import type { Card as CardType, Rank } from '@spades/shared';
import React from 'react';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  onDoubleClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  small?: boolean;
  testId?: string;
  visuallyDisabled?: boolean;
}

const RANK_NAMES: Record<Rank, string> = {
  A: 'ace',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'jack',
  Q: 'queen',
  K: 'king',
};

function getCardImageUrl(card: CardType): string {
  return `/cards/${RANK_NAMES[card.rank]}_of_${card.suit}.svg`;
}

export function Card({
  card,
  onClick,
  onDoubleClick,
  disabled,
  selected,
  small,
  testId,
  visuallyDisabled,
}: CardProps) {
  const showDisabled = visuallyDisabled ?? disabled;
  const isSmall = small ?? false;

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      data-testid={testId}
      style={{
        position: 'relative',
        width: isSmall ? '50px' : '90px',
        height: isSmall ? '75px' : '130px',
        background: '#fff',
        border: selected ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.15)',
        borderRadius: '8px',
        padding: isSmall ? '2px' : '3px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: selected
          ? '0 4px 12px rgba(59, 130, 246, 0.4)'
          : showDisabled
            ? 'none'
            : '0 2px 4px rgba(0,0,0,0.15)',
        transition: 'all 0.15s ease',
        filter: showDisabled ? 'grayscale(1) brightness(0.85)' : 'none',
        overflow: 'hidden',
      }}
    >
      <img
        src={getCardImageUrl(card)}
        alt={`${card.rank} of ${card.suit}`}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          borderRadius: '4px',
        }}
      />
    </button>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  return (
    <div
      style={{
        width: small ? '50px' : '90px',
        height: small ? '75px' : '130px',
        backgroundColor: '#1e40af',
        border: '2px solid #1e3a8a',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage:
          'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.08) 5px, rgba(255,255,255,0.08) 10px)',
        boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.15)',
      }}
    >
      <span style={{ color: '#fff', fontSize: small ? '20px' : '36px' }}>
        {'\u2660'}
      </span>
    </div>
  );
}
