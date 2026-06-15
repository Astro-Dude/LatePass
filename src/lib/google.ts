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
  // Basic profile (name + picture) so the UI can show the user's avatar.
  "https://www.googleapis.com/auth/userinfo.profile",
];

export function createOAuthClient(): OAuth2Client {
  return new OAuth2Client(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri,
  );
}

/**
 * Whether a post-login redirect target is one of our native app deep links.
 * Guards against open-redirect abuse — only our own schemes are allowed.
 */
export function isAppReturnUri(uri: string): boolean {
  return /^(latepass:|exp:)\/\//.test(uri);
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
  name: string | null;
  picture: string | null;
}

/**
 * Exchange the authorization code for tokens and resolve the signed-in user's
 * email (plus name + picture from the profile scope). Throws if Google did not
 * return a refresh token.
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

  if (!tokens.id_token) {
    throw new Error("Could not determine the connected Google account.");
  }
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new Error("Could not determine the connected Google account email.");
  }

  return {
    refreshToken: tokens.refresh_token,
    email: payload.email,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}
