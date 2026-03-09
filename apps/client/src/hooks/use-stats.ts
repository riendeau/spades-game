import { useEffect, useState } from 'react';

interface PartnerStats {
  displayName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

export interface RecentGame {
  completedAt: string;
  won: boolean;
  myScore: number;
  opponentScore: number;
  partner: string;
  opponents: [string, string];
}

export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  recentGames: RecentGame[];
  partners: PartnerStats[];
}

export interface BidStats {
  totalRounds: number;
  averageBid: number;
  averageTricks: number;
  bidAccuracy: number;
  underbidRate: number;
  setBidRate: number;
}

export interface NilStats {
  totalAttempts: number;
  succeeded: number;
  failed: number;
  successRate: number;
  blindNilAttempts: number;
  blindNilSucceeded: number;
  blindNilSuccessRate: number;
  asPartner: {
    totalAttempts: number;
    succeeded: number;
    failed: number;
    successRate: number;
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json() as Promise<T>;
}

export function useStats() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [bidStats, setBidStats] = useState<BidStats | null>(null);
  const [nilStats, setNilStats] = useState<NilStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJson<PlayerStats>('/api/stats'),
      fetchJson<BidStats>('/api/stats/bids'),
      fetchJson<NilStats>('/api/stats/nil'),
    ])
      .then(([s, b, n]) => {
        setStats(s);
        setBidStats(b);
        setNilStats(n);
      })
      .catch((err) => {
        console.error('Failed to fetch stats:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { stats, bidStats, nilStats, loading };
}
