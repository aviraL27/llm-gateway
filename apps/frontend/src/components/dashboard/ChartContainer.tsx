import { ReactNode } from 'react';
import GlassCard from '../glass/GlassCard';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  height?: string | number;
}

export default function ChartContainer({
  title,
  subtitle,
  children,
  actions,
  height = '300px',
}: ChartContainerProps) {
  return (
    <GlassCard variant="default" padding="1.5rem" style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h3
            style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {subtitle}
            </span>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </div>

      <div style={{ height: height, width: '100%', position: 'relative' }}>
        {children}
      </div>
    </GlassCard>
  );
}
