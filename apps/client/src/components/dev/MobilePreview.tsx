import { useState } from 'react';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

function getIframeSrc(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('mobile');
  return url.toString();
}

export function MobilePreview() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    'portrait'
  );

  const dims = orientation === 'portrait' ? PORTRAIT : LANDSCAPE;

  return (
    <div
      style={{
        background: '#111827',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <span style={{ color: '#9ca3af', fontSize: 14 }}>
          {dims.width} &times; {dims.height}
        </span>
        <button
          onClick={() =>
            setOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'))
          }
          style={{
            background: '#374151',
            color: '#e5e7eb',
            border: '1px solid #4b5563',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {orientation === 'portrait'
            ? 'Switch to Landscape'
            : 'Switch to Portrait'}
        </button>
      </div>

      <div
        style={{
          width: dims.width,
          height: dims.height,
          borderRadius: 40,
          border: '4px solid #374151',
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.5)',
          transition: 'width 0.3s ease, height 0.3s ease',
        }}
      >
        <iframe
          src={getIframeSrc()}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title="Mobile Preview"
        />
      </div>
    </div>
  );
}
