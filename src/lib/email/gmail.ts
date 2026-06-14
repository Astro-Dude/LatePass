import { google } from "googleapis";
import { env } from "../env";
import type { EmailSender, OutboundEmail, SendResult } from "./types";

/**
 * Sends mail through the user's own Gmail account using a stored OAuth refresh
 * token and the `gmail.send` scope (insert/send only — no read access).
 */
export class GmailSender implements EmailSender {
  async send(email: OutboundEmail, credential: string): Promise<SendResult> {
    // Use googleapis' bundled OAuth2 client so the auth type matches the gmail
    // client exactly (avoids the dual google-auth-library type mismatch).
    const auth = new google.auth.OAuth2(
      env.googleClientId,
      env.googleClientSecret,
      env.googleRedirectUri,
    );
    auth.setCredentials({ refresh_token: credential });

    const gmail = google.gmail({ version: "v1", auth });
    const raw = buildRawMessage(email);

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return { id: res.data.id ?? "unknown" };
  }
}

/** RFC 2047 encode a header value if it contains non-ASCII characters. */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Build a base64url-encoded RFC 822 message for the Gmail API. */
function buildRawMessage(email: OutboundEmail): string {
  const headers: string[] = [
    `From: ${email.fromEmail}`,
    `To: ${email.to}`,
  ];
  if (email.cc) headers.push(`Cc: ${email.cc}`);
  headers.push(
    `Reply-To: ${email.fromEmail}`,
    `Subject: ${encodeHeader(email.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  );

  // Body is base64 (with CRLF line breaks) to safely carry UTF-8 + long lines.
  const body = Buffer.from(email.text, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");

  const message = `${headers.join("\r\n")}\r\n\r\n${body}`;

  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
