/**
 * The swappable "how we send" seam.
 *
 * Today the only implementation is GmailSender (per-user OAuth). If you scale
 * past Google's 100-test-user limit you can add e.g. a NylasSender or
 * UnipileSender that implements this same interface, and switch which one
 * `getSender()` returns — no call sites change.
 */

export interface OutboundEmail {
  /** The authenticated sender's own address (used for From + Reply-To). */
  fromEmail: string;
  to: string;
  cc?: string | null;
  subject: string;
  /** Plain-text body. */
  text: string;
}

export interface SendResult {
  /** Provider-side message id, for logging/debugging. */
  id: string;
}

export interface EmailSender {
  /**
   * Send one email.
   * @param email   the message to send
   * @param credential  the decrypted per-user secret this provider needs
   *                    (for Gmail: the OAuth refresh token)
   */
  send(email: OutboundEmail, credential: string): Promise<SendResult>;
}
