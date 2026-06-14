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
  sm: {
    padding: '6px 12px',
    fontSize: 'var(--text-sm)',
    gap: '6px',
    borderRadius: 'var(--radius-sm)',
  },
  md: {
    padding: '8px 18px',
    fontSize: 'var(--text-base)',
    gap: '8px',
    borderRadius: 'var(--radius-md)',
  },
  lg: {
    padding: '12px 26px',
    fontSize: 'var(--text-md)',
    gap: '10px',
    borderRadius: 'var(--radius-lg)',
  },
};

const variantMap: Record<string, CSSProperties> = {
  primary: {
    background: 'var(--gradient-primary)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.2), 0 4px 16px var(--color-primary-glow)',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
  },
  secondary: {
    background: 'var(--glass-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--glass-border)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05), var(--shadow-sm)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'rgba(239, 68, 68, 0.08)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
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
    fontWeight: 'var(--weight-semibold)' as any,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    letterSpacing: '0.01em',
    lineHeight: 1,
    whiteSpace: 'nowrap' as any,
    position: 'relative',
    overflow: 'hidden',
    ...sizeMap[size],
    ...variantMap[variant],
    ...style,
  };

  return (
    <motion.button
      style={mergedStyle}
      disabled={disabled || loading}
      whileHover={
        !disabled && !loading
          ? {
              scale: 1.015,
              borderColor: variant === 'secondary' ? 'var(--glass-border-hover)' : undefined,
              boxShadow:
                variant === 'primary'
                  ? 'inset 0 1px 0 0 rgba(255, 255, 255, 0.25), 0 6px 20px var(--color-primary-glow)'
                  : variant === 'secondary'
                  ? 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), var(--shadow-md)'
                  : undefined,
            }
          : undefined
      }
      whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
      {...(props as any)}
    >
      {/* Light sheen animation overlay */}
      {!disabled && !loading && variant === 'primary' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 50%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {loading ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          style={{ animation: 'spin 1.2s linear infinite', marginRight: '0.25rem' }}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="28"
            strokeDashoffset="10"
            opacity="0.8"
          />
        </svg>
      ) : icon ? (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      ) : null}
      <span style={{ display: 'flex', alignItems: 'center', gap: 'inherit' }}>{children}</span>
    </motion.button>
  );
}
