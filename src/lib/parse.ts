import type { EditableTemplate } from "./config";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Validate + normalize a template form payload. */
export function parseTemplate(
  body: Record<string, unknown>,
): EditableTemplate | { error: string } {
  const recipient = str(body.recipient);
  if (!recipient) return { error: "Recipient email is required." };

  const subject = str(body.subject);
  if (!subject) return { error: "Subject is required." };

  const templateBody = str(body.body);
  if (!templateBody) return { error: "Message is required." };

  const cc = str(body.cc);
  const label = str(body.label) || "Template";

  const autoSend = body.auto_send === true || body.auto_send === "true";
  const geoAuto = body.geo_auto === true || body.geo_auto === "true";
  const autoSendTime = str(body.auto_send_time) || null;
  if (
    (autoSend || geoAuto) &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(autoSendTime ?? "")
  ) {
    return { error: "Pick a valid time (HH:MM) for auto-send." };
  }

  const geoLat = num(body.geo_lat);
  const geoLng = num(body.geo_lng);
  if (geoAuto && (geoLat === null || geoLng === null)) {
    return { error: "Save your location first to use open-app auto-send." };
  }
  let geoRadius = num(body.geo_radius) ?? 150;
  geoRadius = Math.min(2000, Math.max(50, Math.round(geoRadius)));

  return {
    label,
    recipient,
    cc: cc || null,
    subject,
    body: templateBody,
    field_name: str(body.field_name),
    field_room: str(body.field_room),
    field_roll: str(body.field_roll),
    field_arrival_time: str(body.field_arrival_time),
    field_reason: str(body.field_reason),
    auto_send: autoSend,
    auto_send_time: autoSend || geoAuto ? autoSendTime : null,
    geo_auto: geoAuto,
    geo_lat: geoLat,
    geo_lng: geoLng,
    geo_radius: geoRadius,
  };
}
