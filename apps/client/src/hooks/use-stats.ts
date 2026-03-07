import { useEffect, useState } from 'react';

interface PartnerStats {
  displayName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  partners: PartnerStats[];
}

export function useStats() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json() as Promise<PlayerStats>;
      })
      .then(setStats)
      .catch((err) => {
        console.error('Failed to fetch stats:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}
