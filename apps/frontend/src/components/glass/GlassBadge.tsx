import { CSSProperties } from 'react';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface GlassBadgeProps {
  variant?: BadgeVariant;
  children: string;
  dot?: boolean;
  size?: 'sm' | 'md';
}

const colorMap: Record<BadgeVariant, { bg: string; color: string; dot: string; shadow: string }> = {
  success: {
    bg: 'var(--color-success-muted)',
    color: 'var(--color-success)',
    dot: 'var(--color-success)',
    shadow: 'var(--color-success-glow)',
  },
  error: {
    bg: 'var(--color-error-muted)',
    color: 'var(--color-error)',
    dot: 'var(--color-error)',
    shadow: 'var(--color-error-glow)',
  },
  warning: {
    bg: 'var(--color-warning-muted)',
    color: 'var(--color-warning)',
    dot: 'var(--color-warning)',
    shadow: 'var(--color-warning-glow)',
  },
  info: {
    bg: 'var(--color-info-muted)',
    color: 'var(--color-info)',
    dot: 'var(--color-info)',
    shadow: 'var(--color-info-glow)',
  },
  neutral: {
    bg: 'var(--bg-hover)',
    color: 'var(--text-secondary)',
    dot: 'var(--text-muted)',
    shadow: 'transparent',
  },
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
    padding: isSmall ? '2px 8px' : '4px 12px',
    borderRadius: 'var(--radius-full)',
    background: colors.bg,
    color: colors.color,
    fontSize: isSmall ? 'var(--text-xs)' : 'var(--text-sm)',
    fontWeight: 'var(--weight-semibold)' as any,
    letterSpacing: '0.04em',
    lineHeight: 1,
    whiteSpace: 'nowrap' as any,
    border: `1px solid ${colors.shadow}`,
    boxShadow: `0 2px 6px -1px ${colors.shadow}`,
  };

  const dotStyle: CSSProperties = {
    width: isSmall ? '4px' : '6px',
    height: isSmall ? '4px' : '6px',
    borderRadius: '50%',
    backgroundColor: colors.dot,
    flexShrink: 0,
    boxShadow: `0 0 6px ${colors.dot}`,
  };

  return (
    <span style={badgeStyle}>
      {dot && (
        <span
          style={dotStyle}
          className={variant !== 'neutral' ? 'dot-pulse' : undefined}
        />
      )}
      <span style={{ transform: 'translateY(0.5px)' }}>{children}</span>
    </span>
  );
}
