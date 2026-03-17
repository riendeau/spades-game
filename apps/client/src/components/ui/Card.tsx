import type { Card as CardType } from '@spades/shared';
import React, { useCallback, useState } from 'react';
import { getCardImageUrl, preloadedCardUrls } from '../../preload-cards';

export const CARD_WIDTH = { small: 50, normal: 110 } as const;
export const CARD_HEIGHT = { small: 75, normal: 160 } as const;

interface CardProps {
  card: CardType;
  onDoubleClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  testId?: string;
  visuallyDisabled?: boolean;
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
        width: `${isSmall ? CARD_WIDTH.small : CARD_WIDTH.normal}px`,
        height: `${isSmall ? CARD_HEIGHT.small : CARD_HEIGHT.normal}px`,
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
        width: `${small ? CARD_WIDTH.small : CARD_WIDTH.normal}px`,
        height: `${small ? CARD_HEIGHT.small : CARD_HEIGHT.normal}px`,
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
