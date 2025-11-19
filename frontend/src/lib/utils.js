import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getApiBase() {
  const v = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL)
    || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    || (typeof process !== 'undefined' && process.env?.VITE_API_URL)
    || (typeof window !== 'undefined' && window.__ENV__?.VITE_API_URL)
    || '';
  if (!v) return '';
  const base = String(v).replace(/\/$/, '');
  return base;
}
