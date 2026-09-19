/* eslint-disable @typescript-eslint/no-empty-object-type */
/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
  APP_NAME?: string;
}

interface CloudflareEnv extends Env {}
