import { query } from "./db";
import { encrypt } from "./crypto";
import { env } from "./env";

/**
 * Data access for student configs, their templates (up to 3), and send logging.
 *
 * Two tokens guard a config:
 *  - send_token   → the home-screen link (/t/{send_token}); used to send and to
 *                   customise+save a template's content.
 *  - manage_token → the private setup link (/manage/{manage_token}); also adds /
 *                   deletes templates, sets the daily cap, and regenerates the
 *                   send token.
 */

export const MAX_TEMPLATES = 3;

export const DEFAULT_RECIPIENT = "warden.velankanimicrocampus@sst.scaler.com";
export const DEFAULT_CC = "naman@scaler.com";
export const DEFAULT_LABEL = "Late arrival";
export const DEFAULT_SUBJECT = "Late arrival notification — {name} ({roll})";

export const DEFAULT_TEMPLATE = `Respected Warden,

This is to inform you that I, {name} (Roll No. {roll}, Room {room}), will be arriving late on {date}.

Expected arrival time: {arrivalTime}
Reason: {reason}

Kindly consider this as my prior intimation.

Thank you,
{name}`;

export interface Config {
  id: string;
  user_email: string;
  provider: string;
  encrypted_credential: string;
  send_token: string;
  manage_token: string;
  daily_cap: number;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  config_id: string;
  position: number;
  label: string;
  recipient: string;
  cc: string | null;
  subject: string;
  body: string;
  field_name: string;
  field_room: string;
  field_roll: string;
  field_arrival_time: string;
  field_reason: string;
  auto_send: boolean;
  auto_send_time: string | null;
  last_auto_sent_on: string | null;
  geo_auto: boolean;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_radius: number;
  created_at: string;
  updated_at: string;
}

/** Editable template fields (from a manage or send page form). */
export interface EditableTemplate {
  label: string;
  recipient: string;
  cc: string | null;
  subject: string;
  body: string;
  field_name: string;
  field_room: string;
  field_roll: string;
  field_arrival_time: string;
  field_reason: string;
  auto_send: boolean;
  auto_send_time: string | null;
  geo_auto: boolean;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_radius: number;
}

// ---- configs ----

export async function getByManageToken(
  manageToken: string,
): Promise<Config | null> {
  const rows = await query<Config>(
    `select * from configs where manage_token = $1`,
    [manageToken],
  );
  return rows[0] ?? null;
}

export async function getBySendToken(
  sendToken: string,
): Promise<Config | null> {
  const rows = await query<Config>(
    `select * from configs where send_token = $1`,
    [sendToken],
  );
  return rows[0] ?? null;
}

/**
 * Called after OAuth: create a config for this email (with one default
 * template), or update the stored credential if one already exists. Always
 * ensures at least one template exists. Returns the manage_token.
 */
export async function upsertAfterOAuth(
  email: string,
  refreshToken: string,
  name: string | null = null,
  picture: string | null = null,
): Promise<{ manageToken: string; sendToken: string; isNew: boolean }> {
  const encrypted = encrypt(refreshToken);

  const existing = await query<{
    id: string;
    manage_token: string;
    send_token: string;
  }>(
    `update configs
       set encrypted_credential = $2, provider = 'gmail',
           display_name = coalesce($3, display_name),
           avatar_url = coalesce($4, avatar_url),
           updated_at = now()
     where user_email = $1
     returning id, manage_token, send_token`,
    [email, encrypted, name, picture],
  );

  if (existing[0]) {
    await ensureTemplate(existing[0].id);
    return {
      manageToken: existing[0].manage_token,
      sendToken: existing[0].send_token,
      isNew: false,
    };
  }

  const created = await query<{
    id: string;
    manage_token: string;
    send_token: string;
  }>(
    `insert into configs (user_email, encrypted_credential, display_name, avatar_url)
     values ($1, $2, $3, $4)
     returning id, manage_token, send_token`,
    [email, encrypted, name, picture],
  );
  await createTemplate(created[0].id);
  return {
    manageToken: created[0].manage_token,
    sendToken: created[0].send_token,
    isNew: true,
  };
}

export async function setDailyCap(
  manageToken: string,
  dailyCap: number,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `update configs set daily_cap = $2, updated_at = now()
     where manage_token = $1 returning id`,
    [manageToken, dailyCap],
  );
  return rows.length > 0;
}

