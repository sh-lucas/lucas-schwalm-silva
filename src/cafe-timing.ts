import type { Action, CafeState, Offer } from '../server/cafe-model'

export interface CafeRequest {
	action: Action
	requestId: string
	slot?: number
	index?: number
}
export interface CafeJob extends CafeRequest {
	started: number
	ready: number
	submitted?: boolean
	failed?: boolean
}
export const JOBS_KEY = 'cafe-timers-v1'
export const prepSeconds = (offer: Offer) =>
	[1, 3, 5][(offer.recipe + offer.index + offer.slot) % 3]
export const deliverySeconds = (moves: number, action: 'coffee' | 'milk') =>
	[6, 9, 12][(moves + (action === 'milk' ? 1 : 0)) % 3]
export const secondsLeft = (job: CafeJob, now: number) =>
	Math.max(0, Math.ceil((job.ready - now) / 1000))
export const deliveryCost = (job: CafeRequest) =>
	job.action === 'coffee' ? 7 : job.action === 'milk' ? 5 : 0

// Timers are browser pacing; Plinth owns the actual stock and credit mutations.
export function restoreJobs(raw: string | null, state: CafeState): CafeJob[] {
	try {
		const saved = JSON.parse(raw ?? 'null')
		if (saved?.shift !== state.shift || !Array.isArray(saved.jobs)) return []
		return saved.jobs.filter((job: CafeJob) => {
			if (
				!job ||
				!['serve', 'discard', 'race', 'coffee', 'milk'].includes(job.action) ||
				typeof job.requestId !== 'string' ||
				!/^[0-9a-f-]{36}$/.test(job.requestId) ||
				!Number.isFinite(job.started) ||
				!Number.isFinite(job.ready) ||
				job.ready < job.started ||
				job.ready - job.started > 12000
			)
				return false
			if (state.status !== 'active' && !job.submitted) return false
			return (
				job.action === 'coffee' ||
				job.action === 'milk' ||
				state.offers.some(
					(offer) => offer.slot === job.slot && offer.index === job.index,
				) ||
				job.submitted
			)
		})
	} catch {
		return []
	}
}
