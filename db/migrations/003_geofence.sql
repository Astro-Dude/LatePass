-- Migration: open-app location auto-send (geofence). When enabled, opening the
-- send page at the saved spot (after the set time) auto-fires the email.
-- Idempotent.

alter table templates
  add column if not exists geo_auto   boolean not null default false,
  add column if not exists geo_lat    double precision,
  add column if not exists geo_lng    double precision,
  add column if not exists geo_radius integer not null default 150;  -- metres
