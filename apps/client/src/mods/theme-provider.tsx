import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ThemeDefinition } from '@spades/shared';

const defaultTheme: ThemeDefinition = {
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
};

interface ThemeContextType {
  theme: ThemeDefinition;
  setTheme: (theme: ThemeDefinition) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  setTheme: () => {}
});

function applyThemeToCSSVariables(theme: ThemeDefinition) {
  const root = document.documentElement;

  // Colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });

  // Typography
  root.style.setProperty('--font-family', theme.typography.fontFamily);
  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    root.style.setProperty(`--font-size-${key}`, value);
  });

  // Card style
  root.style.setProperty('--card-border-radius', theme.cardStyle.borderRadius);
  root.style.setProperty('--card-shadow', theme.cardStyle.shadow);
  root.style.setProperty('--card-width', theme.cardStyle.width);
  root.style.setProperty('--card-height', theme.cardStyle.height);

  // Animations
  root.style.setProperty('--animation-deal-speed', `${theme.animations.dealSpeed}ms`);
  root.style.setProperty('--animation-play-speed', `${theme.animations.playSpeed}ms`);
  root.style.setProperty('--animation-trick-collect-speed', `${theme.animations.trickCollectSpeed}ms`);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeDefinition>(defaultTheme);

  useEffect(() => {
    applyThemeToCSSVariables(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
