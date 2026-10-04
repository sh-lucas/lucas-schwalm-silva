import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { handleCafe } from '../server/cafe'
import {
	type CafeResponse,
	type CafeState,
	MAX_DECISIONS,
	type Offer,
	ROOT,
	RUSH_SECONDS,
	drawOffer,
	openingOperations,
	roundStatus,
} from '../server/cafe-model'

async function check() {
	const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
	const origin = 'http://localhost:5173'
	let cookie = ''
	async function call(
		body?: unknown,
		expected: number | number[] = 200,
		requestOrigin = origin,
	): Promise<CafeResponse> {
		const response = await handleCafe(
			new Request(`${origin}/api/cafe`, {
				method: body === undefined ? 'GET' : 'POST',
				headers: {
					cookie,
					Origin: requestOrigin,
					'Content-Type': 'application/json',
				},
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
			}),
			env,
		)
		const result: CafeResponse = await response.json()
		assert.ok(
			(Array.isArray(expected) ? expected : [expected]).includes(
				response.status,
			),
			`${response.status} (${typeof body === 'object' && body && 'action' in body ? body.action : 'GET'}): ${JSON.stringify(result)}`,
		)
		cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie
		return result
	}
	const request = (action: string, offer?: Offer) => ({
		action,
		requestId: crypto.randomUUID(),
		...(offer ? { slot: offer.slot, index: offer.index } : {}),
	})
	const stateOf = (data: CafeResponse) => {
		assert.ok(data.state)
		return data.state
	}
	assert.equal(roundStatus(0, 0, 20, 1000, 999), 'active')
	assert.equal(roundStatus(0, 0, 20, 1000, 1000), 'expired')
	assert.equal(roundStatus(12, 8, 50, 1000, 2000), 'won')
	assert.equal(roundStatus(12, 7, 100, 1000, 2000), 'lost')
	assert.equal(roundStatus(0, 0, 20, 1000, 999, true), 'active')
	assert.equal(roundStatus(0, 0, 20, 1000, 1000, true), 'finished')
	assert.equal(roundStatus(12, 0, 20, 1000, 999, true), 'finished')
	await call(request('start'), 403, 'https://another-site.example')
	await call({ action: 'start', requestId: 'invalid' }, 400)
	const opening = request('start')
	let state = stateOf(await call(opening))
	assert.deepEqual(state.balances, {
		cash: 20,
		beans: 4,
		milk: 2,
		served: 0,
		discarded: 0,
		moves: 0,
		journal: 3,
	})
	assert.equal(state.offers.length, 3)
	assert.deepEqual(
		stateOf(await call(opening)),
		state,
		'Opening replay must recover the same atomic batch',
	)
	assert.equal(
		Date.parse(state.expires_at) -
			Math.floor(Date.parse(state.started_at) / 1000) * 1000,
		RUSH_SECONDS * 1000,
	)
	assert.equal(state.mode, 'rush')
	assert.equal(
		(await call()).recent[0].shift,
		state.shift,
		'Public history must start with the newest round',
	)
	await call(request('milk'))
	state = stateOf(await call(request('milk')))
	await call(request('milk'), 422)
	const affordable = (s: CafeState, offer: Offer) =>
		s.balances.beans >= offer.beans && s.balances.milk >= offer.milk
	const first = state.offers.find((o) => affordable(state, o))
	assert.ok(first)
	const race = request('race', first)
	const raced = await call(race)
	assert.equal(
		raced.attempts?.filter((r) => r.committed).length,
		1,
		'Only one simultaneous serve may consume a ticket',
	)
	state = stateOf(raced)
	assert.equal(state.served, 1)
	assert.equal(state.balances.moves, 1)
	assert.deepEqual(
		stateOf(await call(race)),
		state,
		'Race replay must not consume the replacement ticket',
	)
	await call(request('discard', first), 422)
	assert.deepEqual(
		stateOf(await call()),
		state,
		'Stale ticket rejection must not change stock or credits',
	)
	const discarded = request('discard', state.offers[0])
	state = stateOf(await call(discarded))
	assert.equal(state.discarded, 1)
	assert.deepEqual(
		stateOf(await call(discarded)),
		state,
		'Discard replay must not cost another decision',
	)
	assert.equal(state.offers[0].index, (discarded.index ?? 0) + 1)
	const tooLarge = { ...request('serve'), slot: 3, index: 0 }
	await call(tooLarge, 400)
	while (state.balances.moves < MAX_DECISIONS - 1) {
		const offer = state.offers.find((o) => affordable(state, o))
		if (offer) state = stateOf(await call(request('serve', offer)))
		else {
			const target = [...state.offers].sort(
				(a, b) => a.beans + a.milk - (b.beans + b.milk),
			)[0]
			const action = state.balances.beans < target.beans ? 'coffee' : 'milk'
			const delivery = request(action)
			state = stateOf(await call(delivery))
			assert.deepEqual(
				stateOf(await call(delivery)),
				state,
				'Delivery replay must not charge twice',
			)
		}
	}
	const finalOffers = state.offers.slice(0, 2)
	for (const resource of ['beans', 'milk'] as const) {
		while (
			state.balances[resource] <
			Math.max(...finalOffers.map((offer) => offer[resource]))
		)
			state = stateOf(
				await call(request(resource === 'beans' ? 'coffee' : 'milk')),
			)
	}
	const lastDecisions = await Promise.all(
		finalOffers.map((offer) => call(request('serve', offer), [200, 422])),
	)
	assert.equal(
		lastDecisions.filter((result) => result.state).length,
		1,
		'Concurrent different tickets must not exceed twelve decisions',
	)
	state = stateOf(await call())
	assert.equal(state.served, 11)
	assert.equal(state.discarded, 1)
	assert.ok(state.cash >= 50)
	assert.equal(state.status, 'finished')
	await call(request('serve', state.offers[0]), 422)
	await call(request('coffee'), 422)
	assert.deepEqual(
		stateOf(await call()),
		state,
		'Reload must restore a complete round',
	)
	const finishedCookie = cookie
	assert.deepEqual(
		stateOf(await call(discarded)),
		state,
		'A committed retry must remain safe after closure',
	)
	assert.deepEqual(
		stateOf(await call(race)),
		state,
		'A race retry must remain safe after closure',
	)
	const originalNow = Date.now
	try {
		Date.now = () => originalNow() + RUSH_SECONDS * 1000 + 1000
		state = stateOf(await call())
		assert.deepEqual(stateOf(await call(discarded)), state)
		await call(request('coffee'), 422)
	} finally {
		Date.now = originalNow
	}
	for (let n = 0; n < 6; n++) await call(request('start'))
	const active = stateOf(await call())
	try {
		Date.now = () => originalNow() + RUSH_SECONDS * 1000 + 1000
		const timedOut = stateOf(await call())
		assert.equal(timedOut.status, 'finished')
		assert.equal(timedOut.ended_at, timedOut.expires_at)
		for (const action of ['serve', 'discard', 'race', 'coffee', 'milk'])
			await call(request(action, active.offers[0]), 422)
		assert.equal(stateOf(await call()).history.length, active.history.length)
	} finally {
		Date.now = originalNow
	}
	const recent = (await call()).recent
	assert.equal(recent.length, 6)
	assert.ok(
		!recent.some((round) => round.shift === state.shift),
		'History must show the newest six, not the oldest six',
	)
	assert.ok(
		!JSON.stringify(recent).includes(opening.requestId),
		'Public history must not disclose cookie capabilities',
	)
	cookie = finishedCookie
	assert.deepEqual(
		stateOf(await call()),
		state,
		'New rounds must not rewrite old receipts',
	)

	// A zero-duration copy exercises the real server-clock guard without a 15-minute wait.
	const login = await fetch('https://plinth.sh-lucas.dev/v1/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: env.PLINTH_EMAIL,
			password: env.PLINTH_PASSWORD,
		}),
	})
	assert.ok(login.ok)
	const { token } = (await login.json()) as { token: string }
	async function api(path: string, body: unknown, key?: string) {
		const res = await fetch(`https://plinth.sh-lucas.dev/v1${path}`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
				...(key ? { 'Idempotency-Key': key } : {}),
			},
			body: JSON.stringify(body),
		})
		assert.ok(res.ok, `${path}: ${res.status} ${await res.text()}`)
	}
	// Reuse the existing clock fixture; this check does not publish templates.
	const expiredId = crypto.randomUUID()
	const offers = await Promise.all(
		[0, 1, 2].map((slot) => drawOffer(expiredId, slot, 0)),
	)
	const operations = openingOperations(expiredId, offers)
	operations[0].template = `${ROOT}-expiry-check`
	await api('/transactions/batch', { operations }, `cafe2:${expiredId}:open`)
	cookie = `cafe_shift_v2=${expiredId}`
	const expired = stateOf(await call())
	assert.equal(expired.status, 'expired')
	assert.equal(expired.mode, 'classic')
	await call(
		{
			...request('serve', expired.offers[0]),
			client_now: 0,
			deadline: Date.now() + 99999999,
		},
		422,
	)
	await call(request('discard', expired.offers[0]), 422)
	await call(request('coffee'), 422)
	await call(request('milk'), 422)
	assert.deepEqual(
		stateOf(await call()),
		expired,
		'Expired rounds must remain unchanged for every action',
	)
	console.log(
		'Passed against real Plinth: rush metadata and two-minute expiry, closed-round retries, three persistent choices, atomic opening, single-use tickets, pantry capacity, twelve-decision closure, newest six public rounds, and original server-clock expiry. No templates published.',
	)
}
check().catch((error) => {
	console.error(error.message)
	process.exitCode = 1
})
