import { motion } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

export default function GatewayOrb() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      onClick={toggleTheme}
      style={{
        position: 'relative',
        width: '52px',
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      {/* Outer Glow Ring 1 */}
      <motion.div
        animate={{
          rotate: 360,
          scale: isDark ? [0.95, 1.05, 0.95] : [0.98, 1.02, 0.98],
        }}
        transition={{
          rotate: { repeat: Infinity, duration: 8, ease: 'linear' },
          scale: { repeat: Infinity, duration: 4, ease: 'easeInOut' },
        }}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: isDark
            ? '1px dashed rgba(168, 85, 247, 0.4)'
            : '1px dashed rgba(245, 158, 11, 0.5)',
          boxShadow: isDark
            ? '0 0 15px rgba(168, 85, 247, 0.2)'
            : '0 0 15px rgba(245, 158, 11, 0.25)',
        }}
      />

      {/* Inner Orbiting Ring 2 */}
      <motion.div
        animate={{
          rotate: -360,
          scale: isDark ? [1.02, 0.98, 1.02] : [1.01, 0.99, 1.01],
        }}
        transition={{
          rotate: { repeat: Infinity, duration: 5, ease: 'linear' },
          scale: { repeat: Infinity, duration: 3, ease: 'easeInOut' },
        }}
        style={{
          position: 'absolute',
          width: '75%',
          height: '75%',
          borderRadius: '50%',
          border: isDark
            ? '1px solid rgba(139, 92, 246, 0.3)'
            : '1px solid rgba(251, 191, 36, 0.4)',
        }}
      />

      {/* Center Core Orb */}
      <motion.div
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        animate={{
          boxShadow: isDark
            ? [
                '0 0 12px rgba(168, 85, 247, 0.6)',
                '0 0 24px rgba(168, 85, 247, 0.8)',
                '0 0 12px rgba(168, 85, 247, 0.6)',
              ]
            : [
                '0 0 12px rgba(245, 158, 11, 0.6)',
                '0 0 24px rgba(245, 158, 11, 0.8)',
                '0 0 12px rgba(245, 158, 11, 0.6)',
              ],
        }}
        transition={{
          boxShadow: { repeat: Infinity, duration: 3, ease: 'easeInOut' },
        }}
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, #c084fc 0%, #7e22ce 60%, #3b0764 100%)'
            : 'radial-gradient(circle, #fef08a 0%, #f59e0b 60%, #78350f 100%)',
          zIndex: 2,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Core highlight reflection */}
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: '5px',
            width: '8px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.5)',
            borderRadius: '50%',
            transform: 'rotate(-20deg)',
          }}
        />
      </motion.div>

      {/* Ambient background pulsing glow */}
      <motion.div
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [0.8, 1.2, 0.8],
        }}
        transition={{
          repeat: Infinity,
          duration: 4,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, rgba(168,85,247,0) 70%)'
            : 'radial-gradient(circle, rgba(245,158,11,0.4) 0%, rgba(245,158,11,0) 70%)',
          filter: 'blur(4px)',
          zIndex: 1,
        }}
      />
    </div>
  );
}
