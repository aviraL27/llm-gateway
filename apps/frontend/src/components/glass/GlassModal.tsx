import { ReactNode, useEffect, CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: string;
}

export default function GlassModal({ open, onClose, title, children, width = '480px' }: GlassModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 'var(--z-modal)' as any,
    padding: 'var(--space-6)',
  };

  const backdropStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  };

  const panelStyle: CSSProperties = {
    position: 'relative',
    background: 'var(--glass-bg-solid)',
    backdropFilter: 'blur(var(--glass-blur-heavy))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-heavy))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-xl)',
    width: '100%',
    maxWidth: width,
    maxHeight: '85vh',
    overflow: 'auto',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-5) var(--space-6)',
    borderBottom: '1px solid var(--glass-border)',
  };

  const closeStyle: CSSProperties = {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all var(--duration-fast) var(--ease-out)',
  };

  return (
    <AnimatePresence>
      {open && (
        <div style={overlayStyle}>
          <motion.div
            style={backdropStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            style={panelStyle}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Top highlight */}
            <div style={{
              position: 'absolute', top: 0, left: '15%', right: '15%',
              height: '1px', background: 'linear-gradient(90deg, transparent, var(--glass-highlight), transparent)',
              pointerEvents: 'none',
            }} />

            {title && (
              <div style={headerStyle}>
                <h3 style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--weight-semibold)' as any,
                  color: 'var(--text-primary)',
                }}>
                  {title}
                </h3>
                <button style={closeStyle} onClick={onClose}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="1" y1="1" x2="13" y2="13" />
                    <line x1="13" y1="1" x2="1" y2="13" />
                  </svg>
                </button>
              </div>
            )}
            <div style={{ padding: 'var(--space-6)' }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
