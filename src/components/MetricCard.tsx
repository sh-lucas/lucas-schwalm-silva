import React from 'react'

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  unit: string
  percent: number
  barColor: string
  updateFlash: boolean
  description: string
}

export function MetricCard({
  icon,
  label,
  value,
  unit,
  percent,
  barColor,
  updateFlash,
  description
}: MetricCardProps) {
  return (
    <div className={`metric-card ${updateFlash ? 'update-flash' : ''}`}>
      <div className="metric-header">
        <div className="metric-title-group">
          {icon}
          <span className="metric-label">{label}</span>
        </div>
      </div>
      <div className="metric-value-container">
        <span className="metric-value">{value}</span>
        <span className="metric-unit">{unit}</span>
      </div>
      <div className="metric-bar-bg">
        <div 
          className="metric-bar-fill" 
          style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: barColor }} 
        />
      </div>
      <div className="metric-description">
        {description}
      </div>
    </div>
  )
}
