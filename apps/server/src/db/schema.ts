import { pool } from './client.js';

export async function createTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      google_id     TEXT        UNIQUE NOT NULL,
      email         TEXT        UNIQUE NOT NULL,
      display_name  TEXT        NOT NULL,
      picture_url   TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id       UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      theme         TEXT,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS game_results (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id          TEXT        NOT NULL,
      winning_team     TEXT        NOT NULL CHECK (winning_team IN ('team1', 'team2')),
      team1_score      INTEGER     NOT NULL,
      team2_score      INTEGER     NOT NULL,
      rounds_played    INTEGER     NOT NULL,
      team1_player1_id UUID        REFERENCES users(id) ON DELETE SET NULL,
      team1_player2_id UUID        REFERENCES users(id) ON DELETE SET NULL,
      team2_player1_id UUID        REFERENCES users(id) ON DELETE SET NULL,
      team2_player2_id UUID        REFERENCES users(id) ON DELETE SET NULL,
      completed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_game_results_team1_player1 ON game_results(team1_player1_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_team1_player2 ON game_results(team1_player2_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_team2_player1 ON game_results(team2_player1_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_team2_player2 ON game_results(team2_player2_id);
  `);
}
