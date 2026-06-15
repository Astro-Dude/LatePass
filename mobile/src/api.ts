import Constants from "expo-constants";

export const BASE: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ||
  "https://latepass-sage.vercel.app";

/**
 * Parse a response as JSON, but fail with a clear message if the server
 * returned HTML (e.g. a 404 page when the endpoint isn't deployed yet) instead
 * of the generic "JSON parse error: unexpected character".
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

export interface TemplateInfo {
  id: string;
  label: string;
  recipient: string;
  cc: string | null;
  subject: string;
}

export interface SendInfo {
  fromEmail: string;
  templates: TemplateInfo[];
}

/** Accept a full /t/{token} link or a bare token, return the token. */
export function extractToken(input: string): string {
  const s = input.trim();
  const m = s.match(/[0-9a-fA-F-]{36}/);
  return m ? m[0] : s;
}

export async function fetchInfo(token: string): Promise<SendInfo> {
  const res = await fetch(
    `${BASE}/api/send/info?token=${encodeURIComponent(token)}`,
  );
  const data = await readJson(res);
  if (!res.ok) throw new Error((data.error as string) || "Couldn't load your link.");
  return data as unknown as SendInfo;
}

export async function sendNow(
  token: string,
  templateId: string,
): Promise<void> {
  const res = await fetch(`${BASE}/api/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, templateId }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error((data.error as string) || "Send failed.");
}
