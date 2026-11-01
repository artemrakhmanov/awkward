// Settings for the e2e runs. Prod only: preview URLs sit behind Vercel login.
export const BASE = (process.env.E2E_BASE_URL ?? "https://awkwardboard.com").replace(/\/$/, "");
export const HOST = new URL(BASE).host;
export const MODEL = process.env.E2E_MODEL ?? "gpt-6.1-terra";
export const TRIAL_KEY = process.env.TRIAL_KEY ?? "";
export const TEST_PREFIX = "https://test.awkwardboard.com/";

export const since = (t0: number) => Math.round((Date.now() - t0) / 100) / 10;
