-- Migration: per-template scheduled auto-send (fired by a cron job).
-- Idempotent.

alter table templates
  add column if not exists auto_send       boolean not null default false,
  add column if not exists auto_send_time  text,            -- 'HH:MM' in APP_TIMEZONE
  add column if not exists last_auto_sent_on date;          -- guard against double-send/day
