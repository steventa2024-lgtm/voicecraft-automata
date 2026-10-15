import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isDestructiveAction } from "./parser.js";
import { MAX_MESSAGE_BYTES } from "./limits.js";

export function timingSafeStringEqual(left, right) {
  const a = Buffer.from(String(left ?? ""));
  const b = Buffer.from(String(right ?? ""));
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isLoopbackAddress(address) {
  const host = String(address || "").replace(/^::ffff:/, "");
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.protocol === "file:") return true;
    return url.protocol === "http:" && isLoopbackAddress(url.hostname);
  } catch {
    return false;
  }
}

export function createRateLimiter({ limit = 20, windowMs = 10_000 } = {}) {
  const hits = new Map();
  return function allow(key, now = Date.now()) {
    const bucket = hits.get(key) || [];
    const fresh = bucket.filter((stamp) => now - stamp < windowMs);
    if (fresh.length >= limit) {
      hits.set(key, fresh);
      return false;
    }
    fresh.push(now);
    hits.set(key, fresh);
    return true;
  };
}

export function assessPayload(data, maxBytes = MAX_MESSAGE_BYTES) {
  const size = Buffer.byteLength(String(data ?? ""));
  if (size > maxBytes) return { ok: false, code: "payload_too_large", size };
  return { ok: true, size };
}

export function createPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export function verifyPkce(verifier, challenge) {
  if (!verifier || !challenge) return false;
  const actual = createHash("sha256").update(String(verifier)).digest("base64url");
  return timingSafeStringEqual(actual, challenge);
}

export function isAllowedLoopbackRedirect(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:") return false;
    if (!isLoopbackAddress(url.hostname)) return false;
    if (url.username || url.password) return false;
    if (url.pathname !== "/callback") return false;
    return true;
  } catch {
    return false;
  }
}

export function hashCode(code) {
  return createHash("sha256").update(String(code)).digest("hex");
}

/**
 * Chat control is off unless explicitly enabled.
 * Offline-mode usernames are not trusted unless the operator opts into that risk.
 * Destructive chat commands stay blocked unless a second explicit flag is set.
 */
export function evaluateChatCommand({
  enabled = false,
  username,
  allowlist = [],
  authMode = "offline",
  trustOffline = false,
  action,
}) {
  if (!enabled) return { allowed: false, allowDestructive: false, reason: "chat_disabled" };
  const name = String(username || "").trim().toLowerCase();
  const allowedNames = allowlist.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean);
  if (!name || !allowedNames.includes(name)) {
    return { allowed: false, allowDestructive: false, reason: "player_not_allowlisted" };
  }
  if (authMode !== "microsoft" && !trustOffline) {
    return { allowed: false, allowDestructive: false, reason: "offline_identity_untrusted" };
  }
  return {
    allowed: true,
    allowDestructive: false,
    reason: isDestructiveAction(action) ? "chat_destructive_blocked" : "ok",
  };
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
