import React, { useEffect, useState } from 'react';
import { TEAM1_COLOR, TEAM2_COLOR } from '../../styles/colors';
import { Button } from '../ui/Button';

interface TeamNameRevealModalProps {
  players: { nickname: string; team: 'team1' | 'team2' }[];
  teamNames: { team1: string; team2: string; startButton?: string } | null;
  onClose: () => void;
}

const TIMEOUT_MS = 10_000;

export function TeamNameRevealModal({
  players,
  teamNames: teamNamesProp,
  onClose,
}: TeamNameRevealModalProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (teamNamesProp) return;
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [teamNamesProp]);

  const teamNames =
    teamNamesProp ?? (timedOut ? { team1: 'Team 1', team2: 'Team 2' } : null);

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
        {!teamNames ? (
          <div style={{ padding: '24px 0' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                border: '3px solid rgba(255,255,255,0.15)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'team-reveal-spin 0.8s linear infinite',
                margin: '0 auto 20px',
              }}
            />
            <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)' }}>
              Setting up game...
            </div>
            <style>{`@keyframes team-reveal-spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '32px' }}>
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 800,
                  color: TEAM1_COLOR,
                  lineHeight: 1.2,
                }}
              >
                {teamNames.team1}
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
                {teamNames.team2}
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

            <Button
              onClick={onClose}
              size="large"
              data-testid="team-reveal-dismiss"
            >
              {teamNames.startButton ?? 'Let\u2019s Go!'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
