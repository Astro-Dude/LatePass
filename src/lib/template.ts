import { env } from "./env";

/**
 * Template rendering for the email body and subject.
 *
 * Supported placeholders: {name} {room} {roll} {arrivalTime} {reason} {date}
 * - The first five come from the saved config values.
 * - {date} is computed fresh at send time, in APP_TIMEZONE.
 */

export interface TemplateValues {
  name: string;
  room: string;
  roll: string;
  arrivalTime: string;
  reason: string;
  date: string;
}

export const PLACEHOLDERS = [
  "name",
  "room",
  "roll",
  "arrivalTime",
  "reason",
  "date",
] as const;

/**
 * Format a date like "Wednesday, June 14, 2026" in the configured timezone.
 */
export function formatDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: env.appTimezone,
  }).format(date);
}

/**
 * Replace every {placeholder} in `template` with its value. Unknown
 * placeholders are left untouched so a typo is visible rather than silently
 * dropped.
 */
export function renderTemplate(
  template: string,
  values: TemplateValues,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (key in values) {
      return values[key as keyof TemplateValues] ?? "";
    }
    return match;
  });
}
