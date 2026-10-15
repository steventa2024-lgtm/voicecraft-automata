import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../services/cloud-api/src/app.js";
import { HttpError } from "../services/cloud-api/src/errors.js";
import { openCloudStore } from "../services/cloud-api/src/store.js";
import { advanceJob } from "../services/cloud-api/src/worker.js";
import { isAllowedCloudUrl } from "../mobile/src/lib/api-url.js";

const users = {
  ada: { id: "00000000-0000-4000-8000-000000000001", email: "ada@example.com" },
  bye: { id: "00000000-0000-4000-8000-000000000002", email: "bye@example.com" },
};

function appFor(store, extras = {}) {
  return createApp({
    store,
    serverToken: "server-token-0123456789",
    allowLocalAccounts: true,
    authenticate: async (token) => {
      if (token === "ada-token") return users.ada;
      if (token === "bye-token") return users.bye;
      throw new HttpError(401, "Your session expired. Sign in again.");
    },
    minecraftHost: null,
    publicHost: "",
    ...extras,
  });
}

async function listen(handler) {
  const server = createServer(async (incoming, outgoing) => {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const request = new Request(`http://127.0.0.1${incoming.url}`, {
      method: incoming.method,
      headers: incoming.headers,
      body: incoming.method === "GET" || incoming.method === "HEAD" ? undefined : body,
    });
    const response = await handler(request);
    outgoing.writeHead(response.status, { "content-type": "application/json" });
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function temporaryStore() {
  const directory = mkdtempSync(path.join(tmpdir(), "zp-cloud-"));
  const store = openCloudStore(directory, "pepper");
  store.setProfile({
    userId: users.ada.id,
    email: users.ada.email,
    planTier: "starter",
    subscriptionStatus: "active",
    unlimitedTester: false,
  });
  return {
    store,
    cleanup() {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

async function pair(base, store) {
  const issued = await fetch(`${base}/api/mobile/pairing/issue`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-server-token": "server-token-0123456789" },
    body: JSON.stringify({
      playerUuid: "11111111-1111-4111-8111-111111111111",
      playerName: "ConsoleAda",
      platform: "ps5",
      worldId: "public-build",
      worldName: "VoiceCraft Cloud",
    }),
  });
  const issueBody = await issued.json();
  assert.equal(issued.status, 200);
  const claimed = await fetch(`${base}/api/mobile/pairing/claim`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer ada-token" },
    body: JSON.stringify({ code: issueBody.code, platform: "ps5" }),
  });
  const claimBody = await claimed.json();
  assert.equal(claimed.status, 200, claimBody.message);
  return { code: issueBody.code, claim: claimBody, store };
}

test("mobile cloud URLs stay https except for local development hosts", () => {
  assert.equal(isAllowedCloudUrl("https://cloud.zeropulse.example", { dev: false }), true);
  assert.equal(isAllowedCloudUrl("https://cloud.example.com", { dev: false }), false);
  assert.equal(isAllowedCloudUrl("http://127.0.0.1:8787", { dev: false }), false);
  assert.equal(isAllowedCloudUrl("http://127.0.0.1:8787", { dev: true }), true);
  assert.equal(isAllowedCloudUrl("http://203.0.113.8", { dev: true }), false);
});

test("health does not claim a Minecraft connection that was not probed", async () => {
  const { store, cleanup } = temporaryStore();
  const handler = appFor(store);
  const server = await listen(handler);
  try {
    const response = await fetch(`${server.url}/api/mobile/health`);
    const body = await response.json();
    assert.equal(body.api, "ok");
    assert.equal(body.minecraft, "not-configured");
    assert.equal(body.bedrock, null);
    assert.equal(body.transcription, "not-configured");
  } finally {
    await server.close();
    cleanup();
  }
});

test("pairing codes expire their usefulness after one claim and do not cross accounts", async () => {
  const { store, cleanup } = temporaryStore();
  const server = await listen(appFor(store));
  try {
    const first = await pair(server.url, store);
    const replay = await fetch(`${server.url}/api/mobile/pairing/claim`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer bye-token" },
      body: JSON.stringify({ code: first.code, platform: "ps5" }),
    });
    assert.equal(replay.status, 400);
    const unauth = await fetch(`${server.url}/api/mobile/pairing/issue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerUuid: "11111111-1111-4111-8111-111111111111", playerName: "ConsoleAda", platform: "ps5" }),
    });
    assert.equal(unauth.status, 401);
  } finally {
    await server.close();
    cleanup();
  }
});

test("preview does not create a job, and confirm enforces entitlement, ownership, and idempotency", async () => {
  const { store, cleanup } = temporaryStore();
  const server = await listen(appFor(store));
  try {
    const paired = await pair(server.url, store);
    const preview = await fetch(`${server.url}/api/mobile/builds/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ada-token" },
      body: JSON.stringify({ worldId: paired.claim.worldId, instruction: "build a small stone house" }),
    });
    const previewBody = await preview.json();
    assert.equal(preview.status, 200, previewBody.message);
    assert.equal(previewBody.requiresConfirmation, true);
    assert.ok(previewBody.estimatedBlocks > 0);
    assert.equal(store.recentJobs(users.ada.id).length, 0);

    const denied = await fetch(`${server.url}/api/mobile/builds/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer bye-token" },
      body: JSON.stringify({ previewId: previewBody.previewId }),
    });
    assert.equal(denied.status, 404);

    const confirmed = await fetch(`${server.url}/api/mobile/builds/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ada-token", "idempotency-key": "job-1" },
      body: JSON.stringify({ previewId: previewBody.previewId }),
    });
    const job = await confirmed.json();
    assert.equal(confirmed.status, 202, job.message);
    assert.equal(job.status, "queued");
    assert.equal(job.confirmed, 0);

    const again = await fetch(`${server.url}/api/mobile/builds/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ada-token", "idempotency-key": "job-1" },
      body: JSON.stringify({ previewId: previewBody.previewId }),
    });
    const replay = await again.json();
    assert.equal(replay.jobId, job.jobId);
    assert.equal(store.accountState(users.ada.id).usage.task_count, 1);

    store.setProfile({
      userId: users.ada.id,
      email: users.ada.email,
      planTier: "starter",
      subscriptionStatus: "canceled",
      unlimitedTester: false,
    });
    const secondPreview = await fetch(`${server.url}/api/mobile/builds/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ada-token" },
      body: JSON.stringify({ worldId: paired.claim.worldId, instruction: "build a small stone tower" }),
    });
    const secondBody = await secondPreview.json();
    const blocked = await fetch(`${server.url}/api/mobile/builds/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ada-token" },
      body: JSON.stringify({ previewId: secondBody.previewId }),
    });
    assert.equal(blocked.status, 402);
  } finally {
    await server.close();
    cleanup();
  }
});

test("a queued build fails closed when Minecraft is down and refunds the unused reservation", async () => {
  const { store, cleanup } = temporaryStore();
  const server = await listen(appFor(store));
  try {
    const paired = await pair(server.url, store);
    const preview = await fetch(`${server.url}/api/mobile/builds/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ada-token" },
      body: JSON.stringify({ worldId: paired.claim.worldId, instruction: "build a small oak house" }),
    }).then((response) => response.json());
    const job = await fetch(`${server.url}/api/mobile/builds/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ada-token" },
      body: JSON.stringify({ previewId: preview.previewId }),
    }).then((response) => response.json());
    const finished = await advanceJob(store, { probe: async () => false, execute: null });
    assert.equal(finished.id, job.jobId);
    assert.equal(finished.status, "failed");
    assert.equal(finished.confirmed, 0);
    assert.match(finished.error, /No blocks were placed/);
    assert.equal(store.accountState(users.ada.id).usage.task_count, 0);
  } finally {
    await server.close();
    cleanup();
  }
});

test("cancellation before execution is not reported as a completed build", async () => {
  const { store, cleanup } = temporaryStore();
  const server = await listen(appFor(store));
  try {
    const paired = await pair(server.url, store);
    const preview = await fetch(`${server.url}/api/mobile/builds/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ada-token" },
      body: JSON.stringify({ worldId: paired.claim.worldId, instruction: "build a small stone wall" }),
    }).then((response) => response.json());
    const job = await fetch(`${server.url}/api/mobile/builds/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer ada-token" },
      body: JSON.stringify({ previewId: preview.previewId }),
    }).then((response) => response.json());
    const cancelled = await fetch(`${server.url}/api/mobile/builds/${job.jobId}/cancel`, {
      method: "POST",
      headers: { authorization: "Bearer ada-token" },
    });
    const body = await cancelled.json();
    assert.equal(body.status, "cancelled");
    assert.equal(store.accountState(users.ada.id).usage.task_count, 0);
    const foreign = await fetch(`${server.url}/api/mobile/builds/${job.jobId}/cancel`, {
      method: "POST",
      headers: { authorization: "Bearer bye-token" },
    });
    assert.equal(foreign.status, 404);
  } finally {
    await server.close();
    cleanup();
  }
});

test("transcription rejects anonymous and oversized uploads and does not approve a build", async () => {
  const { store, cleanup } = temporaryStore();
  const server = await listen(appFor(store));
  try {
    const anonymous = await fetch(`${server.url}/api/mobile/transcribe`, { method: "POST" });
    assert.equal(anonymous.status, 401);
    const boundary = "zpboundary";
    const audio = Buffer.alloc(80, 1);
    const payload = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="clip.wav"\r\nContent-Type: audio/wav\r\n\r\n`,
      "utf8",
    );
    const response = await fetch(`${server.url}/api/mobile/transcribe`, {
      method: "POST",
      headers: { authorization: "Bearer ada-token", "content-type": `multipart/form-data; boundary=${boundary}` },
      body: Buffer.concat([payload, audio, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    });
    assert.equal(response.status, 503);
    assert.equal(store.recentJobs(users.ada.id).length, 0);
  } finally {
    await server.close();
    cleanup();
  }
});
