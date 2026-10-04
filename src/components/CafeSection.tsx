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

type Pending = {
	action: Action
	requestId: string
	slot?: number
	index?: number
}
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
	const [pending, setPending] = useState<Pending | null>(null)
	const [now, setNow] = useState(0)
	const busy = useRef(false)
	const mounted = useRef(true)
	const clockOffset = useRef(0)

	const apply = useCallback((data: CafeResponse) => {
		setState(data.state)
		setRecent(data.recent)
		clockOffset.current = Date.parse(data.server_now) - Date.now()
		setNow(Date.now() + clockOffset.current)
	}, [])

	useEffect(() => {
		mounted.current = true
		const controller = new AbortController()
		fetch('/api/cafe', { signal: controller.signal })
			.then(async (res) => {
				const data: CafeResponse = await res.json()
				if (!res.ok) throw new Error(data.error)
				if (mounted.current) apply(data)
			})
			.catch((err) => {
				if (!controller.signal.aborted && mounted.current)
					setError(err.message || 'Could not load the counter.')
			})
			.finally(() => {
				if (!controller.signal.aborted && mounted.current) setLoading(false)
			})
		const clock = setInterval(
			() => setNow(Date.now() + clockOffset.current),
			1000,
		)
		return () => {
			mounted.current = false
			controller.abort()
			clearInterval(clock)
		}
	}, [apply])

	useEffect(() => {
		const controller = new AbortController()
		const poll = setInterval(async () => {
			if (busy.current) return
			busy.current = true
			setLoading(true)
			try {
				const res = await fetch('/api/cafe', { signal: controller.signal })
				const data: CafeResponse = await res.json()
				if (!res.ok) throw new Error(data.error)
				if (mounted.current) {
					apply(data)
					setError('')
				}
			} catch (err) {
				if (!controller.signal.aborted && mounted.current)
					setError(
						err instanceof Error
							? err.message
							: 'Could not refresh the ledger.',
					)
			} finally {
				busy.current = false
				if (!controller.signal.aborted && mounted.current) setLoading(false)
			}
		}, 15000)
		return () => {
			clearInterval(poll)
			controller.abort()
		}
	}, [apply])

	async function refresh() {
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
	}

	async function act(action: Action, offer?: Offer, retry?: Pending) {
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
		try {
			const res = await fetch('/api/cafe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(request),
			})
			const data: CafeResponse = await res.json()
			if (!mounted.current) return
			if (!res.ok) {
				setPending(data.retryable ? request : null)
				throw new Error(data.error)
			}
			apply(data)
			setAttempts(data.attempts ?? [])
			setPending(data.retryable ? request : null)
		} catch (err) {
			if (mounted.current)
				setError(
					err instanceof Error
						? err.message
						: 'Connection interrupted. Retry the same request.',
				)
		} finally {
			busy.current = false
			if (mounted.current) setLoading(false)
		}
	}

	const remaining = state
		? Math.max(0, Math.ceil((Date.parse(state.expires_at) - now) / 1000))
		: 0
	const status =
		state?.status === 'active' && remaining === 0 ? 'expired' : state?.status
	const active = status === 'active'
	const disabled = loading || !!pending || !active
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
					Three orders on the counter. Twelve decisions. Serve at least{' '}
					{TARGET_SERVED} and finish with {TARGET_CASH} credits before your 15
					minutes run out. Choose what to brew, what to pass on and when to
					restock.
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
							Start with 20 credits, 4 coffee and 2 milk. Coffee deliveries cost
							7 for 3 portions; milk costs 5 for 3. Every discard uses one of
							your twelve decisions.
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
							</div>
						))}
					</div>
					{active ? (
						<>
							<div className="cafe-supplies">
								<div>
									<h3>Keep an eye on the pantry.</h3>
									<p>
										Buy only what you need. A delivery doesn’t use a decision,
										but it spends your earnings and needs space on the shelf.
									</p>
								</div>
								<div className="supply-actions">
									<button
										className="text-button"
										type="button"
										disabled={
											disabled || state.cash < 7 || state.balances.beans > 7
										}
										onClick={() => act('coffee')}
									>
										Buy 3 coffee · 7 credits
									</button>
									<button
										className="text-button"
										type="button"
										disabled={
											disabled || state.cash < 5 || state.balances.milk > 5
										}
										onClick={() => act('milk')}
									>
										Buy 3 milk · 5 credits
									</button>
								</div>
							</div>
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
										<strong className="order-price">
											+{offer.price} <small>credits</small>
										</strong>
										<div className="order-options">
											<button
												className="action-button"
												type="button"
												disabled={disabled || !canServe(offer)}
												onClick={() => act('serve', offer)}
											>
												Serve
											</button>
											<button
												className="text-button"
												type="button"
												disabled={disabled}
												onClick={() => act('discard', offer)}
											>
												Discard
											</button>
										</div>
										{!canServe(offer) && (
											<p className="order-shortage">Need {shortage(offer)}.</p>
										)}
									</article>
								))}
							</div>
							<p className="cafe-rule-note">
								Serving or discarding replaces that ticket with a new one. You
								can discard at most four and still reach eight served orders.
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
											disabled={disabled || !canServe(offer)}
											onClick={() => act('race', offer)}
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
									{status === 'won'
										? 'A good night’s work.'
										: status === 'expired'
											? 'Time to close the counter.'
											: 'That shift didn’t quite pay off.'}
								</h3>
								<p>
									{state.served} orders served, {state.discarded} passed on,{' '}
									{state.cash} credits left. Your receipt is saved in the
									ledger.
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
			{pending && (
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
					The six most recently opened rounds. Unfinished rounds expire
					automatically after 15 minutes.
				</p>
				{recent.length ? (
					<ol>
						{recent.map((round) => {
							const publicStatus =
								round.status === 'active' && now >= Date.parse(round.expires_at)
									? 'expired'
									: round.status
							return (
								<li key={round.shift}>
									<div>
										<strong>Shift {round.shift}</strong>
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
			<p className="cafe-credit">
				Stock, credits, single-use tickets and the 15-minute deadline are
				guarded by{' '}
				<a
					href="https://about.plinth.sh-lucas.dev"
					target="_blank"
					rel="noopener noreferrer"
				>
					Plinth
				</a>
				, my dedicated ledger service. Each operation commits in full or changes
				nothing. The receipts and public round history are read from its
				persistent records.
			</p>
		</section>
	)
}
