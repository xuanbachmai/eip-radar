import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against a production build served from the committed snapshot (no network).
// `pnpm build` first; CI does this in .github/workflows/ci.yml.
const PORT = 3218;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: { EIP_RADAR_OFFLINE: "1" },
    timeout: 60_000,
  },
});
