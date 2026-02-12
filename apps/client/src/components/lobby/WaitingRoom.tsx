import React from 'react';
import type { ClientGameState, Position } from '@spades/shared';
import { Button } from '../ui/Button';

interface WaitingRoomProps {
  roomId: string;
  gameState: ClientGameState;
  myPosition: Position;
  onReady: () => void;
  onLeave: () => void;
}

const POSITION_LABELS: Record<Position, string> = {
  0: 'South',
  1: 'West',
  2: 'North',
  3: 'East'
};

const TEAM_COLORS: Record<'team1' | 'team2', string> = {
  team1: '#3b82f6',
  team2: '#10b981'
};

function PlayerSlot({ position: pos, gameState, myPosition }: { position: Position; gameState: ClientGameState; myPosition: Position }) {
  const player = gameState.players.find(p => p.position === pos);
  const isMe = pos === myPosition;

  return (
    <div
      style={{
        flex: 1,
        padding: '16px',
        backgroundColor: player ? '#fff' : '#f9fafb',
        border: `2px solid ${player ? TEAM_COLORS[player.team] : '#e5e7eb'}`,
        borderRadius: '12px',
        opacity: player ? 1 : 0.6
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          {POSITION_LABELS[pos]}
        </span>
        {player && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: TEAM_COLORS[player.team]
            }}
          >
            Team {player.team === 'team1' ? '1' : '2'}
          </span>
        )}
      </div>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>
        {player ? (
          <>
            {player.nickname}
            {isMe && <span style={{ color: '#6b7280' }}> (you)</span>}
          </>
        ) : (
          <span style={{ color: '#9ca3af' }}>Waiting...</span>
        )}
      </div>
      {player && (
        <div
          style={{
            fontSize: '12px',
            color: player.ready ? '#10b981' : '#f59e0b'
          }}
        >
          {player.ready ? 'Ready' : 'Not ready'}
        </div>
      )}
    </div>
  );
}

export function WaitingRoom({ roomId, gameState, myPosition, onReady, onLeave }: WaitingRoomProps) {
  const myPlayer = gameState.players.find(p => p.position === myPosition);
  const isReady = myPlayer?.ready ?? false;

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '40px 20px' }}>
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '8px'
        }}
      >
        Waiting Room
      </h1>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '32px'
        }}
      >
        <span style={{ fontSize: '14px', color: '#6b7280' }}>Room Code:</span>
        <code
          style={{
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '3px',
            padding: '8px 16px',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
          onClick={copyRoomCode}
          title="Click to copy"
        >
          {roomId}
        </code>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px'
        }}
      >
        {/* North */}
        <div style={{ width: 'calc(50% - 8px)' }}>
          <PlayerSlot position={2} gameState={gameState} myPosition={myPosition} />
        </div>
        {/* West and East */}
        <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
          <PlayerSlot position={1} gameState={gameState} myPosition={myPosition} />
          <PlayerSlot position={3} gameState={gameState} myPosition={myPosition} />
        </div>
        {/* South */}
        <div style={{ width: 'calc(50% - 8px)' }}>
          <PlayerSlot position={0} gameState={gameState} myPosition={myPosition} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <Button variant="secondary" onClick={onLeave} style={{ flex: 1 }}>
          Leave
        </Button>
        <Button
          onClick={onReady}
          disabled={isReady || gameState.players.length < 4}
          style={{ flex: 2 }}
        >
          {isReady ? 'Waiting for others...' : 'Ready'}
        </Button>
      </div>

      {gameState.players.length < 4 && (
        <p
          style={{
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '14px',
            marginTop: '16px'
          }}
        >
          Share the room code with friends to invite them
        </p>
      )}
    </div>
  );
}
