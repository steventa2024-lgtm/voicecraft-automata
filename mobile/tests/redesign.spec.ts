import { test, expect } from "@playwright/test";
import { generateTemplate } from "../../packages/protocol/src/templates.js";
import { isolate, openApp, pcStatus, tab } from "./fixtures";

test("editor transforms, undo/redo, camera tools and unsupported controls reflect the real plan", async ({
  page,
  context,
}) => {
  await isolate(context);
  await openApp(page);
  await tab(page, "Build");
  await page.getByRole("button", { name: "Increase Width (X)", exact: true }).click();
  await page.getByRole("button", { name: "90°", exact: true }).click();
  await page.getByRole("button", { name: "Flip X", exact: true }).click();
  await page.getByRole("button", { name: "Medieval", exact: true }).click();
  await page.getByRole("button", { name: "Undo edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Default", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("button", { name: "Redo edit", exact: true }).click();
  await page.getByRole("button", { name: "Expand preview", exact: true }).click();
  await page.getByRole("button", { name: "Orbit expanded camera", exact: true }).click();
  await page.getByRole("button", { name: "Close expanded preview", exact: true }).click();
  await page.getByRole("button", { name: "Save Blueprint", exact: true }).click();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("voicecraft.local.blueprints")!)[0],
  );
  expect(saved.options).toMatchObject({
    width: 10,
    rotation: 1,
    mirror: "x",
    material: "stone_bricks",
  });
  expect(saved.fingerprint).toBe(generateTemplate(saved.templateId, saved.options).fingerprint);
  await tab(page, "Catalog");
  await page.getByRole("textbox", { name: "Search structures" }).fill("Forest Treehouse");
  await page.getByRole("button", { name: "Open Forest Treehouse", exact: true }).click();
  await expect(page.getByRole("button", { name: "Medieval", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "On Water", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Increase Width (X)", exact: true })).toHaveCount(
    0,
  );
});

test("Catalog search, favorites and filters open the actual editor", async ({ page, context }) => {
  await isolate(context);
  await openApp(page);
  await tab(page, "Catalog");
  await page.getByRole("textbox", { name: "Search structures" }).fill("lakeside");
  await expect(
    page.getByRole("button", { name: "Open Lakeside Cottage", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Favorite Lakeside Cottage", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Favorite Lakeside Cottage", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("textbox", { name: "Search structures" }).fill("");
  await page.getByRole("button", { name: "Filter categories" }).click();
  await page.getByRole("button", { name: "Favorites only", exact: true }).click();
  await page.getByRole("button", { name: "Close filters", exact: true }).click();
  await expect(page.getByText("1 results · Favorites")).toBeVisible();
  await page.getByRole("button", { name: "Open Lakeside Cottage", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save Blueprint", exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Approve Build", exact: true })).toBeDisabled();
});

test("placement changes the prepared plan, invalidates approval, and survives Library management", async ({
  page,
  context,
}) => {
  await isolate(context, true);
  const previews: any[] = [],
    approvals: any[] = [];
  await context.route("**/api/companion/preview", async (route) => {
    const body = route.request().postDataJSON();
    previews.push(body);
    await route.fulfill({
      json: {
        ...generateTemplate(body.templateId, body.templateOptions),
        requiresConfirmation: true,
      },
    });
  });
  await context.route("**/api/companion/approve", async (route) => {
    approvals.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await openApp(page);
  await tab(page, "Build");
  const approve = page.getByRole("button", { name: "Approve Build", exact: true });
  await page.getByRole("button", { name: "Prepare Preview", exact: true }).click();
  await expect(approve).toBeEnabled();
  await page.getByRole("button", { name: "Orbit camera", exact: true }).click();
  await expect(approve).toBeEnabled();
  await page.getByRole("button", { name: "Floating", exact: true }).click();
  await expect(approve).toBeDisabled();
  await page.getByRole("button", { name: "Prepare Preview", exact: true }).click();
  await expect(approve).toBeEnabled();
  expect(previews[1].templateOptions.elevation).toBe(4);
  expect(previews[1].templateOptions.placement).toBe("floating");
  await approve.click();
  await expect(approve).toBeDisabled();
  expect(approvals).toHaveLength(1);
  expect(approvals[0].fingerprint).toBe(
    generateTemplate("lakeside-cottage", previews[1].templateOptions).fingerprint,
  );
  await page.getByRole("button", { name: "Save Blueprint", exact: true }).click();
  await tab(page, "Library");
  await expect(page.getByText("Lakeside Cottage", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByRole("textbox", { name: "Saved blueprint name" }).fill("Raised cottage");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await page.getByRole("button", { name: "Favorite Raised cottage", exact: true }).click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open in Blueprint Studio", exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await page.getByRole("button", { name: "Delete blueprint", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open in Blueprint Studio", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Open in Blueprint Studio", exact: true }).click();
  await expect(page.getByRole("button", { name: "Floating", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(approve).toBeDisabled();
  await page.getByRole("button", { name: "Increase Raise (Y)", exact: true }).click();
  await page.getByRole("button", { name: "Save Blueprint", exact: true }).click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("voicecraft.local.blueprints")!),
  );
  expect(stored).toHaveLength(1);
  expect(stored[0].options.elevation).toBe(5);
});

test("an edit during an outstanding preview rejects its late confirmation", async ({
  page,
  context,
}) => {
  await isolate(context, true);
  let pending: any;
  await context.route("**/api/companion/preview", (route) => {
    pending = route;
  });
  await openApp(page);
  await tab(page, "Build");
  await page.getByRole("button", { name: "Prepare Preview", exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  const old = pending.request().postDataJSON();
  await page.getByRole("button", { name: "90°", exact: true }).click();
  await pending.fulfill({
    json: { ...generateTemplate(old.templateId, old.templateOptions), requiresConfirmation: true },
  });
  await expect(page.getByText(/plan changed while preparing/)).toBeAttached();
  await expect(page.getByRole("button", { name: "Approve Build", exact: true })).toBeDisabled();
});

test("My PC navigation and supported controls work; failed refresh removes online status", async ({
  page,
  context,
}) => {
  await isolate(context, true);
  let failing = false;
  const status = structuredClone(pcStatus),
    controls: string[] = [];
  await context.route("**/api/companion/session", (route) =>
    failing ? route.abort() : route.fulfill({ json: status }),
  );
  await context.route(/\/api\/companion\/(pause|resume|cancel|undo)$/, async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").pop()!;
    controls.push(action);
    status.activeJob.status =
      action === "pause" ? "paused" : action === "resume" ? "building" : "cancelled";
    await route.fulfill({ json: { ok: true, action } });
  });
  await openApp(page);
  await tab(page, "My PC");
  await expect(page.getByText("Online", { exact: true })).toBeVisible();
  await expect(page.getByText("67%", { exact: true })).toBeAttached();
  await page.getByRole("button", { name: "Pause on PC", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume on PC", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Resume on PC", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause on PC", exact: true })).toBeEnabled();
  expect(controls).toEqual(["pause", "resume"]);
  await page.getByRole("button", { name: "Prepare on PC", exact: true }).click();
  await expect(page.getByRole("button", { name: "Prepare Preview", exact: true })).toBeAttached();
  await tab(page, "My PC");
  await page.getByRole("button", { name: "Approve on PC", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve Build", exact: true })).toBeDisabled();
  await tab(page, "My PC");
  await expect(page.getByText("Online", { exact: true })).toBeVisible();
  failing = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  await expect(page.getByText("Online", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pause on PC", exact: true })).toBeDisabled();
  await expect(page.getByText("67%", { exact: true })).toHaveCount(0);
});

test("cloud health failure clears ready indicators and published address", async ({
  page,
  context,
}) => {
  await isolate(context, false, true);
  let failing = false;
  await context.route("**/api/mobile/health", (route) =>
    failing
      ? route.abort()
      : route.fulfill({
          json: {
            api: "ok",
            minecraft: "tcp-open",
            bedrock: { host: "test-world.invalid", port: 19132, probe: "configured" },
            transcription: "not-configured",
            planner: "not-configured",
          },
        }),
  );
  await openApp(page);
  await tab(page, "Console");
  await expect(page.getByText("Reported ready", { exact: true })).toBeVisible();
  await expect(page.getByText("test-world.invalid", { exact: true })).toBeVisible();
  failing = true;
  await page.getByRole("button", { name: "Check connection", exact: true }).click();
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByText("Reported ready", { exact: true })).toHaveCount(0);
  await expect(page.getByText("test-world.invalid", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Copy server address", exact: true }),
  ).toBeDisabled();
  await tab(page, "Home");
  await expect(page.getByText("Unavailable", { exact: true })).toBeVisible();
});

for (const width of [320, 393, 430])
  test(`all six screens fit ${width}px without clipped controls or runtime errors`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 852 });
    await isolate(context);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openApp(page);
    for (const name of ["Home", "Build", "Console", "Library", "Catalog", "My PC"]) {
      await tab(page, name);
      const overflow = await page.evaluate(() => {
        // Scrollable horizontal rails are intentional; text and ordinary buttons must fit.
        return [...document.querySelectorAll<HTMLElement>("[role=button], [role=tab], input")]
          .filter((el) => {
            let p = el.parentElement;
            while (p) {
              if (["auto", "scroll"].includes(getComputedStyle(p).overflowX)) return false;
              p = p.parentElement;
            }
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
          })
          .map((el) => el.getAttribute("aria-label") || el.textContent);
      });
      expect(overflow, name + " overflow").toEqual([]);
    }
    expect(errors).toEqual([]);
  });
