"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Initial mount check to handle hydration mismatch
    const stored = localStorage.getItem("dvt_theme") as Theme | null;
    const root = window.document.documentElement;
    
    if (stored === "light") {
      setTheme("light");
      root.classList.remove("dark");
    } else {
      setTheme("dark");
      root.classList.add("dark");
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      setTheme("light");
      root.classList.remove("dark");
      localStorage.setItem("dvt_theme", "light");
    } else {
      setTheme("dark");
      root.classList.add("dark");
      localStorage.setItem("dvt_theme", "dark");
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div style={{ visibility: mounted ? "visible" : "hidden" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