/** Issue a fresh send_token, invalidating the old home-screen link. */
export async function regenerateSendToken(
  manageToken: string,
): Promise<string | null> {
  const rows = await query<{ send_token: string }>(
    `update configs
       set send_token = gen_random_uuid(), updated_at = now()
     where manage_token = $1
     returning send_token`,
    [manageToken],
  );
  return rows[0]?.send_token ?? null;
}

// ---- templates ----

export async function getTemplates(configId: string): Promise<Template[]> {
  return query<Template>(
    `select * from templates where config_id = $1 order by position, created_at`,
    [configId],
  );
}

/**
 * Pull a student's name + roll number out of their college email, e.g.
 * "shaurya.24bcs10151@sst.scaler.com" → { name: "Shaurya", roll: "24bcs10151" }.
 * The roll is whatever sits after the first "." and before the "@"; if there's
 * no such segment we leave it blank rather than guess. Name prefers the Google
 * display name, falling back to the (capitalised) email prefix.
 */
export function deriveIdentity(
  email: string,
  displayName: string | null,
): { name: string; roll: string } {
  const local = (email.split("@")[0] ?? "").trim();
  const dot = local.indexOf(".");
  const prefix = dot > 0 ? local.slice(0, dot) : "";
  const roll = dot >= 0 ? local.slice(dot + 1) : "";
  const name =
    (displayName ?? "").trim() ||
    (prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : "");
  return { name, roll };
}

async function ensureTemplate(configId: string): Promise<void> {
  const rows = await query<{ count: number }>(
    `select count(*)::int as count from templates where config_id = $1`,
    [configId],
  );
  if ((rows[0]?.count ?? 0) === 0) await createTemplate(configId);
}

/**
 * Add a template (seeded with defaults). The name + roll fields are pre-filled
 * from the student's email/display name. Returns null if the config already has
 * the maximum number of templates.
 */
