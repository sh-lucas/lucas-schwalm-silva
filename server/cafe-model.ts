export const ORDERS = [
	{ name: 'Espresso', beans: 1, milk: 0, price: 6 },
	{ name: 'Flat white', beans: 1, milk: 1, price: 9 },
	{ name: 'Two coffees, one with milk', beans: 2, milk: 1, price: 14 },
	{ name: 'Flat white', beans: 1, milk: 1, price: 9 },
	{ name: 'Espresso', beans: 1, milk: 0, price: 6 },
	{ name: 'Two coffees, one with milk', beans: 2, milk: 1, price: 14 },
	{ name: 'Flat white', beans: 1, milk: 1, price: 9 },
	{ name: 'Espresso', beans: 1, milk: 0, price: 6 },
] as const

export const ROOT = 'portfolio-cafe-v1'
export const RESOURCES = ['cash', 'beans', 'milk', 'served'] as const
export type Resource = (typeof RESOURCES)[number]
export interface CafeState {
	shift: string
	balances: Record<Resource, number>
	history: {
		id: string
		memo: string
		created_at: string
		postings: { resource: Resource; amount: number }[]
	}[]
}

type Node = Record<string, unknown>
const value = (id: string, amount: number): Node => ({
	op: 'value',
	id,
	value_type: 'integer',
	value: amount,
})
const input = (id: string, value_type: string): Node => ({
	op: 'input',
	id,
	value_type,
})
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

export function template(
	action: 'open' | 'restock' | 'espresso' | 'white' | 'double',
) {
	const nodes: Node[] = RESOURCES.map((id) => input(id, 'bucket'))
	if (action !== 'open') {
		nodes.push({
			op: 'input',
			id: 'step',
			value_type: 'integer',
			min: 0,
			max: 7,
		})
		for (const id of RESOURCES)
			nodes.push({ op: 'balance', id: `${id}_balance`, scope: { bucket: id } })
		nodes.push(
			...guard(
				'current_order',
				'served_balance',
				'eq',
				'step',
				'This order was already handled. Refresh the counter.',
			),
		)
	} else {
		nodes.push(value('zero', 0), {
			op: 'balance',
			id: 'cash_balance',
			scope: { bucket: 'cash' },
		})
		nodes.push(
			...guard(
				'unopened',
				'cash_balance',
				'eq',
				'zero',
				'This shift is already open.',
			),
		)
	}
	const recipe =
		action === 'espresso'
			? ORDERS[0]
			: action === 'white'
				? ORDERS[1]
				: ORDERS[2]
	const amounts: Record<Resource, number> =
		action === 'open'
			? { cash: 20, beans: 4, milk: 2, served: 0 }
			: action === 'restock'
				? { cash: -14, beans: 4, milk: 3, served: 0 }
				: {
						cash: recipe.price,
						beans: -recipe.beans,
						milk: -recipe.milk,
						served: 1,
					}
	for (const id of RESOURCES) {
		const amount = amounts[id]
		if (!amount) continue
		nodes.push(value(`${id}_amount`, Math.abs(amount)))
		if (amount < 0)
			nodes.push(
				...guard(
					`enough_${id}`,
					`${id}_balance`,
					'gte',
					`${id}_amount`,
					`Not enough ${id}.`,
				),
			)
		nodes.push({
			op: 'post',
			id: `${id}_posting`,
			bucket: id,
			amount: `${id}_amount`,
			direction: amount < 0 ? 'out' : 'in',
		})
	}
	return {
		id: `${ROOT}-${action}`,
		domain: ROOT,
		name: `Night shift: ${action}`,
		nodes,
	}
}
