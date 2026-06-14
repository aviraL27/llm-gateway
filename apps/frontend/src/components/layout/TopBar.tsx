import { ShieldCheck } from 'lucide-react';
import GlassBadge from '../glass/GlassBadge';

interface TopBarProps {
  title?: string;
}

export default function TopBar({ title = 'Command Center' }: TopBarProps) {
  return (
    <header
      style={{
        height: '70px',
        padding: '0 2rem',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderBottom: '1px solid var(--glass-border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 99,
      }}
    >
      <div>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* System Health Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={16} style={{ color: 'var(--success-glow)' }} />
          <GlassBadge variant="success" dot size="sm">
            Gateway Operational
          </GlassBadge>
        </div>

        {/* Separator */}
        <div
          style={{
            width: '1px',
            height: '20px',
            background: 'var(--glass-border-light)',
          }}
        />

        {/* Profile/Identity Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary-glow), var(--accent-glow))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8125rem',
              color: '#ffffff',
              boxShadow: '0 0 10px var(--glass-glow)',
            }}
          >
            A
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: '1.2',
              }}
            >
              Aviral
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                lineHeight: '1.2',
              }}
            >
              Administrator
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
