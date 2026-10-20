import { describe, it, expect } from 'vitest';
import {
  parseGame,
  scoreGame,
  paperMismatches,
  buildSql,
} from '../scripts/irl-game-sql.js';
import type { IrlGame } from '../scripts/irl-game-sql.js';

const players = {
  B: 'b@example.com',
  J: 'j@example.com',
  S: 's@example.com',
  A: 'a@example.com',
};

// The 2026-10-17 game, transcribed from the paper sheet with per-player tricks.
// Every running total on the sheet is reproduced.
const october17: IrlGame = {
  roomId: 'IRL-20261017',
  playedAt: '2026-10-17T20:40:00-04:00',
  team1: ['B', 'J'],
  team2: ['S', 'A'],
  players,
  rounds: [
    {
      play: { B: [3, 6], J: ['nil', 0], S: [5, 7], A: ['nil', 0] },
      paper: [133, 152],
    },
    {
      play: { B: ['nil', 0], J: [5, 7], S: [2, 3], A: [2, 3] },
      paper: [285, 194],
    },
    {
      play: { B: [3, 4], J: [5, 7], S: ['nil', 0], A: [2, 2] },
      paper: [368, 314],
    },
    { play: { B: [2, 3], J: [3, 5], S: [1, 1], A: [4, 4] }, paper: [321, 364] },
    { play: { B: [2, 2], J: [5, 6], S: [2, 3], A: [1, 2] }, paper: [392, 396] },
    { play: { B: [5, 6], J: [2, 2], S: [1, 3], A: [2, 2] }, paper: [463, 428] },
    { play: { B: [1, 1], J: [1, 3], S: [3, 5], A: [5, 4] }, paper: [485, 509] },
  ],
};

// The 2026-10-16 game. The paper credited 14 tricks in round 4; corrected to
// one bag per team, which moves J+S's bag penalty from round 5 to round 6.
const october16: IrlGame = {
  roomId: 'IRL-20261016',
  playedAt: '2026-10-16T17:57:07-04:00',
  team1: ['J', 'S'],
  team2: ['B', 'A'],
  players,
  rounds: [
    {
      play: { J: ['nil', 0], S: [5, 9], B: [1, 1], A: [3, 3] },
      paper: [154, 40],
    },
    { play: { J: [1, 2], S: [4, 4], B: [2, 3], A: [3, 4] }, paper: [205, 92] },
    { play: { J: [3, 4], S: [2, 3], B: [3, 4], A: [2, 2] }, paper: [257, 143] },
    {
      play: { J: [5, 6], S: [4, 4], B: ['nil', 0], A: [2, 3] },
      paper: [349, 264],
    },
    {
      play: { J: [3, 4], S: [3, 3], B: [3, 5], A: ['nil', 1] },
      paper: [310, 197],
    },
    {
      play: { J: [5, 6], S: ['blind', 0], B: [3, 5], A: [1, 2] },
      paper: [561, 140],
    },
  ],
};

const clone = (game: IrlGame): IrlGame => structuredClone(game);

describe('irl-game-sql', () => {
  it('replays a clean sheet to the paper totals', () => {
    const scored = scoreGame(parseGame(clone(october17)));
    expect(scored.map((r) => r.totals)).toEqual(
      october17.rounds.map((r) => r.paper)
    );
    expect(paperMismatches(october17, scored)).toEqual([]);
  });

  it('applies bag penalties and scores blind nil at 200', () => {
    const scored = scoreGame(parseGame(clone(october16)));
    expect(scored.map((r) => r.totals)).toEqual([
      [154, 40],
      [205, 92],
      [257, 143],
      [348, 264],
      [409, 197], // B+A's failed nil plus a bag penalty
      [560, 140], // J+S's blind nil (+251) minus their bag penalty
    ]);
    expect(paperMismatches(october16, scored)).toEqual([
      'round 4 team1: paper 349, replayed 348',
      'round 5 team1: paper 310, replayed 409',
      'round 6 team1: paper 561, replayed 560',
    ]);
  });

  it('ignores unreadable (null) paper cells', () => {
    const game = clone(october17);
    game.rounds[0].paper = [null, 999];
    const problems = paperMismatches(game, scoreGame(game));
    expect(problems).toEqual(['round 1 team2: paper 999, replayed 152']);
  });

  it('rejects a round that does not total 13 tricks', () => {
    const game = clone(october16);
    game.rounds[3].play.J = [5, 7];
    expect(() => parseGame(game)).toThrow('round 4: tricks total 14, not 13');
  });

  it('rejects a round missing a player', () => {
    const game = clone(october17);
    delete game.rounds[2].play.A;
    expect(() => parseGame(game)).toThrow('round 3: play must have exactly');
  });

  it('rejects a zero bid (nil must be spelled "nil" or "blind")', () => {
    const game = clone(october17);
    game.rounds[0].play.J = [0, 0];
    expect(() => parseGame(game)).toThrow('round 1: J must be [bid');
  });

  it('rejects a player without an email', () => {
    const game = clone(october17);
    game.players = { ...players, A: 'adam' };
    expect(() => parseGame(game)).toThrow('players.A');
  });

  it('seats team1 at 0/2 and team2 at 1/3 and embeds the replayed finals', () => {
    const sql = buildSql(october17, scoreGame(october17));
    expect(sql).toContain(
      "('B', 'b@example.com', 0),\n  ('S', 's@example.com', 1),\n  ('J', 'j@example.com', 2),\n  ('A', 'a@example.com', 3);"
    );
    expect(sql).toContain("'IRL-20261017', 485, 509, 7,");
    expect(sql).toContain('IF t1 <> 485 OR t2 <> 509 THEN');
    // nil and blind nil are stored as bid 0 with the matching flag
    expect(sql).toContain("(1, 'J', 0, true, false, 0)");
    expect(buildSql(october16, scoreGame(october16))).toContain(
      "(6, 'S', 0, false, true, 0)"
    );
  });
});
