/**
 * LAN companion for a signed-in desktop session.
 * The phone can request the existing build actions. It cannot run shell commands.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import os from "node:os";
import { buildPlan } from "../../packages/protocol/src/plan.js";

const DEFAULT_PORT = 8791;

function privateAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.internal || entry.family !== "IPv4") continue;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(entry.address)) addresses.push(entry.address);
    }
  }
  return addresses;
}

function isPrivateAddress(address) {
  return address === "127.0.0.1" || address === "::1" || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(address);
}

function hashCode(code) {
  return createHash("sha256").update(String(code || "").trim().toUpperCase()).digest();
}

function sameHash(left, right) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createCompanion(options = {}) {
  const sessions = new Map();
  let challenge = null;
  let server = null;
  let boundPort = options.port ?? DEFAULT_PORT;
  let permissions = { build: false, view: false, input: false };

  function status() {
    return {
      name: options.deviceName || os.hostname(),
      account: options.accountEmail?.() || null,
      platform: process.platform,
      version: options.version || "dev",
      listening: Boolean(server),
      addresses: privateAddresses(),
      port: boundPort,
      encrypted: false,
      transport: "Private-network HTTP. Not encrypted. Pair only on a Wi-Fi network you trust.",
      permissions: { ...permissions },
      remoteDesktop: "unavailable",
      remoteDesktopReason: "Live screen sharing is not in this build. It needs a native capture module and a development build, and it stays off.",
      devices: [...sessions.values()].map((session) => ({
        id: session.id,
        name: session.name,
        pairedAt: session.pairedAt,
      })),
      bridgeRunning: Boolean(options.bridgeRunning?.()),
      activeJob: options.activeJob?.() || null,
    };
  }

  function listen() {
    if (server) return Promise.resolve(boundPort);
    return new Promise((resolve, reject) => {
      server = createServer((request, response) => {
        const remote = String(request.socket.remoteAddress || "").replace(/^::ffff:/, "");
        if (!isPrivateAddress(remote)) {
          send(response, 403, { message: "Companion requests are accepted only from this private network." });
          return;
        }
        void onRequest(request, response);
      });
      server.once("error", reject);
      server.listen(options.port ?? DEFAULT_PORT, "0.0.0.0", () => {
        boundPort = server.address().port;
        server.unref();
        resolve(boundPort);
      });
    });
  }

  async function arm() {
    const code = randomBytes(4).toString("hex").slice(0, 8).toUpperCase();
    challenge = { hash: hashCode(code), expires: Date.now() + (options.ttlMs || 5 * 60_000) };
    const port = await listen();
    return { code, expiresAt: challenge.expires, port, addresses: privateAddresses() };
  }

  function revoke(deviceId) {
    if (!deviceId) sessions.clear();
    else {
      for (const [token, session] of sessions) {
        if (session.id === deviceId) sessions.delete(token);
      }
    }
    return status();
  }

  function stop() {
    sessions.clear();
    challenge = null;
    permissions = { build: false, view: false, input: false };
    server?.closeAllConnections?.();
    server?.close();
    server = null;
    return status();
  }

  function setPermissions(next) {
    permissions = {
      build: next.build === true,
      view: false,
      input: false,
    };
    return status();
  }

  async function onRequest(request, response) {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const limited = rateLimit(request.socket.remoteAddress || "");
    if (!limited) return send(response, 429, { message: "Too many companion requests." });
    try {
      if (request.method === "GET" && url.pathname === "/api/companion/status" && !bearer(request)) {
        return send(response, 200, { listening: true, pairing: Boolean(challenge) });
      }
      if (request.method === "POST" && url.pathname === "/api/companion/pair") {
        const body = await readBody(request);
        if (!challenge || challenge.expires < Date.now()) return send(response, 401, { message: "The pairing code expired. Generate a new one on the PC." });
        if (!sameHash(challenge.hash, hashCode(body.code))) return send(response, 401, { message: "That pairing code was not accepted." });
        challenge = null;
        const token = randomBytes(24).toString("hex");
        const id = randomBytes(8).toString("hex");
        sessions.set(token, { id, token, name: String(body.deviceName || "iPhone").slice(0, 40), pairedAt: Date.now(), lastFingerprint: null });
        return send(response, 200, { token, deviceId: id });
      }
      const session = sessions.get(bearer(request) || "");
      if (!session) return send(response, 401, { message: "Pair this phone from the desktop before controlling it." });
      if (request.method === "GET" && url.pathname === "/api/companion/session") return send(response, 200, status());
      if (request.method === "POST" && url.pathname === "/api/companion/preview") {
        const body = await readBody(request);
        const instruction = templateInstruction(body);
        const plan = buildPlan(instruction);
        session.lastFingerprint = plan.fingerprint;
        return send(response, 200, {
          fingerprint: plan.fingerprint,
          count: plan.count,
          bounds: plan.bounds,
          warnings: plan.warnings || [],
          requiresConfirmation: true,
        });
      }
      if (request.method === "POST" && url.pathname === "/api/companion/approve") {
        if (!permissions.build) return send(response, 403, { message: "Remote builds are off. Enable them on the PC companion panel." });
        const body = await readBody(request);
        const instruction = templateInstruction(body);
        const plan = buildPlan(instruction);
        if (plan.fingerprint !== body.fingerprint || plan.fingerprint !== session.lastFingerprint) {
          return send(response, 409, { message: "That preview is stale. Generate it again." });
        }
        if (!options.bridgeRunning?.()) return send(response, 409, { message: "The Minecraft bridge is not running on this PC." });
        session.lastFingerprint = null;
        const result = await options.approve?.(instruction, plan);
        return send(response, 200, result || { ok: true });
      }
      if (request.method === "POST" && ["/api/companion/pause", "/api/companion/resume", "/api/companion/cancel", "/api/companion/undo"].includes(url.pathname)) {
        if (!permissions.build) return send(response, 403, { message: "Remote builds are off on this PC." });
        const action = url.pathname.split("/").pop();
        await options.control?.(action);
        return send(response, 200, { ok: true, action });
      }
      if (request.method === "POST" && url.pathname === "/api/companion/desktop/start") {
        return send(response, 501, { message: status().remoteDesktopReason });
      }
      return send(response, 404, { message: "That companion action does not exist." });
    } catch (error) {
      return send(response, 400, { message: error instanceof Error ? error.message : "Companion request failed." });
    }
  }

  return { arm, revoke, stop, setPermissions, status, close: stop };
}

function templateInstruction(body) {
  if (!/^[a-z0-9-]{3,80}$/.test(body.templateId || "")) {
    const error = new Error("Choose a structure template.");
    throw error;
  }
  const options = body.templateOptions || {};
  return {
    valid: true,
    action: "build",
    structure: "house",
    templateId: body.templateId,
    templateOptions: options,
    material: options.material || "stone_bricks",
    floors: Number(options.floors) || 1,
    dimensions: {
      width: Number(options.width) || 9,
      depth: Number(options.depth) || 9,
      height: 12,
    },
    warnings: [],
  };
}

function bearer(request) {
  const value = request.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

const hits = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, at: now };
  if (now - entry.at > 60_000) {
    hits.set(ip, { count: 1, at: now });
    return true;
  }
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count <= 60;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 8192) {
        reject(new Error("Companion request is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("Companion request must be JSON."));
      }
    });
    request.on("error", reject);
  });
}

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}