export async function createTemplate(
  configId: string,
): Promise<Template | null> {
  const countRows = await query<{ count: number; next: number }>(
    `select count(*)::int as count, coalesce(max(position), -1) + 1 as next
       from templates where config_id = $1`,
    [configId],
  );
  const count = countRows[0]?.count ?? 0;
  if (count >= MAX_TEMPLATES) return null;

  const position = countRows[0]?.next ?? 0;
  const label = count === 0 ? DEFAULT_LABEL : `Template ${count + 1}`;

  const idRows = await query<{ user_email: string; display_name: string | null }>(
    `select user_email, display_name from configs where id = $1`,
    [configId],
  );
  const { name, roll } = deriveIdentity(
    idRows[0]?.user_email ?? "",
    idRows[0]?.display_name ?? null,
  );

  const rows = await query<Template>(
    `insert into templates
       (config_id, position, label, recipient, cc, subject, body,
        field_name, field_roll)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      configId,
      position,
      label,
      DEFAULT_RECIPIENT,
      DEFAULT_CC,
      DEFAULT_SUBJECT,
      DEFAULT_TEMPLATE,
      name,
      roll,
    ],
  );
  return rows[0];
}

/** Update a template, scoped to its owning config (token-verified upstream). */
export async function updateTemplate(
  configId: string,
  templateId: string,
  data: EditableTemplate,
): Promise<Template | null> {
  const rows = await query<Template>(
    `update templates set
       label = $3, recipient = $4, cc = $5, subject = $6, body = $7,
       field_name = $8, field_room = $9, field_roll = $10,
       field_arrival_time = $11, field_reason = $12,
       auto_send = $13, auto_send_time = $14,
       geo_auto = $15, geo_lat = $16, geo_lng = $17, geo_radius = $18,
       updated_at = now()
     where id = $1 and config_id = $2
     returning *`,
    [
      templateId,
      configId,
      data.label,
      data.recipient,
      data.cc,
      data.subject,
      data.body,
      data.field_name,
      data.field_room,
      data.field_roll,
      data.field_arrival_time,
      data.field_reason,
      data.auto_send,
      data.auto_send_time,
      data.geo_auto,
      data.geo_lat,
      data.geo_lng,
      data.geo_radius,
    ],
  );
  return rows[0] ?? null;
}

/** Delete a template, but never the last one. Returns false if it's the last. */
export async function deleteTemplate(
  configId: string,
  templateId: string,
): Promise<boolean> {
  const countRows = await query<{ count: number }>(
    `select count(*)::int as count from templates where config_id = $1`,
    [configId],
  );
  if ((countRows[0]?.count ?? 0) <= 1) return false;

  const rows = await query<{ id: string }>(
    `delete from templates where id = $1 and config_id = $2 returning id`,
    [templateId, configId],
  );
  return rows.length > 0;
}

export async function getTemplateForConfig(
  configId: string,
  templateId: string,
): Promise<Template | null> {
  const rows = await query<Template>(
    `select * from templates where id = $1 and config_id = $2`,
    [templateId, configId],
  );
  return rows[0] ?? null;
}

// ---- send logging / cap ----

/** Count successful sends since the start of today (in APP_TIMEZONE). */
export async function countSendsToday(configId: string): Promise<number> {
  const rows = await query<{ count: number }>(
    `select count(*)::int as count
       from send_logs
      where config_id = $1
        and status = 'sent'
        and sent_at >= date_trunc('day', now() at time zone $2) at time zone $2`,
    [configId, env.appTimezone],
  );
  return rows[0]?.count ?? 0;
}

export async function logSend(
  configId: string,
  templateId: string | null,
  status: "sent" | "error" | "capped",
  recipient: string,
  error?: string,
): Promise<void> {
  await query(
    `insert into send_logs (config_id, template_id, status, recipient, error)
     values ($1, $2, $3, $4, $5)`,
    [configId, templateId, status, recipient, error ?? null],
  );
}

// ---- auto-send (cron) ----

/** A template that is due to auto-send now, with its owning config. */
export interface AutoSendJob {
  config: Config;
  template: Template;
}

/**
 * Templates whose auto-send time has arrived today (in APP_TIMEZONE) and which
 * haven't already auto-sent today.
 * @param today  'YYYY-MM-DD' in APP_TIMEZONE
 * @param hhmm   'HH:MM' current time in APP_TIMEZONE
 */
export async function getDueAutoSends(
  today: string,
  hhmm: string,
): Promise<AutoSendJob[]> {
  type Row = Template & {
    c_user_email: string;
    c_provider: string;
    c_encrypted_credential: string;
    c_send_token: string;
    c_manage_token: string;
    c_daily_cap: number;
    c_created_at: string;
    c_updated_at: string;
  };

  const rows = await query<Row>(
    `select t.*,
            c.user_email           as c_user_email,
            c.provider             as c_provider,
            c.encrypted_credential as c_encrypted_credential,
            c.send_token           as c_send_token,
            c.manage_token         as c_manage_token,
            c.daily_cap            as c_daily_cap,
            c.created_at           as c_created_at,
            c.updated_at           as c_updated_at
       from templates t
       join configs c on c.id = t.config_id
      where t.auto_send = true
        and t.auto_send_time is not null
        and t.auto_send_time <= $2
        and (t.last_auto_sent_on is null or t.last_auto_sent_on < $1)`,
    [today, hhmm],
  );

  return rows.map((r) => ({
    config: {
      id: r.config_id,
      user_email: r.c_user_email,
      provider: r.c_provider,
      encrypted_credential: r.c_encrypted_credential,
      send_token: r.c_send_token,
      manage_token: r.c_manage_token,
      daily_cap: r.c_daily_cap,
      display_name: null,
      avatar_url: null,
      created_at: r.c_created_at,
      updated_at: r.c_updated_at,
    },
    template: {
      id: r.id,
      config_id: r.config_id,
      position: r.position,
      label: r.label,
      recipient: r.recipient,
      cc: r.cc,
      subject: r.subject,
      body: r.body,
      field_name: r.field_name,
      field_room: r.field_room,
      field_roll: r.field_roll,
      field_arrival_time: r.field_arrival_time,
      field_reason: r.field_reason,
      auto_send: r.auto_send,
      auto_send_time: r.auto_send_time,
      last_auto_sent_on: r.last_auto_sent_on,
      geo_auto: r.geo_auto,
      geo_lat: r.geo_lat,
      geo_lng: r.geo_lng,
      geo_radius: r.geo_radius,
      created_at: r.created_at,
      updated_at: r.updated_at,
    },
  }));
}

/** Mark a template as having auto-sent on the given day (prevents repeats). */
export async function markAutoSent(
  templateId: string,
  today: string,
): Promise<void> {
  await query(`update templates set last_auto_sent_on = $2 where id = $1`, [
    templateId,
    today,
  ]);
}
