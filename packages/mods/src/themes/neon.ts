import type { ThemeMod } from '@spades/shared';

export const neonTheme: ThemeMod = {
  id: 'neon',
  name: 'Neon',
  description:
    'Vibrant neon colors with a dark background for a modern arcade feel.',
  version: '1.0.0',
  type: 'theme',
  author: 'Spades Team',

  theme: {
    colors: {
      primary: '#8b5cf6',
      secondary: '#ec4899',
      background: '#0f0f23',
      surface: '#1a1a2e',
      text: '#ffffff',
      textSecondary: '#a78bfa',
      accent: '#22d3ee',
      error: '#f43f5e',
      success: '#34d399',
      cardBack: '#4c1d95',
      tableGreen: '#0f0f23',
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: {
        small: '12px',
        medium: '14px',
        large: '18px',
        xlarge: '24px',
      },
    },
    cardStyle: {
      borderRadius: '12px',
      shadow: '0 0 20px rgba(139, 92, 246, 0.3)',
      width: '70px',
      height: '100px',
    },
    animations: {
      dealSpeed: 100,
      playSpeed: 150,
      trickCollectSpeed: 250,
    },
  },
};
