import type { RoundSummary, ClientGameState } from '@spades/shared';
import React from 'react';
import { Button } from '../ui/Button';

interface RoundSummaryModalProps {
  summary: RoundSummary;
  scores: ClientGameState['scores'];
  onClose: () => void;
}

export function RoundSummaryModal({
  summary,
  scores,
  onClose,
}: RoundSummaryModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '500px',
          width: '90%',
          color: '#1f2937',
        }}
      >
        <h2 style={{ margin: '0 0 24px', textAlign: 'center' }}>
          Round {summary.roundNumber} Complete
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
          }}
        >
          {(['team1', 'team2'] as const).map((teamId) => {
            const result = summary[teamId];
            const teamColor = teamId === 'team1' ? '#3b82f6' : '#10b981';

            return (
              <div key={teamId}>
                <h3
                  style={{
                    color: teamColor,
                    margin: '0 0 12px',
                    fontSize: '18px',
                  }}
                >
                  Team {teamId === 'team1' ? '1' : '2'}
                </h3>

                <div style={{ fontSize: '14px', lineHeight: 1.8 }}>
                  <div>Bid: {result.bid}</div>
                  <div>Tricks: {result.tricks}</div>
                  <div style={{ fontWeight: 600 }}>
                    Points: {result.points > 0 ? '+' : ''}
                    {result.points}
                  </div>
                  {result.bags > 0 && <div>Bags: +{result.bags}</div>}
                  {result.bagPenalty && (
                    <div style={{ color: '#dc2626' }}>Bag Penalty: -100</div>
                  )}
                  {result.nilResults.map((nil, i) => (
                    <div
                      key={i}
                      style={{
                        color: nil.succeeded ? '#10b981' : '#dc2626',
                      }}
                    >
                      {nil.isBlindNil ? 'Blind Nil' : 'Nil'}:{' '}
                      {nil.succeeded ? 'Success' : 'Failed'} (
                      {nil.points > 0 ? '+' : ''}
                      {nil.points})
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid #e5e7eb',
                    fontSize: '20px',
                    fontWeight: 700,
                  }}
                >
                  Total: {scores[teamId].score}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Button onClick={onClose} size="large">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
