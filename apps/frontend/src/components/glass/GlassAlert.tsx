import { ReactNode } from 'react';
import GlassCard from './GlassCard';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface GlassAlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}

const colorMap = {
  success: {
    border: '1px solid rgba(16, 185, 129, 0.3)',
    background: 'rgba(16, 185, 129, 0.05)',
    glow: 'rgba(16, 185, 129, 0.1)',
    text: '#10b981',
  },
  error: {
    border: '1px solid rgba(239, 68, 68, 0.3)',
    background: 'rgba(239, 68, 68, 0.05)',
    glow: 'rgba(239, 68, 68, 0.1)',
    text: '#ef4444',
  },
  warning: {
    border: '1px solid rgba(245, 158, 11, 0.3)',
    background: 'rgba(245, 158, 11, 0.05)',
    glow: 'rgba(245, 158, 11, 0.1)',
    text: '#f59e0b',
  },
  info: {
    border: '1px solid rgba(59, 130, 246, 0.3)',
    background: 'rgba(59, 130, 246, 0.05)',
    glow: 'rgba(59, 130, 246, 0.1)',
    text: '#3b82f6',
  },
};

export default function GlassAlert({
  variant = 'info',
  title,
  children,
  style,
}: GlassAlertProps) {
  const colors = colorMap[variant];

  return (
    <GlassCard
      padding="0.75rem 1rem"
      style={{
        border: colors.border,
        background: colors.background,
        boxShadow: `0 4px 30px rgba(0, 0, 0, 0.1), inset 0 0 10px ${colors.glow}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        ...style,
      }}
    >
      {title && (
        <span
          style={{
            fontWeight: 600,
            fontSize: '0.875rem',
            color: colors.text,
          }}
        >
          {title}
        </span>
      )}
      <div
        style={{
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.4',
        }}
      >
        {children}
      </div>
    </GlassCard>
  );
}
