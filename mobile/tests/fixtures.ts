import fs from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

// Test-only authentication in isolated browser storage; never shipped in the app.
// Every external request is blocked unless a test explicitly supplies a fixture.
export async function isolate(context: BrowserContext, paired = false, configured = false) {
  const env = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
  const localUrl = env
    .match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]
    .trim()
    .replace(/^["']|["']$/g, "");
  const urls = ["https://voicecraft-ui-fixture.supabase.co", localUrl].filter(Boolean) as string[];
  await context.addInitScript(
    ({ urls, paired, configured }) => {
      for (const url of urls)
        localStorage.setItem(
          "sb-" + new URL(url).hostname.split(".")[0] + "-auth-token",
          JSON.stringify({
            access_token: "visual-test-token",
            refresh_token: "visual-test-refresh",
            token_type: "bearer",
            expires_at: Math.floor(Date.now() / 1000) + 36000,
            user: {
              id: "visual-review-user",
              email: "visual-review@example.test",
              aud: "authenticated",
              role: "authenticated",
            },
          }),
        );
      if (paired) {
        localStorage.setItem("voicecraft.companion.host", "192.168.4.10");
        localStorage.setItem("voicecraft.companion.token", "test-companion-token-only");
      }
      if (configured)
        localStorage.setItem(
          "voicecraft.connection.v1",
          JSON.stringify({ mode: "community", apiUrl: "https://api.voicecraft.test" }),
        );
    },
    { urls, paired, configured },
  );
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "localhost" && url.port === "8092" ? route.continue() : route.abort();
  });
}

export async function openApp(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("tab", { name: "Home", exact: true })).toBeVisible();
}
export const tab = (page: Page, name: string) =>
  page.getByRole("tab", { name, exact: true }).click();
export const pcStatus = {
  name: "TEST-DESKTOP",
  account: null,
  platform: "win32",
  version: "2.0.0",
  listening: true,
  encrypted: false,
  transport: "http",
  permissions: { build: true, view: false, input: false },
  remoteDesktop: "unavailable",
  remoteDesktopReason: "Build only",
  bridgeRunning: true,
  devices: [],
  activeJob: { status: "building", progress: 67, count: 1000 },
};
