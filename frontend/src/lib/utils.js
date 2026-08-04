import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"
import { createClient } from "@supabase/supabase-js"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const SUPABASE_URL = String(import.meta.env?.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || "").trim();

export const missingSupabaseEnvVars = [
  !SUPABASE_URL ? "VITE_SUPABASE_URL" : null,
  !SUPABASE_ANON_KEY ? "VITE_SUPABASE_ANON_KEY" : null,
].filter(Boolean);

export const hasSupabaseConfig = missingSupabaseEnvVars.length === 0;

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
