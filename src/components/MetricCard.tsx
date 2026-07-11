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
  ticks?: { percent: number; label: string }[]
}

export function MetricCard({
  icon,
  label,
  value,
  unit,
  percent,
  barColor,
  updateFlash,
  description,
  ticks
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
      <div className="metric-bar-wrapper">
        <div className="metric-bar-bg">
          <div 
            className="metric-bar-fill" 
            style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: barColor }} 
          />
        </div>
        {ticks && ticks.length > 0 && (
          <div className="metric-ticks-container">
            {ticks.map((tick, i) => {
              const isStart = tick.percent <= 5;
              const isEnd = tick.percent >= 95;
              const align = isStart ? 'left' : isEnd ? 'right' : 'center';
              const style: React.CSSProperties = {
                position: 'absolute',
                left: isEnd ? 'auto' : `${tick.percent}%`,
                right: isEnd ? '0%' : 'auto',
                transform: align === 'center' ? 'translateX(-50%)' : 'none',
              };

              return (
                <div
                  key={i}
                  className={`metric-tick align-${align}`}
                  style={style}
                >
                  <div className="metric-tick-line" />
                  <span className="metric-tick-label">{tick.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="metric-description">
        {description}
      </div>
    </div>
  )
}
