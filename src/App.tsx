import { useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { ExperienceSection } from './components/ExperienceSection'
import { MonitorSection } from './components/MonitorSection'
import { ProjectsSection } from './components/ProjectsSection'
import { SiteHeader } from './components/SiteHeader'
import { TabNav } from './components/TabNav'
import { PRODUCTION_EXCUSES, type SystemMetrics, TABS } from './data'

const METRICS_ENDPOINT = 'https://checkup.sh-lucas.dev/api/metrics'
const METRICS_STREAM_ENDPOINT =
	'https://checkup.sh-lucas.dev/api/metrics/stream'

type StreamStatus = 'sse' | 'polling' | 'connecting'

const EMPTY_METRICS: SystemMetrics = {
	cpu_percent: 0,
	cpu_usage: 0,
	disk_percent: 0,
	io_percent: 0,
	load_avg: 0,
	memory_percent: 0,
	uptime_percent: 0,
	avg_psi: 0,
}

export function App() {
	const navigate = useNavigate()
	const { pathname } = useLocation()

	const activeTab = TABS.find((tab) => tab.route === pathname) ?? TABS[0]

	// Real-time server metrics
	const [metrics, setMetrics] = useState<SystemMetrics>(EMPTY_METRICS)
	const [streamStatus, setStreamStatus] = useState<StreamStatus>('connecting')
	const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date())
	const [clusterUptime, setClusterUptime] = useState<number | null>(null)

	// Easter egg
	const [excuse, setExcuse] = useState(
		'Press generate for a production-ready excuse.',
	)
	const rollExcuse = useCallback(() => {
		setExcuse(
			PRODUCTION_EXCUSES[Math.floor(Math.random() * PRODUCTION_EXCUSES.length)],
		)
	}, [])

	// Metrics fetching: REST polling as baseline, SSE as live upgrade.
	useEffect(() => {
		let pollingInterval: ReturnType<typeof setInterval> | null = null
		let eventSource: EventSource | null = null
		let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
		let sseActive = false

		const applyMetrics = (data: SystemMetrics) => {
			setMetrics(data)
			setLastUpdated(new Date())
			if (data.uptime_percent !== undefined && data.uptime_percent > 0) {
				setClusterUptime((prev) => (prev === null ? data.uptime_percent : prev))
			}
		}

		const poll = async () => {
			try {
				const res = await fetch(METRICS_ENDPOINT)
				if (res.ok && !sseActive) {
					const data = await res.json()
					applyMetrics(data)
					setStreamStatus('polling')
				}
			} catch (e) {
				console.warn('REST polling failed', e)
			}
		}

		poll()
		pollingInterval = setInterval(poll, 1000)

		const connectSSE = () => {
			if (eventSource) {
				eventSource.close()
			}

			try {
				eventSource = new EventSource(METRICS_STREAM_ENDPOINT)

				eventSource.onopen = () => {
					sseActive = true
					setStreamStatus('sse')
					// SSE now owns updates — drop the poller.
					if (pollingInterval) {
						clearInterval(pollingInterval)
						pollingInterval = null
					}
				}

				eventSource.onmessage = (event) => {
					try {
						applyMetrics(JSON.parse(event.data))
					} catch (e) {
						console.error('Failed to parse SSE data', e)
					}
				}

				eventSource.onerror = () => {
					sseActive = false
					eventSource?.close()
					eventSource = null
					setStreamStatus('polling')

					if (!pollingInterval) {
						poll()
						pollingInterval = setInterval(poll, 1000)
					}
					reconnectTimeout = setTimeout(connectSSE, 15000)
				}
			} catch (e) {
				console.warn('SSE not available, staying on polling', e)
			}
		}

		connectSSE()

		// Uptime is computed server-side on a 5m window.
		const uptimeInterval = setInterval(
			async () => {
				try {
					const res = await fetch(METRICS_ENDPOINT)
					if (res.ok) {
						const data = await res.json()
						if (data.uptime_percent !== undefined && data.uptime_percent > 0) {
							setClusterUptime(data.uptime_percent)
						}
					}
				} catch (e) {
					console.warn('5m uptime refresh failed', e)
				}
			},
			5 * 60 * 1000,
		)

		return () => {
			if (eventSource) eventSource.close()
			if (pollingInterval) clearInterval(pollingInterval)
			if (reconnectTimeout) clearTimeout(reconnectTimeout)
			clearInterval(uptimeInterval)
		}
	}, [])

	return (
		<>
			{pathname === '/' && <Navigate to="/metrics" replace />}

			<div className="app-shell">
				<div className="container">
					<SiteHeader online={streamStatus === 'sse'} />

					<TabNav
						activeId={activeTab.id}
						onChange={(route) => navigate(route)}
					/>

					<main className="info-content">
						{activeTab.id === 'monitor' && (
							<MonitorSection
								metrics={metrics}
								streamStatus={streamStatus}
								lastUpdated={lastUpdated}
								clusterUptime={clusterUptime}
								excuse={excuse}
								onRollExcuse={rollExcuse}
							/>
						)}
						{activeTab.id === 'experience' && <ExperienceSection />}
						{activeTab.id === 'projects' && <ProjectsSection />}
					</main>
				</div>

				<footer className="site-footer">
					<span>© {new Date().getFullYear()} Lucas Schwalm Silva</span>
					<span className="footer-meta">React · Vite · self-hosted on k3s</span>
				</footer>
			</div>
		</>
	)
}
