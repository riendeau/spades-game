import type {
  Card as CardType,
  ClientGameState,
  Position,
} from '@spades/shared';
import { getPlayableCards } from '@spades/shared';
import React, { useState, useMemo, useEffect } from 'react';
import { useIsMobile } from '../../hooks/use-is-mobile';
import { TEAM_COLORS, TEAM_RGB } from '../../styles/colors';
import { BiddingPanel } from '../bidding/BiddingPanel';
import { Button } from '../ui/Button';
import { OpponentArea } from './OpponentArea';
import { PlayerHand } from './PlayerHand';
import { ScoreBoard } from './ScoreBoard';
import { TrickArea } from './TrickArea';

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
  onRevealCards,
}: GameTableProps) {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const isMobile = useIsMobile();
  const isMyTurn = gameState.currentPlayerPosition === myPosition;
  const isBidding = gameState.phase === 'bidding';
  const isPlaying = gameState.phase === 'playing';

  const myPlayer = gameState.players.find((p) => p.position === myPosition);
  const myPlayerId = myPlayer?.id;

  const playableCards = useMemo(() => {
    if (!isPlaying || !isMyTurn || !myPlayerId) return undefined;
    return getPlayableCards(gameState, myPlayerId, myHand);
  }, [isPlaying, isMyTurn, myPlayerId, gameState, myHand]);

  useEffect(() => {
    if (
      selectedCard &&
      playableCards &&
      !playableCards.some(
        (c) => c.suit === selectedCard.suit && c.rank === selectedCard.rank
      )
    ) {
      setSelectedCard(null);
    }
  }, [playableCards, selectedCard]);

  const handlePlaySelected = () => {
    if (selectedCard) {
      onPlayCard(selectedCard);
      setSelectedCard(null);
    }
  };

  // Determine button text and state
  const getButtonState = () => {
    if (!isPlaying) {
      return { text: 'Waiting...', disabled: true };
    }
    if (!isMyTurn) {
      return { text: 'Waiting...', disabled: true };
    }
    if (!selectedCard) {
      return { text: 'Select Card', disabled: true };
    }
    return {
      text: `Play ${selectedCard.rank} of ${selectedCard.suit}`,
      disabled: false,
    };
  };

  const buttonState = getButtonState();

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a472a',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: isMobile ? '4px 8px' : '16px',
        }}
      >
        <ScoreBoard gameState={gameState} compact={isMobile} />
        <div
          style={{
            color: '#fff',
            fontSize: isMobile ? '12px' : '14px',
            opacity: 0.8,
          }}
        >
          Room: {gameState.id}
        </div>
      </div>

      {/* Game area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Top opponent */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: isMobile ? '2px 6px' : '20px',
          }}
        >
          <OpponentArea
            gameState={gameState}
            myPosition={myPosition}
            relativePosition="top"
            compact={isMobile}
          />
        </div>

        {/* Middle section with left opponent, trick area, right opponent */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isMobile ? '0 6px' : '0 20px',
            minHeight: 0,
          }}
        >
          <OpponentArea
            gameState={gameState}
            myPosition={myPosition}
            relativePosition="left"
            compact={isMobile}
          />

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {isBidding ? (
              <div
                style={{
                  maxWidth: isMobile ? '360px' : '500px',
                  width: '100%',
                }}
              >
                <BiddingPanel
                  gameState={gameState}
                  myPosition={myPosition}
                  cardsRevealed={cardsRevealed}
                  onBid={onBid}
                  onRevealCards={onRevealCards}
                  compact={isMobile}
                />
              </div>
            ) : (
              <TrickArea
                gameState={gameState}
                myPosition={myPosition}
                compact={isMobile}
              />
            )}
          </div>

          <OpponentArea
            gameState={gameState}
            myPosition={myPosition}
            relativePosition="right"
            compact={isMobile}
          />
        </div>

        {/* My player name badge — south position on the table */}
        {myPlayer && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: isMobile ? '2px 6px 10px' : '8px 20px 20px',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                padding: isMobile ? '6px' : '16px',
                borderRadius: '10px',
                backgroundColor: `rgba(${TEAM_RGB[myPlayer.team]}, ${isMyTurn ? 0.2 : 0.07})`,
                border: isMyTurn
                  ? `2px solid ${TEAM_COLORS[myPlayer.team]}`
                  : `2px solid rgba(${TEAM_RGB[myPlayer.team]}, 0.35)`,
                boxShadow: isMyTurn
                  ? `0 0 12px rgba(${TEAM_RGB[myPlayer.team]}, 0.6)`
                  : 'none',
                transition:
                  'background-color 0.2s, border-color 0.2s, box-shadow 0.2s',
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: isMobile ? '12px' : '18px',
                  color: '#f9fafb',
                }}
              >
                {myPlayer.nickname}
              </span>
              <span
                style={{
                  fontSize: isMobile ? '10px' : '14px',
                  color: '#d1d5db',
                }}
              >
                {(() => {
                  const myBid = gameState.currentRound?.bids.find(
                    (b) => b.playerId === myPlayerId
                  );
                  const bidLabel = myBid
                    ? myBid.isBlindNil
                      ? 'BNL'
                      : myBid.isNil
                        ? 'Nil'
                        : myBid.bid
                    : '—';
                  const tricksWon =
                    gameState.currentRound?.tricksWon[myPlayerId ?? ''] ?? 0;
                  return `Bid: ${bidLabel} | Won: ${tricksWon}`;
                })()}
              </span>
            </div>
          </div>
        )}

        {/* Bottom section with my hand */}
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.2)',
            padding: isMobile ? '12px 12px' : '20px',
            borderRadius: '20px 20px 0 0',
          }}
        >
          <PlayerHand
            cards={myHand}
            onPlayCard={onPlayCard}
            isMyTurn={isPlaying && isMyTurn}
            selectedCard={selectedCard}
            onSelectCard={setSelectedCard}
            faceDown={isBidding && !cardsRevealed}
            playableCards={playableCards}
            compact={isMobile}
          />

          {!isBidding && (
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <Button
                onClick={handlePlaySelected}
                disabled={buttonState.disabled}
              >
                {buttonState.text}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
