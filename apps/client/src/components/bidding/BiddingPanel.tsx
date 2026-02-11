import React, { useState } from 'react';
import type { ClientGameState, Position } from '@spades/shared';
import { Button } from '../ui/Button';

interface BiddingPanelProps {
  gameState: ClientGameState;
  myPosition: Position;
  onBid: (bid: number, isNil?: boolean, isBlindNil?: boolean) => void;
}

export function BiddingPanel({ gameState, myPosition, onBid }: BiddingPanelProps) {
  const [selectedBid, setSelectedBid] = useState<number | null>(null);
  const isMyTurn = gameState.currentPlayerPosition === myPosition;
  const myBid = gameState.currentRound?.bids.find(
    b => b.playerId === gameState.players.find(p => p.position === myPosition)?.id
  );
  const hasBid = !!myBid;

  const handleSubmitBid = () => {
    if (selectedBid !== null) {
      onBid(selectedBid);
      setSelectedBid(null);
    }
  };

  const handleNilBid = () => {
    onBid(0, true);
  };

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}
    >
      <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600 }}>
        Bidding Round {gameState.currentRound?.roundNumber}
      </h3>

      {/* Current bids */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
          Bids placed:
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {gameState.players.map(player => {
            const bid = gameState.currentRound?.bids.find(b => b.playerId === player.id);
            return (
              <div
                key={player.id}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                <span style={{ fontWeight: 500 }}>{player.nickname}</span>
                <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                  {bid
                    ? bid.isNil
                      ? 'Nil'
                      : bid.isBlindNil
                        ? 'Blind Nil'
                        : bid.bid
                    : '...'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isMyTurn && !hasBid ? (
        <>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
              Select your bid:
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '8px'
              }}
            >
              {Array.from({ length: 13 }, (_, i) => i + 1).map(bid => (
                <button
                  key={bid}
                  onClick={() => setSelectedBid(bid)}
                  style={{
                    padding: '12px',
                    fontSize: '16px',
                    fontWeight: 600,
                    backgroundColor: selectedBid === bid ? '#3b82f6' : '#f3f4f6',
                    color: selectedBid === bid ? '#fff' : '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {bid}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" onClick={handleNilBid}>
              Bid Nil
            </Button>
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
            padding: '20px'
          }}
        >
          {hasBid ? (
            <>Your bid: <strong>{myBid?.isNil ? 'Nil' : myBid?.bid}</strong></>
          ) : (
            <>Waiting for {gameState.players.find(p => p.position === gameState.currentPlayerPosition)?.nickname} to bid...</>
          )}
        </div>
      )}
    </div>
  );
}
