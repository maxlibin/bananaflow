import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the local app (docker compose Postgres + .env).
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3100" },
  webServer: {
    command: "yarn dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
