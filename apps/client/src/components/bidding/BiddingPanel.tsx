import type { ClientGameState, Position } from '@spades/shared';
import { getPartnerPosition } from '@spades/shared';
import React, { useRef, useState } from 'react';
import { useGameStore } from '../../store/game-store';
import { Button } from '../ui/Button';
import { BidAdviceModal } from './BidAdviceModal';

interface BiddingPanelProps {
  gameState: ClientGameState;
  myPosition: Position;
  cardsRevealed: boolean;
  onBid: (bid: number, isNil?: boolean, isBlindNil?: boolean) => void;
  onRevealCards: () => void;
  compact?: boolean;
}

export function BiddingPanel({
  gameState,
  myPosition,
  cardsRevealed,
  onBid,
  onRevealCards,
  compact = false,
}: BiddingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [selectedBid, setSelectedBid] = useState<number | null>(null);
  const [showAdvice, setShowAdvice] = useState(false);
  const [adviceUsed, setAdviceUsed] = useState(false);
  const [anchorY, setAnchorY] = useState<number | undefined>(undefined);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceData, setAdviceData] = useState<{
    recommendedBid: number;
    analysis: string;
  } | null>(null);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const roomId = useGameStore((s) => s.roomId);
  const sessionToken = useGameStore((s) => s.sessionToken);

  const handleAskClaude = async () => {
    const rect = panelRef.current?.getBoundingClientRect();
    setAnchorY(rect ? rect.top + rect.height / 2 : undefined);
    setShowAdvice(true);
    setAdviceLoading(true);
    setAdviceData(null);
    setAdviceError(null);

    try {
      const res = await fetch('/api/bid-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, sessionToken }),
      });
      const body = await res.json();
      if (!res.ok) {
        setAdviceError(body.error || 'Failed to get advice');
      } else {
        setAdviceData(body);
      }
    } catch {
      setAdviceError('Failed to connect to server');
    } finally {
      setAdviceLoading(false);
    }
  };

  const isMyTurn = gameState.currentPlayerPosition === myPosition;
  const myBid = gameState.currentRound?.bids.find(
    (b) =>
      b.playerId ===
      gameState.players.find((p) => p.position === myPosition)?.id
  );
  const hasBid = !!myBid;

  const handleSubmitBid = () => {
    if (selectedBid !== null) {
      // selectedBid === 0 means nil bid
      const isNil = selectedBid === 0;
      onBid(selectedBid, isNil);
      setSelectedBid(null);
    }
  };

  const handleNilBid = () => {
    setSelectedBid(0);
  };

  const handleBlindNilBid = () => {
    onRevealCards();
    onBid(0, false, true);
  };

  const handleSeeCards = () => {
    onRevealCards();
  };

  // Calculate max allowed bid based on partner's bid (to prevent team bidding > 13)
  const getMaxAllowedBid = (): number => {
    const currentBids = gameState.currentRound?.bids || [];
    // Only restrict if we're the 3rd or 4th player to bid
    if (currentBids.length < 2) {
      return 13; // No restriction for first two bidders
    }

    const partnerPosition = getPartnerPosition(myPosition);
    const partnerBid = currentBids.find(
      (b) =>
        b.playerId ===
        gameState.players.find((p) => p.position === partnerPosition)?.id
    );

    if (!partnerBid) {
      return 13; // Partner hasn't bid yet
    }

    // If partner bid nil, they're bidding 0 tricks
    const partnerTrickBid =
      partnerBid.isNil || partnerBid.isBlindNil ? 0 : partnerBid.bid;

    // Max we can bid is 13 minus partner's bid
    return 13 - partnerTrickBid;
  };

  const maxAllowedBid = getMaxAllowedBid();

  return (
    <div
      ref={panelRef}
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: compact ? '8px' : '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}
    >
      {hasBid ? (
        <div
          style={{
            textAlign: 'center',
            color: '#6b7280',
            padding: compact ? '8px' : '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div>
            Your bid:{' '}
            <strong>
              {myBid?.isBlindNil
                ? 'Blind Nil'
                : myBid?.isNil
                  ? 'Nil'
                  : myBid?.bid}
            </strong>
          </div>
          {gameState.currentPlayerPosition != null && (
            <div style={{ fontSize: '14px' }}>
              Waiting for{' '}
              {
                gameState.players.find(
                  (p) => p.position === gameState.currentPlayerPosition
                )?.nickname
              }{' '}
              to bid...
            </div>
          )}
        </div>
      ) : !cardsRevealed ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: compact ? '8px' : '12px',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: compact ? '8px' : '12px' }}>
            <Button
              variant="secondary"
              onClick={handleBlindNilBid}
              disabled={!isMyTurn}
            >
              Bid Blind Nil
            </Button>
            <Button onClick={handleSeeCards}>See Cards</Button>
          </div>
          <div
            style={{
              fontSize: '14px',
              color: isMyTurn ? '#3b82f6' : '#6b7280',
            }}
          >
            {isMyTurn ? (
              "It's your turn to bid!"
            ) : (
              <>
                Waiting for{' '}
                {
                  gameState.players.find(
                    (p) => p.position === gameState.currentPlayerPosition
                  )?.nickname
                }{' '}
                to bid...
              </>
            )}
          </div>
        </div>
      ) : isMyTurn ? (
        <>
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '8px',
              }}
            >
              Select your bid:
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: compact
                  ? 'repeat(4, 1fr)'
                  : 'repeat(7, 1fr)',
                gap: '8px',
              }}
            >
              {Array.from({ length: 13 }, (_, i) => i + 1).map((bid) => {
                const isDisabled =
                  bid > maxAllowedBid ||
                  (gameState.disabledBids?.includes(bid) ?? false);
                return (
                  <button
                    key={bid}
                    onClick={() => !isDisabled && setSelectedBid(bid)}
                    disabled={isDisabled}
                    style={{
                      padding: compact ? '8px' : '12px',
                      fontSize: '16px',
                      fontWeight: 600,
                      backgroundColor:
                        selectedBid === bid ? '#3b82f6' : '#f3f4f6',
                      color: selectedBid === bid ? '#fff' : '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.4 : 1,
                    }}
                  >
                    {bid}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={() => void handleAskClaude()}
              disabled={adviceLoading || adviceUsed}
              style={{
                width: '100%',
                padding: compact ? '7px 12px' : '9px 16px',
                fontSize: '13px',
                fontWeight: 600,
                backgroundColor:
                  adviceLoading || adviceUsed ? '#c4652a' : '#E07A2F',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: adviceLoading || adviceUsed ? 'not-allowed' : 'pointer',
                opacity: adviceUsed ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                letterSpacing: '0.01em',
              }}
            >
              <span style={{ fontSize: '15px', lineHeight: 1 }}>✦</span>
              {adviceLoading ? 'Asking Claude...' : 'Help me, Claude!'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: compact ? '8px' : '12px' }}>
            <button
              onClick={handleNilBid}
              style={{
                padding: compact ? '8px 16px' : '12px 24px',
                fontSize: '16px',
                fontWeight: 600,
                backgroundColor: selectedBid === 0 ? '#3b82f6' : '#f3f4f6',
                color: selectedBid === 0 ? '#fff' : '#374151',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Nil
            </button>
            <Button
              onClick={handleSubmitBid}
              disabled={selectedBid === null}
              style={{ flex: 1 }}
            >
              Submit Bid
            </Button>
          </div>
        </>
      ) : (
        <div
          style={{
            textAlign: 'center',
            color: '#6b7280',
            padding: compact ? '8px' : '20px',
          }}
        >
          Waiting for{' '}
          {
            gameState.players.find(
              (p) => p.position === gameState.currentPlayerPosition
            )?.nickname
          }{' '}
          to bid...
        </div>
      )}

      {showAdvice && (
        <BidAdviceModal
          loading={adviceLoading}
          error={adviceError}
          data={adviceData}
          anchorY={anchorY}
          onClose={() => {
            setShowAdvice(false);
            setAdviceUsed(true);
          }}
          onUseBid={(bid) => {
            setSelectedBid(bid);
            setShowAdvice(false);
            setAdviceUsed(true);
          }}
        />
      )}
    </div>
  );
}
