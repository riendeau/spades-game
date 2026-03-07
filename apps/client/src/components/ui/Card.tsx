import type { Card as CardType, Rank } from '@spades/shared';
import React, { useCallback, useState } from 'react';
import { preloadedCardUrls } from '../../preload-cards';

interface CardProps {
  card: CardType;
  onDoubleClick?: () => void;
  disabled?: boolean;
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
  onDoubleClick,
  disabled,
  small,
  testId,
  visuallyDisabled,
}: CardProps) {
  const showDisabled = visuallyDisabled ?? disabled;
  const isSmall = small ?? false;
  const src = getCardImageUrl(card);
  const [loaded, setLoaded] = useState(() => preloadedCardUrls.has(src));
  const onLoad = useCallback(() => setLoaded(true), []);

  return (
    <button
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      data-testid={testId}
      style={{
        position: 'relative',
        width: isSmall ? '50px' : '90px',
        height: isSmall ? '75px' : '130px',
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: '8px',
        padding: isSmall ? '2px' : '3px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: showDisabled ? 'none' : '0 2px 4px rgba(0,0,0,0.15)',
        transition: 'all 0.15s ease',
        filter: showDisabled ? 'grayscale(1) brightness(0.85)' : 'none',
        overflow: 'hidden',
      }}
    >
      <img
        src={src}
        alt={`${card.rank} of ${card.suit}`}
        draggable={false}
        onLoad={onLoad}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          borderRadius: '4px',
          opacity: loaded ? 1 : 0,
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
