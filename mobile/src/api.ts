import Constants from "expo-constants";

export const BASE: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ||
  "https://latepass-sage.vercel.app";

export interface AppTemplate {
  id: string;
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

export interface AppState {
  fromEmail: string;
  sendToken: string;
  dailyCap: number;
  maxTemplates: number;
  templates: AppTemplate[];
}

/** Fields the app can write back for a template. */
export type TemplateInput = Omit<AppTemplate, "id">;

/**
 * Parse a response as JSON, with a clear message when the server returns HTML
 * (e.g. a 404 page if the backend isn't deployed) instead of JSON.
 */
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Server returned a non-JSON response (status ${res.status}). ` +
        `Is the site deployed with the latest backend?`,
    );
  }
}

/** Accept a full link or a bare token, return the 36-char token. */
export function extractToken(input: string): string {
  const m = input.trim().match(/[0-9a-fA-F-]{36}/);
  return m ? m[0] : input.trim();
}

export async function loadState(manageToken: string): Promise<AppState> {
  const res = await fetch(
    `${BASE}/api/config/${encodeURIComponent(manageToken)}`,
  );
  const data = await readJson(res);
  if (!res.ok) throw new Error((data.error as string) || "Couldn't load.");
  return data as unknown as AppState;
}

export async function createTemplate(
  manageToken: string,
): Promise<AppTemplate> {
  const res = await fetch(
    `${BASE}/api/config/${encodeURIComponent(manageToken)}/templates`,
    { method: "POST" },
  );
  const data = await readJson(res);
  if (!res.ok) throw new Error((data.error as string) || "Couldn't add.");
  return data.template as AppTemplate;
}

export async function updateTemplate(
  manageToken: string,
  id: string,
  input: TemplateInput,
): Promise<void> {
  const res = await fetch(
    `${BASE}/api/config/${encodeURIComponent(manageToken)}/templates/${id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  const data = await readJson(res);
  if (!res.ok) throw new Error((data.error as string) || "Couldn't save.");
}

export async function deleteTemplate(
  manageToken: string,
  id: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/api/config/${encodeURIComponent(manageToken)}/templates/${id}`,
    { method: "DELETE" },
  );
  const data = await readJson(res);
  if (!res.ok) throw new Error((data.error as string) || "Couldn't delete.");
}

export async function setDailyCap(
  manageToken: string,
  cap: number,
): Promise<void> {
  const res = await fetch(`${BASE}/api/config/${encodeURIComponent(manageToken)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ daily_cap: cap }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error((data.error as string) || "Couldn't save.");
}

/**
 * Best-effort heartbeat so the backend can record that the background
 * auto-send task fired (and what it decided). Never throws.
 */
export async function pingAutoCheck(
  sendToken: string,
  result: string,
): Promise<void> {
  try {
    await fetch(`${BASE}/api/autocheck`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: sendToken, result }),
    });
  } catch {
    /* best-effort — don't let logging break the task */
  }
}

export async function sendNow(
  sendToken: string,
  templateId: string,
): Promise<void> {
  const res = await fetch(`${BASE}/api/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: sendToken, templateId }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error((data.error as string) || "Send failed.");
}
