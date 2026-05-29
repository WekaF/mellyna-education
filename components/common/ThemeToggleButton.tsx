"use client"

import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export const ThemeToggleButton: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-center text-gray-500 transition-all duration-300 bg-white border border-gray-200 rounded-xl hover:text-gray-700 h-10 w-10 hover:bg-gray-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
      aria-label="Toggle Theme"
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5 transition-transform duration-300" />
      ) : (
        <Sun className="h-5 w-5 transition-transform duration-300 text-amber-500" />
      )}
    </button>
  );
};
