import { ReactNode, CSSProperties } from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'inset';
  glow?: boolean;
  hover?: boolean;
  padding?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

const baseStyle: CSSProperties = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: '1px solid var(--glass-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  position: 'relative',
  overflow: 'hidden',
};

const variants: Record<string, CSSProperties> = {
  default: {},
  elevated: {
    boxShadow: 'var(--shadow-md)',
    background: 'var(--glass-bg-solid)',
  },
  inset: {
    background: 'var(--bg-hover)',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    border: '1px solid var(--glass-border)',
  },
};

export default function GlassCard({
  children,
  variant = 'default',
  glow = false,
  hover = false,
  padding,
  className = '',
  style = {},
  onClick,
}: GlassCardProps) {
  const mergedStyle: CSSProperties = {
    ...baseStyle,
    ...variants[variant],
    ...(padding ? { padding } : {}),
    ...(glow ? { boxShadow: 'var(--shadow-glow)' } : {}),
    ...(onClick ? { cursor: 'pointer' } : {}),
    ...style,
  };

  return (
    <motion.div
      className={className}
      style={mergedStyle}
      onClick={onClick}
      whileHover={hover ? {
        borderColor: 'var(--glass-border-hover)',
        y: -2,
        transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
      } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
    >
      {/* Top highlight line for glass reflection */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '10%',
        right: '10%',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, var(--glass-highlight), transparent)',
        pointerEvents: 'none',
      }} />
      {children}
    </motion.div>
  );
}
