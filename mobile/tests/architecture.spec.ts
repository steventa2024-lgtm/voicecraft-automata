import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { generateTemplate, listTemplates } from "../../packages/protocol/src/templates.js";
import { isolate, openApp, tab } from "./fixtures";

test("the seven enhanced canonical plans render in the running mobile editor", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await isolate(context);
  await page.setViewportSize({ width: 430, height: 1100 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openApp(page);
  const dir = "../docs/architecture-verification";
  await fs.mkdir(dir, { recursive: true });
  for (const id of [
    "lakeside-cottage",
    "starter-cottage",
    "oak-cabin",
    "forest-treehouse",
    "stone-keep",
    "cliffside-house",
    "glass-villa",
  ]) {
    const template = listTemplates().find((t: { id: string }) => t.id === id)!;
    await tab(page, "Catalog");
    await page.getByRole("textbox", { name: "Search structures" }).fill(template.name);
    await page.getByRole("button", { name: `Open ${template.name}`, exact: true }).click();
    const plan = generateTemplate(id),
      solid = plan.blocks.filter((b: { block: string }) => b.block !== "air").length;
    await expect(page.getByText(`${solid.toLocaleString()} BLOCKS`, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve Build", exact: true })).toBeDisabled();
    await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
    await page.screenshot({ path: `${dir}/running-${id}.png` });
    await page.getByRole("button", { name: "Inspect interior", exact: true }).click();
    await expect(page.getByText("INTERIOR CUTAWAY", { exact: true })).toBeVisible();
    if (id === "lakeside-cottage") await page.screenshot({ path: `${dir}/running-interior.png` });
  }
  expect(errors).toEqual([]);
});
