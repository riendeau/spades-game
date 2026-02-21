import { useState, useEffect } from 'react';

function checkIsMobile(breakpoint: number): boolean {
  return window.innerWidth < breakpoint || window.innerHeight < 500;
}

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => checkIsMobile(breakpoint));
  useEffect(() => {
    const handleResize = () => setIsMobile(checkIsMobile(breakpoint));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);
  return isMobile;
}
