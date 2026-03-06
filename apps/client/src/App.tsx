import React, { useEffect } from 'react';
import { LoginGate } from './components/auth/LoginGate';
import { useUser } from './components/auth/user-context';
import { EffectsOverlay } from './components/effects/EffectsOverlay';
import { GameEndModal } from './components/game/GameEndModal';
import { GameTable } from './components/game/GameTable';
import { RoundSummaryModal } from './components/game/RoundSummaryModal';
import { JoinRoom } from './components/lobby/JoinRoom';
import { SeatSelection } from './components/lobby/SeatSelection';
import { WaitingRoom } from './components/lobby/WaitingRoom';
import { useGame } from './hooks/use-game';
import { preload } from './services/audio';
import { useGameStore } from './store/game-store';

function AppInner() {
  const user = useUser();
  const {
    connected,
    roomId,
    myPosition,
    gameState,
    myHand,
    cardsRevealed,
    roundSummary,
    roundEffects,
    gameEnded,
    error,
    createRoom,
    joinRoom,
    setReady,
    makeBid,
    playCard,
    leaveRoom,
    changeSeat,
    openSeat,
    selectSeat,
    availableSeats,
    seatSelectRoomId,
    clearRoundSummary,
    clearRoundEffects,
    revealCards,
    reset,
  } = useGame();

  useEffect(() => {
    void preload('bowling-strike', '/audio/bowling-strike.mp3');
    void preload('victory-fanfare', '/audio/victory-fanfare.mp3');
  }, []);

  // Dev helper: trigger effects from browser console
  // Usage: __triggerEffect('bowling-strike') or __triggerEffect('fake-victory', 'team2')
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const trigger = (effectId: string, teamId: 'team1' | 'team2' = 'team1') => {
      useGameStore.getState().setRoundEffects([{ id: effectId, teamId }]);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__triggerEffect = trigger;
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__triggerEffect;
    };
  }, []);

  // Get room ID from URL if present (uppercase for consistency)
  const urlRoomId = /\/room\/([A-Z0-9]+)/i
    .exec(window.location.pathname)?.[1]
    ?.toUpperCase();

  if (!connected) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>
            Connecting...
          </div>
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
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {error}
    </div>
  );

  // Seat selection for joining an in-progress game
  if (availableSeats && seatSelectRoomId) {
    const nickname =
      useGameStore.getState().nickname ?? user?.displayName ?? 'Player';
    return (
      <>
        {errorToast}
        <SeatSelection
          roomId={seatSelectRoomId}
          seats={availableSeats}
          nickname={nickname}
          onSelectSeat={selectSeat}
        />
      </>
    );
  }

  // No room yet - show join/create
  if (!roomId || !gameState) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        {errorToast}
        <JoinRoom
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          initialRoomId={urlRoomId}
          initialNickname={user?.displayName}
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
          onChangeSeat={changeSeat}
        />
      </div>
    );
  }

  // Game in progress
  if (myPosition !== null) {
    const myPlayer = gameState.players.find((p) => p.position === myPosition);
    const myTeam = myPlayer?.team ?? 'team1';

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
          onOpenSeat={openSeat}
        />

        {roundEffects.length > 0 && (
          <EffectsOverlay
            effects={roundEffects}
            gameState={gameState}
            onAllComplete={clearRoundEffects}
          />
        )}

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
        justifyContent: 'center',
      }}
    >
      Loading...
    </div>
  );
}

export function App() {
  return (
    <LoginGate>
      <AppInner />
    </LoginGate>
  );
}
