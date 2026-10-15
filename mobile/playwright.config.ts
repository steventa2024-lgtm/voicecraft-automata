import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8092",
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
    channel: process.platform === "win32" ? "chrome" : undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx expo start --port 8092 --offline",
    url: "http://localhost:8092",
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    env: {
      EXPO_PUBLIC_SUPABASE_URL: "https://voicecraft-ui-fixture.supabase.co",
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_visual_fixture_only",
      EXPO_PUBLIC_VOICECRAFT_API_URL: "",
    },
  },
});
