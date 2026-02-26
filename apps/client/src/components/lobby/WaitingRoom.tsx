import type { ClientGameState, Position } from '@spades/shared';
import React, { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/use-is-mobile';
import { TEAM_COLORS } from '../../styles/colors';
import { Button } from '../ui/Button';

interface WaitingRoomProps {
  roomId: string;
  gameState: ClientGameState;
  myPosition: Position;
  onReady: () => void;
  onLeave: () => void;
  onChangeSeat: (position: Position) => void;
}

const POSITION_LABELS: Record<Position, string> = {
  0: 'South',
  1: 'West',
  2: 'North',
  3: 'East',
};

// Fun name generator for auto-join feature
const ADJECTIVES = [
  'Swift',
  'Happy',
  'Clever',
  'Bold',
  'Bright',
  'Calm',
  'Brave',
  'Quick',
  'Wise',
  'Lucky',
];

const ANIMALS = [
  'Eagle',
  'Penguin',
  'Fox',
  'Wolf',
  'Bear',
  'Tiger',
  'Lion',
  'Hawk',
  'Owl',
  'Panda',
];

function generateRandomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

function PlayerSlot({
  position: pos,
  gameState,
  myPosition,
  onSitHere,
}: {
  position: Position;
  gameState: ClientGameState;
  myPosition: Position;
  onSitHere?: () => void;
}) {
  const player = gameState.players.find((p) => p.position === pos);
  const isMe = pos === myPosition;

  return (
    <div
      data-testid={`seat-${pos}`}
      style={{
        flex: 1,
        padding: '16px',
        backgroundColor: player ? '#fff' : '#f9fafb',
        border: `2px solid ${player ? TEAM_COLORS[player.team] : '#e5e7eb'}`,
        borderRadius: '12px',
        opacity: player || onSitHere ? 1 : 0.6,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          {POSITION_LABELS[pos]}
        </span>
        {player && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: TEAM_COLORS[player.team],
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
        ) : onSitHere ? (
          <button
            onClick={onSitHere}
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#3b82f6',
              background: 'none',
              border: '1px solid #3b82f6',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            Sit here
          </button>
        ) : (
          <span style={{ color: '#9ca3af' }}>Waiting...</span>
        )}
      </div>
      {player && (
        <div
          style={{
            fontSize: '12px',
            color: player.ready ? '#10b981' : '#f59e0b',
          }}
        >
          {player.ready ? 'Ready' : 'Not ready'}
        </div>
      )}
    </div>
  );
}

export function WaitingRoom({
  roomId,
  gameState,
  myPosition,
  onReady,
  onLeave,
  onChangeSeat,
}: WaitingRoomProps) {
  const isMobile = useIsMobile();
  const [copyError, setCopyError] = useState<string | null>(null);
  const myPlayer = gameState.players.find((p) => p.position === myPosition);
  const isReady = myPlayer?.ready ?? false;

  const getSitHereHandler = (pos: Position) => {
    if (pos === myPosition || isReady) return undefined;
    const occupied = gameState.players.some((p) => p.position === pos);
    if (occupied) return undefined;
    return () => onChangeSeat(pos);
  };
  const autoReadyTabsClicked = useRef(false);

  const shareableUrl = `${window.location.origin}/room/${roomId}`;

  // Auto-ready feature: check for autoReady query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldAutoReady = params.get('autoReady') === 'true';

    if (shouldAutoReady && !isReady && gameState.players.length === 4) {
      // Auto-click ready after a short delay to ensure everything is loaded
      const timer = setTimeout(() => {
        onReady();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isReady, gameState.players.length, onReady]);

  // Auto-ready in original tab after clicking "Open 3 Auto-Ready Tabs"
  useEffect(() => {
    if (
      autoReadyTabsClicked.current &&
      !isReady &&
      gameState.players.length === 4
    ) {
      // All players have joined, auto-ready this tab too
      const timer = setTimeout(() => {
        onReady();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isReady, gameState.players.length, onReady]);

  const handleCopyError = () => {
    setCopyError('Could not copy — please copy manually.');
    setTimeout(() => setCopyError(null), 3000);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).catch(handleCopyError);
  };

  const copyShareableUrl = () => {
    navigator.clipboard.writeText(shareableUrl).catch(handleCopyError);
  };

  const openAutoReadyTabs = () => {
    // Open 3 tabs with unique random names
    for (let i = 0; i < 3; i++) {
      const randomName = generateRandomName();
      const autoReadyUrl = `${shareableUrl}?autoReady=true&autoName=${encodeURIComponent(randomName)}`;
      window.open(autoReadyUrl, '_blank');
    }
    // Mark that we should auto-ready this tab once all players join
    autoReadyTabsClicked.current = true;
  };

  return (
    <div
      style={{
        maxWidth: '500px',
        margin: '0 auto',
        padding: isMobile ? '20px 16px' : '40px 20px',
      }}
    >
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '8px',
        }}
      >
        Waiting Room
      </h1>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '24px',
          overflow: 'hidden',
        }}
      >
        <span
          style={{ fontSize: '14px', color: '#6b7280', whiteSpace: 'nowrap' }}
        >
          Room Code:
        </span>
        <code
          style={{
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '2px',
            color: '#1f2937',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          onClick={copyRoomCode}
          title="Click to copy"
        >
          {roomId}
        </code>
        <span style={{ color: '#d1d5db', flexShrink: 0 }}>·</span>
        <span
          style={{ fontSize: '14px', color: '#6b7280', whiteSpace: 'nowrap' }}
        >
          Share Link:
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            overflow: 'hidden',
            flex: 1,
            minWidth: 0,
          }}
          onClick={copyShareableUrl}
          title="Click to copy"
        >
          <code
            style={{
              fontSize: '13px',
              color: '#3b82f6',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {shareableUrl}
          </code>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, color: '#6b7280' }}
          >
            <rect x="3" y="3" width="10" height="10" rx="2" />
            <path d="M7 3V1h6v6h-2" />
          </svg>
        </div>
      </div>

      {copyError && (
        <div
          style={{
            fontSize: '13px',
            color: '#ef4444',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          {copyError}
        </div>
      )}

      {isMobile ? (
        /* 2×2 grid for mobile landscape */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <PlayerSlot
            position={2}
            gameState={gameState}
            myPosition={myPosition}
            onSitHere={getSitHereHandler(2)}
          />
          <PlayerSlot
            position={3}
            gameState={gameState}
            myPosition={myPosition}
            onSitHere={getSitHereHandler(3)}
          />
          <PlayerSlot
            position={0}
            gameState={gameState}
            myPosition={myPosition}
            onSitHere={getSitHereHandler(0)}
          />
          <PlayerSlot
            position={1}
            gameState={gameState}
            myPosition={myPosition}
            onSitHere={getSitHereHandler(1)}
          />
        </div>
      ) : (
        /* Compass layout for desktop */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          {/* North */}
          <div style={{ width: 'calc(50% - 8px)' }}>
            <PlayerSlot
              position={2}
              gameState={gameState}
              myPosition={myPosition}
              onSitHere={getSitHereHandler(2)}
            />
          </div>
          {/* West and East */}
          <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
            <PlayerSlot
              position={1}
              gameState={gameState}
              myPosition={myPosition}
              onSitHere={getSitHereHandler(1)}
            />
            <PlayerSlot
              position={3}
              gameState={gameState}
              myPosition={myPosition}
              onSitHere={getSitHereHandler(3)}
            />
          </div>
          {/* South */}
          <div style={{ width: 'calc(50% - 8px)' }}>
            <PlayerSlot
              position={0}
              gameState={gameState}
              myPosition={myPosition}
              onSitHere={getSitHereHandler(0)}
            />
          </div>
        </div>
      )}

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

      {/* Dev button to auto-fill room */}
      {import.meta.env.DEV && gameState.players.length < 4 && (
        <Button
          onClick={openAutoReadyTabs}
          style={{
            marginTop: '12px',
            width: '100%',
            backgroundColor: '#8b5cf6',
            fontSize: '13px',
          }}
        >
          🚀 Open 3 Auto-Ready Tabs (Dev)
        </Button>
      )}
    </div>
  );
}
