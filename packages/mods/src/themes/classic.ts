import type { ThemeMod } from '@spades/shared';

export const classicTheme: ThemeMod = {
  id: 'classic',
  name: 'Classic',
  description: 'Traditional card table look with green felt and classic styling.',
  version: '1.0.0',
  type: 'theme',
  author: 'Spades Team',

  theme: {
    colors: {
      primary: '#2563eb',
      secondary: '#64748b',
      background: '#1a472a',
      surface: '#ffffff',
      text: '#1f2937',
      textSecondary: '#6b7280',
      accent: '#f59e0b',
      error: '#dc2626',
      success: '#10b981',
      cardBack: '#1e40af',
      tableGreen: '#1a472a'
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: {
        small: '12px',
        medium: '14px',
        large: '18px',
        xlarge: '24px'
      }
    },
    cardStyle: {
      borderRadius: '8px',
      shadow: '0 2px 4px rgba(0,0,0,0.1)',
      width: '70px',
      height: '100px'
    },
    animations: {
      dealSpeed: 150,
      playSpeed: 200,
      trickCollectSpeed: 300
    }
  }
};
