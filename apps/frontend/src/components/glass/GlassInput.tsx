import { InputHTMLAttributes, CSSProperties, ReactNode, useState } from 'react';

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  error?: string;
  containerStyle?: CSSProperties;
}

export default function GlassInput({
  label,
  icon,
  error,
  containerStyle = {},
  style = {},
  onFocus,
  onBlur,
  ...props
}: GlassInputProps) {
  const [focused, setFocused] = useState(false);

  const wrapperStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    ...containerStyle,
  };

  const fieldStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    background: 'var(--input-bg)',
    border: `1px solid ${error ? 'var(--color-error)' : focused ? 'var(--input-border-focus)' : 'var(--input-border)'}`,
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
    transition: 'all var(--duration-fast) var(--ease-out)',
    boxShadow: focused
      ? error
        ? 'var(--shadow-glow-error)'
        : '0 0 0 3px var(--color-primary-muted)'
      : 'none',
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-md)',
    fontFamily: 'var(--font-sans)',
    lineHeight: 1.4,
    width: '100%',
    ...style,
  };

  return (
    <div style={wrapperStyle}>
      {label && (
        <label style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-medium)' as any,
          color: error ? 'var(--color-error)' : 'var(--text-secondary)',
          letterSpacing: '0.02em',
          transition: 'color var(--duration-fast) var(--ease-out)',
        }}>
          {label}
        </label>
      )}
      <div style={fieldStyle}>
        {icon && (
          <span style={{
            color: focused ? 'var(--color-primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            transition: 'color var(--duration-fast) var(--ease-out)',
            flexShrink: 0,
          }}>
            {icon}
          </span>
        )}
        <input
          style={inputStyle}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
      </div>
      {error && (
        <span style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-error)',
          marginTop: '2px',
        }}>
          {error}
        </span>
      )}
    </div>
  );
}
