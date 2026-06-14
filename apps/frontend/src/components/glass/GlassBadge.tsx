import { CSSProperties } from 'react';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface GlassBadgeProps {
  variant?: BadgeVariant;
  children: string;
  dot?: boolean;
  size?: 'sm' | 'md';
}

const colorMap: Record<BadgeVariant, { bg: string; color: string; dot: string }> = {
  success: { bg: 'var(--color-success-muted)', color: 'var(--color-success)', dot: 'var(--color-success)' },
  error: { bg: 'var(--color-error-muted)', color: 'var(--color-error)', dot: 'var(--color-error)' },
  warning: { bg: 'var(--color-warning-muted)', color: 'var(--color-warning)', dot: 'var(--color-warning)' },
  info: { bg: 'var(--color-info-muted)', color: 'var(--color-info)', dot: 'var(--color-info)' },
  neutral: { bg: 'var(--bg-hover)', color: 'var(--text-secondary)', dot: 'var(--text-muted)' },
};

export default function GlassBadge({
  variant = 'neutral',
  children,
  dot = true,
  size = 'sm',
}: GlassBadgeProps) {
  const colors = colorMap[variant];
  const isSmall = size === 'sm';

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: isSmall ? '4px' : '6px',
    padding: isSmall ? '2px 8px' : '4px 10px',
    borderRadius: 'var(--radius-full)',
    background: colors.bg,
    color: colors.color,
    fontSize: isSmall ? 'var(--text-xs)' : 'var(--text-sm)',
    fontWeight: 'var(--weight-medium)' as any,
    letterSpacing: '0.02em',
    lineHeight: 1.4,
    whiteSpace: 'nowrap' as any,
  };

  const dotStyle: CSSProperties = {
    width: isSmall ? '5px' : '6px',
    height: isSmall ? '5px' : '6px',
    borderRadius: '50%',
    backgroundColor: colors.dot,
    flexShrink: 0,
  };

  return (
    <span style={badgeStyle}>
      {dot && <span style={dotStyle} />}
      {children}
    </span>
  );
}
