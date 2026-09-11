import { TABS } from '../data'

interface TabNavProps {
	activeId: string
	onChange: (route: string) => void
}

export function TabNav({ activeId, onChange }: TabNavProps) {
	return (
		<nav className="tab-nav" aria-label="Sections">
			{TABS.map((tab) => (
				<button
					key={tab.id}
					type="button"
					className={`tab-btn ${tab.id === activeId ? 'active' : ''}`}
					onClick={() => onChange(tab.route)}
				>
					{tab.label}
				</button>
			))}
		</nav>
	)
}
