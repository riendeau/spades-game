import React from 'react';
import { TEAM1_COLOR, TEAM2_COLOR } from '../../styles/colors';
import { Button } from '../ui/Button';

interface TeamNameRevealModalProps {
  team1: string;
  team2: string;
  players: { nickname: string; team: 'team1' | 'team2' }[];
  onClose: () => void;
}

export function TeamNameRevealModal({
  team1,
  team2,
  players,
  onClose,
}: TeamNameRevealModalProps) {
  const team1Players = players
    .filter((p) => p.team === 'team1')
    .map((p) => p.nickname)
    .join(' & ');
  const team2Players = players
    .filter((p) => p.team === 'team2')
    .map((p) => p.nickname)
    .join(' & ');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#1a1a2e',
          borderRadius: '16px',
          padding: '40px 48px',
          maxWidth: '460px',
          width: '90%',
          textAlign: 'center',
          color: '#fff',
        }}
      >
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 800,
              color: TEAM1_COLOR,
              lineHeight: 1.2,
            }}
          >
            {team1}
          </div>
          <div
            style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.5)',
              marginTop: '4px',
            }}
          >
            {team1Players}
          </div>
        </div>

        <div
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            marginBottom: '32px',
          }}
        >
          vs
        </div>

        <div style={{ marginBottom: '36px' }}>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 800,
              color: TEAM2_COLOR,
              lineHeight: 1.2,
            }}
          >
            {team2}
          </div>
          <div
            style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.5)',
              marginTop: '4px',
            }}
          >
            {team2Players}
          </div>
        </div>

        <Button onClick={onClose} size="large">
          Let&apos;s Go!
        </Button>
      </div>
    </div>
  );
}
