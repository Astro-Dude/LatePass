/**
 * Central place to read environment variables so missing config fails loudly
 * (with a clear message) instead of producing confusing runtime errors.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  get appBaseUrl() {
    return optional("APP_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get appTimezone() {
    return optional("APP_TIMEZONE", "Asia/Kolkata");
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get googleClientId() {
    return required("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return required("GOOGLE_CLIENT_SECRET");
  },
  get googleRedirectUri() {
    return (
      process.env.GOOGLE_REDIRECT_URI ||
      `${this.appBaseUrl}/api/auth/google/callback`
    );
  },
  get encryptionKey() {
    return required("ENCRYPTION_KEY");
  },
};
