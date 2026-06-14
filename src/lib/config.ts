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
): Promise<{ manageToken: string; isNew: boolean }> {
  const encrypted = encrypt(refreshToken);

  const existing = await query<{ id: string; manage_token: string }>(
    `update configs
       set encrypted_credential = $2, provider = 'gmail', updated_at = now()
     where user_email = $1
     returning id, manage_token`,
    [email, encrypted],
  );

  if (existing[0]) {
    await ensureTemplate(existing[0].id);
    return { manageToken: existing[0].manage_token, isNew: false };
  }

  const created = await query<{ id: string; manage_token: string }>(
    `insert into configs (user_email, encrypted_credential)
     values ($1, $2)
     returning id, manage_token`,
    [email, encrypted],
  );
  await createTemplate(created[0].id);
  return { manageToken: created[0].manage_token, isNew: true };
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

async function ensureTemplate(configId: string): Promise<void> {
  const rows = await query<{ count: number }>(
    `select count(*)::int as count from templates where config_id = $1`,
    [configId],
  );
  if ((rows[0]?.count ?? 0) === 0) await createTemplate(configId);
}

/**
 * Add a template (seeded with defaults). Returns null if the config already has
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

  const rows = await query<Template>(
    `insert into templates
       (config_id, position, label, recipient, cc, subject, body)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      configId,
      position,
      label,
      DEFAULT_RECIPIENT,
      DEFAULT_CC,
      DEFAULT_SUBJECT,
      DEFAULT_TEMPLATE,
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
       field_arrival_time = $11, field_reason = $12, updated_at = now()
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
