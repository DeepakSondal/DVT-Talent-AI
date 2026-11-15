import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize a candidate match score (0–1 ratio or 0–100 percentage) to an integer percentage. */
export function normalizeCandidateScore(val?: number | null, fallback = 85): number {
  if (val == null || Number.isNaN(Number(val))) return fallback;
  const num = Number(val);
  return Math.round(num <= 1 ? num * 100 : num);
}