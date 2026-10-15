import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "chrome" : undefined,
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const env = await fs.readFile(".env", "utf8").catch(() => "");
const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  env
    .match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]
    .trim()
    .replace(/^["']|["']$/g, "") ||
  "https://voicecraft-ui-fixture.supabase.co";
const storageKey = "sb-" + new URL(url).hostname.split(".")[0] + "-auth-token";
await context.addInitScript(
  ({ storageKey }) => {
    localStorage.setItem(
      storageKey,
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
  },
  { storageKey },
);
// Authentication is isolated for visual review. No production API or Minecraft requests are allowed.
await context.route("**/*", (route) => {
  const target = new URL(route.request().url());
  return target.hostname === "localhost" && target.port === "8092"
    ? route.continue()
    : route.abort();
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://localhost:8092", { waitUntil: "networkidle" });
await page.getByRole("tab", { name: "Home", exact: true }).waitFor({ timeout: 45000 });
await fs.mkdir("../docs/visual-verification", { recursive: true });
for (const [tab, name] of [
  ["Home", "home"],
  ["Catalog", "catalog"],
  ["Build", "blueprint"],
  ["Console", "console"],
  ["My PC", "my-pc"],
]) {
  await page.getByRole("tab", { name: tab, exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "../docs/visual-verification/" + name + "-web-393.png",
    fullPage: true,
  });
  console.log(name + " captured");
  if (name === "blueprint") {
    await page
      .getByRole("button", { name: "Save Blueprint", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "../docs/visual-verification/blueprint-controls-web-393.png" });
  } else if (name === "console") {
    await page
      .getByRole("button", { name: "Link this player", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "../docs/visual-verification/console-pairing-web-393.png" });
  } else if (name === "my-pc") {
    await page.getByRole("button", { name: "Prepare on PC", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "../docs/visual-verification/my-pc-actions-web-393.png" });
  }
}
await page.getByRole("tab", { name: "Build", exact: true }).click();
await page.getByRole("button", { name: "Floating", exact: true }).click();
await page.getByRole("button", { name: "Save Blueprint", exact: true }).click();
await page.getByRole("tab", { name: "Library", exact: true }).click();
await page.screenshot({ path: "../docs/visual-verification/library-web-393.png" });
console.log("Page errors:", JSON.stringify(errors));
await browser.close();
if (errors.length) process.exitCode = 1;
