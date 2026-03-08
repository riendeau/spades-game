import type { ClientGameState } from '@spades/shared';

export type DotZone = 'team1' | 'team2' | 'unclaimed' | 'contested';

export type DotState =
  | { type: 'unclaimed' }
  | { type: 'bid'; team: 'team1' | 'team2' }
  | { type: 'contested' }
  | { type: 'won'; team: 'team1' | 'team2' }
  | { type: 'bag'; team: 'team1' | 'team2' }
  | { type: 'set'; team: 'team1' | 'team2' }
  | { type: 'bag-set'; team: 'team1' | 'team2' };

export interface TrickTrackerData {
  team1Bid: number;
  team2Bid: number;
  team1Won: number;
  team2Won: number;
  phase: 'bidding' | 'playing';
}

export function extractTrickTrackerData(
  gameState: ClientGameState
): TrickTrackerData | null {
  const { currentRound } = gameState;
  if (!currentRound) return null;

  let team1Bid = 0;
  let team2Bid = 0;

  for (const bid of currentRound.bids) {
    if (bid.isNil || bid.isBlindNil) continue;
    const player = gameState.players.find((p) => p.id === bid.playerId);
    if (!player) continue;
    if (player.team === 'team1') team1Bid += bid.bid;
    else team2Bid += bid.bid;
  }

  let team1Won = 0;
  let team2Won = 0;

  for (const player of gameState.players) {
    const won = currentRound.tricksWon[player.id] ?? 0;
    if (player.team === 'team1') team1Won += won;
    else team2Won += won;
  }

  const phase: 'bidding' | 'playing' =
    gameState.phase === 'bidding' || gameState.phase === 'dealing'
      ? 'bidding'
      : 'playing';

  return { team1Bid, team2Bid, team1Won, team2Won, phase };
}

export function computeDotZones(team1Bid: number, team2Bid: number): DotZone[] {
  const zones: DotZone[] = new Array(13);
  const total = team1Bid + team2Bid;

  if (total <= 13) {
    for (let i = 0; i < 13; i++) {
      if (i < team1Bid) zones[i] = 'team1';
      else if (i >= 13 - team2Bid) zones[i] = 'team2';
      else zones[i] = 'unclaimed';
    }
  } else {
    // Overbid: team1 claims from left, team2 claims from right, overlap is contested
    const team2Start = 13 - team2Bid;
    for (let i = 0; i < 13; i++) {
      if (i < team2Start) zones[i] = 'team1';
      else if (i < team1Bid) zones[i] = 'contested';
      else zones[i] = 'team2';
    }
  }

  return zones;
}

export function computeDotStates(data: TrickTrackerData): DotState[] {
  const zones = computeDotZones(data.team1Bid, data.team2Bid);
  const states: DotState[] = new Array(13);

  for (let i = 0; i < 13; i++) {
    const zone = zones[i];

    if (i < data.team1Won) {
      // Team1 won this dot (filling from left)
      const isBag = i >= data.team1Bid;
      const isSet = zone !== 'team1' && zone !== 'unclaimed';

      if (isBag && isSet) states[i] = { type: 'bag-set', team: 'team1' };
      else if (isBag) states[i] = { type: 'bag', team: 'team1' };
      else if (isSet) states[i] = { type: 'set', team: 'team1' };
      else states[i] = { type: 'won', team: 'team1' };
    } else if (i >= 13 - data.team2Won) {
      // Team2 won this dot (filling from right)
      const isBag = i < 13 - data.team2Bid;
      const isSet = zone !== 'team2' && zone !== 'unclaimed';

      if (isBag && isSet) states[i] = { type: 'bag-set', team: 'team2' };
      else if (isBag) states[i] = { type: 'bag', team: 'team2' };
      else if (isSet) states[i] = { type: 'set', team: 'team2' };
      else states[i] = { type: 'won', team: 'team2' };
    } else {
      // Not yet won — show bid state
      if (zone === 'team1') states[i] = { type: 'bid', team: 'team1' };
      else if (zone === 'team2') states[i] = { type: 'bid', team: 'team2' };
      else if (zone === 'contested') states[i] = { type: 'contested' };
      else states[i] = { type: 'unclaimed' };
    }
  }

  return states;
}
