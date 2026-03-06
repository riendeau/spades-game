import React from 'react';

const SPADE_PATH =
  'M50 0C50 0 0 40 0 70C0 90 15 100 30 100C37 100 43 97 47 92C45 105 38 115 25 120L75 120C62 115 55 105 53 92C57 97 63 100 70 100C85 100 100 90 100 70C100 40 50 0 50 0Z';

export function TableFelt() {
  return (
    <>
      {/* Base green + radial spotlight gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 80% 70% at 50% 45%, #1e5c35 0%, #1a472a 40%, #0f2d1a 100%)',
          zIndex: 0,
        }}
      />

      {/* Felt texture via repeating SVG noise filter */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="felt-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: 'url(#felt-noise)',
          opacity: 0.04,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Vignette — dark edges */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 120px 40px rgba(0, 0, 0, 0.5)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

export function TableWatermark() {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox="0 0 100 120"
        width="220"
        height="264"
        fill="rgba(255, 255, 255, 0.8)"
        style={{ opacity: 0.05, display: 'block' }}
      >
        <path d={SPADE_PATH} />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '48%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.09,
          color: 'rgba(255, 255, 255, 0.8)',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '32px',
          fontWeight: 700,
          letterSpacing: '4px',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        CCXLV
      </div>
    </div>
  );
}
