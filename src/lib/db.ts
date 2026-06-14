import { Pool, type QueryResultRow } from "pg";
import { env } from "./env";

/**
 * Single shared pg Pool. In dev, Next.js hot-reload re-evaluates modules, so we
 * stash the pool on globalThis to avoid leaking connections across reloads.
 */

declare global {
  // eslint-disable-next-line no-var
  var _latepassPool: Pool | undefined;
}

/**
 * Lazily create the pool on first query (not at import time) so that
 * `next build` doesn't require DATABASE_URL to be set.
 */
function getPool(): Pool {
  if (!global._latepassPool) {
    global._latepassPool = new Pool({
      connectionString: env.databaseUrl,
      // Hosted Postgres (Supabase/Neon) requires SSL. We don't verify the CA
      // here because managed providers terminate TLS with their own certs.
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return global._latepassPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as never[]);
  return result.rows;
}
