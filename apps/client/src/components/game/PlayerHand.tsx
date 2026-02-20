import type { Card as CardType } from '@spades/shared';
import React from 'react';
import { Card, CardBack } from '../ui/Card';

interface PlayerHandProps {
  cards: CardType[];
  onPlayCard: (card: CardType) => void;
  isMyTurn: boolean;
  selectedCard: CardType | null;
  onSelectCard: (card: CardType | null) => void;
  faceDown?: boolean;
  playableCards?: CardType[];
  compact?: boolean;
}

export function PlayerHand({
  cards,
  onPlayCard,
  isMyTurn,
  selectedCard,
  onSelectCard,
  faceDown = false,
  playableCards,
  compact = false,
}: PlayerHandProps) {
  const isCardPlayable = (card: CardType): boolean => {
    if (!isMyTurn) return false;
    if (!playableCards) return true;
    return playableCards.some(
      (c) => c.suit === card.suit && c.rank === card.rank
    );
  };

  const handleCardClick = (card: CardType) => {
    if (!isCardPlayable(card)) return;

    const isSelected =
      selectedCard?.suit === card.suit && selectedCard.rank === card.rank;
    if (isSelected) {
      // Clicking a selected card deselects it
      onSelectCard(null);
    } else {
      // Clicking an unselected card selects it
      onSelectCard(card);
    }
  };

  const handleCardDoubleClick = (card: CardType) => {
    if (!isCardPlayable(card)) return;

    // Double-clicking immediately plays the card
    onPlayCard(card);
    onSelectCard(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '-20px',
        padding: compact ? '8px' : '20px',
      }}
    >
      {cards.map((card, idx) => {
        const isSelected =
          selectedCard?.suit === card.suit && selectedCard?.rank === card.rank;

        return (
          <div
            key={`${card.suit}-${card.rank}`}
            style={{
              marginLeft: idx > 0 ? (compact ? '-35px' : '-25px') : 0,
              zIndex: isSelected ? 100 : idx,
            }}
          >
            {faceDown ? (
              <CardBack small={compact} />
            ) : (
              <Card
                card={card}
                onClick={() => handleCardClick(card)}
                onDoubleClick={() => handleCardDoubleClick(card)}
                disabled={!isCardPlayable(card)}
                selected={isSelected}
                testId="hand-card"
                visuallyDisabled={isMyTurn && !isCardPlayable(card)}
                small={compact}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
