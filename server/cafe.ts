import {
	type CafeState,
	ORDERS,
	RESOURCES,
	ROOT,
	type Resource,
	template,
} from './cafe-model'

export interface CafeEnv {
	PLINTH_EMAIL?: string
	PLINTH_PASSWORD?: string
}
const API = 'https://plinth.sh-lucas.dev/v1'
const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const COOKIE = 'cafe_shift'
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
		return plinth<T>(env, path, body, key, false)
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
		name: 'Portfolio night shift',
	})
	for (const id of RESOURCES)
		await plinth(env, '/domains', {
			id: `${ROOT}-${id}`,
			parent: ROOT,
			kind: 'scalar',
			unit: id === 'cash' ? 'credit' : 'unit',
		})
	for (const action of [
		'open',
		'restock',
		'espresso',
		'white',
		'double',
	] as const)
		await plinth(env, '/templates', template(action))
}

const buckets = (shift: string) =>
	Object.fromEntries(
		RESOURCES.map((id) => [id, `cafe-${shift}-${id}`]),
	) as Record<Resource, string>

async function readState(env: CafeEnv, shift: string): Promise<CafeState> {
	const refs = buckets(shift)
	// Derive the counter from the receipt so both reflect the same transactions.
	const { items } = await plinth<{
		items: {
			id: string
			memo?: string
			created_at: string
			postings: { bucket: string; amount: number }[]
		}[]
	}>(env, `/transactions?bucket=${refs.cash}&per_page=100`)
	const history: CafeState['history'] = items
		.map((tx) => ({
			id: tx.id,
			memo: tx.memo ?? 'Ledger operation',
			created_at: tx.created_at,
			postings: tx.postings.flatMap((p) => {
				const resource = RESOURCES.find((id) => refs[id] === p.bucket)
				return resource ? [{ resource, amount: p.amount }] : []
			}),
		}))
		.sort(
			(a, b) =>
				a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
		)
	const balances = { cash: 0, beans: 0, milk: 0, served: 0 }
	for (const tx of history)
		for (const posting of tx.postings)
			balances[posting.resource] += posting.amount
	if (!history.length)
		throw new ApiError(404, 'This shift could not be found. Open a new one.')
	return { shift: shift.slice(0, 8), balances, history }
}

async function execute(
	env: CafeEnv,
	shift: string,
	action: string,
	step: number,
	key: string,
) {
	const order = ORDERS[step]
	const operation =
		action === 'restock'
			? 'restock'
			: order.milk === 0
				? 'espresso'
				: order.beans === 1
					? 'white'
					: 'double'
	return plinth(
		env,
		`/transactions/execute/${ROOT}-${operation}?replay_on_conflict=true`,
		{
			context: { domain: ROOT },
			inputs: { ...buckets(shift), step },
			memo:
				action === 'restock'
					? 'Delivery: 4 coffee + 3 milk'
					: `Order ${step + 1}: ${order.name}`,
		},
		`cafe:${shift}:${key}`,
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
		if (request.method === 'GET')
			return reply({ state: shift ? await readState(env, shift) : null })
		if (request.headers.get('origin') !== url.origin)
			throw new ApiError(403, 'This request must come from the coffee counter.')
		if (!request.headers.get('content-type')?.startsWith('application/json'))
			throw new ApiError(415, 'JSON is required.')
		const text = await request.text()
		if (text.length > 1024) throw new ApiError(413, 'Request too large.')
		let body: { action?: unknown; requestId?: unknown; step?: unknown } | null
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
			!['start', 'serve', 'restock', 'race'].includes(body.action)
		)
			throw new ApiError(400, 'Invalid coffee counter request.')
		if (body.action === 'start') {
			const newShift: string = body.requestId
			const refs = buckets(newShift)
			for (const id of RESOURCES)
				await plinth(env, `/domains/${ROOT}-${id}/buckets`, { id: refs[id] })
			await plinth(
				env,
				`/transactions/execute/${ROOT}-open?replay_on_conflict=true`,
				{
					context: { domain: ROOT },
					inputs: refs,
					memo: 'Opened the counter: 20 credits, 4 coffee, 2 milk',
				},
				`cafe:${newShift}:open`,
			)
			headers.set(
				'Set-Cookie',
				`${COOKIE}=${newShift}; HttpOnly; SameSite=Strict; Path=/api/cafe; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`,
			)
			return reply({ state: await readState(env, newShift) })
		}
		if (!shift) throw new ApiError(400, 'Open a shift first.')
		if (
			typeof body.step !== 'number' ||
			!Number.isInteger(body.step) ||
			body.step < 0 ||
			body.step >= ORDERS.length
		)
			throw new ApiError(400, 'Invalid order.')
		const currentShift = shift
		const step = body.step
		if (body.action === 'race') {
			const results = await Promise.allSettled(
				[0, 1].map((n) =>
					execute(env, currentShift, 'serve', step, `${body.requestId}:${n}`),
				),
			)
			const attempts = results.map((result, n) => ({
				request: n + 1,
				committed:
					result.status === 'fulfilled'
						? true
						: result.reason instanceof ApiError && result.reason.status === 422
							? false
							: null,
				message:
					result.status === 'fulfilled'
						? 'Committed'
						: result.reason instanceof ApiError
							? result.reason.message
							: 'Connection interrupted. Refresh the receipt to check the result.',
			}))
			return reply({
				state: await readState(env, shift),
				attempts,
				retryable: attempts.some((attempt) => attempt.committed === null),
			})
		}
		await execute(env, shift, body.action, body.step, body.requestId)
		return reply({ state: await readState(env, shift) })
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
