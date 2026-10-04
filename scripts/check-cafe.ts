import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { handleCafe } from '../server/cafe'

async function check() {
	const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
	const origin = 'http://localhost:5173'
	let cookie = ''
	async function call(body?: unknown, expected = 200, requestOrigin = origin) {
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
		const result = await response.json()
		assert.equal(response.status, expected, JSON.stringify(result))
		cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie
		return result
	}
	const request = (action: string, step = 0) => ({
		action,
		step,
		requestId: crypto.randomUUID(),
	})
	assert.equal((await call()).state, null)
	await call(request('start'), 403, 'https://another-site.example')
	await call({ action: 'start', requestId: 'invalid' }, 400)
	const opening = request('start')
	let state = (await call(opening)).state
	assert.deepEqual(state.balances, { cash: 20, beans: 4, milk: 2, served: 0 })
	assert.deepEqual(
		(await call(opening)).state,
		state,
		'Opening retry must not issue twice',
	)
	state = (await call(request('serve', 0))).state
	const race = request('race', 1)
	const raced = await call(race)
	assert.equal(
		raced.attempts.filter((r: { committed: boolean | null }) => r.committed)
			.length,
		1,
		'Exactly one simultaneous request must commit',
	)
	assert.deepEqual(raced.state.balances, {
		cash: 35,
		beans: 2,
		milk: 1,
		served: 2,
	})
	await call(request('serve', 1), 422)
	assert.deepEqual(
		(await call(race)).state,
		raced.state,
		'Race retry must not sell another order',
	)
	state = (await call(request('serve', 2))).state
	await call(request('serve', 3), 422)
	assert.deepEqual(
		(await call()).state,
		state,
		'Insufficient stock must roll back every posting',
	)
	const delivery = request('restock', 3)
	state = (await call(delivery)).state
	assert.deepEqual(
		(await call(delivery)).state,
		state,
		'Delivery retry must not charge twice',
	)
	for (const step of [3, 4, 5])
		state = (await call(request('serve', step))).state
	state = (await call(request('restock', 6))).state
	for (const step of [6, 7]) state = (await call(request('serve', step))).state
	assert.deepEqual(state.balances, { cash: 65, beans: 2, milk: 3, served: 8 })
	assert.equal(state.history.length, 11)
	await call(request('serve', 7), 422)
	assert.deepEqual(
		(await call()).state,
		state,
		'Reload must restore the complete receipt',
	)
	const previousCookie = cookie
	assert.equal((await call(request('start'))).state.balances.served, 0)
	cookie = previousCookie
	assert.deepEqual(
		(await call()).state,
		state,
		'New shifts must not rewrite old shifts',
	)
	console.log(
		'Passed against real Plinth: persistence, isolated shifts, atomic rejection, idempotent retries, concurrent order guard, complete 8-order game.',
	)
}
check().catch((error) => {
	console.error(error.message)
	process.exitCode = 1
})
