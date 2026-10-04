import assert from 'node:assert/strict'
import type { CafeState } from '../server/cafe-model'
import {
	type CafeJob,
	deliveryCost,
	deliverySeconds,
	prepSeconds,
	restoreJobs,
	secondsLeft,
} from '../src/cafe-timing'

const state: CafeState = {
	shift: '12345678',
	mode: 'rush',
	started_at: new Date(1000).toISOString(),
	expires_at: new Date(121000).toISOString(),
	ended_at: null,
	status: 'active',
	cash: 20,
	served: 0,
	discarded: 0,
	balances: {
		cash: 20,
		beans: 4,
		milk: 2,
		served: 0,
		discarded: 0,
		moves: 0,
		journal: 3,
	},
	offers: [
		{
			slot: 0,
			index: 0,
			recipe: 2,
			name: 'Double espresso',
			beans: 2,
			milk: 0,
			price: 11,
		},
	],
	history: [],
}
const brew: CafeJob = {
	action: 'serve',
	requestId: crypto.randomUUID(),
	slot: 0,
	index: 0,
	started: 1000,
	ready: 6000,
}
const delivery: CafeJob = {
	action: 'coffee',
	requestId: crypto.randomUUID(),
	started: 1000,
	ready: 7000,
}
const saved = (jobs: CafeJob[], shift = state.shift) =>
	JSON.stringify({ shift, jobs })
assert.equal(prepSeconds(state.offers[0]), 5)
assert.deepEqual(
	[0, 1, 2].map((recipe) => prepSeconds({ ...state.offers[0], recipe })),
	[1, 3, 5],
)
assert.deepEqual(
	[0, 1, 2].map((moves) => deliverySeconds(moves, 'coffee')),
	[6, 9, 12],
)
assert.equal(deliverySeconds(0, 'milk'), 9)
assert.equal(deliveryCost(delivery), 7)
assert.equal(deliveryCost({ ...delivery, action: 'milk' }), 5)
assert.equal(deliveryCost(brew), 0)
const restored = restoreJobs(saved([brew, delivery]), state)
assert.deepEqual(
	restored,
	[brew, delivery],
	'Reload must retain original, independent deadlines and request IDs',
)
assert.equal(secondsLeft(restored[0], 4000), 2)
assert.equal(secondsLeft(restored[1], 4000), 3)
assert.equal(
	secondsLeft(brew, 8000),
	0,
	'A suspended tab must catch up using the absolute deadline',
)
assert.deepEqual(restoreJobs(saved([brew], 'another-round'), state), [])
assert.deepEqual(
	restoreJobs(saved([{ ...brew, index: 1 }]), state),
	[],
	'Old tickets cannot silently become new orders',
)
assert.deepEqual(restoreJobs('invalid JSON', state), [])
assert.deepEqual(restoreJobs(saved([{ ...brew, ready: 14000 }]), state), [])
assert.deepEqual(restoreJobs(saved([{ ...brew, ready: 500 }]), state), [])
assert.deepEqual(
	restoreJobs(saved([brew, delivery]), { ...state, status: 'finished' }),
	[],
	'Unsubmitted work must be cancelled on closure',
)
assert.deepEqual(
	restoreJobs(saved([{ ...delivery, submitted: true, failed: true }]), {
		...state,
		status: 'finished',
	}),
	[{ ...delivery, submitted: true, failed: true }],
	'Unconfirmed writes must retain their retry key even after closure',
)
console.log(
	'Passed: preparation times, independent deliveries, reserved costs, reload recovery, stale tickets, closure and safe retry persistence.',
)
