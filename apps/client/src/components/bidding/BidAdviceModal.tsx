import React from 'react';
import { Button } from '../ui/Button';

interface BidAdviceModalProps {
  loading: boolean;
  error: string | null;
  data: { recommendedBid: number; analysis: string } | null;
  onClose: () => void;
  onUseBid: (bid: number) => void;
}

export function BidAdviceModal({
  loading,
  error,
  data,
  onClose,
  onUseBid,
}: BidAdviceModalProps) {
  return (
    <div
      onClick={onClose}
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
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '420px',
          width: '90%',
          color: '#1f2937',
          textAlign: 'center',
        }}
      >
        {loading && (
          <>
            <div
              style={{
                fontSize: '32px',
                marginBottom: '16px',
                animation: 'spin 1s linear infinite',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                style={{
                  animation: 'spin 1s linear infinite',
                  display: 'inline-block',
                }}
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="#d1d5db"
                  strokeWidth="3"
                  fill="none"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
            <div style={{ fontSize: '16px', color: '#6b7280' }}>
              Claude is analyzing your hand...
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </>
        )}

        {error && (
          <>
            <div
              style={{
                fontSize: '16px',
                color: '#dc2626',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
            <Button onClick={onClose}>Close</Button>
          </>
        )}

        {data && (
          <>
            <div
              style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '8px',
                fontWeight: 500,
              }}
            >
              Claude recommends
            </div>
            <div
              style={{
                fontSize: '48px',
                fontWeight: 700,
                color: '#3b82f6',
                marginBottom: '16px',
              }}
            >
              {data.recommendedBid === 0 ? 'Nil' : data.recommendedBid}
            </div>
            <div
              style={{
                fontSize: '14px',
                color: '#4b5563',
                lineHeight: '1.5',
                marginBottom: '24px',
                textAlign: 'left',
              }}
            >
              {data.analysis}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                Dismiss
              </Button>
              <Button
                onClick={() => onUseBid(data.recommendedBid)}
                style={{ flex: 1 }}
              >
                Use This Bid
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
