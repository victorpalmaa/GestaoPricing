-- Script to restore 'obs' column in pricing_history table
-- Run this script in your Supabase SQL Editor to fix the "Could not find the 'obs' column" error.

ALTER TABLE public.pricing_history 
ADD COLUMN IF NOT EXISTS obs TEXT;
