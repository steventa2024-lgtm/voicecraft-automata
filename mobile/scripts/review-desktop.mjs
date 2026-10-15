import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "chrome" : undefined,
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/*", (route) =>
  new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
);
await page.goto("http://127.0.0.1:5174", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Catalog", exact: true }).click();
await page.getByPlaceholder("Search structures").fill("Lakeside Cottage");
await page.getByRole("button", { name: "Open blueprint", exact: true }).click();
await page.locator("canvas").waitFor();
await page.locator("canvas").scrollIntoViewIfNeeded();
await page.waitForTimeout(1500); // Allow the actual WebGL render and shadow map to settle.
await fs.mkdir("../docs/architecture-verification", { recursive: true });
await page.screenshot({ path: "../docs/architecture-verification/desktop-lakeside.png" });
await page.getByRole("button", { name: "Inspect interior", exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "../docs/architecture-verification/desktop-interior.png" });
console.log("Desktop renderer errors:", errors);
await browser.close();
if (errors.length) process.exitCode = 1;
