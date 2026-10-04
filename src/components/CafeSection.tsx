import { useCallback, useEffect, useRef, useState } from 'react'
import {
	type Action,
	type Attempt,
	type CafeResponse,
	type CafeState,
	MAX_DECISIONS,
	type Offer,
	type RoundSummary,
	TARGET_CASH,
	TARGET_SERVED,
} from '../../server/cafe-model'
import {
	type CafeJob,
	type CafeRequest,
	JOBS_KEY,
	deliveryCost,
	deliverySeconds,
	prepSeconds,
	restoreJobs,
	secondsLeft,
} from '../cafe-timing'

const resourceNames = {
	cash: 'credits',
	beans: 'coffee',
	milk: 'milk',
	served: 'served',
	discarded: 'discarded',
	moves: 'decisions',
	journal: 'entries',
}
const labels = {
	active: 'In progress',
	won: 'Target reached',
	lost: 'Target missed',
	expired: 'Time expired',
	finished: 'Rush finished',
}
const date = (value: string) =>
	new Date(value).toLocaleString([], {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
const timer = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export function CafeSection() {
	const [state, setState] = useState<CafeState | null>(null)
	const [recent, setRecent] = useState<RoundSummary[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [attempts, setAttempts] = useState<Attempt[]>([])
	const [pending, setPending] = useState<CafeRequest | null>(null)
	const [jobs, setJobs] = useState<CafeJob[]>([])
	const [now, setNow] = useState(0)
	const busy = useRef(false)
	const mounted = useRef(true)
	const clockOffset = useRef(0)
	const shift = useRef('')
	const jobsRef = useRef<CafeJob[]>([])

	const saveJobs = useCallback((next: CafeJob[]) => {
		jobsRef.current = next
		setJobs(next)
		try {
			localStorage.setItem(
				JOBS_KEY,
				JSON.stringify({ shift: shift.current, jobs: next }),
			)
		} catch {
			setError(
				'This browser could not save the timers. Keep this tab open during the shift.',
			)
		}
	}, [])

	const apply = useCallback(
		(data: CafeResponse) => {
			setState(data.state)
			setRecent(data.recent)
			clockOffset.current = Date.parse(data.server_now) - Date.now()
			setNow(Date.now() + clockOffset.current)
			if (!data.state) return
			let next = jobsRef.current
			if (shift.current !== data.state.shift) {
				shift.current = data.state.shift
				try {
					next = restoreJobs(localStorage.getItem(JOBS_KEY), data.state).map(
						(job) => ({ ...job, failed: job.failed || job.submitted }),
					)
				} catch {
					next = []
				}
			}
			const current = data.state
			next = next.filter((job) => {
				const committed = current.history.some(
					(tx) => tx.request_id === job.requestId,
				)
				return !committed && (current.status === 'active' || job.submitted)
			})
			saveJobs(next)
			setPending((previous) =>
				previous?.action === 'start'
					? previous
					: (next.find((job) => job.failed) ?? null),
			)
		},
		[saveJobs],
	)

	const refresh = useCallback(async () => {
		if (busy.current) return
		busy.current = true
		setLoading(true)
		try {
			const res = await fetch('/api/cafe')
			const data: CafeResponse = await res.json()
			if (!res.ok) throw new Error(data.error)
			if (mounted.current) {
				apply(data)
				setError('')
			}
		} catch (err) {
			if (mounted.current)
				setError(
					err instanceof Error ? err.message : 'Could not load the receipt.',
				)
		} finally {
			busy.current = false
			if (mounted.current) setLoading(false)
		}
	}, [apply])

	useEffect(() => {
		mounted.current = true
		void refresh()
		const poll = setInterval(refresh, 15000)
		const clock = setInterval(
			() => setNow(Date.now() + clockOffset.current),
			250,
		)
		return () => {
			mounted.current = false
			clearInterval(poll)
			clearInterval(clock)
		}
	}, [refresh])

	const act = useCallback(
		async (action: Action, offer?: Offer, retry?: CafeRequest) => {
			if (busy.current) return
			const request = retry ?? {
				action,
				requestId: crypto.randomUUID(),
				...(offer ? { slot: offer.slot, index: offer.index } : {}),
			}
			busy.current = true
			setLoading(true)
			setError('')
			setAttempts([])
			setPending(request)
			saveJobs(
				jobsRef.current.map((job) =>
					job.requestId === request.requestId
						? { ...job, submitted: true, failed: false }
						: job,
				),
			)
			let retryable = true
			try {
				const res = await fetch('/api/cafe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(request),
				})
				const data: CafeResponse = await res.json()
				if (!mounted.current) return
				if (!res.ok) {
					retryable = !!data.retryable
					throw new Error(data.error)
				}
				apply(data)
				setAttempts(data.attempts ?? [])
				if (!data.retryable) {
					saveJobs(
						jobsRef.current.filter(
							(job) => job.requestId !== request.requestId,
						),
					)
					setPending(null)
				} else {
					saveJobs(
						jobsRef.current.map((job) =>
							job.requestId === request.requestId
								? { ...job, failed: true }
								: job,
						),
					)
					setPending(request)
				}
			} catch (err) {
				if (mounted.current) {
					saveJobs(
						retryable
							? jobsRef.current.map((job) =>
									job.requestId === request.requestId
										? { ...job, failed: true }
										: job,
								)
							: jobsRef.current.filter(
									(job) => job.requestId !== request.requestId,
								),
					)
					setPending(retryable ? request : null)
					setError(
						err instanceof Error
							? err.message
							: 'Connection interrupted. Retry the same request.',
					)
				}
			} finally {
				busy.current = false
				if (mounted.current) setLoading(false)
			}
		},
		[apply, saveJobs],
	)

	const remaining = state
		? Math.max(0, Math.ceil((Date.parse(state.expires_at) - now) / 1000))
		: 0
	const status =
		state?.status === 'active' && remaining === 0
			? state.mode === 'rush'
				? 'finished'
				: 'expired'
			: state?.status
	const active = status === 'active'
	const disabled = loading || !!pending || !active
	const brewing = jobs.find(
		(job) => job.action === 'serve' || job.action === 'race',
	)
	const heldCash = jobs.reduce((total, job) => total + deliveryCost(job), 0)
	const spendable = (state?.cash ?? 0) - heldCash
	const canServe = (offer: Offer) =>
		!!state &&
		state.balances.beans >= offer.beans &&
		state.balances.milk >= offer.milk
	const shortage = (offer: Offer) => {
		const coffee = Math.max(0, offer.beans - (state?.balances.beans ?? 0))
		const milk = Math.max(0, offer.milk - (state?.balances.milk ?? 0))
		return [coffee && `${coffee} more coffee`, milk && `${milk} more milk`]
			.filter(Boolean)
			.join(' and ')
	}

	function queue(action: Exclude<Action, 'start'>, offer?: Offer) {
		if (busy.current || pending || !active || !state) return
		const next = jobsRef.current
		if (action === 'coffee' || action === 'milk') {
			const cost = action === 'coffee' ? 7 : 5
			if (
				next.some((job) => job.action === action) ||
				state.cash - next.reduce((total, job) => total + deliveryCost(job), 0) <
					cost
			)
				return
		} else {
			if (
				!offer ||
				next.some((job) => job.slot === offer.slot) ||
				(action !== 'discard' &&
					next.some((job) => job.action === 'serve' || job.action === 'race'))
			)
				return
		}
		const duration =
			action === 'coffee' || action === 'milk'
				? deliverySeconds(state.balances.moves, action)
				: action === 'discard'
					? 0
					: prepSeconds(offer as Offer)
		if (now + duration * 1000 >= Date.parse(state.expires_at)) {
			setError('Not enough time left for that to finish. Try a quicker order.')
			return
		}
		saveJobs([
			...next,
			{
				action,
				requestId: crypto.randomUUID(),
				started: now,
				ready: now + duration * 1000,
				...(offer ? { slot: offer.slot, index: offer.index } : {}),
			},
		])
	}

	useEffect(() => {
		if (disabled) return
		const ready = jobs.find((job) => !job.failed && job.ready <= now)
		if (ready) void act(ready.action, undefined, ready)
	}, [act, disabled, jobs, now])

	return (
		<section className="cafe fade-in" aria-labelledby="cafe-title">
			<div className="cafe-intro">
				<p className="section-kicker">A little game, a real ledger</p>
				<h2 id="cafe-title">
					Coffee for the
					<br />
					<em>night shift.</em>
				</h2>
				<p>
					Two minutes. Three orders. One coffee machine. Keep as many credits as
					you can before time runs out or you use all twelve decisions. Brew
					something quick, wait for a bigger payout, or pass on a costly order
					while your supplies are on the way.
				</p>
			</div>

			{!state ? (
				<div className="cafe-opening">
					<div className="cafe-cup" aria-hidden="true">
						<div className="cup-body" />
						<div className="cup-saucer" />
					</div>
					<div>
						<h3>Your counter is waiting.</h3>
						<p>
							Start with 20 credits, 4 coffee and 2 milk. Brewing takes 1, 3 or
							5 seconds. Deliveries take 6–12 seconds and run alongside the
							machine. Passing on an order saves ingredients, but spends a
							decision without earning anything.
						</p>
						<button
							className="action-button"
							type="button"
							disabled={loading || !!pending}
							onClick={() => act('start')}
						>
							{loading ? 'Connecting…' : 'Open the counter'}
						</button>
					</div>
				</div>
			) : (
				<>
					<div className="shift-progress">
						<div>
							<span>{active ? 'Time left' : 'Counter closed'}</span>
							<strong
								className="shift-timer"
								aria-label={
									active ? `${remaining} seconds remaining` : 'Shift ended'
								}
							>
								{active ? timer(remaining) : labels[status ?? 'expired']}
							</strong>
						</div>
						<div>
							<span>
								{state.balances.moves} / {MAX_DECISIONS} decisions
							</span>
							<p>
								{state.served} served · {state.discarded} discarded
								{state.mode === 'classic' &&
									` · Original shift: ${TARGET_SERVED} served / ${TARGET_CASH} credits target`}
							</p>
						</div>
					</div>
					<div
						className="cafe-counter"
						aria-label="Pantry and till"
						aria-busy={loading}
					>
						{(['cash', 'beans', 'milk'] as const).map((resource) => (
							<div key={resource}>
								<span>
									{resource === 'cash'
										? 'Till'
										: resource === 'beans'
											? 'Coffee'
											: 'Milk'}
								</span>
								<strong>
									{state.balances[resource]}{' '}
									<small>
										{resource === 'cash'
											? 'credits'
											: `${resource === 'beans' ? '/ 10' : '/ 8'} portions`}
									</small>
								</strong>
								{resource === 'cash' && heldCash > 0 && active && (
									<p className="cafe-rule-note">
										{heldCash} held for deliveries · {spendable} available
									</p>
								)}
							</div>
						))}
					</div>
					{active ? (
						<>
							<div className="cafe-supplies">
								<div>
									<h3>Keep an eye on the pantry.</h3>
									<p>
										Order ahead: deliveries take 6–12 seconds. Keep brewing
										while you wait. Credits are held now; payment and stock
										arrive together when the delivery finishes.
									</p>
								</div>
								<div className="supply-actions">
									<button
										className="text-button"
										type="button"
										disabled={
											disabled ||
											spendable < 7 ||
											state.balances.beans > 7 ||
											jobs.some((job) => job.action === 'coffee')
										}
										onClick={() => queue('coffee')}
									>
										Buy 3 coffee · 7 credits ·{' '}
										{deliverySeconds(state.balances.moves, 'coffee')}s
									</button>
									<button
										className="text-button"
										type="button"
										disabled={
											disabled ||
											spendable < 5 ||
											state.balances.milk > 5 ||
											jobs.some((job) => job.action === 'milk')
										}
										onClick={() => queue('milk')}
									>
										Buy 3 milk · 5 credits ·{' '}
										{deliverySeconds(state.balances.moves, 'milk')}s
									</button>
								</div>
							</div>
							{jobs.some((job) => deliveryCost(job)) && (
								<div className="delivery-grid" aria-label="Incoming supplies">
									{jobs
										.filter((job) => deliveryCost(job))
										.map((job) => (
											<div className="cafe-timed-task" key={job.requestId}>
												<div>
													<span>
														3 {job.action === 'coffee' ? 'coffee' : 'milk'} on
														the way
													</span>
													<strong>
														{job.failed
															? 'Needs confirmation'
															: secondsLeft(job, now)
																? `${secondsLeft(job, now)}s`
																: 'Receiving…'}
													</strong>
												</div>
												<progress
													aria-label={`${job.action} delivery progress`}
													max={job.ready - job.started}
													value={Math.min(
														job.ready - job.started,
														Math.max(0, now - job.started),
													)}
												/>
											</div>
										))}
								</div>
							)}
							<div className="order-grid" aria-label="Choose an order">
								{state.offers.map((offer) => (
									<article
										className="order-ticket"
										key={`${offer.slot}-${offer.index}`}
									>
										<p className="section-kicker">Counter {offer.slot + 1}</p>
										<h3>{offer.name}</h3>
										<p className="order-recipe">
											{offer.beans} coffee
											{offer.milk ? ` + ${offer.milk} milk` : ''}
										</p>
										<p className="order-time">
											{prepSeconds(offer)}s at the machine · uses 1 decision
										</p>
										<strong className="order-price">
											+{offer.price} <small>credits</small>
										</strong>
										<div className="order-options">
											<button
												className="action-button"
												type="button"
												disabled={
													disabled ||
													!!brewing ||
													!canServe(offer) ||
													jobs.some((job) => job.slot === offer.slot)
												}
												onClick={() => queue('serve', offer)}
											>
												Brew & serve
											</button>
											<button
												className="text-button"
												type="button"
												disabled={
													disabled ||
													jobs.some((job) => job.slot === offer.slot)
												}
												onClick={() => queue('discard', offer)}
											>
												Discard
											</button>
										</div>
										{brewing?.slot === offer.slot ? (
											<div className="cafe-timed-task">
												<div>
													<span>
														{brewing.failed
															? 'Check the receipt'
															: secondsLeft(brewing, now)
																? 'Brewing'
																: 'Serving…'}
													</span>
													<strong>{secondsLeft(brewing, now)}s</strong>
												</div>
												<progress
													aria-label="Brewing progress"
													max={brewing.ready - brewing.started}
													value={Math.min(
														brewing.ready - brewing.started,
														Math.max(0, now - brewing.started),
													)}
												/>
											</div>
										) : (
											brewing && (
												<p className="order-time">
													Machine busy at counter {(brewing.slot ?? 0) + 1}.
												</p>
											)
										)}
										{!canServe(offer) && (
											<p className="order-shortage">Need {shortage(offer)}.</p>
										)}
									</article>
								))}
							</div>
							<p className="cafe-rule-note">
								A longer brew ties up the machine. Passing on an order brings a
								new offer immediately and saves stock, but earns nothing and
								uses one of your twelve decisions. Unfinished brews and
								deliveries are cancelled when the counter closes.
							</p>
							<details className="cafe-experiment">
								<summary>Try two requests for one order</summary>
								<p>
									Choose a counter below. Both requests try to serve its current
									ticket at once. The ledger allows only one to consume it.
								</p>
								<div className="race-actions">
									{state.offers.map((offer) => (
										<button
											className="text-button"
											key={offer.slot}
											type="button"
											disabled={
												disabled ||
												!!brewing ||
												!canServe(offer) ||
												jobs.some((job) => job.slot === offer.slot)
											}
											onClick={() => queue('race', offer)}
										>
											Try counter {offer.slot + 1}
										</button>
									))}
								</div>
							</details>
						</>
					) : (
						<div className="cafe-order">
							<div>
								<p className="section-kicker">{labels[status ?? 'expired']}</p>
								<h3>
									{status === 'finished'
										? `${state.cash} credits in the till.`
										: status === 'won'
											? 'A good night’s work.'
											: status === 'expired'
												? 'Time to close the counter.'
												: 'That shift didn’t quite pay off.'}
								</h3>
								<p>
									{state.served} orders served, {state.discarded} passed on,{' '}
									{state.cash} credits left. Your receipt is saved in the
									ledger.
									{state.mode === 'rush' &&
										` That’s ${state.cash >= 20 ? '+' : ''}${state.cash - 20} against your starting till.`}
									{status === 'expired'
										? ' Orders and deliveries are locked after the deadline, even if you closed this tab.'
										: ''}
								</p>
							</div>
							<button
								className="action-button"
								type="button"
								disabled={loading || !!pending}
								onClick={() => act('start')}
							>
								Another shift
							</button>
						</div>
					)}
					{attempts.length > 0 && (
						<ul className="race-results" aria-live="polite">
							{attempts.map((attempt) => (
								<li key={attempt.request} data-committed={attempt.committed}>
									<strong>
										Request {attempt.request}:{' '}
										{attempt.committed === null
											? 'unconfirmed'
											: attempt.committed
												? 'committed'
												: 'rejected'}
									</strong>
									<span>{attempt.message}</span>
								</li>
							))}
						</ul>
					)}
					<details className="cafe-receipt">
						<summary>
							Receipt{' '}
							<span>
								{state.history.length} transactions · shift {state.shift} ·
								opened {date(state.started_at)}
							</span>
						</summary>
						<ol>
							{[...state.history].reverse().map((tx) => (
								<li key={tx.id}>
									<div>
										<strong>{tx.memo}</strong>
										<time dateTime={tx.created_at}>
											{new Date(tx.created_at).toLocaleTimeString([], {
												hour: '2-digit',
												minute: '2-digit',
											})}
										</time>
									</div>
									<p>
										{tx.postings
											.map(
												(posting) =>
													`${posting.amount > 0 ? '+' : ''}${posting.amount} ${resourceNames[posting.resource]}`,
											)
											.join(' / ') || 'Counter prepared.'}
									</p>
									<details>
										<summary>Transaction reference</summary>
										<code>{tx.id}</code>
									</details>
								</li>
							))}
						</ol>
					</details>
				</>
			)}
			<div className="cafe-feedback" aria-live="polite" aria-atomic="true">
				{error && <p role="alert">{error}</p>}
				{loading && state && <p>Checking the ledger…</p>}
			</div>
			{pending && !loading && (
				<button
					className="text-button"
					type="button"
					disabled={loading}
					onClick={() => act(pending.action, undefined, pending)}
				>
					Retry the same request
				</button>
			)}
			<button
				className="text-button receipt-refresh"
				type="button"
				disabled={loading}
				onClick={refresh}
			>
				Refresh from the ledger
			</button>
			<section className="recent-rounds" aria-labelledby="recent-title">
				<div className="section-head">
					<h3 id="recent-title" className="section-head-title">
						Last six shifts
					</h3>
					<span className="section-head-meta">everyone’s counter</span>
				</div>
				<p className="cafe-rule-note">
					The six most recently opened rounds. Rushes close after two minutes or
					twelve decisions; original shifts keep their 15-minute deadline.
				</p>
				{recent.length ? (
					<ol>
						{recent.map((round) => {
							const publicStatus =
								round.status === 'active' && now >= Date.parse(round.expires_at)
									? round.mode === 'rush'
										? 'finished'
										: 'expired'
									: round.status
							return (
								<li key={round.shift}>
									<div>
										<strong>
											{round.mode === 'rush' ? 'Rush' : 'Shift'} {round.shift}
										</strong>
										<time dateTime={round.started_at}>
											{date(round.started_at)}
										</time>
									</div>
									<div>
										<span className="round-status" data-status={publicStatus}>
											{labels[publicStatus]}
										</span>
										<span>
											{round.served} served · {round.discarded} discarded ·{' '}
											{round.cash} credits
										</span>
									</div>
									{round.ended_at && (
										<small>Closed {date(round.ended_at)}</small>
									)}
								</li>
							)
						})}
					</ol>
				) : (
					<p className="cafe-rule-note">
						{loading
							? 'Loading recent rounds…'
							: error
								? 'Recent rounds could not be loaded. Try refreshing.'
								: 'The counter is quiet. Your round can be the first.'}
					</p>
				)}
			</section>
			<section className="cafe-credit" aria-labelledby="plinth-title">
				<div className="section-head">
					<h3 id="plinth-title" className="section-head-title">
						What Plinth handles
					</h3>
				</div>
				<p>
					Plinth is my ledger service: it records quantities and applies rules
					through atomic transactions. Here, it checks stock, credits, pantry
					capacity and the twelve-decision limit. Serving an order consumes its
					ingredients, collects payment and closes the ticket together, so the
					same order cannot be served twice. Each operation commits in full or
					changes nothing, with a persistent receipt.
				</p>
				<p>
					The browser handles brewing and delivery timers; the site's backend
					enforces the two-minute deadline.{' '}
					<a
						href="https://about.plinth.sh-lucas.dev"
						target="_blank"
						rel="noopener noreferrer"
					>
						Learn more about Plinth
					</a>
					.
				</p>
			</section>
		</section>
	)
}
