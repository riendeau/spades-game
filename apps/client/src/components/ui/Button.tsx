import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
}

export function Button({
  variant = 'primary',
  size = 'medium',
  children,
  style,
  ...props
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    transition: 'all 0.15s ease',
    opacity: props.disabled ? 0.6 : 1,
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: '#3b82f6',
      color: '#fff',
    },
    secondary: {
      backgroundColor: '#e5e7eb',
      color: '#374151',
    },
    danger: {
      backgroundColor: '#dc2626',
      color: '#fff',
    },
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    small: { padding: '6px 12px', fontSize: '14px' },
    medium: { padding: '10px 20px', fontSize: '16px' },
    large: { padding: '14px 28px', fontSize: '18px' },
  };

  return (
    <button
      {...props}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
