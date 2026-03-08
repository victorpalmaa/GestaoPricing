import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"
import { createClient } from "@supabase/supabase-js"

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
  let base = String(v).replace(/\/$/, '');
  if (!/\/api$/.test(base)) base = `${base}/api`;
  return base;
}

export function getSupabaseUrl() {
  const url = (typeof process !== 'undefined' && process.env?.REACT_APP_SUPABASE_URL)
    || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
    || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL)
    || (typeof window !== 'undefined' && window.__ENV__?.VITE_SUPABASE_URL)
    || 'https://ptqptbsslyvytnnrgvqp.supabase.co';
  
  return url.trim();
}

export function getSupabaseAnonKey() {
  const key = (typeof process !== 'undefined' && process.env?.REACT_APP_SUPABASE_ANON_KEY)
    || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
    || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY)
    || (typeof window !== 'undefined' && window.__ENV__?.VITE_SUPABASE_ANON_KEY)
    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cXB0YnNzbHl2eXRubnJndnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MzM5NDEsImV4cCI6MjA3ODUwOTk0MX0.SvcC4lnQtt_ejE8dFxJQUVar9VF86rTcPDS5BfFNPoI';
  
  return key.trim();
}

const SUPABASE_URL = String(getSupabaseUrl() || '').trim();
const SUPABASE_ANON_KEY = String(getSupabaseAnonKey() || '').trim();
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
