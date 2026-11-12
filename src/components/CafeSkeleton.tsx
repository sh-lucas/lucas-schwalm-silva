import type { ReactNode } from 'react'

// Invisible text keeps each placeholder at the real line height, so the swap does not move the page.
const Bone = ({ children }: { children: ReactNode }) => (
	<span className="skeleton">{children}</span>
)

/** Mirrors the active-shift layout while a saved round is being read. */
export function CafeSkeleton() {
	return (
		<div
			className="cafe-skeleton"
			role="status"
			aria-label="Loading your shift"
		>
			<div className="shift-progress" aria-hidden="true">
				<div>
					<span>
						<Bone>Time left</Bone>
					</span>
					<strong className="shift-timer">
						<Bone>2:00</Bone>
					</strong>
				</div>
				<div>
					<span>
						<Bone>0 / 12 decisions</Bone>
					</span>
					<p>
						<Bone>0 served · 0 discarded</Bone>
					</p>
				</div>
			</div>
			<div className="cafe-counter" aria-hidden="true">
				{['Till', 'Coffee', 'Milk'].map((label) => (
					<div key={label}>
						<span>
							<Bone>{label}</Bone>
						</span>
						<strong>
							<Bone>
								20 <small>credits</small>
							</Bone>
						</strong>
					</div>
				))}
			</div>
			<div className="cafe-supplies" aria-hidden="true">
				<div>
					<h3>
						<Bone>Keep an eye on the pantry.</Bone>
					</h3>
					<p>
						<Bone>
							Order ahead: deliveries take 6–12 seconds. Keep brewing while you
							wait. Credits are held now; payment and stock arrive together when
							the delivery finishes.
						</Bone>
					</p>
				</div>
				<div className="supply-actions">
					<span className="text-button">
						<Bone>Buy 3 coffee · 7 credits · 6s</Bone>
					</span>
					<span className="text-button">
						<Bone>Buy 3 milk · 5 credits · 6s</Bone>
					</span>
				</div>
			</div>
			<div className="order-grid" aria-hidden="true">
				{[1, 2, 3].map((slot) => (
					<div className="order-ticket" key={slot}>
						<p className="section-kicker">
							<Bone>Counter {slot}</Bone>
						</p>
						<h3>
							<Bone>Flat white</Bone>
						</h3>
						<p className="order-recipe">
							<Bone>2 coffee + 1 milk</Bone>
						</p>
						<p className="order-time">
							<Bone>3s at the machine · uses 1 decision</Bone>
						</p>
						<strong className="order-price">
							<Bone>
								+10 <small>credits</small>
							</Bone>
						</strong>
						<div className="order-options">
							<span className="action-button skeleton">Brew & serve</span>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
