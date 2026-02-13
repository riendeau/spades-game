import React from 'react';
import { useGame } from './hooks/use-game';
import { JoinRoom } from './components/lobby/JoinRoom';
import { WaitingRoom } from './components/lobby/WaitingRoom';
import { GameTable } from './components/game/GameTable';
import { RoundSummaryModal } from './components/game/RoundSummaryModal';
import { GameEndModal } from './components/game/GameEndModal';

export function App() {
  const {
    connected,
    roomId,
    myPosition,
    gameState,
    myHand,
    cardsRevealed,
    roundSummary,
    gameEnded,
    error,
    createRoom,
    joinRoom,
    setReady,
    makeBid,
    playCard,
    leaveRoom,
    clearRoundSummary,
    revealCards,
    reset
  } = useGame();

  // Get room ID from URL if present (uppercase for consistency)
  const urlRoomId = window.location.pathname.match(/\/room\/([A-Z0-9]+)/i)?.[1]?.toUpperCase();

  if (!connected) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>Connecting...</div>
          <div style={{ color: '#6b7280' }}>Please wait</div>
        </div>
      </div>
    );
  }

  // Error toast
  const errorToast = error && (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#dc2626',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '8px',
        zIndex: 2000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}
    >
      {error}
    </div>
  );

  // No room yet - show join/create
  if (!roomId || !gameState) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        {errorToast}
        <JoinRoom
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          initialRoomId={urlRoomId}
        />
      </div>
    );
  }

  // Waiting room
  if (gameState.phase === 'waiting' && myPosition !== null) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        {errorToast}
        <WaitingRoom
          roomId={roomId}
          gameState={gameState}
          myPosition={myPosition}
          onReady={setReady}
          onLeave={leaveRoom}
        />
      </div>
    );
  }

  // Game in progress
  if (myPosition !== null) {
    const myPlayer = gameState.players.find(p => p.position === myPosition);
    const myTeam = myPlayer?.team || 'team1';

    return (
      <>
        {errorToast}

        <GameTable
          gameState={gameState}
          myPosition={myPosition}
          myHand={myHand}
          cardsRevealed={cardsRevealed}
          onPlayCard={playCard}
          onBid={makeBid}
          onRevealCards={revealCards}
        />

        {roundSummary && (
          <RoundSummaryModal
            summary={roundSummary}
            scores={gameState.scores}
            onClose={clearRoundSummary}
          />
        )}

        {gameEnded && (
          <GameEndModal
            winner={gameEnded.winner}
            scores={gameEnded.scores}
            myTeam={myTeam}
            onNewGame={() => {
              reset();
              window.location.reload();
            }}
          />
        )}
      </>
    );
  }

  // Fallback
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      Loading...
    </div>
  );
}
