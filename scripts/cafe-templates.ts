import {
	MAX_DECISIONS,
	PREFIX,
	RECIPES,
	RESOURCES,
	ROOT,
	RUSH_SECONDS,
} from '../src/cafe-model'

// Builds the Plinth proposal for the game. Print it with `vpx scripts/cafe-templates.ts`.
type Node = Record<string, unknown>
const value = (id: string, amount: number): Node => ({
	op: 'value',
	id,
	value_type: 'integer',
	value: amount,
})
const input = (id: string, min: number, max?: number): Node => ({
	op: 'input',
	id,
	value_type: 'integer',
	min,
	...(max === undefined ? {} : { max }),
})
const balance = (id: string, bucket: string): Node => ({
	op: 'balance',
	id,
	scope: { bucket },
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
// `fail` opens a round bucket once; `reuse` reopens it and rejects different attributes.
const own = (
	id: string,
	domain: string,
	parts: string[],
	on_conflict: 'fail' | 'reuse',
	attributes: Record<string, string> = {},
): Node => ({
	op: 'provision',
	id,
	scope: { domain: `${ROOT}-${domain}` },
	reference: {
		from: 'parts',
		prefix: `${PREFIX}${domain}`,
		parts,
		on_conflict,
	},
	attributes,
})
// Plinth draws the recipe and price, so the browser cannot choose an order.
function drawOffer(prefix: string, slot: string, index: string): Node[] {
	const pick = (key: 'beans' | 'milk' | 'price') => ({
		op: 'pick',
		id: `${prefix}_${key === 'price' ? 'base' : key}`,
		at: `${prefix}_recipe`,
		items: RECIPES.map((recipe) => recipe[key]),
	})
	return [
		{ op: 'random', id: `${prefix}_recipe`, min: 'zero', max: 'last_recipe' },
		pick('beans'),
		pick('milk'),
		pick('price'),
		{ op: 'random', id: `${prefix}_bonus`, min: 'zero', max: 'max_bonus' },
		{
			op: 'math',
			id: `${prefix}_price`,
			operator: 'add',
			left: `${prefix}_base`,
			right: `${prefix}_bonus`,
		},
		own(prefix, 'orders', ['round', slot, index], 'fail', {
			recipe: `${prefix}_recipe`,
			beans: `${prefix}_beans`,
			milk: `${prefix}_milk`,
			price: `${prefix}_price`,
		}),
		post(`${prefix}_open`, prefix, 'one'),
	]
}

function template(
	action: 'start' | 'serve' | 'discard' | 'coffee' | 'milk' | 'expiry-check',
) {
	const opening = action === 'start' || action === 'expiry-check'
	const policy = opening ? 'fail' : 'reuse'
	const nodes: Node[] = [
		value('one', 1),
		value('two', 2),
		value('zero', 0),
		value('last_recipe', RECIPES.length - 1),
		value('max_bonus', 3),
		{ op: 'clock', id: 'now', source: 'created_at', unit: 'second' },
		input('round', 1),
		input('secret', 1),
		// A wrong secret makes `reuse` fail, so only the round's owner can play it.
		own('key', 'keys', ['round'], policy, { secret: 'secret' }),
		// A posting outside the public grant hides this transaction's inputs from readers.
		post('touch_key', 'key', 'one'),
		...[...RESOURCES, 'end'].map((id) => own(id, id, ['round'], policy)),
	]
	if (opening) {
		// The expiry-check copy opens an already-closed round for scripts/check-cafe.ts.
		nodes.push(
			value('duration', action === 'start' ? RUSH_SECONDS : 0),
			{
				op: 'math',
				id: 'deadline',
				operator: 'add',
				left: 'now',
				right: 'duration',
			},
			post('save_deadline', 'end', 'deadline'),
		)
		for (const [id, amount] of [
			['cash', 20],
			['beans', 4],
			['milk', 2],
		] as const)
			nodes.push(
				value(`${id}_amount`, amount),
				post(`${id}_opening`, id, `${id}_amount`),
			)
		for (const [slot, id] of ['zero', 'one', 'two'].entries())
			nodes.push(...drawOffer(`offer_${slot}`, id, 'zero'))
	} else {
		nodes.push(
			// A round that was never opened has a zero deadline and fails here.
			balance('deadline', 'end'),
			...guard(
				'within_shift',
				'now',
				'lt',
				'deadline',
				'The two-minute rush has ended. Open a new shift.',
			),
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
				post('pay_delivery', 'cash', 'cost', 'out'),
				post('receive_delivery', resource, 'quantity'),
			)
		} else {
			// The browser repeats the ticket's attributes; `reuse` rejects any change.
			nodes.push(
				input('slot', 0, 2),
				input('index', 0, MAX_DECISIONS),
				input('recipe', 0, RECIPES.length - 1),
				input('beans_needed', 1, 2),
				input('milk_needed', 0, 3),
				input('order_price', 6, 21),
				own('order', 'orders', ['round', 'slot', 'index'], 'reuse', {
					recipe: 'recipe',
					beans: 'beans_needed',
					milk: 'milk_needed',
					price: 'order_price',
				}),
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
					post('receive_payment', 'cash', 'order_price'),
					post('count_served', 'served', 'one'),
				)
			} else nodes.push(post('count_discarded', 'discarded', 'one'))
			nodes.push(
				post('close_ticket', 'order', 'one', 'out'),
				post('count_decision', 'moves', 'one'),
				{
					op: 'math',
					id: 'next_index',
					operator: 'add',
					left: 'index',
					right: 'one',
				},
				...drawOffer('next', 'slot', 'next_index'),
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

const proposal = () => ({
	domains: [
		{
			id: ROOT,
			name: 'Portfolio night shift: browser-only rush',
			kind: 'organizational',
		},
		...[...RESOURCES, 'end', 'orders', 'keys'].map((id) => ({
			id: `${ROOT}-${id}`,
			name: `${ROOT}-${id}`,
			parent: ROOT,
			kind: 'scalar',
			unit: id === 'cash' ? 'credit' : id === 'end' ? 'second' : 'unit',
		})),
	],
	templates: (
		['start', 'serve', 'discard', 'coffee', 'milk', 'expiry-check'] as const
	).map(template),
})

if (process.argv[1]?.endsWith('cafe-templates.ts'))
	console.log(JSON.stringify(proposal()))
