import React, { useState } from 'react';
import type { Card as CardType, ClientGameState, Position } from '@spades/shared';
import { PlayerHand } from './PlayerHand';
import { TrickArea } from './TrickArea';
import { OpponentArea } from './OpponentArea';
import { ScoreBoard } from './ScoreBoard';
import { BiddingPanel } from '../bidding/BiddingPanel';
import { Button } from '../ui/Button';

interface GameTableProps {
  gameState: ClientGameState;
  myPosition: Position;
  myHand: CardType[];
  cardsRevealed: boolean;
  onPlayCard: (card: CardType) => void;
  onBid: (bid: number, isNil?: boolean, isBlindNil?: boolean) => void;
  onRevealCards: () => void;
}

export function GameTable({
  gameState,
  myPosition,
  myHand,
  cardsRevealed,
  onPlayCard,
  onBid,
  onRevealCards
}: GameTableProps) {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const isMyTurn = gameState.currentPlayerPosition === myPosition;
  const isBidding = gameState.phase === 'bidding';
  const isPlaying = gameState.phase === 'playing';

  const handlePlaySelected = () => {
    if (selectedCard) {
      onPlayCard(selectedCard);
      setSelectedCard(null);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a472a',
        color: '#fff',
        overflow: 'hidden'
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '16px'
        }}
      >
        <ScoreBoard gameState={gameState} />
        <div style={{ color: '#fff', fontSize: '14px', opacity: 0.8 }}>
          Room: {gameState.id}
        </div>
      </div>

      {/* Game area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top opponent */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
          <OpponentArea
            gameState={gameState}
            myPosition={myPosition}
            relativePosition="top"
          />
        </div>

        {/* Middle section with left opponent, trick area, right opponent */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px'
          }}
        >
          <OpponentArea
            gameState={gameState}
            myPosition={myPosition}
            relativePosition="left"
          />

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {isBidding ? (
              <div style={{ maxWidth: '500px', width: '100%' }}>
                <BiddingPanel
                  gameState={gameState}
                  myPosition={myPosition}
                  cardsRevealed={cardsRevealed}
                  onBid={onBid}
                  onRevealCards={onRevealCards}
                />
              </div>
            ) : (
              <TrickArea gameState={gameState} myPosition={myPosition} />
            )}
          </div>

          <OpponentArea
            gameState={gameState}
            myPosition={myPosition}
            relativePosition="right"
          />
        </div>

        {/* Bottom section with my hand */}
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.2)',
            padding: '20px',
            borderRadius: '20px 20px 0 0'
          }}
        >
          {isPlaying && isMyTurn && (
            <div
              style={{
                textAlign: 'center',
                marginBottom: '12px',
                color: '#fbbf24'
              }}
            >
              Your turn! {selectedCard ? 'Click card again or press Play' : 'Select a card'}
            </div>
          )}

          <PlayerHand
            cards={myHand}
            onPlayCard={onPlayCard}
            isMyTurn={isPlaying && isMyTurn}
            selectedCard={selectedCard}
            onSelectCard={setSelectedCard}
            faceDown={isBidding && !cardsRevealed}
          />

          {selectedCard && isMyTurn && (
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <Button onClick={handlePlaySelected}>
                Play {selectedCard.rank} of {selectedCard.suit}
              </Button>
            </div>
          )}

          {/* My info */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '24px',
              marginTop: '12px',
              fontSize: '14px'
            }}
          >
            {gameState.currentRound?.bids.find(
              b => b.playerId === gameState.players.find(p => p.position === myPosition)?.id
            ) && (
              <>
                <span>
                  My Bid:{' '}
                  {(() => {
                    const myBid = gameState.currentRound?.bids.find(
                      b => b.playerId === gameState.players.find(p => p.position === myPosition)?.id
                    );
                    return myBid?.isBlindNil ? 'Blind Nil' : myBid?.isNil ? 'Nil' : myBid?.bid;
                  })()}
                </span>
                <span>
                  Tricks Won:{' '}
                  {gameState.currentRound?.tricksWon[
                    gameState.players.find(p => p.position === myPosition)?.id || ''
                  ] || 0}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
