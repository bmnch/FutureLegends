import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  const dbBinding = (env as CloudflareEnv).DB;

  if (!dbBinding) {
    throw new Error("D1 binding `DB` is not available in the current context.");
  }

  return drizzle(dbBinding, { schema });
}
