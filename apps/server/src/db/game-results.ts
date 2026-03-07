import { pool } from './client.js';

export interface GameResultData {
  roomId: string;
  winningTeam: 'team1' | 'team2';
  team1Score: number;
  team2Score: number;
  roundsPlayed: number;
  team1Player1Id: string | null;
  team1Player2Id: string | null;
  team2Player1Id: string | null;
  team2Player2Id: string | null;
}

export async function insertGameResult(data: GameResultData): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  await pool.query(
    `INSERT INTO game_results
       (room_id, winning_team, team1_score, team2_score, rounds_played,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      data.roomId,
      data.winningTeam,
      data.team1Score,
      data.team2Score,
      data.roundsPlayed,
      data.team1Player1Id,
      data.team1Player2Id,
      data.team2Player1Id,
      data.team2Player2Id,
    ]
  );
}

export interface PartnerStats {
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

const EMPTY_STATS: PlayerStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  partners: [],
};

const DEV_SAMPLE_STATS: PlayerStats = {
  totalGames: 23,
  wins: 14,
  losses: 9,
  winRate: 61,
  partners: [
    { displayName: 'Alice', gamesPlayed: 10, wins: 7, losses: 3 },
    { displayName: 'Bob', gamesPlayed: 8, wins: 4, losses: 4 },
    { displayName: 'Charlie', gamesPlayed: 3, wins: 2, losses: 1 },
    { displayName: 'Diana', gamesPlayed: 2, wins: 1, losses: 1 },
  ],
};

export async function getPlayerStats(userId: string): Promise<PlayerStats> {
  if (!process.env.DATABASE_URL) {
    return process.env.NODE_ENV === 'production'
      ? EMPTY_STATS
      : DEV_SAMPLE_STATS;
  }

  // Find all games this user participated in, determine their team, and identify their partner
  const result = await pool.query<{
    winning_team: string;
    my_team: string;
    partner_id: string | null;
  }>(
    `SELECT
       winning_team,
       CASE
         WHEN team1_player1_id = $1 OR team1_player2_id = $1 THEN 'team1'
         ELSE 'team2'
       END AS my_team,
       CASE
         WHEN team1_player1_id = $1 THEN team1_player2_id
         WHEN team1_player2_id = $1 THEN team1_player1_id
         WHEN team2_player1_id = $1 THEN team2_player2_id
         WHEN team2_player2_id = $1 THEN team2_player1_id
       END AS partner_id
     FROM game_results
     WHERE team1_player1_id = $1
        OR team1_player2_id = $1
        OR team2_player1_id = $1
        OR team2_player2_id = $1
     ORDER BY completed_at DESC`,
    [userId]
  );

  if (result.rows.length === 0) return EMPTY_STATS;

  const totalGames = result.rows.length;
  const wins = result.rows.filter((r) => r.winning_team === r.my_team).length;
  const losses = totalGames - wins;

  // Aggregate partner stats
  const partnerMap = new Map<
    string,
    { gamesPlayed: number; wins: number; losses: number }
  >();
  for (const row of result.rows) {
    if (!row.partner_id) continue;
    const existing = partnerMap.get(row.partner_id) ?? {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
    };
    existing.gamesPlayed++;
    if (row.winning_team === row.my_team) {
      existing.wins++;
    } else {
      existing.losses++;
    }
    partnerMap.set(row.partner_id, existing);
  }

  // Resolve partner display names
  const partnerIds = [...partnerMap.keys()];
  const partners: PartnerStats[] = [];

  if (partnerIds.length > 0) {
    const nameResult = await pool.query<{ id: string; display_name: string }>(
      `SELECT id, display_name FROM users WHERE id = ANY($1)`,
      [partnerIds]
    );
    const nameMap = new Map(nameResult.rows.map((r) => [r.id, r.display_name]));

    for (const [partnerId, stats] of partnerMap) {
      partners.push({
        displayName: nameMap.get(partnerId) ?? 'Unknown',
        ...stats,
      });
    }

    // Sort by most games played together
    partners.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  }

  return {
    totalGames,
    wins,
    losses,
    winRate: Math.round((wins / totalGames) * 100),
    partners,
  };
}
