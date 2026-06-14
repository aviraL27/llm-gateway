import { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const sizeMap: Record<string, CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 'var(--text-sm)', gap: '6px', borderRadius: 'var(--radius-sm)' },
  md: { padding: '8px 16px', fontSize: 'var(--text-base)', gap: '8px', borderRadius: 'var(--radius-md)' },
  lg: { padding: '12px 24px', fontSize: 'var(--text-md)', gap: '10px', borderRadius: 'var(--radius-md)' },
};

const variantMap: Record<string, CSSProperties> = {
  primary: {
    background: 'var(--gradient-primary)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 2px 12px var(--color-primary-glow)',
  },
  secondary: {
    background: 'var(--glass-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--glass-border)',
    backdropFilter: 'blur(12px)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'var(--color-error-muted)',
    color: 'var(--color-error)',
    border: '1px solid rgba(248,113,113,0.2)',
  },
};

export default function GlassButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  style = {},
  ...props
}: GlassButtonProps) {
  const mergedStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'var(--weight-medium)' as any,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all var(--duration-fast) var(--ease-out)',
    letterSpacing: '0.01em',
    lineHeight: 1,
    whiteSpace: 'nowrap' as any,
    ...sizeMap[size],
    ...variantMap[variant],
    ...style,
  };

  return (
    <motion.button
      style={mergedStyle}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? {
        scale: 1.02,
        filter: 'brightness(1.1)',
      } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      {...props as any}
    >
      {loading ? (
        <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin 1s linear infinite' }}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeDasharray="28" strokeDashoffset="8" opacity="0.7" />
        </svg>
      ) : icon ? (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      ) : null}
      <span>{children}</span>
    </motion.button>
  );
}
