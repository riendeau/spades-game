import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, style, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          {label}
        </label>
      )}
      <input
        {...props}
        style={{
          padding: '10px 14px',
          fontSize: '16px',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          outline: 'none',
          transition: 'border-color 0.15s ease',
          ...style
        }}
      />
    </div>
  );
}
