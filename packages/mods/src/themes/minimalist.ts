import type { ThemeMod } from '@spades/shared';

export const minimalistTheme: ThemeMod = {
  id: 'minimalist',
  name: 'Minimalist',
  description: 'Clean, simple design with muted colors and subtle styling.',
  version: '1.0.0',
  type: 'theme',
  author: 'Spades Team',

  theme: {
    colors: {
      primary: '#171717',
      secondary: '#737373',
      background: '#fafafa',
      surface: '#ffffff',
      text: '#171717',
      textSecondary: '#737373',
      accent: '#171717',
      error: '#b91c1c',
      success: '#15803d',
      cardBack: '#404040',
      tableGreen: '#f5f5f5',
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: {
        small: '11px',
        medium: '13px',
        large: '16px',
        xlarge: '22px',
      },
    },
    cardStyle: {
      borderRadius: '4px',
      shadow: '0 1px 2px rgba(0,0,0,0.05)',
      width: '65px',
      height: '95px',
    },
    animations: {
      dealSpeed: 200,
      playSpeed: 250,
      trickCollectSpeed: 350,
    },
  },
};
