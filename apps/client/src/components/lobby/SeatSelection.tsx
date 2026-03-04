import type { Position } from '@spades/shared';
import React from 'react';
import { useIsMobile } from '../../hooks/use-is-mobile';
import type { AvailableSeat } from '../../store/game-store';
import { TEAM_COLORS, TEAM_RGB } from '../../styles/colors';
import { Button } from '../ui/Button';

const POSITION_LABELS: Record<Position, string> = {
  0: 'North',
  1: 'East',
  2: 'South',
  3: 'West',
};

interface SeatSelectionProps {
  roomId: string;
  seats: AvailableSeat[];
  nickname: string;
  onSelectSeat: (roomId: string, position: Position, nickname: string) => void;
}

export function SeatSelection({
  roomId,
  seats,
  nickname,
  onSelectSeat,
}: SeatSelectionProps) {
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a472a',
        color: '#fff',
        padding: isMobile ? '16px' : '32px',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? '20px' : '28px',
            fontWeight: 700,
            marginBottom: '8px',
          }}
        >
          Join Game in Progress
        </h2>
        <p
          style={{
            color: '#9ca3af',
            fontSize: isMobile ? '13px' : '16px',
            marginBottom: '24px',
          }}
        >
          Room{' '}
          <span style={{ fontWeight: 600, color: '#d1d5db' }}>{roomId}</span>
          {' — '}Select a seat to take over
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {seats.map((seat) => (
            <button
              key={seat.position}
              onClick={() => onSelectSeat(roomId, seat.position, nickname)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: isMobile ? '12px 16px' : '16px 20px',
                backgroundColor: `rgba(${TEAM_RGB[seat.team]}, 0.15)`,
                border: `2px solid ${TEAM_COLORS[seat.team]}`,
                borderRadius: '12px',
                color: '#fff',
                cursor: 'pointer',
                transition: 'background-color 0.2s, transform 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `rgba(${TEAM_RGB[seat.team]}, 0.3)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `rgba(${TEAM_RGB[seat.team]}, 0.15)`;
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: isMobile ? '14px' : '18px',
                  }}
                >
                  {POSITION_LABELS[seat.position]}
                </div>
                <div
                  style={{
                    fontSize: isMobile ? '12px' : '14px',
                    color: '#9ca3af',
                  }}
                >
                  Previously: {seat.previousNickname}
                </div>
              </div>
              <div
                style={{
                  fontSize: isMobile ? '11px' : '13px',
                  fontWeight: 600,
                  color: TEAM_COLORS[seat.team],
                  textTransform: 'uppercase',
                }}
              >
                {seat.team === 'team1' ? 'Team 1' : 'Team 2'}
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: '24px' }}>
          <Button
            onClick={() => window.history.back()}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #4b5563',
              color: '#9ca3af',
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
