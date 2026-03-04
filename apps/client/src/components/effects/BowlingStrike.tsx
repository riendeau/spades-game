import React, { useEffect } from 'react';
import { play } from '../../services/audio';

interface BowlingStrikeProps {
  onComplete: () => void;
}

const DURATION = 4000;

const keyframes = `
@keyframes chair-slide {
  0%   { transform: translateX(-80px) rotate(0deg);   opacity: 0; }
  5%   { opacity: 1; }
  95%  { opacity: 1; }
  100% { transform: translateX(110vw) rotate(900deg); opacity: 0; }
}
`;

export function BowlingStrike({ onComplete }: BowlingStrikeProps) {
  useEffect(() => {
    play('bowling-strike');
    const timer = setTimeout(onComplete, DURATION);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <>
      <style>{keyframes}</style>

      {/* Chair tumbling across the screen */}
      <div
        style={{
          position: 'absolute',
          bottom: '40%',
          left: 0,
          animation: `chair-slide ${DURATION}ms linear forwards`,
        }}
      >
        {/* Seat */}
        <div style={{ position: 'relative', width: 40 }}>
          <div
            style={{
              width: 40,
              height: 8,
              background: '#8B4513',
              borderRadius: 2,
            }}
          />
          {/* Back post */}
          <div
            style={{
              position: 'absolute',
              top: -32,
              left: 0,
              width: 8,
              height: 32,
              background: '#A0522D',
              borderRadius: 2,
            }}
          />
          {/* Back top rail */}
          <div
            style={{
              position: 'absolute',
              top: -36,
              left: -2,
              width: 14,
              height: 6,
              background: '#8B4513',
              borderRadius: 2,
            }}
          />
          {/* Front left leg */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 4,
              width: 5,
              height: 20,
              background: '#A0522D',
            }}
          />
          {/* Front right leg */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 31,
              width: 5,
              height: 20,
              background: '#A0522D',
            }}
          />
        </div>
      </div>
    </>
  );
}
