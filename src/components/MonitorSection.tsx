import { Cpu, Gauge, HardDrive, MemoryStick } from 'lucide-react'
import type { ReactNode } from 'react'

import type { SystemMetrics } from '../data'
import { ExcuseGenerator } from './ExcuseGenerator'
import { MetricCard, type MetricTone } from './MetricCard'

type StreamStatus = 'sse' | 'polling' | 'connecting'

interface MonitorSectionProps {
	metrics: SystemMetrics
	streamStatus: StreamStatus
	lastUpdated: Date
	clusterUptime: number | null
	excuse: string
	onRollExcuse: () => void
}

const STREAM_LABELS: Record<StreamStatus, string> = {
	sse: 'live · sse stream',
	polling: 'live · http polling',
	connecting: 'connecting…',
}

const getUptimeComment = (uptime: number) => {
	if (uptime >= 99) return 'Perfect uptime — something feels odd.'
	if (uptime > 95) return 'A hiccup or two, all resolved.'
	if (uptime > 50) return 'A rough week for the node.'
	return 'The cluster has seen better days.'
}

const toneFor = (
	value: number,
	warnThreshold = 70,
	criticalThreshold = 90,
): MetricTone => {
	if (value >= criticalThreshold) return 'critical'
	if (value >= warnThreshold) return 'warn'
	return 'ok'
}

function psiToBarPercent(psi: number): number {
	// 20% PSI marks the starvation threshold and maps to 70% of the bar;
	// everything above stretches across the remaining third.
	if (psi <= 20) return (psi / 20) * 70
	return 70 + ((psi - 20) / 80) * 30
}

interface MetricConfig {
	icon: ReactNode
	label: string
	value: string
	unit: string
	percent: number
	tone: MetricTone
	description: string
	ticks?: { percent: number; label: string }[]
}

function buildMetricConfigs(m: SystemMetrics): MetricConfig[] {
	const psi = m.avg_psi ?? 0

	return [
		{
			icon: <Cpu size={14} className="metric-icon" />,
			label: 'Hamster wheel speed — CPU usage',
			value: m.cpu_percent.toFixed(1),
			unit: '%',
			percent: m.cpu_percent,
			tone: toneFor(m.cpu_percent),
			description: 'Utilization across 2 dedicated vCPUs.',
		},
		{
			icon: <MemoryStick size={14} className="metric-icon" />,
			label: 'Coffee cup fullness — Memory',
			value: m.memory_percent.toFixed(1),
			unit: '%',
			percent: m.memory_percent,
			tone: toneFor(m.memory_percent),
			description: 'Usage across 12 GB of RAM.',
		},
		{
			icon: <HardDrive size={14} className="metric-icon" />,
			label: 'Available space for memes — Disk',
			value: ((m.disk_percent / 100) * 150).toFixed(1),
			unit: 'GB',
			percent: m.disk_percent,
			tone: toneFor(m.disk_percent, 80, 95),
			description: 'Used space on the 150 GB NVMe volume.',
		},
		{
			icon: <Gauge size={14} className="metric-icon" />,
			label: 'Average developer concern — kernel PSI',
			value: psi.toFixed(1),
			unit: '%',
			percent: psiToBarPercent(psi),
			tone: toneFor(psi, 20, 60),
			description:
				'Average resource pressure across CPU, memory and I/O. Above 20% signals starvation.',
			ticks: [{ percent: 70, label: '20%' }],
		},
	]
}

export function MonitorSection({
	metrics,
	streamStatus,
	lastUpdated,
	clusterUptime,
	excuse,
	onRollExcuse,
}: MonitorSectionProps) {
	const uptime =
		clusterUptime !== null && clusterUptime > 0 ? clusterUptime : 100

	return (
		<section className="monitor fade-in" aria-label="Live monitor">
			{/* Cluster status */}
			<div className="status-card">
				<div className="status-row">
					<div className="status-id">
						<div>
							<div className="status-name">Self-hosted k3s cluster</div>
							<div className="status-stream">{STREAM_LABELS[streamStatus]}</div>
						</div>
					</div>

					<div className="status-uptime">
						<div className="status-uptime-value">
							{uptime.toFixed(2)}
							<span className="unit">%</span>
						</div>
						<span className="status-uptime-range">uptime · past week</span>
					</div>
				</div>

				<p className="status-note">{getUptimeComment(uptime)}</p>
			</div>

			{/* Live metrics */}
			<div className="metrics-section">
				<div className="section-head">
					<h2 className="section-head-title">System metrics</h2>
					<span className="section-head-meta">
						updated {lastUpdated.toLocaleTimeString()}
					</span>
				</div>

				<div className="metrics-grid">
					{buildMetricConfigs(metrics).map((config) => (
						<MetricCard key={config.label} {...config} />
					))}
				</div>
			</div>

			{/* Easter egg */}
			<ExcuseGenerator excuse={excuse} onRoll={onRollExcuse} />
		</section>
	)
}
