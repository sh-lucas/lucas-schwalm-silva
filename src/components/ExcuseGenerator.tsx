import { RefreshCw } from 'lucide-react'

interface ExcuseGeneratorProps {
  excuse: string
  onRoll: () => void
  style?: React.CSSProperties
}

export function ExcuseGenerator({ excuse, onRoll, style }: ExcuseGeneratorProps) {
  return (
    <div className="eccentric-card" style={{ borderColor: 'rgba(245, 158, 11, 0.15)', marginTop: 0, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <h4 style={{ color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 600 }}>
            🤷‍♂️ Excuse Generator
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Pull a production-ready excuse out of thin air
          </p>
        </div>
        <button
          onClick={onRoll}
          className="generator-btn"
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            color: 'var(--accent-amber)',
            borderColor: 'rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            border: '1px solid'
          }}
        >
          <RefreshCw size={14} /> Roll Excuse
        </button>
      </div>
      <p
        style={{
          color: 'var(--text-main)',
          fontSize: '0.88rem',
          fontStyle: 'italic',
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.45',
          marginTop: '1rem',
          borderLeft: '2px solid var(--accent-amber)',
          paddingLeft: '0.75rem',
          minHeight: '2.9rem',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        "{excuse}"
      </p>
    </div>
  )
}
