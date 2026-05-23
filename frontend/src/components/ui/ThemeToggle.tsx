"use client";

import { Sun, Moon, Sparkles } from "lucide-react";
import { useTheme } from "@/providers/theme-provider";
import { Button } from "./Button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="relative w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/20 transition-all duration-500 group overflow-hidden"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={theme}
          initial={{ y: 20, opacity: 0, rotate: 45, scale: 0.5 }}
          animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
          exit={{ y: -20, opacity: 0, rotate: -45, scale: 0.5 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 20 }}
          className="flex items-center justify-center relative z-10"
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5 text-amber-400 fill-amber-400/20" />
          ) : (
            <Moon className="w-5 h-5 text-primary fill-primary/20" />
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Naturalist Highlight Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <motion.div 
         animate={{ scale: [1, 1.2, 1], opacity: [0, 0.3, 0] }}
         transition={{ repeat: Infinity, duration: 4 }}
         className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full blur-lg" 
      />
    </Button>
  );
}
