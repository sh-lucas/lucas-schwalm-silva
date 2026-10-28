import {
	type Attempt,
	type CafeState,
	MAX_DECISIONS,
	type Offer,
	PREFIX,
	RECIPES,
	RESOURCES,
	ROOT,
	type Resource,
	type RoundSummary,
	bucketRefs,
	offerRef,
	roundStatus,
} from './cafe-model'
import type { CafeRequest } from './cafe-timing'

// The browser talks to Plinth directly. The public token can only run the game templates.
export const config = {
	api: 'https://plinth.sh-lucas.dev/v1',
	token: (import.meta as { env?: Record<string, string> }).env
		?.VITE_PLINTH_TOKEN,
}
const ROUND_KEY = 'cafe-round-v4'
const SECRETS_KEY = 'cafe-secrets-v4'
class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message)
	}
}

async function plinth<T = unknown>(
	path: string,
	body?: unknown,
	key?: string,
): Promise<T> {
	if (!config.token)
		throw new ApiError(
			503,
			'The coffee counter is not connected yet. Please come back later.',
		)
	const response = await fetch(`${config.api}${path}`, {
		method: body === undefined ? 'GET' : 'POST',
		headers: {
			Authorization: `Bearer ${config.token}`,
			...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
			...(key ? { 'Idempotency-Key': key } : {}),
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
		signal: AbortSignal.timeout(15000),
	})
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
const bucketPath = (bucket: string) => encodeURIComponent(bucket)

// The round number is public; the secret proves that this browser opened it.
const roundOf = (requestId: string) =>
	Number.parseInt(requestId.replaceAll('-', '').slice(0, 13), 16) + 1
const secrets = (): Record<string, number> => {
	try {
		return JSON.parse(localStorage.getItem(SECRETS_KEY) ?? '{}')
	} catch {
		return {}
	}
}
function secretFor(round: number) {
	const saved = secrets()
	if (!saved[round]) {
		const [high, low] = crypto.getRandomValues(new Uint32Array(2))
		saved[round] = (high % 2 ** 20) * 2 ** 32 + low + 1
		localStorage.setItem(SECRETS_KEY, JSON.stringify(saved))
	}
	return saved[round]
}
function currentRound() {
	const round = Number(localStorage.getItem(ROUND_KEY))
	return Number.isSafeInteger(round) && round > 0 && secrets()[round]
		? round
		: undefined
}

interface Transaction {
	id: string
	memo?: string
	created_at: string
	metadata?: { request_id?: string }
	postings: { bucket: string; amount: number; sequence: number }[]
}
interface OrderBucket {
	id: string
	attributes: { recipe: number; beans: number; milk: number; price: number }
}
const orderOffer = (
	{ attributes }: OrderBucket,
	slot: number,
	index: number,
): Offer => ({
	...attributes,
	slot,
	index,
	name: RECIPES[attributes.recipe].name,
})
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
	round: number,
	now = Date.now(),
	withOffers = true,
): Promise<CafeState> {
	const refs = bucketRefs(round)
	const prefix = `${PREFIX}orders:${round}:`
	// Cash bounds deliveries (12 orders earn at most 252 credits), so a round stays below 100 operations.
	const [{ items, pagination }, end, orders] = await Promise.all([
		plinth<{ items: Transaction[]; pagination: { has_next: boolean } }>(
			`/transactions?bucket=${bucketPath(refs.journal)}&per_page=100`,
		),
		plinth<{ balance: number }>(`/buckets/${bucketPath(refs.end)}/balance`),
		// A round opens 3 tickets and replaces one per decision: at most 15.
		withOffers
			? plinth<{ items: OrderBucket[] }>(
					`/domains/${ROOT}-orders/buckets?q=${bucketPath(prefix)}&per_page=100`,
				)
			: { items: [] },
	])
	if (pagination.has_next)
		throw new ApiError(503, 'This receipt is too large to read safely.')
	const sequence = (tx: Transaction) =>
		tx.postings.find((posting) => posting.bucket === refs.journal)?.sequence ??
		0
	const transactions = items.sort((a, b) => sequence(a) - sequence(b))
	if (!transactions.length)
		throw new ApiError(404, 'This shift could not be found. Open a new one.')
	// The newest ticket of each counter is the open one.
	const offers: Offer[] = []
	for (const order of orders.items) {
		const [slot, index] = order.id.slice(prefix.length).split(':').map(Number)
		if (!offers[slot] || offers[slot].index < index)
			offers[slot] = orderOffer(order, slot, index)
	}
	if (withOffers && offers.filter(Boolean).length !== 3)
		throw new ApiError(503, 'This shift could not be read safely.')
	const balances = Object.fromEntries(RESOURCES.map((id) => [id, 0])) as Record<
		Resource,
		number
	>
	let finishedAt: string | null = null
	const history = transactions.map((tx) => {
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
	// The deadline was saved by Plinth's own clock when the round opened.
	const deadline = end.balance * 1000
	const status = roundStatus(
		balances.moves,
		balances.served,
		balances.cash,
		deadline,
		now,
		true,
	)
	return {
		shift: String(round).slice(-8),
		mode: 'rush',
		started_at: transactions[0].created_at,
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

async function recentRounds(now: number): Promise<RoundSummary[]> {
	const { items } = await plinth<{ items: Transaction[] }>(
		`/transactions?template=${ROOT}-start&per_page=6`,
	)
	const journal = `${PREFIX}journal:`
	const rounds = await Promise.all(
		items.map((tx) => {
			const bucket = tx.postings.find((p) => p.bucket.startsWith(journal))
			if (!bucket)
				throw new ApiError(503, 'The recent rounds could not be read safely.')
			return readState(Number(bucket.bucket.slice(journal.length)), now, false)
		}),
	)
	return rounds
		.map(summary)
		.sort((a, b) => b.started_at.localeCompare(a.started_at))
}

async function execute(
	round: number,
	action: string,
	slot: number,
	index: number,
	key: string,
) {
	const inputs: Record<string, number> = { round, secret: secretFor(round) }
	let memo: string
	if (action === 'coffee' || action === 'milk')
		memo =
			action === 'coffee'
				? 'Delivery: 3 coffee for 7 credits'
				: 'Delivery: 3 milk for 5 credits'
	else {
		// Plinth rejects the ticket unless these attributes match the stored ones.
		const offer = orderOffer(
			await plinth<OrderBucket>(
				`/buckets/${bucketPath(offerRef(round, slot, index))}`,
			),
			slot,
			index,
		)
		Object.assign(inputs, {
			slot,
			index,
			recipe: offer.recipe,
			beans_needed: offer.beans,
			milk_needed: offer.milk,
			order_price: offer.price,
		})
		memo = `${action === 'discard' ? 'Discarded' : 'Served'}: ${offer.name} (counter ${slot + 1}, ticket ${index + 1})`
	}
	return plinth(
		`/transactions/execute/${ROOT}-${action}?replay_on_conflict=true`,
		{
			context: { domain: `${ROOT}-journal` },
			inputs,
			memo,
			metadata: { request_id: key },
		},
		`cafe4:${round}:${key}`,
	)
}

// Keeps the request and reply shape of the removed server endpoint, so the UI did not change.
export async function cafe(body?: CafeRequest): Promise<Response> {
	const reply = (data: unknown, status = 200) =>
		new Response(JSON.stringify(data), {
			status,
			headers: { 'Content-Type': 'application/json' },
		})
	const result = async (round?: number, extra = {}) => {
		const now = Date.now()
		const [state, recent] = await Promise.all([
			round ? readState(round, now) : Promise.resolve(null),
			recentRounds(now),
		])
		return reply({
			state,
			recent,
			server_now: new Date().toISOString(),
			...extra,
		})
	}
	try {
		const round = currentRound()
		if (!body) return await result(round)
		const requestId = body.requestId
		if (body.action === 'start') {
			const opened = roundOf(requestId)
			await plinth(
				`/transactions/execute/${ROOT}-start?replay_on_conflict=true`,
				{
					context: { domain: `${ROOT}-journal` },
					inputs: { round: opened, secret: secretFor(opened) },
					memo: 'Opened the two-minute rush: 20 credits, 4 coffee, 2 milk.',
				},
				`cafe4:${opened}:open`,
			)
			localStorage.setItem(ROUND_KEY, String(opened))
			return await result(opened)
		}
		if (!round) throw new ApiError(400, 'Open a shift first.')
		const slot = body.slot ?? 0
		const index = body.index ?? 0
		const current = await readState(round)
		// Recover committed retries after closure; Plinth's WITHIN_SHIFT guard refuses late actions.
		if (current.status !== 'active') {
			if (body.action === 'race') {
				const attempts = [0, 1].map((n) => {
					const committed = current.history.some(
						(tx) => tx.request_id === `${requestId}:${n}`,
					)
					return {
						request: n + 1,
						committed,
						message: committed ? 'Committed' : 'Not committed before closure',
					}
				})
				if (attempts.some((attempt) => attempt.committed))
					return await result(round, { attempts })
			} else if (current.history.some((tx) => tx.request_id === requestId))
				return await result(round)
			throw new ApiError(
				422,
				'The two-minute rush has ended. Open a new shift.',
			)
		}
		if (body.action === 'race') {
			const results = await Promise.allSettled(
				[0, 1].map((n) =>
					execute(round, 'serve', slot, index, `${requestId}:${n}`),
				),
			)
			const attempts: Attempt[] = results.map((attempt, n) => ({
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
			return await result(round, {
				attempts,
				retryable: attempts.some((attempt) => attempt.committed === null),
			})
		}
		await execute(round, body.action, slot, index, requestId)
		return await result(round)
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
