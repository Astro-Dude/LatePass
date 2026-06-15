-- Migration: store the user's Google display name + avatar (from the profile
-- scope) so the UI can show their picture. Idempotent.

alter table configs
  add column if not exists display_name text,
  add column if not exists avatar_url   text;
