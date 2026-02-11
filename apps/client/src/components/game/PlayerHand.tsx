import React from 'react';
import type { Card as CardType } from '@spades/shared';
import { Card, CardBack } from '../ui/Card';

interface PlayerHandProps {
  cards: CardType[];
  onPlayCard: (card: CardType) => void;
  isMyTurn: boolean;
  selectedCard: CardType | null;
  onSelectCard: (card: CardType | null) => void;
  faceDown?: boolean;
}

export function PlayerHand({
  cards,
  onPlayCard,
  isMyTurn,
  selectedCard,
  onSelectCard,
  faceDown = false
}: PlayerHandProps) {
  const handleCardClick = (card: CardType) => {
    if (!isMyTurn) return;

    if (selectedCard && selectedCard.suit === card.suit && selectedCard.rank === card.rank) {
      // Double click to play
      onPlayCard(card);
      onSelectCard(null);
    } else {
      onSelectCard(card);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '-20px',
        padding: '20px'
      }}
    >
      {cards.map((card, idx) => {
        const isSelected =
          selectedCard?.suit === card.suit && selectedCard?.rank === card.rank;

        return (
          <div
            key={`${card.suit}-${card.rank}`}
            style={{
              marginLeft: idx > 0 ? '-25px' : 0,
              zIndex: isSelected ? 100 : idx
            }}
          >
            {faceDown ? (
              <CardBack />
            ) : (
              <Card
                card={card}
                onClick={() => handleCardClick(card)}
                disabled={!isMyTurn}
                selected={isSelected}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
