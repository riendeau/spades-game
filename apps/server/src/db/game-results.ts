import { pool } from './client.js';

export interface NilAttemptInsertData {
  roundNumber: number;
  playerId: string | null;
  isBlindNil: boolean;
  succeeded: boolean;
}

export interface GameResultData {
  roomId: string;
  team1Score: number;
  team2Score: number;
  roundsPlayed: number;
  team1Player1Id: string | null;
  team1Player2Id: string | null;
  team2Player1Id: string | null;
  team2Player2Id: string | null;
  nilAttempts: NilAttemptInsertData[];
}

export async function insertGameResult(data: GameResultData): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query<{ id: string }>(
      `INSERT INTO game_results
         (room_id, team1_score, team2_score, rounds_played,
          team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        data.roomId,
        data.team1Score,
        data.team2Score,
        data.roundsPlayed,
        data.team1Player1Id,
        data.team1Player2Id,
        data.team2Player1Id,
        data.team2Player2Id,
      ]
    );

    const gameResultId = result.rows[0].id;

    for (const nil of data.nilAttempts) {
      await client.query(
        `INSERT INTO nil_attempts
           (game_result_id, round_number, player_id, is_blind_nil, succeeded)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          gameResultId,
          nil.roundNumber,
          nil.playerId,
          nil.isBlindNil,
          nil.succeeded,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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

  // Single query: fetch all games with scores, partner, and opponent IDs.
  // Ordered by completed_at DESC so the first 5 rows are the recent games.
  const result = await pool.query<{
    completed_at: string;
    won: boolean;
    my_score: number;
    opponent_score: number;
    partner_id: string | null;
    opponent1_id: string | null;
    opponent2_id: string | null;
  }>(
    `SELECT
       completed_at,
       CASE
         WHEN team1_player1_id = $1 OR team1_player2_id = $1 THEN team1_score > team2_score
         ELSE team2_score > team1_score
       END AS won,
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
     ORDER BY completed_at DESC`,
    [userId]
  );

  if (result.rows.length === 0) return EMPTY_STATS;

  const totalGames = result.rows.length;
  const wins = result.rows.filter((r) => r.won).length;
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
    if (row.won) {
      existing.wins++;
    } else {
      existing.losses++;
    }
    partnerMap.set(row.partner_id, existing);
  }

  // Collect all unique user IDs we need to resolve names for.
  // Opponent IDs only matter for the 5 most recent games.
  const allUserIds = new Set<string>();
  for (const row of result.rows) {
    if (row.partner_id) allUserIds.add(row.partner_id);
  }
  const recentRows = result.rows.slice(0, 5);
  for (const row of recentRows) {
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

  // Build recent games from the first 5 rows
  const recentGames: RecentGame[] = recentRows.map((row) => ({
    completedAt: row.completed_at,
    won: row.won,
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

const EMPTY_NIL_STATS: NilStats = {
  totalAttempts: 0,
  succeeded: 0,
  failed: 0,
  successRate: 0,
  blindNilAttempts: 0,
  blindNilSucceeded: 0,
  blindNilSuccessRate: 0,
  asPartner: { totalAttempts: 0, succeeded: 0, failed: 0, successRate: 0 },
};

const DEV_SAMPLE_NIL_STATS: NilStats = {
  totalAttempts: 8,
  succeeded: 5,
  failed: 3,
  successRate: 63,
  blindNilAttempts: 2,
  blindNilSucceeded: 1,
  blindNilSuccessRate: 50,
  asPartner: { totalAttempts: 6, succeeded: 4, failed: 2, successRate: 67 },
};

export async function getNilStats(userId: string): Promise<NilStats> {
  if (!process.env.DATABASE_URL) {
    return process.env.NODE_ENV === 'production'
      ? EMPTY_NIL_STATS
      : DEV_SAMPLE_NIL_STATS;
  }

  // My nil bids
  const myNils = await pool.query<{
    total: string;
    succeeded: string;
    blind_total: string;
    blind_succeeded: string;
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE succeeded)::text AS succeeded,
       COUNT(*) FILTER (WHERE is_blind_nil)::text AS blind_total,
       COUNT(*) FILTER (WHERE is_blind_nil AND succeeded)::text AS blind_succeeded
     FROM nil_attempts
     WHERE player_id = $1`,
    [userId]
  );

  const totalAttempts = parseInt(myNils.rows[0].total, 10);
  const succeeded = parseInt(myNils.rows[0].succeeded, 10);
  const failed = totalAttempts - succeeded;
  const blindNilAttempts = parseInt(myNils.rows[0].blind_total, 10);
  const blindNilSucceeded = parseInt(myNils.rows[0].blind_succeeded, 10);

  // Partner's nil bids (I was protecting)
  const partnerNils = await pool.query<{
    total: string;
    succeeded: string;
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE na.succeeded)::text AS succeeded
     FROM nil_attempts na
     JOIN game_results gr ON gr.id = na.game_result_id
     WHERE na.player_id != $1
       AND CASE
         WHEN gr.team1_player1_id = $1 THEN na.player_id = gr.team1_player2_id
         WHEN gr.team1_player2_id = $1 THEN na.player_id = gr.team1_player1_id
         WHEN gr.team2_player1_id = $1 THEN na.player_id = gr.team2_player2_id
         WHEN gr.team2_player2_id = $1 THEN na.player_id = gr.team2_player1_id
         ELSE FALSE
       END`,
    [userId]
  );

  const partnerTotal = parseInt(partnerNils.rows[0].total, 10);
  const partnerSucceeded = parseInt(partnerNils.rows[0].succeeded, 10);
  const partnerFailed = partnerTotal - partnerSucceeded;

  return {
    totalAttempts,
    succeeded,
    failed,
    successRate:
      totalAttempts > 0 ? Math.round((succeeded / totalAttempts) * 100) : 0,
    blindNilAttempts,
    blindNilSucceeded,
    blindNilSuccessRate:
      blindNilAttempts > 0
        ? Math.round((blindNilSucceeded / blindNilAttempts) * 100)
        : 0,
    asPartner: {
      totalAttempts: partnerTotal,
      succeeded: partnerSucceeded,
      failed: partnerFailed,
      successRate:
        partnerTotal > 0
          ? Math.round((partnerSucceeded / partnerTotal) * 100)
          : 0,
    },
  };
}
