import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Edge"], channel: "msedge" } }],
  webServer: {
    command: "npx next dev -p 3100 -H 127.0.0.1",
    url: "http://127.0.0.1:3100", timeout: 120000, reuseExistingServer: false,
    env: { NEXT_PUBLIC_FIREBASE_API_KEY: "", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "", FIREBASE_SERVICE_ACCOUNT_KEY: "", APP_URL: "http://localhost:3100" },
  },
});
