import React, { useEffect, useMemo } from 'react';
import { play } from '../../services/audio';

interface FakeVictoryProps {
  teamName: string;
  teamColor: string;
  onComplete: () => void;
}

const DURATION = 5000;

const keyframes = `
@keyframes banner-entrance {
  0% { transform: scale(0) rotate(-5deg); opacity: 0; }
  50% { transform: scale(1.1) rotate(1deg); opacity: 1; }
  60% { transform: scale(0.95) rotate(-0.5deg); }
  70% { transform: scale(1.02) rotate(0deg); }
  75% { transform: scale(1) rotate(0deg); }
  85% { opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 0; }
}

@keyframes firework-burst {
  0% { transform: scale(0); opacity: 1; }
  50% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes particle {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { opacity: 0; }
}
`;

interface Burst {
  x: number;
  y: number;
  delay: number;
  color: string;
  particles: { angle: number; distance: number; size: number }[];
}

const COLORS = [
  '#ff4444',
  '#44ff44',
  '#4488ff',
  '#ffdd44',
  '#ff44ff',
  '#44ffff',
];

function generateBursts(): Burst[] {
  const bursts: Burst[] = [];
  for (let i = 0; i < 8; i++) {
    const particles = [];
    for (let j = 0; j < 12; j++) {
      particles.push({
        angle: (360 / 12) * j + (Math.random() - 0.5) * 20,
        distance: 40 + Math.random() * 60,
        size: 4 + Math.random() * 4,
      });
    }
    bursts.push({
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 60,
      delay: Math.random() * 2500,
      color: COLORS[i % COLORS.length],
      particles,
    });
  }
  return bursts;
}

export function FakeVictory({
  teamName,
  teamColor,
  onComplete,
}: FakeVictoryProps) {
  const bursts = useMemo(() => generateBursts(), []);

  useEffect(() => {
    play('victory-fanfare');
    const timer = setTimeout(onComplete, DURATION);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <>
      <style>{keyframes}</style>

      {/* Firework bursts */}
      {bursts.map((burst, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${burst.x}%`,
            top: `${burst.y}%`,
            animation: `firework-burst 1.2s ${burst.delay}ms ease-out forwards`,
            opacity: 0,
          }}
        >
          {burst.particles.map((p, j) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.distance;
            const ty = Math.sin(rad) * p.distance;
            return (
              <div
                key={j}
                style={{
                  position: 'absolute',
                  width: p.size,
                  height: p.size,
                  borderRadius: '50%',
                  backgroundColor: burst.color,
                  boxShadow: `0 0 ${p.size}px ${burst.color}`,
                  animation: `particle 1s ${burst.delay}ms ease-out forwards`,
                  transform: `translate(${tx}px, ${ty}px)`,
                }}
              />
            );
          })}
        </div>
      ))}

      {/* Victory banner */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: `banner-entrance ${DURATION}ms ease-out forwards`,
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: teamColor,
            padding: '24px 48px',
            borderRadius: 12,
            boxShadow: `0 0 40px ${teamColor}, 0 8px 32px rgba(0,0,0,0.4)`,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: '#fff',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              letterSpacing: 2,
            }}
          >
            {teamName} WINS!
          </div>
        </div>
      </div>
    </>
  );
}
