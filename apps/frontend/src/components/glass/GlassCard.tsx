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
  padding: 'var(--space-6)',
  position: 'relative',
  overflow: 'hidden',
  boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05), var(--shadow-sm)',
};

const variants: Record<string, CSSProperties> = {
  default: {},
  elevated: {
    boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.07), var(--shadow-md)',
    background: 'var(--glass-bg-solid)',
  },
  inset: {
    background: 'var(--bg-hover)',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    border: '1px solid var(--glass-border)',
    boxShadow: 'inset 0 2px 8px 0 rgba(0, 0, 0, 0.25)',
  },
};

// SVG noise data URL to simulate a physical frosted glass texture
const glassNoiseUrl = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.015'/%3E%3C/svg%3E")`;

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
    ...(glow ? { boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), var(--shadow-glow)' } : {}),
    ...(onClick ? { cursor: 'pointer' } : {}),
    ...style,
  };

  return (
    <motion.div
      className={className}
      style={mergedStyle}
      onClick={onClick}
      whileHover={
        hover
          ? {
              borderColor: 'var(--glass-border-hover)',
              y: -3,
              boxShadow: variant === 'elevated'
                ? 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1), 0 12px 24px -10px rgba(0,0,0,0.4), var(--shadow-glow)'
                : 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 8px 16px -8px rgba(0,0,0,0.3)',
              transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
            }
          : undefined
      }
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      {/* Frosted glass physical texture layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: glassNoiseUrl,
          opacity: 0.4,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Glossy linear highlights reflection */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0) 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Top prism edge reflection line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15) 30%, rgba(255, 255, 255, 0.15) 70%, transparent)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </motion.div>
  );
}
