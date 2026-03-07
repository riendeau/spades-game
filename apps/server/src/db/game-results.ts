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

const EMPTY_STATS: PlayerStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  recentGames: [],
  partners: [],
};

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

const DEV_SAMPLE_STATS: PlayerStats = {
  totalGames: 23,
  wins: 14,
  losses: 9,
  winRate: 61,
  recentGames: [
    {
      completedAt: hoursAgo(1),
      won: true,
      myScore: 512,
      opponentScore: 340,
      partner: 'Alice',
      opponents: ['Bob', 'Charlie'],
    },
    {
      completedAt: hoursAgo(3),
      won: false,
      myScore: 420,
      opponentScore: 505,
      partner: 'Bob',
      opponents: ['Alice', 'Diana'],
    },
    {
      completedAt: hoursAgo(26),
      won: true,
      myScore: 530,
      opponentScore: 285,
      partner: 'Alice',
      opponents: ['Charlie', 'Diana'],
    },
    {
      completedAt: hoursAgo(50),
      won: true,
      myScore: 500,
      opponentScore: 490,
      partner: 'Charlie',
      opponents: ['Alice', 'Bob'],
    },
    {
      completedAt: hoursAgo(170),
      won: false,
      myScore: 380,
      opponentScore: 510,
      partner: 'Diana',
      opponents: ['Alice', 'Bob'],
    },
  ],
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

  // Fetch the 5 most recent games with all player IDs
  const recentResult = await pool.query<{
    completed_at: string;
    winning_team: string;
    my_team: string;
    my_score: number;
    opponent_score: number;
    partner_id: string | null;
    opponent1_id: string | null;
    opponent2_id: string | null;
  }>(
    `SELECT
       completed_at,
       winning_team,
       CASE
         WHEN team1_player1_id = $1 OR team1_player2_id = $1 THEN 'team1'
         ELSE 'team2'
       END AS my_team,
       CASE
         WHEN team1_player1_id = $1 OR team1_player2_id = $1 THEN team1_score
         ELSE team2_score
       END AS my_score,
       CASE
         WHEN team1_player1_id = $1 OR team1_player2_id = $1 THEN team2_score
         ELSE team1_score
       END AS opponent_score,
       CASE
         WHEN team1_player1_id = $1 THEN team1_player2_id
         WHEN team1_player2_id = $1 THEN team1_player1_id
         WHEN team2_player1_id = $1 THEN team2_player2_id
         WHEN team2_player2_id = $1 THEN team2_player1_id
       END AS partner_id,
       CASE
         WHEN team1_player1_id = $1 OR team1_player2_id = $1 THEN team2_player1_id
         ELSE team1_player1_id
       END AS opponent1_id,
       CASE
         WHEN team1_player1_id = $1 OR team1_player2_id = $1 THEN team2_player2_id
         ELSE team1_player2_id
       END AS opponent2_id
     FROM game_results
     WHERE team1_player1_id = $1
        OR team1_player2_id = $1
        OR team2_player1_id = $1
        OR team2_player2_id = $1
     ORDER BY completed_at DESC
     LIMIT 5`,
    [userId]
  );

  // Collect all unique user IDs we need to resolve (partners + opponents)
  const allUserIds = new Set<string>();
  for (const row of result.rows) {
    if (row.partner_id) allUserIds.add(row.partner_id);
  }
  for (const row of recentResult.rows) {
    if (row.partner_id) allUserIds.add(row.partner_id);
    if (row.opponent1_id) allUserIds.add(row.opponent1_id);
    if (row.opponent2_id) allUserIds.add(row.opponent2_id);
  }

  // Resolve display names in a single query
  const nameMap = new Map<string, string>();
  if (allUserIds.size > 0) {
    const nameResult = await pool.query<{ id: string; display_name: string }>(
      `SELECT id, display_name FROM users WHERE id = ANY($1)`,
      [[...allUserIds]]
    );
    for (const row of nameResult.rows) {
      nameMap.set(row.id, row.display_name);
    }
  }

  const name = (id: string | null) =>
    id ? (nameMap.get(id) ?? 'Unknown') : 'Unknown';

  // Build partner stats
  const partners: PartnerStats[] = [];
  for (const [partnerId, stats] of partnerMap) {
    partners.push({
      displayName: name(partnerId),
      ...stats,
    });
  }
  partners.sort((a, b) => b.gamesPlayed - a.gamesPlayed);

  // Build recent games
  const recentGames: RecentGame[] = recentResult.rows.map((row) => ({
    completedAt: row.completed_at,
    won: row.winning_team === row.my_team,
    myScore: row.my_score,
    opponentScore: row.opponent_score,
    partner: name(row.partner_id),
    opponents: [name(row.opponent1_id), name(row.opponent2_id)],
  }));

  return {
    totalGames,
    wins,
    losses,
    winRate: Math.round((wins / totalGames) * 100),
    recentGames,
    partners,
  };
}
