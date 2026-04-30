import { defineConfig, devices } from "@playwright/test";

/**
 * Local / optional E2E: start the app first (`pnpm dev:web` → http://localhost:3001),
 * then run (from repo root):
 *   pnpm dlx playwright@1.49.0 install chromium
 *   pnpm dlx playwright@1.49.0 test --config apps/web/playwright.config.ts
 *
 * CI uses lint + typecheck + unit tests + `next build` only (see `.github/workflows/web-ci.yml`)
 * so Next and Playwright are not linked in the same install graph.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
