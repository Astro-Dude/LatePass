-- LatePass schema. Run once against your Postgres database (Supabase/Neon).
-- Safe to re-run: uses IF NOT EXISTS.

create extension if not exists "pgcrypto";

-- One row per connected student.
create table if not exists configs (
  id                   uuid primary key default gen_random_uuid(),
  user_email           text not null unique,
  provider             text not null default 'gmail',
  encrypted_credential text not null,                 -- AES-256-GCM blob of refresh token
  send_token           uuid not null unique default gen_random_uuid(),
  manage_token         uuid not null unique default gen_random_uuid(),
  daily_cap            integer not null default 1,
  display_name         text,
  avatar_url           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Up to 3 templates per config (enforced in app logic).
create table if not exists templates (
  id                 uuid primary key default gen_random_uuid(),
  config_id          uuid not null references configs(id) on delete cascade,
  position           integer not null default 0,
  label              text not null default 'Late arrival',
  recipient          text not null default 'warden.velankanimicrocampus@sst.scaler.com',
  cc                 text default 'naman@scaler.com',
  subject            text not null default '',
  body               text not null default '',
  field_name         text not null default '',
  field_room         text not null default '',
  field_roll         text not null default '',
  field_arrival_time text not null default '',
  field_reason       text not null default '',
  auto_send          boolean not null default false,
  auto_send_time     text,                                  -- 'HH:MM' in APP_TIMEZONE
  last_auto_sent_on  date,                                  -- guard against double-send/day
  geo_auto           boolean not null default false,        -- open-app location auto-send
  geo_lat            double precision,
  geo_lng            double precision,
  geo_radius         integer not null default 150,          -- metres
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists templates_config_idx on templates (config_id, position);

create table if not exists send_logs (
  id          bigserial primary key,
  config_id   uuid not null references configs(id) on delete cascade,
  template_id uuid references templates(id) on delete set null,
  status      text not null,                            -- 'sent' | 'error' | 'capped'
  error       text,
  recipient   text,
  sent_at     timestamptz not null default now()
);

create index if not exists send_logs_config_time_idx
  on send_logs (config_id, sent_at);
