export const RECIPES = [
	{ name: 'Espresso', beans: 1, milk: 0, price: 6 },
	{ name: 'Flat white', beans: 1, milk: 1, price: 9 },
	{ name: 'Double espresso', beans: 2, milk: 0, price: 11 },
	{ name: 'Latte', beans: 1, milk: 2, price: 11 },
	{ name: 'Two coffees, one with milk', beans: 2, milk: 1, price: 14 },
	{ name: 'Milk for the whole desk', beans: 2, milk: 3, price: 18 },
] as const
export const ROOT = 'portfolio-cafe-v2'
export const ROUND_SECONDS = 15 * 60
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
export type RoundStatus = 'active' | 'won' | 'lost' | 'expired'
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
): RoundStatus {
	if (moves >= MAX_DECISIONS)
		return served >= TARGET_SERVED && cash >= TARGET_CASH ? 'won' : 'lost'
	return now >= deadline ? 'expired' : 'active'
}

export async function drawOffer(
	shift: string,
	slot: number,
	index: number,
): Promise<Offer> {
	const digest = new Uint8Array(
		await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(`${shift}:${slot}:${index}`),
		),
	)
	const recipe = digest[0] % RECIPES.length
	return {
		...RECIPES[recipe],
		price: RECIPES[recipe].price + (digest[1] % 4),
		slot,
		index,
		recipe,
	}
}
export const bucketRefs = (shift: string) =>
	Object.fromEntries(
		RESOURCES.map((id) => [id, `cafe2-${shift}-${id}`]),
	) as Record<Resource, string>
export const offerRef = (shift: string, slot: number, index: number) =>
	`cafe2-${shift}-o-${slot}-${index}`
export function offerInputs(shift: string, offer: Offer, prefix: string) {
	return {
		[`${prefix}_reference`]: offerRef(shift, offer.slot, offer.index),
		[`${prefix}_recipe`]: offer.recipe,
		[`${prefix}_beans`]: offer.beans,
		[`${prefix}_milk`]: offer.milk,
		[`${prefix}_price`]: offer.price,
	}
}

