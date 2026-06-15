import type { AppTemplate } from "./api";

function todayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Replace {name} {room} {roll} {arrivalTime} {reason} {date} with live values. */
export function renderTemplate(text: string, t: AppTemplate): string {
  const values: Record<string, string> = {
    name: t.field_name,
    room: t.field_room,
    roll: t.field_roll,
    arrivalTime: t.field_arrival_time,
    reason: t.field_reason,
    date: todayLong(),
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in values ? values[k] : m,
  );
}
