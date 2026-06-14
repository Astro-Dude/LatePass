import { OAuth2Client } from "google-auth-library";
import { env } from "./env";

/**
 * Google OAuth helpers. We request ONLY `gmail.send` plus the basic profile
 * scopes needed to learn the user's own email address (so we can set From /
 * Reply-To). No mailbox read access is ever requested.
 */

// `gmail.send` = send-only. The two userinfo/openid scopes just identify the
// signed-in account; they do not grant access to mail content.
export const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function createOAuthClient(): OAuth2Client {
  return new OAuth2Client(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri,
  );
}

export function buildAuthUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force consent so a refresh token is always returned
    scope: SCOPES,
    include_granted_scopes: true,
    state,
  });
}

export interface ExchangedTokens {
  refreshToken: string;
  email: string;
}

/**
 * Exchange the authorization code for tokens and resolve the signed-in user's
 * email. Throws if Google did not return a refresh token (e.g. the user had
 * already consented and `prompt=consent` was not honored).
 */
export async function exchangeCode(code: string): Promise<ExchangedTokens> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke prior access at " +
        "myaccount.google.com/permissions and reconnect.",
    );
  }

  const email = await resolveEmail(client, tokens.id_token ?? undefined);
  return { refreshToken: tokens.refresh_token, email };
}

async function resolveEmail(
  client: OAuth2Client,
  idToken?: string,
): Promise<string> {
  // Prefer the id_token (no extra network call).
  if (idToken) {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    const payload = ticket.getPayload();
    if (payload?.email) return payload.email;
  }
  throw new Error("Could not determine the connected Google account email.");
}
