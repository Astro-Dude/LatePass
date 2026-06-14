import { GmailSender } from "./gmail";
import type { EmailSender } from "./types";

export type { EmailSender, OutboundEmail, SendResult } from "./types";

/**
 * The ONE place that knows which sending backend is in use. To migrate to a
 * pre-verified provider later, add its implementation and switch here.
 */
export function getSender(provider: string = "gmail"): EmailSender {
  switch (provider) {
    case "gmail":
      return new GmailSender();
    default:
      throw new Error(`Unknown email provider: ${provider}`);
  }
}
