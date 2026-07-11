import {
	Activity,
	Coffee,
	Cpu,
	ExternalLink,
	Github,
	HardDrive,
	Linkedin,
	Mail,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { ExcuseGenerator } from './components/ExcuseGenerator'
// Component imports
import { MetricCard } from './components/MetricCard'

// Metrics Data interface
interface SystemMetrics {
	cpu_percent: number
	cpu_usage: number
	disk_percent: number
	io_percent: number
	load_avg: number
	memory_percent: number
	uptime_percent: number
	avg_psi: number
}

// Route <-> tab mapping
const ROUTE_TO_TAB: Record<string, string> = {
	'/metrics': 'Live Monitor',
	'/experience': 'Experience',
	'/projects': 'Projects',
}
const TAB_TO_ROUTE: Record<string, string> = {
	'Live Monitor': '/metrics',
	Experience: '/experience',
	Projects: '/projects',
}

const PROJECTS = [
	{
		name: 'lucas-schwalm-silva',
		link: 'https://github.com/sh-lucas/lucas-schwalm-silva',
		techs: 'TypeScript, React',
		desc: 'This very website. A portfolio and live server dashboard built with React and Vite.',
	},
	{
		name: 'Teapot',
		link: 'https://github.com/sh-lucas/teapot',
		techs: 'Go, WebSockets, HTML',
		desc: "Stream your Docker container's stdout/stderr live to a clean web console. Minimalist and simple.",
	},
	{
		name: 'libsql-handler',
		link: 'https://github.com/sh-lucas/libsql-handler',
		techs: 'Go',
		desc: 'A pure Go implementation of the libSQL Hrana protocol to query remote databases directly without needing sqld.',
	},
	{
		name: 'GoProxy',
		link: 'https://github.com/sh-lucas/goproxy',
		techs: 'Go, YAML',
		desc: 'Reverse proxy that redirects prefix routes to upstream hosts. Configurable via YAML, when caddy is overkill.',
	},
]

const PRODUCTION_EXCUSES = [
	'The Garbage Collector decided to take an extended coffee break.',
	'A rogue loop in the Kubernetes Scheduler is currently questioning its life choices.',
	'The ssh key expired somehow and I did not notice.',
	'The Docker daemon has temporarily transitioned to a spiritual retreat.',
	'A cloud provider engineer tripped over a fiber cable.',
	'The CPU is just running a thermal workout to keep the server farm warm.',
	"It works on my machine. Have you checked if your hemisphere's gravity is reversed?",
	'A microservice entered a reactive existential crisis.',
	"A junior developer committed a 'temporary' testing endpoint to production.",
	'The database connection pool is currently social distancing.',
	'A cosmic ray hit the exact transistor hosting the index page.',
	"I forgot to renew the domain.",
	"The CI/CD pipeline decided to rebuild the Universe.",
	'A temporary log file currently weights 4.2TB.',
	'Someone ran a regex that is still backtracking from 1999.',
	'The server is actually online, just not publicly reachable right now.',
	"PHP's fault, actually.",
	'DNS propagation is currently traveling at the speed of continental drift.',
	'The immutable system configuration mutated itself out of existence (again).',
	'The background workers formed a union and went on strike.',
	'The SSL certificate expired exactly 3 seconds after the sysadmin went to sleep.',
	'We accidentally deployed the local mock database to us-east-1.',
	'The system ran out of file descriptors and dignity.',
	'A deadlock occurred between the main thread and the coffee machine.',
	'The load balancer is distributing pure chaos equally across all nodes.',
	'We hit the integer overflow limit on our cloud provider billing account.',
	'We removed the french documentation to save some space and it stopped working.',
	'We deleted an empty file named "temporary-log_v2(3).txt" and now the rollback is also broken.',
	'The scheduler entered a priority inversion loop and forgot how to count.',
	'We decided to turn it off to save some energy for tomorrow.',
	'You are absolutely right! ...',
]

export function App() {
	const navigate = useNavigate()
	const { pathname } = useLocation()

	// Derive active tab from URL; redirect / → /metrics handled via Navigate below
	const tab = ROUTE_TO_TAB[pathname] ?? 'Live Monitor'
	const setTab = (t: string) => navigate(TAB_TO_ROUTE[t] ?? '/metrics')

	// Real-time server metrics state
	const [metrics, setMetrics] = useState<SystemMetrics>({
		cpu_percent: 0,
		cpu_usage: 0,
		disk_percent: 0,
		io_percent: 0,
		load_avg: 0,
		memory_percent: 0,
		uptime_percent: 0,
		avg_psi: 0,
	})

	// Connection states
	const [streamStatus, setStreamStatus] = useState<
		'sse' | 'polling' | 'connecting'
	>('connecting')
	const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
	const [updateFlash, setUpdateFlash] = useState(false)

	// Excuse Generator state
	const [productionExcuse, setProductionExcuse] = useState<string>(
		'Click the button to pull a production-ready excuse out of thin air.',
	)

	const rollExcuse = () => {
		const randomExcuse =
			PRODUCTION_EXCUSES[Math.floor(Math.random() * PRODUCTION_EXCUSES.length)]
		setProductionExcuse(randomExcuse)
	}

	// Calculate age
	const birthDate = new Date('2005-02-02')
	const today = new Date()
	let age = today.getFullYear() - birthDate.getFullYear()
	if (today.getMonth() < 1 || (today.getMonth() === 1 && today.getDate() < 2)) {
		age--
	}

	// --- Metrics fetching: polling as primary, SSE as upgrade ---
	const applyMetrics = (data: SystemMetrics) => {
		setMetrics(data)
		setLastUpdated(new Date())
		setUpdateFlash(true)
		setTimeout(() => setUpdateFlash(false), 300)
	}

	useEffect(() => {
		let pollingInterval: ReturnType<typeof setInterval> | null = null
		let eventSource: EventSource | null = null
		let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
		let sseActive = false

		// 1. Start REST polling immediately as baseline
		const poll = async () => {
			try {
				const res = await fetch('https://checkup.sh-lucas.dev/api/metrics')
				if (res.ok) {
					const data = await res.json()
					if (!sseActive) {
						applyMetrics(data)
						setStreamStatus('polling')
					}
				}
			} catch (e) {
				console.warn('REST polling failed', e)
			}
		}

		poll() // immediate first fetch
		pollingInterval = setInterval(poll, 1000)

		// 2. Attempt SSE upgrade in parallel
		const connectSSE = () => {
			if (eventSource) {
				eventSource.close()
			}

			try {
				eventSource = new EventSource(
					'https://checkup.sh-lucas.dev/api/metrics/stream',
				)

				eventSource.onopen = () => {
					sseActive = true
					setStreamStatus('sse')
					// SSE now handles updates, reduce polling frequency
					if (pollingInterval) {
						clearInterval(pollingInterval)
						pollingInterval = null
					}
				}

				eventSource.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data)
						applyMetrics(data)
					} catch (e) {
						console.error('Failed to parse SSE data', e)
					}
				}

				eventSource.onerror = () => {
					sseActive = false
					eventSource?.close()
					eventSource = null
					setStreamStatus('polling')

					// Restore polling if not already running
					if (!pollingInterval) {
						poll()
						pollingInterval = setInterval(poll, 1000)
					}

					// Try SSE again after 15s
					reconnectTimeout = setTimeout(connectSSE, 15000)
				}
			} catch (e) {
				console.warn('SSE not available, staying on polling', e)
			}
		}

		connectSSE()

		return () => {
			if (eventSource) eventSource.close()
			if (pollingInterval) clearInterval(pollingInterval)
			if (reconnectTimeout) clearTimeout(reconnectTimeout)
		}
	}, [])

	return (
		<>
			{/* Redirect / → /metrics */}
			{pathname === '/' && <Navigate to="/metrics" replace />}
			<div className="app-wrapper">
				{/* Centered Single-Column Container */}
				<div className="container">
					{/* Profile Section aligned side-by-side (Header) */}
					<header className="profile-header">
						<div className="avatar-wrapper">
							<img
								src="https://avatars.githubusercontent.com/u/57202598?s=400&u=07d28aa77c08dcef79364a50831a494c1b16fecf&v=4"
								alt="Lucas profile"
								className="avatar-img"
							/>
							<div
								className={`pulse-indicator ${streamStatus === 'sse' ? 'active' : 'inactive'}`}
							/>
						</div>
						<div className="profile-info" style={{ gap: '1rem' }}>
							<div>
								<h1
									className="title-gradient"
									style={{ fontSize: '2.8rem', lineHeight: '1.1' }}
								>
									Hello, I am{' '}
									<span style={{ textDecoration: 'underline' }}>Lucas</span>!
								</h1>
								<p
									style={{
										color: 'var(--text-muted)',
										fontFamily: 'var(--font-mono)',
										fontSize: '0.85rem',
										marginTop: '0.4rem',
									}}
								>
									&lt;Computer Engineer / Full Stack&gt;
								</p>
							</div>

							<div>
								<p
									style={{
										color: 'var(--text-main)',
										fontSize: '1rem',
										lineHeight: '1.6',
									}}
								>
									{age} y/o student at{' '}
									<span
										style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
									>
										UERGS
									</span>
									, looking for experience and self development.
								</p>
								<p
									style={{
										color: 'var(--text-muted)',
										fontSize: '0.9rem',
										marginTop: '0.35rem',
									}}
								>
									Currently coding production-ready bugs at{' '}
									<a
										href="https://roxcode.io/"
										target="_blank"
										rel="noopener noreferrer"
										style={{
											color: 'var(--accent-cyan)',
											fontWeight: 500,
											textDecoration: 'none',
										}}
									>
										Roxcode
									</a>
									.
								</p>
							</div>

							<div className="social-links" style={{ marginTop: '0.25rem' }}>
								<a
									href="https://github.com/sh-lucas"
									target="_blank"
									rel="noopener noreferrer"
									className="social-btn outline"
								>
									<Github size={18} /> Github
								</a>
								<a
									href="https://www.linkedin.com/in/lucas-schwalm-silva/"
									target="_blank"
									rel="noopener noreferrer"
									className="social-btn outline"
								>
									<Linkedin size={18} /> LinkedIn
								</a>
								<a
									href="mailto:lucas.schwalm.silva@gmail.com"
									className="social-btn primary"
								>
									<Mail size={18} /> Contact
								</a>
							</div>
						</div>
					</header>

					{/* Tab Selection Switcher */}
					<div className="tab-container">
						<button
							className={`tab-btn ${tab === 'Live Monitor' ? 'active' : ''}`}
							onClick={() => setTab('Live Monitor')}
						>
							Live Monitor
						</button>
						<button
							className={`tab-btn ${tab === 'Experience' ? 'active' : ''}`}
							onClick={() => setTab('Experience')}
						>
							Experience
						</button>
						<button
							className={`tab-btn ${tab === 'Projects' ? 'active' : ''}`}
							onClick={() => setTab('Projects')}
						>
							Projects
						</button>
					</div>

					{/* Dynamic Tab Contents */}
					<main className="info-content">
						{tab === 'Experience' && (
							<div
								className="glass-card fade-in"
								style={{
									display: 'flex',
									flexDirection: 'column',
									gap: '1.5rem',
								}}
							>
								{/* Roxcode */}
								<div>
									<div
										style={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'baseline',
										}}
									>
										<h3
											style={{
												fontSize: '1.1rem',
												color: 'var(--text-main)',
												fontWeight: 600,
											}}
										>
											Full Stack Engineer
										</h3>
										<span
											style={{
												fontSize: '0.78rem',
												color: 'var(--text-muted)',
												fontFamily: 'var(--font-mono)',
											}}
										>
											2024 – present
										</span>
									</div>
									<p
										style={{
											fontSize: '0.85rem',
											color: 'var(--text-muted)',
											marginTop: '0.15rem',
										}}
									>
										<a
											href="https://roxcode.io/"
											target="_blank"
											rel="noopener noreferrer"
											style={{
												color: 'var(--accent-cyan)',
												textDecoration: 'none',
											}}
										>
											Roxcode
										</a>{' '}
										· Remote (Brazil)
									</p>
									<p
										style={{
											fontSize: '0.85rem',
											color: 'var(--text-muted)',
											marginTop: '0.6rem',
											lineHeight: '1.55',
										}}
									>
										Web development, NodeJS and React maintenance, Golang and microservices architecture.
									</p>
									<div
										style={{
											display: 'flex',
											flexWrap: 'wrap',
											gap: '0.4rem',
											marginTop: '0.75rem',
										}}
									>
										{['Go', 'MongoDB', 'TypeScript', 'RabbitMQ', 'SQL'].map((t) => (
											<span
												key={t}
												style={{
													fontFamily: 'var(--font-mono)',
													fontSize: '0.72rem',
													color: 'var(--text-muted)',
													background: 'rgba(255,255,255,0.05)',
													padding: '0.15rem 0.5rem',
													borderRadius: '4px',
													border: '1px solid var(--border-color)',
												}}
											>
												{t}
											</span>
										))}
									</div>
								</div>

								{/* UERGS */}
								<div
									style={{
										borderTop: '1px solid var(--border-color)',
										paddingTop: '1.25rem',
									}}
								>
									<div
										style={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'baseline',
										}}
									>
										<h3
											style={{
												fontSize: '1.1rem',
												color: 'var(--text-main)',
												fontWeight: 600,
											}}
										>
											Computer Engineering
										</h3>
										<span
											style={{
												fontSize: '0.78rem',
												color: 'var(--text-muted)',
												fontFamily: 'var(--font-mono)',
											}}
										>
											2023 – 2027
										</span>
									</div>
									<p
										style={{
											fontSize: '0.85rem',
											color: 'var(--text-muted)',
											marginTop: '0.15rem',
										}}
									>
										UERGS · Porto Alegre, Brazil
									</p>
									<p
										style={{
											fontSize: '0.85rem',
											color: 'var(--text-muted)',
											marginTop: '0.6rem',
											lineHeight: '1.55',
										}}
									>
										Hardware architecture, Parallel computing, Low-level programming. Strong math foundation.
									</p>
									<div
										style={{
											display: 'flex',
											flexWrap: 'wrap',
											gap: '0.4rem',
											marginTop: '0.75rem',
										}}
									>
										{['C', 'Mathematics', 'Parallel Computing'].map((t) => (
											<span
												key={t}
												style={{
													fontFamily: 'var(--font-mono)',
													fontSize: '0.72rem',
													color: 'var(--text-muted)',
													background: 'rgba(255,255,255,0.05)',
													padding: '0.15rem 0.5rem',
													borderRadius: '4px',
													border: '1px solid var(--border-color)',
												}}
											>
												{t}
											</span>
										))}
									</div>
								</div>

								{/* Minor experiences */}
								<div
									style={{
										borderTop: '1px solid var(--border-color)',
										paddingTop: '1.25rem',
									}}
								>
									<h4
										style={{
											fontSize: '0.75rem',
											color: 'var(--text-dark)',
											textTransform: 'uppercase',
											letterSpacing: '0.06em',
											marginBottom: '1rem',
										}}
									>
										Minor experiences
									</h4>
									<div
										style={{
											display: 'flex',
											flexDirection: 'column',
											gap: '0.9rem',
										}}
									>
										<div>
											<p
												style={{
													fontSize: '0.9rem',
													color: 'var(--text-main)',
													fontWeight: 500,
												}}
											>
												Dumbly self-hosting k3s
											</p>
											<p
												style={{
													fontSize: '0.82rem',
													color: 'var(--text-muted)',
													marginTop: '0.2rem',
													lineHeight: '1.5',
												}}
											>
												Running a personal Kubernetes cluster on Oracle Free
												Tier. Podman, NixOS, Cloudflare Tunnels.
											</p>
											<div
												style={{
													display: 'flex',
													flexWrap: 'wrap',
													gap: '0.4rem',
													marginTop: '0.5rem',
												}}
											>
												{['Podman', 'Linux', 'k3s'].map((t) => (
													<span
														key={t}
														style={{
															fontFamily: 'var(--font-mono)',
															fontSize: '0.72rem',
															color: 'var(--text-muted)',
															background: 'rgba(255,255,255,0.05)',
															padding: '0.15rem 0.5rem',
															borderRadius: '4px',
															border: '1px solid var(--border-color)',
														}}
													>
														{t}
													</span>
												))}
											</div>
										</div>
										<div>
											<p
												style={{
													fontSize: '0.9rem',
													color: 'var(--text-main)',
													fontWeight: 500,
												}}
											>
												checkup — Live monitor's API
											</p>
											<p
												style={{
													fontSize: '0.82rem',
													color: 'var(--text-muted)',
													marginTop: '0.2rem',
													lineHeight: '1.5',
												}}
											>
												Real-time system health endpoint powering this
												dashboard. SSE streaming, REST fallback.
											</p>
											<div
												style={{
													display: 'flex',
													flexWrap: 'wrap',
													gap: '0.4rem',
													marginTop: '0.5rem',
												}}
											>
												{['Rust', 'SQLite'].map((t) => (
													<span
														key={t}
														style={{
															fontFamily: 'var(--font-mono)',
															fontSize: '0.72rem',
															color: 'var(--text-muted)',
															background: 'rgba(255,255,255,0.05)',
															padding: '0.15rem 0.5rem',
															borderRadius: '4px',
															border: '1px solid var(--border-color)',
														}}
													>
														{t}
													</span>
												))}
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						{tab === 'Projects' && (
							<div className="glass-card fade-in project-list">
								{PROJECTS.map((p) => (
									<a
										key={p.name}
										href={p.link}
										target="_blank"
										rel="noopener noreferrer"
										className="project-item"
									>
										<div className="project-header">
											<span className="project-name">{p.name}</span>
											<div
												style={{
													display: 'flex',
													alignItems: 'center',
													gap: '0.5rem',
												}}
											>
												<span className="project-tech">{p.techs}</span>
												<ExternalLink
													size={13}
													style={{ color: 'var(--text-dark)', flexShrink: 0 }}
												/>
											</div>
										</div>
										<p className="project-desc">{p.desc}</p>
									</a>
								))}
							</div>
						)}

						{tab === 'Live Monitor' && (
							<div
								className="fade-in"
								style={{
									display: 'flex',
									flexDirection: 'column',
									gap: '1.5rem',
								}}
							>
								{/* Dashboard Sub-Header */}
								<div style={{ padding: '0 0.25rem', marginBottom: '1.25rem' }}>
									<h2
										style={{
											fontSize: '1.5rem',
											color: 'var(--text-main)',
											fontWeight: 600,
										}}
									>
										Live Node Monitor
									</h2>
									<p
										style={{
											color: 'var(--text-muted)',
											fontSize: '0.82rem',
											marginTop: '0.2rem',
										}}
									>
										Self-hosted k3s single-node cluster - Last sync:{' '}
										{lastUpdated.toLocaleTimeString()}
									</p>
								</div>

								{/* Panic banner alerts (dispara apenas com load de servidor crítico) */}
								{/* {metrics.load_avg >= 8.0 && (
									<div className="panic-banner">
										<div className="panic-title">
											<AlertTriangle size={18} className="glow-text" />
											<span>LOAD THRESHOLD WARNING: SYSTEM OVERSTRESSED</span>
										</div>
										<span
											style={{
												fontSize: '0.8rem',
												opacity: 0.8,
												fontFamily: 'monospace',
											}}
										>
											Load: {metrics.load_avg.toFixed(2)}
										</span>
									</div>
								)} */}

								{/* Metrics Grid */}
								<div className="metrics-grid">
									<MetricCard
										icon={<Cpu className="metric-icon" />}
										label="Hamster Wheel Speed"
										value={metrics.cpu_percent.toFixed(1)}
										unit="%"
										percent={metrics.cpu_percent}
										barColor="var(--accent-primary)"
										updateFlash={updateFlash}
										description="Current CPU usage across the 2 (exclusive) virtual cores."
									/>
									<MetricCard
										icon={
											<Activity
												className="metric-icon"
												style={{ color: 'var(--accent-cyan)' }}
											/>
										}
										label="Thermos Bottle Emptiness"
										value={metrics.memory_percent.toFixed(1)}
										unit="%"
										percent={metrics.memory_percent}
										barColor="var(--accent-cyan)"
										updateFlash={updateFlash}
										description="Cache-free RAM usage across all running services out of 12 GB."
									/>
									<MetricCard
										icon={
											<HardDrive
												className="metric-icon"
												style={{ color: 'var(--accent-emerald)' }}
											/>
										}
										label="Kitten memes folder size"
										value={((metrics.disk_percent / 100) * 150).toFixed(1)}
										unit="GB"
										percent={metrics.disk_percent}
										barColor="var(--accent-emerald)"
										updateFlash={updateFlash}
										description="Used disk space on the 150 GB NVMe."
									/>
									<MetricCard
										icon={
											<Coffee
												className="metric-icon"
												style={{ color: 'var(--accent-amber)' }}
											/>
										}
										label="Coffees needed today"
										value={metrics.avg_psi}
										unit="cups"
										percent={Math.min(100, ((metrics.avg_psi ?? 0) / 20) * 100)}
										barColor="var(--accent-amber)"
										updateFlash={updateFlash}
										description="Average resource pressure (psi). Ranges 0-100."
									/>
								</div>

								<ExcuseGenerator
									excuse={productionExcuse}
									onRoll={rollExcuse}
								/>
							</div>
						)}
					</main>
				</div>

				<div className="content-bottom-pad" />

				{/* Fixed footer */}
				<footer className="site-footer">
					<span>
						Made with lots of coffee by Lucas Silva © {new Date().getFullYear()}
					</span>
					<div className="footer-sep" />
					<a
						href="https://github.com/sh-lucas/lucas-schwalm-silva"
						target="_blank"
						rel="noopener noreferrer"
					>
						Source Code <ExternalLink size={11} />
					</a>
				</footer>
			</div>
		</>
	)
}
