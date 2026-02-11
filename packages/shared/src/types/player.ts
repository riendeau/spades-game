import type { Card } from './card.js';

export type PlayerId = string;
export type TeamId = 'team1' | 'team2';
export type Position = 0 | 1 | 2 | 3; // Clockwise from dealer's left

export interface Player {
  id: PlayerId;
  nickname: string;
  position: Position;
  team: TeamId;
  hand: Card[];
  connected: boolean;
  ready: boolean;
}

export interface PlayerBid {
  playerId: PlayerId;
  bid: number;
  isNil: boolean;
  isBlindNil: boolean;
}

export interface PlayerTrickPlay {
  playerId: PlayerId;
  card: Card;
}

export interface TeamScore {
  teamId: TeamId;
  score: number;
  bags: number;
  roundBid: number;
  roundTricks: number;
}

export function getPartnerPosition(position: Position): Position {
  return ((position + 2) % 4) as Position;
}

export function getTeamForPosition(position: Position): TeamId {
  return position % 2 === 0 ? 'team1' : 'team2';
}

export function getPositionsForTeam(teamId: TeamId): [Position, Position] {
  return teamId === 'team1' ? [0, 2] : [1, 3];
}
