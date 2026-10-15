import { supabase } from "./supabase";
import { isAllowedCloudUrl } from "./api-url.js";

const root = (process.env.EXPO_PUBLIC_VOICECRAFT_API_URL || "").replace(/\/$/, "");

export const cloudConfigured = isAllowedCloudUrl(root, {
  dev: typeof __DEV__ === "undefined" ? false : __DEV__,
});

export type ConsolePlatform = "ps5" | "xbox";

export type CloudHealth = {
  api: "ok";
  minecraft: "not-configured" | "tcp-open" | "unreachable";
  bedrock: { host: string; port: number; probe: string } | null;
  transcription: "configured" | "not-configured";
  planner: "configured" | "not-configured";
};

export type CloudSession = {
  email: string;
  entitlement: {
    allowed: boolean;
    plan: string | null;
    message: string | null;
    tasksRemaining: number | null;
    blocksRemaining: number | null;
  };
  link: {
    worldId: string;
    worldName: string;
    platform: string;
    bedrock: boolean;
    playerName: string;
    pairedAt: number;
  } | null;
  activeJob: CloudJob | null;
  recent: CloudJob[];
};

export type CloudPreview = {
  previewId: string;
  summary: string;
  estimatedBlocks: number;
  requiresConfirmation: true;
  width: number;
  depth: number;
  height: number;
  floors: number | null;
  material: string | null;
  structure: string | null;
  warnings: string[];
};

export type CloudJob = {
  jobId: string;
  status: string;
  confirmed: number;
  failed: number;
  total: number;
  error: string | null;
  worldId: string;
};

export type CloudBlueprint = {
  id: string;
  name: string;
  category: string;
  summary: string;
  estimatedBlocks: number;
  favorite: boolean;
  createdAt: number;
};

async function authorized<T>(path: string, init: RequestInit & { timeout?: number } = {}): Promise<T> {
  if (!cloudConfigured) throw new Error("VoiceCraft Cloud API is not configured.");
  if (!supabase) throw new Error("Configure Supabase authentication first.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in to continue.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeout ?? 15_000);
  try {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${data.session.access_token}`);
    const response = await fetch(root + path, { ...init, headers, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `Cloud request failed (HTTP ${response.status}).`);
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function fetchHealth() {
  if (!cloudConfigured) return Promise.reject(new Error("VoiceCraft Cloud API is not configured."));
  return fetch(`${root}/api/mobile/health`).then(async (response) => {
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || "Cloud health check failed.");
    return body as CloudHealth;
  });
}

export const fetchSession = () => authorized<CloudSession>("/api/mobile/session", { method: "GET" });
export const claimPairing = (code: string, platform: ConsolePlatform) =>
  authorized<{ worldId: string; worldName: string; platform: string; playerName: string }>("/api/mobile/pairing/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, platform }),
  });
export const revokePairing = () => authorized<{ revoked: boolean }>("/api/mobile/pairing/revoke", { method: "POST" });
export const requestPreview = (worldId: string, instruction: string) =>
  authorized<CloudPreview>("/api/mobile/builds/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ worldId, instruction }),
  });
export const confirmPreview = (previewId: string, idempotencyKey: string) =>
  authorized<CloudJob>("/api/mobile/builds/confirm", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify({ previewId }),
  });
export const fetchJob = (jobId: string) => authorized<CloudJob>(`/api/mobile/builds/${jobId}`, { method: "GET" });
export const cancelJob = (jobId: string) => authorized<CloudJob>(`/api/mobile/builds/${jobId}/cancel`, { method: "POST" });
export const fetchHistory = () => authorized<{ jobs: CloudJob[] }>("/api/mobile/history", { method: "GET" });
export const fetchBlueprints = () => authorized<{ blueprints: CloudBlueprint[] }>("/api/mobile/blueprints", { method: "GET" });
export const saveBlueprint = (previewId: string, name: string) =>
  authorized<{ id: string }>("/api/mobile/blueprints", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ previewId, name }),
  });
export const renameBlueprint = (id: string, name: string) =>
  authorized(`/api/mobile/blueprints/${id}/rename`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
export const favoriteBlueprint = (id: string, favorite: boolean) =>
  authorized(`/api/mobile/blueprints/${id}/favorite`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ favorite }),
  });
export const duplicateBlueprint = (id: string) =>
  authorized<{ id: string }>(`/api/mobile/blueprints/${id}/duplicate`, { method: "POST" });
export const deleteBlueprint = (id: string) =>
  authorized(`/api/mobile/blueprints/${id}`, { method: "DELETE" });
export const previewBlueprint = (id: string) =>
  authorized<CloudPreview>(`/api/mobile/blueprints/${id}/preview`, { method: "POST" });

export async function transcribeAudio(uri: string): Promise<string> {
  const form = new FormData();
  form.append("audio", { uri, name: "voicecraft.m4a", type: "audio/mp4" } as unknown as Blob);
  const payload = await authorized<{ text: string }>("/api/mobile/transcribe", { method: "POST", body: form, timeout: 30_000 });
  if (typeof payload.text !== "string") throw new Error("Invalid transcription response.");
  return payload.text;
}
