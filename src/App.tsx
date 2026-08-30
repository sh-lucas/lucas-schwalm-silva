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
import { useCallback, useEffect, useState } from 'react'
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

const EXPERIENCES = [
	{
		company: 'Roxcode',
		role: 'Full Stack Developer',
		link: 'https://roxcode.io/',
		highlights: [
			'Backend development and integrations for reward programs in the Internacional Shopping and Nectar Market mobile apps.',
			"Maintenance and development for Frigelar's mobile app and CRM.",
			'RAG pipelines, image processing, and text extraction with embedded AI (TFLite) and cloud AI (Vertex AI).',
		],
		techs: ['Microservices', 'Golang', 'NestJS', 'SQL', 'MongoDB'],
	},
	{
		company: 'Metria Sales',
		role: 'Freelance Full Stack Developer',
		link: 'https://metriasales.com/',
		highlights: [
			'Full-stack web and backend development for sales CRM.',
			'AI integrations, data processing, and classification pipelines.',
		],
		techs: ['Node.js', 'MySQL', 'React'],
	},
	{
		company: 'Fascode',
		role: 'Collaboration & Consulting',
		link: 'https://www.fascode.com.br/',
		highlights: [
			'Development of internal core products as well as custom client solutions.',
			'Infrastructure architecture and maintenance across distributed projects.',
		],
		techs: ['Spring Boot', 'SQLite', 'React'],
	},
]

