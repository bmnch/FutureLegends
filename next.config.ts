import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Edge-friendly defaults for Cloudflare OpenNext deployment
};

export default nextConfig;

// Enables Cloudflare bindings during `next dev` when Wrangler is available.
initOpenNextCloudflareForDev();
