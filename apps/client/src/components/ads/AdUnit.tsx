import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

interface AdUnitProps {
  slot: string;
  format?: 'auto' | 'rectangle' | 'horizontal';
  fullWidthResponsive?: boolean;
  style?: React.CSSProperties;
}

const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;

export function AdUnit({
  slot,
  format = 'auto',
  fullWidthResponsive = false,
  style,
}: AdUnitProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!adsenseClient || pushed.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // Ad blocker or script not loaded — silently ignore
    }
  }, []);

  // Dev placeholder when no AdSense client is configured
  if (!adsenseClient) {
    return (
      <div
        style={{
          border: '2px dashed #9ca3af',
          borderRadius: '8px',
          padding: '12px',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '13px',
          ...style,
        }}
      >
        Ad
      </div>
    );
  }

  // Ad blocker detected — render nothing
  if (typeof window.adsbygoogle === 'undefined') {
    return null;
  }

  return (
    <div style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={adsenseClient}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive ? 'true' : undefined}
      />
    </div>
  );
}
