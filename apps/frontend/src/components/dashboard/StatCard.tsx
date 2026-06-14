import { ReactNode } from 'react';
import GlassCard from '../glass/GlassCard';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    type: 'up' | 'down' | 'neutral';
  };
  icon?: ReactNode;
  loading?: boolean;
  glowColor?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  loading = false,
  glowColor,
}: StatCardProps) {
  return (
    <GlassCard variant="default" glow={!!glowColor} style={{ flex: 1, minWidth: '220px' }}>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem' }}>
          <div
            style={{
              height: '14px',
              width: '60%',
              background: 'var(--glass-border)',
              borderRadius: '3px',
              animation: 'pulse 1.5s infinite',
            }}
          />
          <div
            style={{
              height: '28px',
              width: '80%',
              background: 'var(--glass-border)',
              borderRadius: '5px',
              animation: 'pulse 1.5s infinite',
            }}
          />
          <div
            style={{
              height: '12px',
              width: '40%',
              background: 'var(--glass-border)',
              borderRadius: '3px',
              animation: 'pulse 1.5s infinite',
            }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {title}
            </span>
            <span
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: '1.2',
              }}
            >
              {value}
            </span>
            {(subtitle || trend) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
                {trend && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color:
                        trend.type === 'up'
                          ? '#10b981'
                          : trend.type === 'down'
                          ? '#ef4444'
                          : 'var(--text-muted)',
                    }}
                  >
                    {trend.type === 'up' ? '↑' : trend.type === 'down' ? '↓' : '•'} {trend.value}
                  </span>
                )}
                {subtitle && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {subtitle}
                  </span>
                )}
              </div>
            )}
          </div>

          {icon && (
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0.5rem',
                background: glowColor ? `rgba(${glowColor}, 0.1)` : 'var(--glass-bg-active)',
                border: `1px solid ${glowColor ? `rgba(${glowColor}, 0.2)` : 'var(--glass-border-light)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: glowColor ? `rgb(${glowColor})` : 'var(--text-primary)',
                boxShadow: glowColor ? `0 0 10px rgba(${glowColor}, 0.1)` : 'none',
              }}
            >
              {icon}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
