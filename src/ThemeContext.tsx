import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [primaryColor, setPrimaryColor] = useState(() => {
    const existing = localStorage.getItem('theme-primary-color');
    if (!existing || existing === '#5a5a40') {
      return '#ff3e00';
    }
    return existing;
  });

  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    // Approximate a glow effect color based on the primary color
    const glowColor = primaryColor.startsWith('#') 
      ? hexToRgba(primaryColor, 0.15) 
      : 'rgba(90, 90, 64, 0.15)';
    document.documentElement.style.setProperty('--primary-color-glow', glowColor);
    localStorage.setItem('theme-primary-color', primaryColor);
  }, [primaryColor]);

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper to convert HEX to RGBA for the glow effect
function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
