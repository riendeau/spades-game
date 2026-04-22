function hexToRgbTuple(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function hexToRgb(hex: string): string {
  const [r, g, b] = hexToRgbTuple(hex);
  return `${r}, ${g}, ${b}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1]: [number, number, number] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = ln - c / 2;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

// Derive an "accent" variant of a team color for active-turn highlights.
// Base team colors (especially team1's maroon) are too dark to pop as a
// box-shadow glow against the dark green table. Bumping saturation and
// lightness in HSL produces a brighter, same-hue variant.
//
// The deltas below were chosen to match hand-tuned accents that read well:
//   #861F41 → #C2164F (team1, maroon → rose)
//   #E5751F → #FB8F3C (team2, orange → brighter orange)
const ACCENT_SAT_BOOST = 17;
const ACCENT_LIGHTNESS_BOOST = 10;

export function brightenForAccent(hex: string): string {
  const [r, g, b] = hexToRgbTuple(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [r2, g2, b2] = hslToRgb(
    h,
    Math.min(100, s + ACCENT_SAT_BOOST),
    Math.min(100, l + ACCENT_LIGHTNESS_BOOST)
  );
  return rgbToHex(r2, g2, b2);
}

export const TEAM1_COLOR = '#861F41';
export const TEAM1_RGB = hexToRgb(TEAM1_COLOR);

export const TEAM2_COLOR = '#E5751F';
export const TEAM2_RGB = hexToRgb(TEAM2_COLOR);

const TEAM1_ACCENT = brightenForAccent(TEAM1_COLOR);
const TEAM2_ACCENT = brightenForAccent(TEAM2_COLOR);

export const TEAM_COLORS: Record<'team1' | 'team2', string> = {
  team1: TEAM1_COLOR,
  team2: TEAM2_COLOR,
};

export const TEAM_RGB: Record<'team1' | 'team2', string> = {
  team1: TEAM1_RGB,
  team2: TEAM2_RGB,
};

export const TEAM_ACCENT_COLORS: Record<'team1' | 'team2', string> = {
  team1: TEAM1_ACCENT,
  team2: TEAM2_ACCENT,
};

export const TEAM_ACCENT_RGB: Record<'team1' | 'team2', string> = {
  team1: hexToRgb(TEAM1_ACCENT),
  team2: hexToRgb(TEAM2_ACCENT),
};
