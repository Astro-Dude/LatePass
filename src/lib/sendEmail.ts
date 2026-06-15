import type { Config, Template } from "./config";
import { decrypt } from "./crypto";
import { getSender } from "./email";
import { formatDate, renderTemplate } from "./template";

/**
 * Render a template (fresh {date}) and send it from the config owner's account.
 * Shared by the manual send endpoint and the cron auto-send job. Throws on
 * failure; callers handle logging + the daily cap.
 */
export async function sendTemplateEmail(
  config: Config,
  template: Template,
): Promise<void> {
  const values = {
    name: template.field_name,
    room: template.field_room,
    roll: template.field_roll,
    arrivalTime: template.field_arrival_time,
    reason: template.field_reason,
    date: formatDate(),
  };

  const sender = getSender(config.provider);
  await sender.send(
    {
      fromEmail: config.user_email,
      to: template.recipient,
      cc: template.cc,
      subject: renderTemplate(template.subject, values),
      text: renderTemplate(template.body, values),
    },
    decrypt(config.encrypted_credential),
  );
}
