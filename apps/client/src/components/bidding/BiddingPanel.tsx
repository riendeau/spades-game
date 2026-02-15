import type { ClientGameState, Position } from '@spades/shared';
import { getPartnerPosition } from '@spades/shared';
import React, { useState } from 'react';
import { Button } from '../ui/Button';

interface BiddingPanelProps {
  gameState: ClientGameState;
  myPosition: Position;
  cardsRevealed: boolean;
  onBid: (bid: number, isNil?: boolean, isBlindNil?: boolean) => void;
  onRevealCards: () => void;
}

export function BiddingPanel({
  gameState,
  myPosition,
  cardsRevealed,
  onBid,
  onRevealCards,
}: BiddingPanelProps) {
  const [selectedBid, setSelectedBid] = useState<number | null>(null);
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
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}
    >
      {isMyTurn && !hasBid ? (
        !cardsRevealed ? (
          <div
            style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}
          >
            <Button variant="secondary" onClick={handleBlindNilBid}>
              Bid Blind Nil
            </Button>
            <Button onClick={handleSeeCards}>See Cards</Button>
          </div>
        ) : (
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
                  gridTemplateColumns: 'repeat(7, 1fr)',
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
                        padding: '12px',
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

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleNilBid}
                style={{
                  padding: '12px 24px',
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
        )
      ) : (
        <div
          style={{
            textAlign: 'center',
            color: '#6b7280',
            padding: '20px',
          }}
        >
          {hasBid ? (
            <>
              Your bid:{' '}
              <strong>
                {myBid?.isBlindNil
                  ? 'Blind Nil'
                  : myBid?.isNil
                    ? 'Nil'
                    : myBid?.bid}
              </strong>
            </>
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
      )}
    </div>
  );
}