const PROJECTS = [
	{
		name: 'lucas-schwalm-silva',
		link: 'https://github.com/sh-lucas/lucas-schwalm-silva',
		techs: 'TypeScript, React',
		desc: 'This very website. A portfolio and live server dashboard built with React and Vite.',
	},
	{
		name: 'Plinth',
		link: 'https://about.plinth.sh-lucas.dev',
		techs: 'Web API',
		desc: 'A multi-tenant ledger for managing any quantity, built to be auditable, reliable, and extensively configurable.',
	},
	{
		name: 'libsql-handler',
		link: 'https://github.com/sh-lucas/libsql-handler',
		techs: 'Go',
		desc: 'A pure Go implementation of the libSQL Hrana protocol to query remote databases directly without needing sqld.',
	},
	{
		name: 'Teapot',
		link: 'https://github.com/sh-lucas/teapot',
		techs: 'Go, WebSockets',
		desc: "Stream your Docker container's stdout/stderr live to a clean web console. Minimalist and simple.",
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
	'I forgot to renew the domain.',
	'The CI/CD pipeline decided to rebuild the Universe.',
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

const getUptimeComment = (uptime: number) => {
	if (uptime > 95) {
		return 'Perfect uptime. Totally trustworthy'
	}
	if (uptime > 50) {
		return 'Some usual stuff is going on'
	}
	return 'Well... At least the statistics are working'
}

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
	const [clusterUptime, setClusterUptime] = useState<number | null>(null)

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
	const applyMetrics = useCallback((data: SystemMetrics) => {
		setMetrics(data)
		setLastUpdated(new Date())
		if (data.uptime_percent !== undefined && data.uptime_percent > 0) {
			setClusterUptime((prev) => (prev === null ? data.uptime_percent : prev))
		}
	}, [])

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

		// 3. Refresh uptime statistic every 5 minutes (since backend calculates uptime on a 5m window)
		const uptimeInterval = setInterval(
			async () => {
				try {
					const res = await fetch('https://checkup.sh-lucas.dev/api/metrics')
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
			if (uptimeInterval) clearInterval(uptimeInterval)
		}
	}, [applyMetrics])

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
						<div className="profile-info">
							<div>
								<p className="profile-kicker">Porto Alegre, Brazil</p>
								<h1 className="profile-title">Lucas Schwalm Silva</h1>
								<p className="profile-tag">
									Computer Engineer & Full-stack Developer
								</p>
							</div>

							<div>
								<p className="profile-bio">
									{age} y/o student at{' '}
									<span className="inline-accent">UERGS</span>, building
									software that fits.
								</p>
								<p className="profile-current">
									Currently coding at{' '}
									<a
										href="https://roxcode.io/"
										target="_blank"
										rel="noopener noreferrer"
										className="inline-link"
									>
										Roxcode
									</a>
									.
								</p>
							</div>

							<div className="social-links">
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
							type="button"
							className={`tab-btn ${tab === 'Live Monitor' ? 'active' : ''}`}
							onClick={() => setTab('Live Monitor')}
						>
							Monitor
						</button>
						<button
							type="button"
							className={`tab-btn ${tab === 'Experience' ? 'active' : ''}`}
							onClick={() => setTab('Experience')}
						>
							Experience
						</button>
						<button
							type="button"
							className={`tab-btn ${tab === 'Projects' ? 'active' : ''}`}
							onClick={() => setTab('Projects')}
						>
							Projects
						</button>
					</div>

					{/* Dynamic Tab Contents */}
					<main className="info-content">
						{tab === 'Experience' && (
							<div className="glass-card fade-in experience-list">
								{EXPERIENCES.map((exp) => (
									<div key={exp.company} className="experience-item">
										<div className="experience-header">
											<h3 className="experience-role">{exp.role}</h3>
											{exp.link ? (
												<a
													href={exp.link}
													target="_blank"
													rel="noopener noreferrer"
													className="experience-company"
												>
													@ {exp.company}
												</a>
											) : (
												<span className="experience-company">
													@{exp.company}
												</span>
											)}
										</div>

										<ul className="experience-highlights">
											{exp.highlights.map((item) => (
												<li key={item}>{item}</li>
											))}
										</ul>

										<div className="experience-tags">
											{exp.techs.map((t) => (
												<span key={t} className="experience-tag">
													{t}
												</span>
											))}
										</div>
									</div>
								))}
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
											<div className="project-tech-group">
												<span className="project-tech">{p.techs}</span>
												<ExternalLink size={13} className="project-tech-icon" />
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
								{/* Kubernetes Cluster Section */}
								<section className="k8s-cluster-section">
									<h3 className="k8s-cluster-title">Self-hosted k3s cluster</h3>

									<div className="k8s-cluster-banner">
										{/* Main Highlighted Uptime Display (Primary Information) */}
										<div className="k8s-main-uptime-section">
											<div className="k8s-uptime-value-row">
												<div className="k8s-uptime-summary-row">
													<div className="k8s-uptime-number-group">
														<span className="k8s-uptime-value">
															{clusterUptime !== null && clusterUptime > 0
																? clusterUptime.toFixed(2)
																: '100.00'}
														</span>
														<span className="k8s-uptime-unit">%</span>
													</div>
													<span className="k8s-uptime-label-title">
														Cluster Uptime this week
													</span>
												</div>

												<div className="k8s-uptime-subcomment">
													(
													{getUptimeComment(
														clusterUptime !== null && clusterUptime > 0
															? clusterUptime
															: 100.0,
													)}
													)
												</div>
											</div>
										</div>

										{/* Excuse Generator placed directly below Uptime */}
										<ExcuseGenerator
											excuse={productionExcuse}
											onRoll={rollExcuse}
											style={{
												background: 'transparent',
												border: 'none',
												borderRadius: 0,
												padding: 0,
												marginBottom: 0,
											}}
										/>
									</div>
								</section>

								{/* Metrics Section */}
								<section className="live-metrics-section">
									<div className="live-metrics-header">
										<h3 className="live-metrics-title">Live System Metrics</h3>
										<p className="live-metrics-updated">
											Last updated at {lastUpdated.toLocaleTimeString()}
										</p>
									</div>
									<div className="metrics-grid">
										<MetricCard
											icon={<Cpu className="metric-icon" />}
											label="Hamster Wheel Speed (CPU %)"
											value={metrics.cpu_percent.toFixed(1)}
											unit="%"
											percent={metrics.cpu_percent}
											barColor="var(--accent-primary)"
											description="Current CPU usage across the 2 (exclusive) virtual cores."
										/>
										<MetricCard
											icon={
												<Activity
													className="metric-icon"
													style={{ color: 'var(--accent-cyan)' }}
												/>
											}
											label="Thermos Bottle Level (RAM)"
											value={metrics.memory_percent.toFixed(1)}
											unit="%"
											percent={metrics.memory_percent}
											barColor="var(--accent-cyan)"
											description="Cache-free RAM usage across all running services out of 12 GB."
										/>
										<MetricCard
											icon={
												<HardDrive
													className="metric-icon"
													style={{ color: 'var(--accent-emerald)' }}
												/>
											}
											label="Kitten memes folder size (disk)"
											value={((metrics.disk_percent / 100) * 150).toFixed(1)}
											unit="GB"
											percent={metrics.disk_percent}
											barColor="var(--accent-emerald)"
											description="Used disk space on the 150 GB NVMe."
										/>
										<MetricCard
											icon={
												<Coffee
													className="metric-icon"
													style={{ color: 'var(--accent-amber)' }}
												/>
											}
											label="Coffees needed (PSI %)"
											value={metrics.avg_psi}
											unit="cups"
											percent={
												(metrics.avg_psi ?? 0) <= 20
													? ((metrics.avg_psi ?? 0) / 20) * 70
													: 70 + (((metrics.avg_psi ?? 0) - 20) / 80) * 30
											}
											barColor="var(--accent-amber)"
											description="Average resource pressure. Ranges 0-100% but 20%+ is already resource starvation."
											ticks={[
												{ percent: 70, label: '20%' },
												{ percent: 100, label: '100%' },
											]}
										/>
									</div>
								</section>
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
				</footer>
			</div>
		</>
	)
}
