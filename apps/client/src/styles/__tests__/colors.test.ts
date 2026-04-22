import { describe, expect, it } from 'vitest';
import {
  TEAM_ACCENT_COLORS,
  TEAM_ACCENT_RGB,
  TEAM_COLORS,
  TEAM_RGB,
} from '../colors';

describe('TEAM_COLORS', () => {
  it('exports the base team hex colors', () => {
    expect(TEAM_COLORS.team1).toBe('#861F41');
    expect(TEAM_COLORS.team2).toBe('#E5751F');
  });
});

describe('TEAM_RGB', () => {
  it('exports the base team colors as "r, g, b" triples', () => {
    expect(TEAM_RGB.team1).toBe('134, 31, 65');
    expect(TEAM_RGB.team2).toBe('229, 117, 31');
  });
});

// The accent values exercise the full hex → RGB → HSL → boost → RGB → hex
// pipeline in colors.ts. Retuning ACCENT_SAT_BOOST / ACCENT_LIGHTNESS_BOOST
// will break these — update the expected hexes when that happens.
describe('TEAM_ACCENT_COLORS', () => {
  it('brightens team1 maroon into a rose accent', () => {
    expect(TEAM_ACCENT_COLORS.team1).toBe('#c2164f');
  });

  it('brightens team2 orange into a slightly brighter orange', () => {
    expect(TEAM_ACCENT_COLORS.team2).toBe('#fb8f3c');
  });
});

describe('TEAM_ACCENT_RGB', () => {
  it('exports accent RGB triples that match TEAM_ACCENT_COLORS', () => {
    expect(TEAM_ACCENT_RGB.team1).toBe('194, 22, 79');
    expect(TEAM_ACCENT_RGB.team2).toBe('251, 143, 60');
  });
});
