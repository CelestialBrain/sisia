import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface ThemeContextType {
  themeMode: 'preset' | 'rgb' | 'custom';
  hue: number;
  saturation: number;
  lightness: number;
  setTheme: (mode: 'preset' | 'rgb' | 'custom', h: number, s: number, l: number) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DEFAULT_THEME = {
  mode: 'preset' as const,
  hue: 228,
  saturation: 74,
  lightness: 30,
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [themeMode, setThemeMode] = useState<'preset' | 'rgb' | 'custom'>(DEFAULT_THEME.mode);
  const [hue, setHue] = useState(DEFAULT_THEME.hue);
  const [saturation, setSaturation] = useState(DEFAULT_THEME.saturation);
  const [lightness, setLightness] = useState(DEFAULT_THEME.lightness);
  
  // RGB animation refs
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const currentHueRef = useRef<number>(0);

  // Load theme from localStorage or database
  useEffect(() => {
    const loadTheme = async () => {
      // Try localStorage first
      const stored = localStorage.getItem('theme-preferences');
      if (stored) {
        const parsed = JSON.parse(stored);
        applyTheme(parsed.mode, parsed.hue, parsed.saturation, parsed.lightness);
        setThemeMode(parsed.mode);
        setHue(parsed.hue);
        setSaturation(parsed.saturation);
        setLightness(parsed.lightness);
      }

      // Load from database if user is logged in
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('theme_color_mode, theme_color_hue, theme_color_saturation, theme_color_lightness')
          .eq('id', user.id)
          .single();

        if (data) {
          const mode = data.theme_color_mode as 'preset' | 'rgb' | 'custom';
          const h = data.theme_color_hue;
          const s = data.theme_color_saturation;
          const l = data.theme_color_lightness;
          
          applyTheme(mode, h, s, l);
          setThemeMode(mode);
          setHue(h);
          setSaturation(s);
          setLightness(l);
          
          // Update localStorage
          localStorage.setItem('theme-preferences', JSON.stringify({ mode, hue: h, saturation: s, lightness: l }));
        }
      }
    };

    loadTheme();
  }, [user]);

  // Smooth RGB animation using requestAnimationFrame
  const startRgbAnimation = () => {
    if (rafRef.current) return;
    
    const root = document.documentElement;
    lastTimeRef.current = null;
    
    // Preserve current hue position instead of resetting to 0
    const currentHue = root.style.getPropertyValue('--primary-h');
    currentHueRef.current = currentHue ? parseFloat(currentHue) : 0;
    
    const animate = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      
      const deltaTime = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;
      
      // Rotate 36 degrees per second (10 seconds for full cycle)
      currentHueRef.current = (currentHueRef.current + deltaTime * 36) % 360;
      
      root.style.setProperty('--primary-h', currentHueRef.current.toFixed(2));
      rafRef.current = requestAnimationFrame(animate);
    };
    
    rafRef.current = requestAnimationFrame(animate);
  };
  
  const stopRgbAnimation = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimeRef.current = null;
    }
  };

  const applyTheme = (mode: 'preset' | 'rgb' | 'custom', h: number, s: number, l: number) => {
    const root = document.documentElement;
    
    // Stop any existing animation
    stopRgbAnimation();
    
    if (mode === 'rgb') {
      root.style.setProperty('--primary-s', `${s}%`);
      root.style.setProperty('--primary-l', `${l}%`);
      startRgbAnimation();
    } else {
      root.style.setProperty('--primary-h', h.toString());
      root.style.setProperty('--primary-s', `${s}%`);
      root.style.setProperty('--primary-l', `${l}%`);
    }
  };
  
  // Start/stop animation when RGB mode changes
  useEffect(() => {
    if (themeMode === 'rgb') {
      startRgbAnimation();
    } else {
      stopRgbAnimation();
    }
    
    return () => {
      stopRgbAnimation();
    };
  }, [themeMode]);
  
  // Pause animation when tab is hidden, resume when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (themeMode === 'rgb') {
        if (document.hidden) {
          stopRgbAnimation();
        } else {
          startRgbAnimation();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [themeMode]);

  const setTheme = async (mode: 'preset' | 'rgb' | 'custom', h: number, s: number, l: number) => {
    applyTheme(mode, h, s, l);
    setThemeMode(mode);
    setHue(h);
    setSaturation(s);
    setLightness(l);

    // Save to localStorage
    localStorage.setItem('theme-preferences', JSON.stringify({ mode, hue: h, saturation: s, lightness: l }));

    // Save to database if user is logged in
    if (user) {
      await supabase
        .from('profiles')
        .update({
          theme_color_mode: mode,
          theme_color_hue: h,
          theme_color_saturation: s,
          theme_color_lightness: l,
        })
        .eq('id', user.id);
    }
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME.mode, DEFAULT_THEME.hue, DEFAULT_THEME.saturation, DEFAULT_THEME.lightness);
  };

  return (
    <ThemeContext.Provider value={{ themeMode, hue, saturation, lightness, setTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
