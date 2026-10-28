export const RECIPES = [
	{ name: 'Espresso', beans: 1, milk: 0, price: 6 },
	{ name: 'Flat white', beans: 1, milk: 1, price: 9 },
	{ name: 'Double espresso', beans: 2, milk: 0, price: 11 },
	{ name: 'Latte', beans: 1, milk: 2, price: 11 },
	{ name: 'Two coffees, one with milk', beans: 2, milk: 1, price: 14 },
	{ name: 'Milk for the whole desk', beans: 2, milk: 3, price: 18 },
] as const
export const ROOT = 'portfolio-cafe-v4'
export const RUSH_SECONDS = 2 * 60
export const MAX_DECISIONS = 12
export const TARGET_CASH = 50
export const TARGET_SERVED = 8
export const RESOURCES = [
	'cash',
	'beans',
	'milk',
	'served',
	'discarded',
	'moves',
	'journal',
] as const
export type Resource = (typeof RESOURCES)[number]
export type Action = 'start' | 'serve' | 'discard' | 'coffee' | 'milk' | 'race'
export const ACTIONS: Action[] = [
	'start',
	'serve',
	'discard',
	'coffee',
	'milk',
	'race',
]
type RoundStatus = 'active' | 'won' | 'lost' | 'expired' | 'finished'
export interface Offer {
	slot: number
	index: number
	recipe: number
	name: string
	beans: number
	milk: number
	price: number
}
export interface RoundSummary {
	shift: string
	mode: 'classic' | 'rush'
	started_at: string
	expires_at: string
	ended_at: string | null
	status: RoundStatus
	cash: number
	served: number
	discarded: number
}
export interface CafeState extends RoundSummary {
	balances: Record<Resource, number>
	offers: Offer[]
	history: {
		id: string
		request_id?: string
		memo: string
		created_at: string
		postings: { resource: Resource; amount: number }[]
	}[]
}
export interface Attempt {
	request: number
	committed: boolean | null
	message: string
}
export interface CafeResponse {
	state: CafeState | null
	recent: RoundSummary[]
	server_now: string
	attempts?: Attempt[]
	error?: string
	retryable?: boolean
}

export function roundStatus(
	moves: number,
	served: number,
	cash: number,
	deadline: number,
	now: number,
	rush = false,
): RoundStatus {
	if (rush)
		return moves >= MAX_DECISIONS || now >= deadline ? 'finished' : 'active'
	if (moves >= MAX_DECISIONS)
		return served >= TARGET_SERVED && cash >= TARGET_CASH ? 'won' : 'lost'
	return now >= deadline ? 'expired' : 'active'
}

// Every round bucket is named `c4<resource>:<round>`; Plinth composes the name from the round input.
export const PREFIX = 'c4'
export const bucketRefs = (round: number) =>
	Object.fromEntries(
		[...RESOURCES, 'end'].map((id) => [id, `${PREFIX}${id}:${round}`]),
	) as Record<Resource | 'end', string>
export const offerRef = (round: number, slot: number, index: number) =>
	`${PREFIX}orders:${round}:${slot}:${index}`
// `keys` holds each round's secret. It stays outside the public grant.
export const PUBLIC_DOMAINS = [...RESOURCES, 'end', 'orders'].map(
	(id) => `${ROOT}-${id}`,
)
