import "expo-sqlite/localStorage/install";

const TOKEN_KEY = "voicecraft.companion.token";
const HOST_KEY = "voicecraft.companion.host";

export type PcStatus = {
  name: string;
  account: string | null;
  platform: string;
  version: string;
  listening: boolean;
  encrypted: boolean;
  transport: string;
  permissions: { build: boolean; view: boolean; input: boolean };
  remoteDesktop: string;
  remoteDesktopReason: string;
  bridgeRunning: boolean;
  activeJob: { status?: string; progress?: number | null; count?: number | null } | null;
  devices: Array<{ id: string; name: string }>;
};

function baseUrl(host: string) {
  const trimmed = host.trim();
  if (
    !/^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/.test(
      trimmed,
    )
  ) {
    throw new Error("Enter the PC's private network address, such as 192.168.4.33.");
  }
  if (trimmed.split(".").some((part) => Number(part) > 255))
    throw new Error("Enter a valid private IPv4 address.");
  return `http://${trimmed}:8791`;
}

async function request(host: string, path: string, body?: unknown, authenticated = true) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (authenticated && (!token || host.trim() !== savedPcHost()))
    throw new Error("Pair this PC before requesting access.");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authenticated && token) headers.authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${baseUrl(host)}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        typeof payload.message === "string"
          ? payload.message
          : `The PC returned ${response.status}.`,
      );
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export function savedPcHost() {
  return localStorage.getItem(HOST_KEY) || "";
}

export function pcPaired() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export function disconnectPc() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function pairPc(host: string, code: string) {
  const trimmed = host.trim();
  const result = await request(
    trimmed,
    "/api/companion/pair",
    { code, deviceName: "iPhone" },
    false,
  );
  if (typeof result.token !== "string" || result.token.length < 16)
    throw new Error("The PC did not return a pairing session.");
  localStorage.setItem(TOKEN_KEY, result.token);
  localStorage.setItem(HOST_KEY, trimmed);
  return result;
}

export async function pcStatus(host: string): Promise<PcStatus> {
  const result = await request(host, "/api/companion/session");
  if (
    typeof result.name !== "string" ||
    typeof result.bridgeRunning !== "boolean" ||
    typeof result.permissions?.build !== "boolean"
  )
    throw new Error("The PC returned an invalid status response.");
  return result;
}

export async function previewOnPc(
  host: string,
  templateId: string,
  templateOptions: Record<string, unknown>,
) {
  return request(host, "/api/companion/preview", { templateId, templateOptions });
}

export async function approveOnPc(
  host: string,
  templateId: string,
  templateOptions: Record<string, unknown>,
  fingerprint: string,
) {
  return request(host, "/api/companion/approve", { templateId, templateOptions, fingerprint });
}

export async function controlPc(host: string, action: "pause" | "resume" | "cancel" | "undo") {
  return request(host, `/api/companion/${action}`, {});
}
