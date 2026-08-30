import { RefreshCw } from 'lucide-react'

interface ExcuseGeneratorProps {
	excuse: string
	onRoll: () => void
}

export function ExcuseGenerator({ excuse, onRoll }: ExcuseGeneratorProps) {
	return (
		<div className="excuse-card">
			<div className="excuse-head">
				<span className="excuse-title">Excuse generator</span>
				<button type="button" className="excuse-roll-btn" onClick={onRoll}>
					<RefreshCw size={12} /> Generate
				</button>
			</div>
			<p className="excuse-quote">“{excuse}”</p>
		</div>
	)
}
