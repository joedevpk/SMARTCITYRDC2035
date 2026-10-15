/*
# Step 6 — Extend user_role enum with service roles

## Purpose
Adds emergency, water, energy, waste, and transport roles to support
service-specific dashboards (police, water, energy, waste, transport).

## Changes
- Adds new enum values to user_role type.
- Non-destructive: existing roles are untouched.

## Security
- No data is modified or deleted.
- RLS policies referencing user_role continue to work (new values are additive).
*/

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'emergency';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'water';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'energy';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'waste';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'transport';
