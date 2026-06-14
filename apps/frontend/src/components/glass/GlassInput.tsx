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
    gap: '6px',
    ...containerStyle,
  };

  const fieldStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: focused ? 'rgba(0, 0, 0, 0.25)' : 'var(--input-bg)',
    border: `1px solid ${
      error
        ? 'var(--color-error)'
        : focused
        ? 'rgba(139, 92, 246, 0.45)'
        : 'var(--input-border)'
    }`,
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    boxShadow: focused
      ? error
        ? '0 0 12px rgba(239, 68, 68, 0.2)'
        : '0 0 0 3px rgba(139, 92, 246, 0.15), inset 0 1.5px 3px rgba(0, 0, 0, 0.3)'
      : 'inset 0 1px 2px rgba(0, 0, 0, 0.15)',
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem', // 13px
    fontFamily: 'var(--font-sans)',
    lineHeight: '1.4',
    width: '100%',
    ...style,
  };

  return (
    <div style={wrapperStyle}>
      {label && (
        <label
          style={{
            fontSize: 'var(--text-xs)', // 11px
            fontWeight: 600,
            color: error ? 'var(--color-error)' : 'var(--text-secondary)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            transition: 'color 0.2s ease',
          }}
        >
          {label}
        </label>
      )}
      <div style={fieldStyle}>
        {icon && (
          <span
            style={{
              color: focused ? 'var(--color-primary)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.2s ease',
              flexShrink: 0,
            }}
          >
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
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-error)',
            marginTop: '2px',
            fontWeight: 500,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
