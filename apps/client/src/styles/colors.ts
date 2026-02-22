function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export const TEAM1_COLOR = '#3b82f6';
export const TEAM1_RGB = hexToRgb(TEAM1_COLOR);

export const TEAM2_COLOR = '#ef4444';
export const TEAM2_RGB = hexToRgb(TEAM2_COLOR);

export const TEAM_COLORS: Record<'team1' | 'team2', string> = {
  team1: TEAM1_COLOR,
  team2: TEAM2_COLOR,
};

export const TEAM_RGB: Record<'team1' | 'team2', string> = {
  team1: TEAM1_RGB,
  team2: TEAM2_RGB,
};
