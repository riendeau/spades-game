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
  `);
}
