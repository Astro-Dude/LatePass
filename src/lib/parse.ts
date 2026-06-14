import type { EditableTemplate } from "./config";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
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
  };
}
