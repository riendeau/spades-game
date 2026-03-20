import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/Button';

interface BidAdviceModalProps {
  loading: boolean;
  error: string | null;
  data: { recommendedBid: number; analysis: string } | null;
  anchorY?: number;
  onClose: () => void;
  onUseBid: (bid: number) => void;
}

export function BidAdviceModal({
  loading,
  error,
  data,
  anchorY,
  onClose,
  onUseBid,
}: BidAdviceModalProps) {
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: '50%',
          top: anchorY ?? '50%',
          transform: 'translate(-50%, -50%)',
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
                color: '#E07A2F',
                animation: 'spin 2s ease-in-out infinite',
              }}
            >
              ✦
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
                color: '#9ca3af',
                marginBottom: '8px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
              }}
            >
              <span style={{ color: '#E07A2F' }}>✦</span> Claude recommends
            </div>
            <div
              style={{
                fontSize: '48px',
                fontWeight: 700,
                color: '#E07A2F',
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
    </div>,
    document.body
  );
}
