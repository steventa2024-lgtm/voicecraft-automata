import { isAllowedConnectionUrl } from "./api-url.js";

const STORAGE_KEY = "voicecraft.connection.v1";

function developmentBuild() {
  return typeof __DEV__ === "undefined" ? false : __DEV__;
}

export function defaultConnection() {
  return {
    mode: "local",
    apiUrl: String(process.env.EXPO_PUBLIC_VOICECRAFT_API_URL || "").replace(/\/$/, ""),
  };
}

export function readStoredConnection(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY);
    if (!raw) return defaultConnection();
    const parsed = JSON.parse(raw);
    const apiUrl = String(parsed?.apiUrl || "").replace(/\/$/, "");
    if (!isAllowedConnectionUrl(apiUrl, parsed?.mode, { dev: developmentBuild() })) return defaultConnection();
    return { mode: parsed.mode, apiUrl };
  } catch {
    return defaultConnection();
  }
}

let current = null;
const listeners = new Set();

export function getConnection() {
  if (!current) current = readStoredConnection();
  return current;
}

export function saveConnection(next, storage = globalThis.localStorage) {
  const mode = next?.mode;
  const apiUrl = String(next?.apiUrl || "").replace(/\/$/, "");
  if (!isAllowedConnectionUrl(apiUrl, mode, { dev: developmentBuild() })) {
    throw new Error(
      "That address is not allowed for this connection mode. Community servers require HTTPS. Local and self-hosted development can use a private-network address.",
    );
  }
  current = { mode, apiUrl };
  storage?.setItem?.(STORAGE_KEY, JSON.stringify(current));
  for (const listener of listeners) listener();
  return current;
}

export function subscribeConnection(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function connectionModeLabel(mode) {
  if (mode === "community") return "Community server";
  if (mode === "supplied") return "Your server";
  return "Local developer";
}
