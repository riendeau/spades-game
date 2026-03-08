import { useEffect, useRef, useState } from 'react';
import beefsBanner from '../../assets/beefs.png';

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
  const insRef = useRef<HTMLModElement>(null);
  const [unfilled, setUnfilled] = useState(false);

  useEffect(() => {
    if (!adsenseClient || pushed.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // Ad blocker or script not loaded — silently ignore
    }
  }, []);

  // Collapse the container when AdSense marks the slot as unfilled
  useEffect(() => {
    const ins = insRef.current;
    if (!ins || !adsenseClient) return;

    const observer = new MutationObserver(() => {
      if (ins.getAttribute('data-ad-status') === 'unfilled') {
        setUnfilled(true);
      }
    });
    observer.observe(ins, {
      attributes: true,
      attributeFilter: ['data-ad-status'],
    });
    return () => observer.disconnect();
  }, []);

  // Dev placeholder when no AdSense client is configured
  if (!adsenseClient) {
    return (
      <div style={{ ...style }}>
        <img
          src={beefsBanner}
          alt="Ad"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // Ad blocker detected — render nothing
  if (typeof window.adsbygoogle === 'undefined') {
    return null;
  }

  if (unfilled) return null;

  return (
    <div style={style}>
      <ins
        ref={insRef}
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
