-- Migration: move per-config email content into a separate `templates` table
-- (up to 3 per user) and add template_id to send_logs.
-- Idempotent: safe to run more than once.

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
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists templates_config_idx on templates (config_id, position);

alter table send_logs
  add column if not exists template_id uuid references templates(id) on delete set null;

-- Carry over any existing single-config content into one template each.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'configs' and column_name = 'template'
  ) then
    insert into templates (config_id, position, label, recipient, cc, subject, body,
                           field_name, field_room, field_roll, field_arrival_time, field_reason)
    select c.id, 0, 'Late arrival',
           coalesce(nullif(c.recipient, ''), 'warden.velankanimicrocampus@sst.scaler.com'),
           coalesce(nullif(c.cc, ''), 'naman@scaler.com'),
           c.subject, c.template,
           c.field_name, c.field_room, c.field_roll, c.field_arrival_time, c.field_reason
    from configs c
    where not exists (select 1 from templates t where t.config_id = c.id);

    alter table configs
      drop column if exists recipient,
      drop column if exists cc,
      drop column if exists subject,
      drop column if exists template,
      drop column if exists field_name,
      drop column if exists field_room,
      drop column if exists field_roll,
      drop column if exists field_arrival_time,
      drop column if exists field_reason;
  end if;
end $$;
