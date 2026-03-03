import React, { useEffect } from 'react';
import { play } from '../../services/audio';

interface BowlingStrikeProps {
  onComplete: () => void;
}

const DURATION = 4000;

const keyframes = `
@keyframes bowling-ball-roll {
  0% { transform: translateX(-80px) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  60% { transform: translateX(50vw) rotate(720deg); }
  100% { transform: translateX(50vw) rotate(720deg); }
}

@keyframes chair-tumble {
  0% { transform: translateX(55vw) translateY(0) rotate(0deg); opacity: 0; }
  25% { opacity: 1; }
  30% { transform: translateX(55vw) translateY(0) rotate(0deg); }
  100% { transform: translateX(110vw) translateY(-60px) rotate(540deg); opacity: 0; }
}

@keyframes pin-scatter-1 {
  0% { transform: translate(50vw, 0) rotate(0deg); opacity: 0; }
  55% { opacity: 0; }
  60% { transform: translate(50vw, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(65vw, -120px) rotate(200deg); opacity: 0; }
}

@keyframes pin-scatter-2 {
  0% { transform: translate(50vw, 0) rotate(0deg); opacity: 0; }
  55% { opacity: 0; }
  60% { transform: translate(50vw, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(60vw, -80px) rotate(-150deg); opacity: 0; }
}

@keyframes pin-scatter-3 {
  0% { transform: translate(50vw, 0) rotate(0deg); opacity: 0; }
  55% { opacity: 0; }
  60% { transform: translate(50vw, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(55vw, -140px) rotate(300deg); opacity: 0; }
}

@keyframes pin-scatter-4 {
  0% { transform: translate(50vw, 0) rotate(0deg); opacity: 0; }
  55% { opacity: 0; }
  60% { transform: translate(50vw, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(70vw, -50px) rotate(-250deg); opacity: 0; }
}
`;

const ballStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '40%',
  left: 0,
  width: 50,
  height: 50,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 35% 35%, #555, #1a1a1a)',
  boxShadow: '2px 4px 8px rgba(0,0,0,0.5)',
  animation: `bowling-ball-roll ${DURATION}ms ease-in-out forwards`,
};

const chairBaseStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '38%',
  left: 0,
  animation: `chair-tumble ${DURATION}ms ease-in forwards`,
};

const pinBaseStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '42%',
  left: 0,
  width: 10,
  height: 30,
  borderRadius: '5px 5px 2px 2px',
  background: 'linear-gradient(to bottom, #fff, #ddd)',
  border: '1px solid #ccc',
};

export function BowlingStrike({ onComplete }: BowlingStrikeProps) {
  useEffect(() => {
    play('bowling-strike');
    const timer = setTimeout(onComplete, DURATION);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <>
      <style>{keyframes}</style>

      {/* Bowling ball */}
      <div style={ballStyle}>
        {/* Finger holes */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 18,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#333',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 28,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#333',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 26,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#333',
          }}
        />
      </div>

      {/* Chair (pixel-art style assembled from divs) */}
      <div style={chairBaseStyle}>
        {/* Seat */}
        <div
          style={{
            width: 36,
            height: 8,
            background: '#8B4513',
            borderRadius: 2,
          }}
        />
        {/* Back */}
        <div
          style={{
            position: 'absolute',
            top: -28,
            left: 0,
            width: 8,
            height: 28,
            background: '#A0522D',
            borderRadius: 2,
          }}
        />
        {/* Back top rail */}
        <div
          style={{
            position: 'absolute',
            top: -30,
            left: -2,
            width: 14,
            height: 6,
            background: '#8B4513',
            borderRadius: 2,
          }}
        />
        {/* Front legs */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 4,
            width: 5,
            height: 18,
            background: '#A0522D',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 27,
            width: 5,
            height: 18,
            background: '#A0522D',
          }}
        />
      </div>

      {/* Scattered pins */}
      <div
        style={{
          ...pinBaseStyle,
          animation: `pin-scatter-1 ${DURATION}ms ease-out forwards`,
        }}
      />
      <div
        style={{
          ...pinBaseStyle,
          animation: `pin-scatter-2 ${DURATION}ms ease-out forwards`,
        }}
      />
      <div
        style={{
          ...pinBaseStyle,
          animation: `pin-scatter-3 ${DURATION}ms ease-out forwards`,
        }}
      />
      <div
        style={{
          ...pinBaseStyle,
          animation: `pin-scatter-4 ${DURATION}ms ease-out forwards`,
        }}
      />
    </>
  );
}
