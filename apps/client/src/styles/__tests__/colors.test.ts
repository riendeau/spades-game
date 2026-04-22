import { describe, expect, it } from 'vitest';
import { brightenForAccent } from '../colors';

// These pin the full hex → RGB → HSL → (+17 saturation, +10 lightness,
// clamped at 100) → RGB → hex pipeline. If ACCENT_SAT_BOOST /
// ACCENT_LIGHTNESS_BOOST are retuned in colors.ts, update these values.
describe('brightenForAccent', () => {
  it('brightens a medium blue', () => {
    expect(brightenForAccent('#3366CC')).toBe('#4a7fe8');
  });

  it('brightens a dark green', () => {
    expect(brightenForAccent('#2E5F1F')).toBe('#39941d');
  });

  it('brightens a magenta', () => {
    expect(brightenForAccent('#B04080')).toBe('#d74c9b');
  });

  it('clamps saturation at 100 for a fully-saturated color', () => {
    // Pure red is s=100, l=50. The +17 saturation boost is clipped to 100;
    // only the +10 lightness applies, lifting red toward (255, 51, 51).
    expect(brightenForAccent('#FF0000')).toBe('#ff3333');
  });

  it('clamps lightness at 100 — white stays white', () => {
    expect(brightenForAccent('#FFFFFF')).toBe('#ffffff');
  });

  it('documents the achromatic edge case (gray picks up a red tint)', () => {
    // Pure gray has HSL (h=0, s=0, l=50). Boosting saturation against the
    // default hue=0 produces a reddish tint. Not a concern for team colors
    // which are fully chromatic — pinned here to catch regressions.
    expect(brightenForAccent('#808080')).toBe('#ab8888');
  });
});
