import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * Next.js config for CiviorAI on Cloudflare via @opennextjs/cloudflare.
 * Bindings (DB, AI, ASSETS) are defined in wrangler.toml and available
 * through getCloudflareContext({ async: true }) in server/edge routes.
 */
const nextConfig: NextConfig = {
  // Keep App Router edge-friendly for Workers / Pages deployment.
};

export default nextConfig;

// Enables Cloudflare bindings (including D1 `DB`) during `next dev`.
initOpenNextCloudflareForDev();
