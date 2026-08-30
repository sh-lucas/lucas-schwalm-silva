import type { ReactNode } from 'react'

export type MetricTone = 'ok' | 'warn' | 'critical'

interface MetricTick {
	percent: number
	label: string
}

interface MetricCardProps {
	icon: ReactNode
	label: string
	value: string
	unit: string
	percent: number
	tone: MetricTone
	description: string
	ticks?: MetricTick[]
}

export function MetricCard({
	icon,
	label,
	value,
	unit,
	percent,
	tone,
	description,
	ticks,
}: MetricCardProps) {
	return (
		<article className="metric-card">
			<div className="metric-head">
				<span className="metric-label">{label}</span>
				{icon}
			</div>

			<div className="metric-value-row">
				<span className="metric-value">{value}</span>
				<span className="metric-unit">{unit}</span>
			</div>

			<div className="metric-bar-wrapper">
				<div className="metric-bar-bg">
					<div
						className="metric-bar-fill"
						data-tone={tone}
						style={{
							width: `${Math.min(100, Math.max(0, percent))}%`,
						}}
					/>
				</div>

				{ticks && ticks.length > 0 && (
					<div className="metric-ticks-container">
						{ticks.map((tick) => {
							const isStart = tick.percent <= 5
							const isEnd = tick.percent >= 95
							const align = isStart ? 'left' : isEnd ? 'right' : 'center'
							const style = {
								position: 'absolute' as const,
								left: isEnd ? 'auto' : `${tick.percent}%`,
								right: isEnd ? '0%' : 'auto',
								transform: align === 'center' ? 'translateX(-50%)' : 'none',
							}

							return (
								<div
									key={tick.label}
									className={`metric-tick align-${align}`}
									style={style}
								>
									<div className="metric-tick-line" />
									<span className="metric-tick-label">{tick.label}</span>
								</div>
							)
						})}
					</div>
				)}
			</div>

			<p className="metric-description">{description}</p>
		</article>
	)
}
