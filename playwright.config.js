import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 20_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-webkit",
      testMatch: /mobile-release\.spec\.js/,
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "npm run serve",
    // Test routes use this exact project origin; account activation stays off.
    env:{ECHO_SUPABASE_URL:"https://demo.supabase.co",ECHO_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",ECHO_CLOUD_ACTIVATE:"0"},
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
