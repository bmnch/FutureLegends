import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

/**
 * Fully-typed D1 client. Passing the whole `schema` module (tables *and*
 * `relations()` definitions) is what enables the relational query API
 * (`db.query.courses.findFirst({ with: { modules: { with: { contentBlocks } } } })`)
 * so the edge runtime can hydrate the course → module → block hierarchy in a
 * single round-trip without hand-written joins.
 */
export type Database = DrizzleD1Database<typeof schema>;

/**
 * Resolve the D1 binding from the current Cloudflare request context.
 *
 * Works identically in:
 *   - `next dev` (bindings proxied by `initOpenNextCloudflareForDev()`)
 *   - `opennextjs-cloudflare preview` (local Miniflare D1)
 *   - production Workers (remote D1 via `wrangler.toml` `[[d1_databases]]`)
 *
 * Note on transactions: D1 does not support interactive `BEGIN`/`COMMIT`
 * statements, so Drizzle's `db.transaction()` cannot be used. Use
 * `db.batch([...])` instead - D1 executes a batch as a single SQLite
 * transaction and rolls the whole sequence back if any statement fails.
 */
export async function getDb(): Promise<Database> {
  const { env } = await getCloudflareContext({ async: true });
  const dbBinding = (env as CloudflareEnv).DB;

  if (!dbBinding) {
    throw new Error("D1 binding `DB` is not available in the current context.");
  }

  return drizzle(dbBinding, { schema });
}

export { schema };
