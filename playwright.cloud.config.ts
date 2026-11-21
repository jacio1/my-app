import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/cloud", workers: 1, timeout: 45000,
  use: { baseURL: "http://127.0.0.1:3101", channel: "msedge" },
  webServer: {
    command: "npx next dev -p 3101 -H 127.0.0.1", url: "http://127.0.0.1:3101", timeout: 120000,
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-my-diary.firebaseapp.com", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-my-diary",
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_SERVICE_ACCOUNT_KEY: "", APP_URL: "http://localhost:3101",
    },
  },
});