type Node = Record<string, unknown>
const value = (id: string, amount: number): Node => ({
	op: 'value',
	id,
	value_type: 'integer',
	value: amount,
})
const input = (
	id: string,
	value_type: string,
	min?: number,
	max?: number,
): Node => ({
	op: 'input',
	id,
	value_type,
	...(min === undefined ? {} : { min, max }),
})
const balance = (id: string, bucket: string): Node => ({
	op: 'balance',
	id,
	scope: { bucket },
})
const attribute = (id: string, bucket: string, key: string): Node => ({
	op: 'attribute',
	id,
	bucket,
	key,
})
const post = (
	id: string,
	bucket: string,
	amount: string,
	direction = 'in',
): Node => ({ op: 'post', id, bucket, amount, direction })
const guard = (
	id: string,
	left: string,
	operator: string,
	right: string,
	message: string,
): Node[] => [
	{ op: 'compare', id: `${id}_check`, left, operator, right },
	{
		op: 'require',
		id,
		condition: `${id}_check`,
		code: id.toUpperCase(),
		message,
	},
]
function provisionOffer(prefix: string): Node[] {
	return [
		input(`${prefix}_reference`, 'reference'),
		input(`${prefix}_recipe`, 'integer', 0, RECIPES.length - 1),
		input(`${prefix}_beans`, 'integer', 1, 2),
		input(`${prefix}_milk`, 'integer', 0, 3),
		input(`${prefix}_price`, 'integer', 6, 21),
		{
			op: 'provision',
			id: prefix,
			scope: { domain: `${ROOT}-orders` },
			reference: {
				from: 'input',
				node: `${prefix}_reference`,
				on_conflict: 'fail',
			},
			attributes: {
				recipe: `${prefix}_recipe`,
				beans: `${prefix}_beans`,
				milk: `${prefix}_milk`,
				price: `${prefix}_price`,
			},
		},
		post(`${prefix}_open`, prefix, 'one'),
	]
}
export function template(
	action: Exclude<Action, 'race'> | 'counters' | 'offers',
) {
	const nodes: Node[] = [
		value('one', 1),
		value('zero', 0),
		{ op: 'clock', id: 'now', source: 'created_at', unit: 'second' },
	]
	if (action === 'start') {
		nodes.push(value('duration', ROUND_SECONDS), {
			op: 'math',
			id: 'deadline',
			operator: 'add',
			left: 'now',
			right: 'duration',
		})
		for (const id of ['journal', 'cash', 'beans', 'milk'])
			nodes.push(input(`${id}_reference`, 'reference'), {
				op: 'provision',
				id,
				scope: { domain: `${ROOT}-${id}` },
				reference: {
					from: 'input',
					node: `${id}_reference`,
					on_conflict: 'fail',
				},
				attributes:
					id === 'journal' ? { started_at: 'now', deadline: 'deadline' } : {},
			})
		for (const [id, amount] of [
			['cash', 20],
			['beans', 4],
			['milk', 2],
		] as const)
			nodes.push(
				value(`${id}_amount`, amount),
				post(`${id}_opening`, id, `${id}_amount`),
			)
	} else if (action === 'counters') {
		nodes.push(input('journal', 'bucket'))
		for (const id of ['served', 'discarded', 'moves'])
			nodes.push(input(`${id}_reference`, 'reference'), {
				op: 'provision',
				id,
				scope: { domain: `${ROOT}-${id}` },
				reference: {
					from: 'input',
					node: `${id}_reference`,
					on_conflict: 'fail',
				},
				attributes: {},
			})
	} else if (action === 'offers') {
		nodes.push(input('journal', 'bucket'))
		for (const slot of [0, 1, 2]) nodes.push(...provisionOffer(`offer_${slot}`))
	} else {
		nodes.push(
			...RESOURCES.map((id) => input(id, 'bucket')),
			attribute('deadline', 'journal', 'deadline'),
		)
		nodes.push(
			...guard(
				'within_shift',
				'now',
				'lt',
				'deadline',
				'This shift has reached its 15-minute deadline.',
			),
		)
		nodes.push(
			balance('decisions', 'moves'),
			value('limit', MAX_DECISIONS),
			...guard(
				'shift_open',
				'decisions',
				'lt',
				'limit',
				'This shift is already complete.',
			),
		)
		if (action === 'coffee' || action === 'milk') {
			const resource = action === 'coffee' ? 'beans' : 'milk'
			nodes.push(
				value('cost', action === 'coffee' ? 7 : 5),
				value('quantity', 3),
				value('capacity_before', action === 'coffee' ? 7 : 5),
				balance('available_cash', 'cash'),
				balance('pantry', resource),
			)
			nodes.push(
				...guard(
					'enough_cash',
					'available_cash',
					'gte',
					'cost',
					'Not enough credits for this delivery.',
				),
				...guard(
					'pantry_space',
					'pantry',
					'lte',
					'capacity_before',
					'The pantry has no room for this delivery.',
				),
			)
			nodes.push(
				post('pay_delivery', 'cash', 'cost', 'out'),
				post('receive_delivery', resource, 'quantity'),
			)
		} else {
			nodes.push(
				input('order', 'bucket'),
				balance('ticket_available', 'order'),
				...guard(
					'order_available',
					'ticket_available',
					'eq',
					'one',
					'This order was already served or discarded.',
				),
			)
			if (action === 'serve') {
				for (const id of ['beans', 'milk'] as const)
					nodes.push(
						attribute(`${id}_needed`, 'order', id),
						balance(`${id}_available`, id),
						...guard(
							`enough_${id}`,
							`${id}_available`,
							'gte',
							`${id}_needed`,
							`Not enough ${id} for this order.`,
						),
						{
							op: 'compare',
							id: `${id}_used`,
							left: `${id}_needed`,
							operator: 'gt',
							right: 'zero',
						},
						{
							...post(`${id}_consume`, id, `${id}_needed`, 'out'),
							when: `${id}_used`,
						},
					)
				nodes.push(
					attribute('order_price', 'order', 'price'),
					post('receive_payment', 'cash', 'order_price'),
					post('count_served', 'served', 'one'),
				)
			} else nodes.push(post('count_discarded', 'discarded', 'one'))
			nodes.push(
				post('close_ticket', 'order', 'one', 'out'),
				post('count_decision', 'moves', 'one'),
				...provisionOffer('next'),
			)
		}
	}
	nodes.push(post('record_operation', 'journal', 'one'))
	return {
		id: `${ROOT}-${action}`,
		domain: ROOT,
		name: `Night shift: ${action}`,
		nodes,
	}
}

export function openingOperations(shift: string, offers: Offer[]) {
	const refs = bucketRefs(shift)
	const context = { domain: ROOT }
	const referenceInputs = (resources: string[]) =>
		Object.fromEntries(
			resources.map((id) => [`${id}_reference`, refs[id as Resource]]),
		)
	const initialOffers: Record<string, string | number> = {
		journal: refs.journal,
	}
	for (const offer of offers)
		Object.assign(
			initialOffers,
			offerInputs(shift, offer, `offer_${offer.slot}`),
		)
	return [
		{
			template: `${ROOT}-start`,
			context,
			inputs: referenceInputs(['journal', 'cash', 'beans', 'milk']),
			memo: 'Opened the counter: 20 credits, 4 coffee, 2 milk. Deadline: 15 minutes.',
		},
		{
			template: `${ROOT}-counters`,
			context,
			inputs: {
				...referenceInputs(['served', 'discarded', 'moves']),
				journal: refs.journal,
			},
			memo: 'Twelve opportunities to serve at least eight orders.',
		},
		{
			template: `${ROOT}-offers`,
			context,
			inputs: initialOffers,
			memo: 'The first three orders are on the counter.',
		},
	]
}
