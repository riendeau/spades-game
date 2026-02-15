import type { Card } from './card.js';
import type { RoundSummary } from './events.js';
import type { GameState, GameConfig } from './game-state.js';
import type { PlayerId, PlayerBid } from './player.js';

// Mod metadata
export interface ModInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  type: 'rule' | 'theme';
  author?: string;
}

// Rule mod hook contexts
export interface ScoreContext {
  gameState: GameState;
  config: GameConfig;
  teamId: 'team1' | 'team2';
  bid: number;
  tricks: number;
  nilBids: PlayerBid[];
  calculatedScore: number;
  calculatedBags: number;
}

export interface BidValidationContext {
  gameState: GameState;
  config: GameConfig;
  playerId: PlayerId;
  bid: number;
  isNil: boolean;
  isBlindNil: boolean;
  isValid: boolean;
  errorMessage?: string;
}

export interface PlayValidationContext {
  gameState: GameState;
  config: GameConfig;
  playerId: PlayerId;
  card: Card;
  hand: Card[];
  currentTrick: {
    plays: { playerId: PlayerId; card: Card }[];
    leadSuit: Card['suit'] | null;
  };
  isValid: boolean;
  errorMessage?: string;
}

export interface CardPlayedContext {
  gameState: GameState;
  config: GameConfig;
  playerId: PlayerId;
  card: Card;
}

export interface TrickCompleteContext {
  gameState: GameState;
  config: GameConfig;
  trick: {
    plays: { playerId: PlayerId; card: Card }[];
    leadSuit: Card['suit'];
  };
  winnerId: PlayerId;
}

export interface RoundEndContext {
  gameState: GameState;
  config: GameConfig;
  roundSummary: RoundSummary;
  modState: unknown;
}

export interface RoundEndResult {
  modState?: unknown;
}

export interface CalculateDisabledBidsContext {
  gameState: GameState;
  config: GameConfig;
  playerId: PlayerId;
  currentBids: PlayerBid[];
  modState: unknown;
  disabledBids: number[]; // Mods can add to this array
}

// Rule mod hooks interface
export interface RuleHooks {
  onCalculateScore?: (context: ScoreContext) => ScoreContext;
  onCalculateDisabledBids?: (
    context: CalculateDisabledBidsContext
  ) => CalculateDisabledBidsContext;
  onValidateBid?: (context: BidValidationContext) => BidValidationContext;
  onValidatePlay?: (context: PlayValidationContext) => PlayValidationContext;
  onCardPlayed?: (context: CardPlayedContext) => CardPlayedContext;
  onTrickComplete?: (context: TrickCompleteContext) => TrickCompleteContext;
  onRoundEnd?: (context: RoundEndContext) => RoundEndResult;
  modifyConfig?: (config: GameConfig) => GameConfig;
}

export interface RuleMod extends ModInfo {
  type: 'rule';
  hooks: RuleHooks;
}

// Theme mod types
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  error: string;
  success: string;
  cardBack: string;
  tableGreen: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontSize: {
    small: string;
    medium: string;
    large: string;
    xlarge: string;
  };
}

export interface ThemeCardStyle {
  borderRadius: string;
  shadow: string;
  width: string;
  height: string;
}

export interface ThemeAnimations {
  dealSpeed: number;
  playSpeed: number;
  trickCollectSpeed: number;
}

export interface ThemeDefinition {
  colors: ThemeColors;
  typography: ThemeTypography;
  cardStyle: ThemeCardStyle;
  animations: ThemeAnimations;
}

export interface ThemeMod extends ModInfo {
  type: 'theme';
  theme: ThemeDefinition;
}

export type Mod = RuleMod | ThemeMod;
