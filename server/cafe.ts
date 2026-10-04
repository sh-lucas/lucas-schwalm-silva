import {
	ACTIONS,
	type CafeState,
	MAX_DECISIONS,
	type Offer,
	RECIPES,
	RESOURCES,
	ROOT,
	RUSH_SECONDS,
	type Resource,
	type RoundSummary,
	bucketRefs,
	drawOffer,
	offerInputs,
	offerRef,
	openingOperations,
	roundStatus,
	template,
} from './cafe-model'

export interface CafeEnv {
	PLINTH_EMAIL?: string
	PLINTH_PASSWORD?: string
}
const API = 'https://plinth.sh-lucas.dev/v1'
const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const COOKIE = 'cafe_shift_v2'
class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message)
	}
}
let session: { token: string; email: string; password: string } | undefined

async function plinth<T = unknown>(
	env: CafeEnv,
	path: string,
	body?: unknown,
	key?: string,
	retry = true,
	submitBy = Number.POSITIVE_INFINITY,
): Promise<T> {
	if (!env.PLINTH_EMAIL || !env.PLINTH_PASSWORD)
		throw new ApiError(
			503,
			'The coffee counter is not connected yet. Please come back later.',
		)
	if (
		!session ||
		session.email !== env.PLINTH_EMAIL ||
		session.password !== env.PLINTH_PASSWORD
	) {
		const login = await fetch(`${API}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: env.PLINTH_EMAIL,
				password: env.PLINTH_PASSWORD,
			}),
			signal: AbortSignal.timeout(15000),
		})
		if (!login.ok)
			throw new ApiError(
				503,
				'The coffee counter could not connect to its ledger.',
			)
		const data = (await login.json()) as { token: string }
		session = {
			token: data.token,
			email: env.PLINTH_EMAIL,
			password: env.PLINTH_PASSWORD,
		}
	}
	if (Date.now() >= submitBy)
		throw new ApiError(422, 'The two-minute rush has ended. Open a new shift.')
	const response = await fetch(`${API}${path}`, {
		method: body === undefined ? 'GET' : 'POST',
		headers: {
			Authorization: `Bearer ${session.token}`,
			'Content-Type': 'application/json',
			...(key ? { 'Idempotency-Key': key } : {}),
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
		signal: AbortSignal.timeout(15000),
	})
	if (response.status === 401 && retry) {
		session = undefined
		return plinth<T>(env, path, body, key, false, submitBy)
	}
	const data = await response.json()
	if (!response.ok)
		throw new ApiError(
			response.status,
			response.status === 422
				? (data as { message: string }).message
				: 'The ledger could not complete this request. Retry safely with the same request.',
		)
	return data as T
}

export async function setupCafe(env: CafeEnv) {
	await plinth(env, '/domains', {
		id: ROOT,
		kind: 'organizational',
		name: 'Portfolio night shift: three choices',
	})
	for (const id of [...RESOURCES, 'orders'])
		await plinth(env, '/domains', {
			id: `${ROOT}-${id}`,
			parent: ROOT,
			kind: 'scalar',
			unit: id === 'cash' ? 'credit' : 'unit',
		})
	for (const action of [
		...ACTIONS.filter((action) => action !== 'race'),
		'counters',
		'offers',
	] as const)
		await plinth(env, '/templates', template(action))
}

interface Transaction {
	id: string
	memo?: string
	created_at: string
	inputs: Record<string, string | number>
	metadata?: {
		slot?: number
		index?: number
		game?: string
		request_id?: string
	}
	postings: { bucket: string; amount: number; sequence: number }[]
}
function persistedOffer(
	inputs: Transaction['inputs'],
	prefix: string,
	slot: number,
	index: number,
): Offer {
	const recipe = Number(inputs[`${prefix}_recipe`])
	return {
		slot,
		index,
		recipe,
		name: RECIPES[recipe].name,
		beans: Number(inputs[`${prefix}_beans`]),
		milk: Number(inputs[`${prefix}_milk`]),
		price: Number(inputs[`${prefix}_price`]),
	}
}
const summary = ({
	shift,
	mode,
	started_at,
	expires_at,
	ended_at,
	status,
	cash,
	served,
	discarded,
}: CafeState): RoundSummary => ({
	shift,
	mode,
	started_at,
	expires_at,
	ended_at,
	status,
	cash,
	served,
	discarded,
})

async function readState(
	env: CafeEnv,
	shift: string,
	now = Date.now(),
): Promise<CafeState> {
	const refs = bucketRefs(shift)
	// 12 decisions and bounded paid deliveries keep a round below 100 operations.
	const [{ items, pagination }, { attributes }] = await Promise.all([
		plinth<{ items: Transaction[]; pagination: { has_next: boolean } }>(
			env,
			`/transactions?bucket=${refs.journal}&per_page=100`,
		),
		plinth<{ attributes: { started_at: number; deadline: number } }>(
			env,
			`/buckets/${refs.journal}`,
		),
	])
	if (pagination.has_next)
		throw new ApiError(503, 'This receipt is too large to read safely.')
	const sequence = (tx: Transaction) =>
		tx.postings.find((posting) => posting.bucket === refs.journal)?.sequence ??
		0
	const transactions = items.sort((a, b) => sequence(a) - sequence(b))
	if (!transactions.length)
		throw new ApiError(404, 'This shift could not be found. Open a new one.')
	const opening = transactions.find(
		(tx) => typeof tx.inputs.journal_reference === 'string',
	)
	const initialOffers = transactions.find(
		(tx) => tx.inputs.offer_0_recipe !== undefined,
	)
	if (!opening || !initialOffers)
		throw new ApiError(503, 'This shift could not be read safely.')
	const offers = [0, 1, 2].map((slot) =>
		persistedOffer(initialOffers.inputs, `offer_${slot}`, slot, 0),
	)
	const balances = Object.fromEntries(RESOURCES.map((id) => [id, 0])) as Record<
		Resource,
		number
	>
	let finishedAt: string | null = null
	const history = transactions.map((tx) => {
		if (tx.metadata?.slot !== undefined && tx.metadata.index !== undefined) {
			const { slot, index } = tx.metadata
			offers[slot] = persistedOffer(tx.inputs, 'next', slot, index + 1)
		}
		const postings = tx.postings.flatMap((p) => {
			const resource = RESOURCES.find((id) => refs[id] === p.bucket)
			return resource ? [{ resource, amount: p.amount }] : []
		})
		for (const posting of postings) balances[posting.resource] += posting.amount
		if (balances.moves === MAX_DECISIONS && !finishedAt)
			finishedAt = tx.created_at
		return {
			id: tx.id,
			request_id: tx.metadata?.request_id,
			memo: tx.memo ?? 'Ledger operation',
			created_at: tx.created_at,
			postings: postings.filter((p) => p.resource !== 'journal'),
		}
	})
	// The deadline is an immutable attribute computed by Plinth's server clock.
	const rush = opening.metadata?.game === 'rush-v1'
	const deadline = rush
		? Math.min(attributes.deadline, attributes.started_at + RUSH_SECONDS) * 1000
		: attributes.deadline * 1000
	const status = roundStatus(
		balances.moves,
		balances.served,
		balances.cash,
		deadline,
		now,
		rush,
	)
	return {
		shift: shift.slice(0, 8),
		mode: rush ? 'rush' : 'classic',
		started_at: opening.created_at,
		expires_at: new Date(deadline).toISOString(),
		ended_at:
			finishedAt ??
			(status !== 'active' ? new Date(deadline).toISOString() : null),
		status,
		cash: balances.cash,
		served: balances.served,
		discarded: balances.discarded,
		balances,
		offers,
		history,
	}
}

async function recentRounds(
	env: CafeEnv,
	now: number,
): Promise<RoundSummary[]> {
	const { items } = await plinth<{ items: Transaction[] }>(
		env,
		`/transactions?template=${ROOT}-start&per_page=6`,
	)
	const rounds = await Promise.all(
		items.map((tx) => {
			const ref = String(tx.inputs.journal_reference)
			const shift = ref.slice('cafe2-'.length, -'-journal'.length)
			if (!UUID.test(shift))
				throw new ApiError(503, 'The recent rounds could not be read safely.')
			return readState(env, shift, now)
		}),
	)
	return rounds
		.map(summary)
		.sort((a, b) => b.started_at.localeCompare(a.started_at))
}

async function execute(
	env: CafeEnv,
	shift: string,
	action: string,
	slot: number,
	index: number,
	key: string,
	deadline = Number.POSITIVE_INFINITY,
) {
	const inputs: Record<string, string | number> = bucketRefs(shift)
	let memo: string
	if (action === 'coffee' || action === 'milk')
		memo =
			action === 'coffee'
				? 'Delivery: 3 coffee for 7 credits'
				: 'Delivery: 3 milk for 5 credits'
	else {
		const offer = await drawOffer(shift, slot, index)
		Object.assign(
			inputs,
			{ order: offerRef(shift, slot, index) },
			offerInputs(shift, await drawOffer(shift, slot, index + 1), 'next'),
		)
		memo = `${action === 'discard' ? 'Discarded' : 'Served'}: ${offer.name} (counter ${slot + 1}, ticket ${index + 1})`
	}
	return plinth(
		env,
		`/transactions/execute/${ROOT}-${action}?replay_on_conflict=true`,
		{
			context: { domain: ROOT },
			inputs,
			memo,
			metadata: {
				request_id: key,
				...(action === 'serve' || action === 'discard' ? { slot, index } : {}),
			},
		},
		`cafe2:${shift}:${key}`,
		true,
		deadline,
	)
}

export async function handleCafe(
	request: Request,
	env: CafeEnv,
): Promise<Response> {
	const headers = new Headers({
		'Content-Type': 'application/json',
		'Cache-Control': 'no-store',
	})
	const reply = (data: unknown, status = 200) =>
		new Response(JSON.stringify(data), { status, headers })
	const result = async (shift?: string, extra = {}) => {
		const now = Date.now()
		const [state, recent] = await Promise.all([
			shift ? readState(env, shift, now) : Promise.resolve(null),
			recentRounds(env, now),
		])
		return reply({
			state,
			recent,
			server_now: new Date().toISOString(),
			...extra,
		})
	}
	try {
		const url = new URL(request.url)
		if (!['GET', 'POST'].includes(request.method)) {
			headers.set('Allow', 'GET, POST')
			return reply({ error: 'Method not allowed.' }, 405)
		}
		let shift = request.headers
			.get('cookie')
			?.split(';')
			.map((v) => v.trim())
			.find((v) => v.startsWith(`${COOKIE}=`))
			?.slice(COOKIE.length + 1)
		if (shift && !UUID.test(shift)) shift = undefined
		if (request.method === 'GET') return await result(shift)
		if (request.headers.get('origin') !== url.origin)
			throw new ApiError(403, 'This request must come from the coffee counter.')
		if (!request.headers.get('content-type')?.startsWith('application/json'))
			throw new ApiError(415, 'JSON is required.')
		const text = await request.text()
		if (text.length > 1024) throw new ApiError(413, 'Request too large.')
		let body: {
			action?: unknown
			requestId?: unknown
			slot?: unknown
			index?: unknown
		} | null
		try {
			body = JSON.parse(text)
		} catch {
			throw new ApiError(400, 'Invalid JSON.')
		}
		if (
			!body ||
			typeof body.requestId !== 'string' ||
			typeof body.action !== 'string' ||
			!UUID.test(body.requestId) ||
			!ACTIONS.some((action) => action === body.action)
		)
			throw new ApiError(400, 'Invalid coffee counter request.')
		if (body.action === 'start') {
			const newShift = body.requestId
			const offers = await Promise.all(
				[0, 1, 2].map((slot) => drawOffer(newShift, slot, 0)),
			)
			try {
				await plinth(
					env,
					'/transactions/batch',
					{ operations: openingOperations(newShift, offers, true) },
					`cafe2:${newShift}:open`,
				)
			} catch (error) {
				// Batch retries return 409; an existing complete receipt confirms the atomic opening.
				if (!(error instanceof ApiError) || error.status !== 409) throw error
				try {
					await readState(env, newShift)
				} catch {
					throw error
				}
			}
			headers.set(
				'Set-Cookie',
				`${COOKIE}=${newShift}; HttpOnly; SameSite=Strict; Path=/api/cafe; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`,
			)
			return await result(newShift)
		}
		if (!shift) throw new ApiError(400, 'Open a shift first.')
		const currentShift = shift
		const slot = body.slot
		const index = body.index
		if (
			['serve', 'discard', 'race'].includes(body.action) &&
			(typeof slot !== 'number' ||
				!Number.isInteger(slot) ||
				slot < 0 ||
				slot > 2 ||
				typeof index !== 'number' ||
				!Number.isInteger(index) ||
				index < 0 ||
				index > MAX_DECISIONS)
		)
			throw new ApiError(400, 'Invalid order selection.')
		const selectedSlot = typeof slot === 'number' ? slot : 0
		const selectedIndex = typeof index === 'number' ? index : 0
		const current = await readState(env, shift)
		// Recover committed retries even after closure; never apply a new late action.
		const deadline =
			current.mode === 'rush'
				? Date.parse(current.expires_at)
				: Number.POSITIVE_INFINITY
		if (
			current.mode === 'rush' &&
			(current.status !== 'active' || Date.now() >= deadline)
		) {
			if (body.action === 'race') {
				const attempts = [0, 1].map((n) => {
					const committed = current.history.some(
						(tx) => tx.request_id === `${body.requestId}:${n}`,
					)
					return {
						request: n + 1,
						committed,
						message: committed ? 'Committed' : 'Not committed before closure',
					}
				})
				if (attempts.some((attempt) => attempt.committed))
					return await result(shift, { attempts })
			} else if (current.history.some((tx) => tx.request_id === body.requestId))
				return await result(shift)
			throw new ApiError(
				422,
				'The two-minute rush has ended. Open a new shift.',
			)
		}
		if (body.action === 'race') {
			const results = await Promise.allSettled(
				[0, 1].map((n) =>
					execute(
						env,
						currentShift,
						'serve',
						selectedSlot,
						selectedIndex,
						`${body.requestId}:${n}`,
						deadline,
					),
				),
			)
			const attempts = results.map((attempt, n) => ({
				request: n + 1,
				committed:
					attempt.status === 'fulfilled'
						? true
						: attempt.reason instanceof ApiError &&
								attempt.reason.status === 422
							? false
							: null,
				message:
					attempt.status === 'fulfilled'
						? 'Committed'
						: attempt.reason instanceof ApiError
							? attempt.reason.message
							: 'Connection interrupted. Refresh the receipt to check the result.',
			}))
			return await result(shift, {
				attempts,
				retryable: attempts.some((attempt) => attempt.committed === null),
			})
		}
		await execute(
			env,
			shift,
			body.action,
			selectedSlot,
			selectedIndex,
			body.requestId,
			deadline,
		)
		return await result(shift)
	} catch (error) {
		return reply(
			{
				error:
					error instanceof ApiError
						? error.message
						: 'Connection interrupted. Retry with the same request or refresh the receipt.',
				retryable:
					!(error instanceof ApiError) ||
					error.status >= 500 ||
					error.status === 429 ||
					error.status === 409,
			},
			error instanceof ApiError ? error.status : 503,
		)
	}
}
