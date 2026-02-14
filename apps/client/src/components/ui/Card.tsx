import type { Card as CardType, Suit } from '@spades/shared';
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

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '\u2660',
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
};

const SUIT_COLORS: Record<Suit, string> = {
  spades: '#1a1a2e',
  hearts: '#dc2626',
  diamonds: '#dc2626',
  clubs: '#1a1a2e',
};

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
  const symbol = SUIT_SYMBOLS[card.suit];
  const color = SUIT_COLORS[card.suit];

  // Default visuallyDisabled to disabled if not explicitly set
  const showDisabled = visuallyDisabled ?? disabled;

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      data-testid={testId}
      style={{
        width: small ? '50px' : '70px',
        height: small ? '75px' : '100px',
        backgroundColor: showDisabled ? '#e8e8e8' : '#fff',
        border: selected ? '3px solid #3b82f6' : '1px solid #ccc',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: small ? '14px' : '18px',
        fontWeight: 'bold',
        color,
        boxShadow: selected
          ? '0 4px 12px rgba(59, 130, 246, 0.4)'
          : showDisabled
            ? 'none'
            : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.15s ease',
        transform: selected ? 'translateY(-8px)' : 'none',
        filter: showDisabled ? 'grayscale(1) brightness(0.85)' : 'none',
      }}
    >
      <span>{card.rank}</span>
      <span style={{ fontSize: small ? '20px' : '28px' }}>{symbol}</span>
    </button>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  return (
    <div
      style={{
        width: small ? '50px' : '70px',
        height: small ? '75px' : '100px',
        backgroundColor: '#1e40af',
        border: '1px solid #1e3a8a',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage:
          'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)',
      }}
    >
      <span style={{ color: '#fff', fontSize: small ? '20px' : '28px' }}>
        {'\u2660'}
      </span>
    </div>
  );
}
