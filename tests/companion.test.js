import assert from "node:assert/strict";
import test from "node:test";
import { createCompanion } from "../desktop/electron/companion.js";

async function post(base, path, body, token) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test("phone pairing is one-time and cannot approve a build or open the desktop", async () => {
  const companion = createCompanion({ port: 0, ttlMs: 60_000, bridgeRunning: () => false });
  const armed = await companion.arm();
  const base = `http://127.0.0.1:${armed.port}`;
  try {
    const wrong = await post(base, "/api/companion/pair", { code: "WRONG" });
    assert.equal(wrong.status, 401, JSON.stringify(wrong.body));
    const paired = await post(base, "/api/companion/pair", { code: armed.code, deviceName: "iPhone" });
    assert.equal(paired.status, 200);
    assert.equal(typeof paired.body.token, "string");
    assert.equal((await post(base, "/api/companion/pair", { code: armed.code })).status, 401);

    const session = await fetch(`${base}/api/companion/session`, { headers: { authorization: `Bearer ${paired.body.token}` } });
    const status = await session.json();
    assert.equal(status.permissions.build, false);
    assert.equal(status.encrypted, false);
    assert.equal(status.remoteDesktop, "unavailable");

    const preview = await post(base, "/api/companion/preview", { templateId: "lighthouse" }, paired.body.token);
    assert.equal(preview.status, 200);
    assert.equal(typeof preview.body.fingerprint, "string");
    const approved = await post(
      base,
      "/api/companion/approve",
      { templateId: "lighthouse", fingerprint: preview.body.fingerprint },
      paired.body.token,
    );
    assert.equal(approved.status, 403);
    assert.equal((await post(base, "/api/companion/desktop/start", {}, paired.body.token)).status, 501);
    assert.equal((await post(base, "/api/companion/shell", { command: "calc" }, paired.body.token)).status, 404);

    companion.setPermissions({ build: true, view: true, input: true });
    const blocked = await post(
      base,
      "/api/companion/approve",
      { templateId: "lighthouse", fingerprint: preview.body.fingerprint },
      paired.body.token,
    );
    assert.equal(blocked.status, 409);
    assert.match(blocked.body.message, /bridge is not running/);
    assert.equal(companion.status().permissions.view, false);
    assert.equal(companion.status().permissions.input, false);

    companion.revoke(paired.body.deviceId);
    const revoked = await fetch(`${base}/api/companion/session`, { headers: { authorization: `Bearer ${paired.body.token}` } });
    assert.equal(revoked.status, 401);

    const expired = createCompanion({ port: 0, ttlMs: 20 });
    const short = await expired.arm();
    await new Promise((resolve) => setTimeout(resolve, 40));
    const late = await post(`http://127.0.0.1:${short.port}`, "/api/companion/pair", { code: short.code });
    assert.equal(late.status, 401);
    await expired.close();
  } finally {
    await companion.close();
  }
});
