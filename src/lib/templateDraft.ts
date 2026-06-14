import type { Template } from "./config";

/** Client-editable shape of a template (cc as string, never null). */
export interface TemplateDraft {
  id: string;
  label: string;
  recipient: string;
  cc: string;
  subject: string;
  body: string;
  field_name: string;
  field_room: string;
  field_roll: string;
  field_arrival_time: string;
  field_reason: string;
}

/** Map a DB template row to a draft. Server-safe (no client code). */
export function toDraft(t: Template): TemplateDraft {
  return {
    id: t.id,
    label: t.label,
    recipient: t.recipient,
    cc: t.cc ?? "",
    subject: t.subject,
    body: t.body,
    field_name: t.field_name,
    field_room: t.field_room,
    field_roll: t.field_roll,
    field_arrival_time: t.field_arrival_time,
    field_reason: t.field_reason,
  };
}
