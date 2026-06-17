"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const stored = localStorage.getItem("gotkai_theme");
    if (stored !== null) {
      setIsDark(stored === "dark");
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("gotkai_theme", isDark ? "dark" : "light");
  }, [isDark, hydrated]);

  const toggleTheme = useCallback(() => setIsDark((prev) => !prev), []);
  const setTheme = useCallback((dark: boolean) => setIsDark(dark), []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
