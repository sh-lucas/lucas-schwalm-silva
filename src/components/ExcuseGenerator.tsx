import { RefreshCw } from 'lucide-react'

interface ExcuseGeneratorProps {
	excuse: string
	onRoll: () => void
	style?: React.CSSProperties
}

export function ExcuseGenerator({
	excuse,
	onRoll,
	style,
}: ExcuseGeneratorProps) {
	return (
		<div
			className="eccentric-card excuse-generator-card"
			style={{
				borderColor: 'rgba(245, 158, 11, 0.15)',
				marginTop: 0,
				...style,
			}}
		>
			<div className="excuse-header">
				<div className="excuse-header-info">
					<h4 className="excuse-title">Production excuse</h4>
					<p className="excuse-subtitle">
						Pull a production-ready excuse out of thin air
					</p>
				</div>
				<button
					onClick={onRoll}
					className="generator-btn excuse-roll-btn"
					type="button"
				>
					<RefreshCw size={14} /> Generate
				</button>
			</div>
			<p className="excuse-quote">"{excuse}"</p>
		</div>
	)
}
