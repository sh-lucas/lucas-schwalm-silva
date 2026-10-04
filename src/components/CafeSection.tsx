import { useEffect, useRef, useState } from 'react'
import { type CafeState, ORDERS } from '../../server/cafe-model'

type Action = 'start' | 'serve' | 'restock' | 'race'
type Attempt = { request: number; committed: boolean | null; message: string }
type Pending = { action: Action; requestId: string; step: number }
const resourceNames = {
	cash: 'credits',
	beans: 'coffee',
	milk: 'milk',
	served: 'orders',
}

export function CafeSection() {
	const [state, setState] = useState<CafeState | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [attempts, setAttempts] = useState<Attempt[]>([])
	const [pending, setPending] = useState<Pending | null>(null)
	const busy = useRef(false)
	const mounted = useRef(true)

	useEffect(() => {
		mounted.current = true
		const controller = new AbortController()
		fetch('/api/cafe', { signal: controller.signal })
			.then(async (res) => {
				const data = await res.json()
				if (!res.ok) throw new Error(data.error)
				if (mounted.current) setState(data.state)
			})
			.catch((err) => {
				if (!controller.signal.aborted && mounted.current)
					setError(err.message || 'Could not load the counter.')
			})
			.finally(() => {
				if (!controller.signal.aborted && mounted.current) setLoading(false)
			})
		return () => {
			mounted.current = false
			controller.abort()
		}
	}, [])

	async function refresh() {
		if (busy.current) return
		busy.current = true
		setLoading(true)
		try {
			const res = await fetch('/api/cafe')
			const data = await res.json()
			if (!res.ok) throw new Error(data.error)
			if (mounted.current) {
				setState(data.state)
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

	async function act(action: Action, retry?: Pending) {
		if (busy.current) return
		const request = retry ?? {
			action,
			requestId: crypto.randomUUID(),
			step: state?.balances.served ?? 0,
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
			const data = await res.json()
			if (!mounted.current) return
			if (!res.ok) {
				setPending(data.retryable ? request : null)
				throw new Error(data.error)
			}
			setState(data.state)
			setAttempts(data.attempts ?? [])
			setPending(data.retryable ? request : null)
		} catch (err) {
			if (mounted.current) {
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
	}

	const order = state ? ORDERS[state.balances.served] : undefined
	const finished = state && !order
	const canServe =
		!!state &&
		!!order &&
		state.balances.beans >= order.beans &&
		state.balances.milk >= order.milk
	const canRestock = !!state && !!order && state.balances.cash >= 14

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
					Eight orders. A small pantry. Keep the coffee coming and finish with
					at least 60 credits. Every credit here is fictional; every transaction
					is real.
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
							Start with 20 credits, 4 portions of coffee and 2 of milk. A
							delivery costs 14 credits and brings 4 coffee + 3 milk.
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
									<small>{resource === 'cash' ? 'credits' : 'portions'}</small>
								</strong>
							</div>
						))}
					</div>
					<div className="cafe-order">
						<div>
							<p className="section-kicker">
								{finished
									? 'Counter closed'
									: `Order ${state.balances.served + 1} of ${ORDERS.length}`}
							</p>
							<h3>
								{finished
									? state.balances.cash >= 60
										? 'A good night’s work.'
										: 'All served. A little overstocked.'
									: order?.name}
							</h3>
							<p>
								{finished
									? `You finished with ${state.balances.cash} credits. The target was 60. Your receipt stays here when you come back.`
									: `${order?.beans} coffee${order?.milk ? ` + ${order.milk} milk` : ''}. Earn ${order?.price} credits.`}
							</p>
						</div>
						{finished ? (
							<button
								className="action-button"
								type="button"
								disabled={loading || !!pending}
								onClick={() => act('start')}
							>
								Another shift
							</button>
						) : (
							<div className="cafe-actions">
								<button
									className="action-button"
									type="button"
									disabled={loading || !canServe || !!pending}
									onClick={() => act('serve')}
								>
									{loading ? 'Working…' : 'Serve this order'}
								</button>
								<button
									className="text-button"
									type="button"
									disabled={loading || !canRestock || !!pending}
									onClick={() => act('restock')}
								>
									Order a delivery · 14 credits
								</button>
							</div>
						)}
						{order && !canServe && (
							<p className="pantry-note">
								You need a delivery before serving this order.
							</p>
						)}
					</div>
					<div className="cafe-experiment">
						<div>
							<h3>Same order. Two requests.</h3>
							<p>
								Send two independent requests at once. The ledger checks the
								order and stock inside each transaction. Watch which one
								commits.
							</p>
						</div>
						<button
							className="text-button"
							type="button"
							disabled={loading || !canServe || !!pending}
							onClick={() => act('race')}
						>
							Try simultaneous requests
						</button>
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
					</div>
					<details className="cafe-receipt" open>
						<summary>
							Receipt{' '}
							<span>
								{state.history.length} transactions · shift {state.shift}
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
											.join(' / ')}
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
					onClick={() => act(pending.action, pending)}
				>
					Retry the same request
				</button>
			)}
			{(state || error) && (
				<button
					className="text-button receipt-refresh"
					type="button"
					disabled={loading}
					onClick={refresh}
				>
					Refresh from the ledger
				</button>
			)}
			<p className="cafe-credit">
				Stock, credits and order guards run on{' '}
				<a
					href="https://about.plinth.sh-lucas.dev"
					target="_blank"
					rel="noopener noreferrer"
				>
					Plinth
				</a>
				, my dedicated ledger service. Each sale commits in full or changes
				nothing. Receipts persist across reloads, and retries reuse the same
				transaction key.
			</p>
		</section>
	)
}
