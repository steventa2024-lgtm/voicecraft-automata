import { randomUUID, timingSafeEqual } from "node:crypto";
import { createConnection } from "node:net";
import {
  buildPlan,
  describeInstruction,
  evaluateEntitlement,
  isLocalOllamaModel,
  isLocalOllamaUrl,
  parseCommand,
  planToInstruction,
  validatePlannerResponse,
  OLLAMA_SYSTEM_PROMPT,
} from "../../../packages/protocol/src/index.js";
import { HttpError } from "./errors.js";
import { readAudioUpload, transcribeWithWhisper } from "./transcribe.js";

const WINDOW_MS = 60_000;
const LIMIT = 60;

function json(status, body) {
  return Response.json(body, { status });
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 32_000) throw new HttpError(413, "The request is too large.");
  const text = await request.text();
  if (text.length > 32_000) throw new HttpError(413, "The request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "The request body must be JSON.");
  }
}

function bearer(request) {
  const value = request.headers.get("authorization") || "";
  if (!value.startsWith("Bearer ") || value.slice(7).trim().length < 8) {
    throw new HttpError(401, "Sign in to continue.");
  }
  return value.slice(7).trim();
}

function limit(hits, userId) {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= LIMIT) throw new HttpError(429, "Too many requests. Wait a moment and try again.");
  recent.push(now);
  hits.set(userId, recent);
}

export function probeTcp(host, port, timeoutMs = 1500) {
  if (!host || !port) return Promise.resolve(false);
  return new Promise((resolve) => {
    const socket = createConnection({ host, port: Number(port) });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

function publicPreview(row) {
  return {
    previewId: row.id,
    summary: row.summary,
    estimatedBlocks: row.block_count,
    requiresConfirmation: true,
    width: row.width,
    depth: row.depth,
    height: row.height,
    floors: row.floors,
    material: row.material,
    structure: row.structure,
    warnings: JSON.parse(row.warnings_json),
  };
}

function publicJob(row) {
  return {
    jobId: row.id,
    status: row.status,
    confirmed: row.confirmed,
    failed: row.failed_ops,
    total: row.total_ops,
    error: row.error,
    worldId: row.world_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function planInstruction(text, planner) {
  const instruction = parseCommand(text);
  if (instruction.valid) return { instruction, summary: describeInstruction(instruction), source: "parser" };
  if (!planner) {
    throw new HttpError(400, instruction.errors?.[0] || "The request is not a supported build command.");
  }
  const planned = await planner(text);
  const validated = validatePlannerResponse(planned);
  if (!validated.ok) throw new HttpError(422, validated.error);
  const next = planToInstruction(validated.plan.parts[0], text);
  if (!next.valid) throw new HttpError(422, "The model plan did not become a valid build.");
  return { instruction: next, summary: validated.plan.summary, source: "ollama" };
}

export function createApp(options) {
  const hits = new Map();
  const store = options.store;

  async function profileFor(user, token) {
    if (options.fetchProfile) return options.fetchProfile(user, token);
    if (!options.allowLocalAccounts) {
      throw new HttpError(503, "Subscription checks are not configured. Builds stay blocked.");
    }
    return store.accountState(user.id);
  }

  return async function handle(request) {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/api/mobile/health") {
        const minecraft = await probeTcp(options.minecraftHost, options.minecraftPort);
        return json(200, {
          api: "ok",
          minecraft: options.minecraftHost ? (minecraft ? "tcp-open" : "unreachable") : "not-configured",
          bedrock: options.publicHost
            ? { host: options.publicHost, port: options.publicPort, probe: "udp-not-probed" }
            : null,
          transcription: process.env.WHISPER_CPP ? "configured" : "not-configured",
          planner: options.planner ? "configured" : "not-configured",
        });
      }

      if (request.method === "POST" && url.pathname === "/api/mobile/pairing/issue") {
        const provided = request.headers.get("x-server-token") || "";
        const expected = options.serverToken || "";
        const same = provided.length === expected.length && expected.length > 0
          && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
        if (!same) throw new HttpError(401, "The Minecraft host is not authorized to issue pairing codes.");
        const body = await readJson(request);
        if (!/^[0-9a-f-]{36}$/i.test(body.playerUuid || "")) throw new HttpError(400, "A server-verified player UUID is required.");
        if (!/^[A-Za-z0-9_]{3,16}$/.test(body.playerName || "")) throw new HttpError(400, "Player name is invalid.");
        if (body.platform === "ps5" || body.platform === "xbox") {
          throw new HttpError(400, "The host must not guess PlayStation versus Xbox. Send the verified player identity and bedrock compatibility only.");
        }
        const worldId = String(body.worldId || "public-build").slice(0, 64);
        const worldName = String(body.worldName || "VoiceCraft Cloud").slice(0, 80);
        return json(200, store.issuePairing({
          worldId,
          worldName,
          playerUuid: body.playerUuid.toLowerCase(),
          playerName: body.playerName,
          bedrock: Boolean(body.bedrock),
        }));
      }

      const token = bearer(request);
      const user = await options.authenticate(token);
      if (!user?.id) throw new HttpError(401, "Your session expired. Sign in again.");
      limit(hits, user.id);

      if (request.method === "GET" && url.pathname === "/api/mobile/session") {
        const state = await profileFor(user, token);
        const decision = evaluateEntitlement({ ...state, requestedBlocks: 1 });
        const link = store.activeLink(user.id);
        return json(200, {
          email: user.email || "",
          entitlement: {
            allowed: decision.allowed,
            plan: decision.planTier || state.profile?.plan_tier || null,
            message: decision.allowed ? null : decision.message,
            tasksRemaining: decision.tasksRemaining ?? null,
            blocksRemaining: decision.blocksRemaining ?? null,
          },
          link: link
            ? {
                worldId: link.world_id,
                worldName: link.world_name,
                platform: link.platform,
                bedrock: Boolean(link.bedrock),
                playerName: link.player_name,
                pairedAt: link.created_at,
              }
            : null,
          activeJob: store.activeJob(user.id) ? publicJob(store.activeJob(user.id)) : null,
          recent: store.recentJobs(user.id).map(publicJob),
        });
      }

      if (request.method === "POST" && url.pathname === "/api/mobile/pairing/claim") {
        const body = await readJson(request);
        const code = String(body.code || "").trim().toUpperCase();
        if (!/^[A-Z0-9]{8}$/.test(code)) throw new HttpError(400, "Enter the 8 character code from the Minecraft server.");
        const claimed = store.claimPairing({ userId: user.id, code, console: body.platform });
        return json(200, claimed);
      }

      if (request.method === "POST" && url.pathname === "/api/mobile/pairing/revoke") {
        store.revokeLink(user.id);
        return json(200, { revoked: true });
      }

      if (request.method === "POST" && url.pathname === "/api/mobile/builds/preview") {
        const body = await readJson(request);
        const link = store.activeLink(user.id);
        if (!link || link.world_id !== body.worldId) {
          throw new HttpError(403, "Pair this account with the cloud world before requesting a preview.");
        }
        const text = String(body.instruction || "").trim();
        if (!text || text.length > 500) throw new HttpError(400, "Enter a build request under 500 characters.");
        const planned = await planInstruction(text, options.planner || null);
        if (planned.instruction.action === "clear" || planned.instruction.requiresConfirmation) {
          planned.instruction.approved = false;
        }
        const plan = buildPlan({ ...planned.instruction, action: planned.instruction.action === "clear" ? "clear" : "build", valid: true });
        const warnings = [];
        if (planned.instruction.action === "clear" || planned.instruction.destructive) {
          warnings.push("This plan removes blocks. Approval is required, and protected regions are refused by the executor.");
        }
        if (options.minecraftHost == null) warnings.push("No Minecraft host is configured, so approval cannot change a world yet.");
        const row = {
          id: randomUUID(),
          userId: user.id,
          worldId: link.world_id,
          linkId: link.id,
          summary: planned.summary,
          instructionJson: JSON.stringify(planned.instruction),
          blockCount: plan.count,
          width: plan.bounds.width,
          depth: plan.bounds.depth,
          height: plan.bounds.height,
          floors: planned.instruction.floors || null,
          material: planned.instruction.material || null,
          structure: planned.instruction.structure || null,
          warningsJson: JSON.stringify(warnings),
          createdAt: Date.now(),
          expiresAt: Date.now() + 15 * 60_000,
        };
        store.savePreview(row);
        return json(200, publicPreview({ ...row, id: row.id, summary: row.summary, block_count: row.blockCount, width: row.width, depth: row.depth, height: row.height, floors: row.floors, material: row.material, structure: row.structure, warnings_json: row.warningsJson }));
      }

      if (request.method === "POST" && url.pathname === "/api/mobile/builds/confirm") {
        const body = await readJson(request);
        const preview = store.previewForUser(body.previewId, user.id);
        if (!preview) throw new HttpError(404, "That preview was not found.");
        if (preview.expires_at < Date.now()) throw new HttpError(410, "That preview expired. Generate it again.");
        const link = store.activeLink(user.id);
        if (!link || link.id !== preview.link_id || link.world_id !== preview.world_id) {
          throw new HttpError(403, "The pairing for this preview is no longer active.");
        }
        const idempotencyKey = request.headers.get("idempotency-key") || null;
        if (idempotencyKey && idempotencyKey.length > 80) throw new HttpError(400, "Idempotency key is too long.");
        const replay = store.jobByIdempotency(user.id, idempotencyKey);
        if (replay) {
          if (replay.preview_id !== preview.id) throw new HttpError(409, "That idempotency key was already used for a different preview.");
          return json(202, publicJob(replay));
        }
        let charge = null;
        let reservationKind = "local";
        let reservationToken = null;
        if (options.reserveRemote) {
          const reserved = await options.reserveRemote(token, preview.block_count);
          reservationKind = "remote";
          reservationToken = reserved?.token || null;
        } else {
          const state = await profileFor(user, token);
          const decision = evaluateEntitlement({ ...state, requestedBlocks: preview.block_count });
          if (!decision.allowed) throw new HttpError(402, decision.message);
          charge = decision.bypass ? null : { tasks: 1, blocks: preview.block_count };
        }
        const created = store.createJob({
          userId: user.id,
          worldId: preview.world_id,
          previewId: preview.id,
          idempotencyKey,
          total: preview.block_count,
          charge,
          reservationKind,
          reservationToken,
        });
        return json(202, publicJob(created.job));
      }

      const jobMatch = url.pathname.match(/^\/api\/mobile\/builds\/([0-9a-f-]{36})$/i);
      if (jobMatch && request.method === "GET") {
        const job = store.jobForUser(jobMatch[1], user.id);
        if (!job) throw new HttpError(404, "That build was not found.");
        return json(200, publicJob(job));
      }
      const cancelMatch = url.pathname.match(/^\/api\/mobile\/builds\/([0-9a-f-]{36})\/cancel$/i);
      if (cancelMatch && request.method === "POST") {
        return json(200, publicJob(store.requestCancel(cancelMatch[1], user.id)));
      }

      if (request.method === "GET" && url.pathname === "/api/mobile/history") {
        return json(200, { jobs: store.recentJobs(user.id).map(publicJob) });
      }

      if (request.method === "GET" && url.pathname === "/api/mobile/blueprints") {
        return json(200, {
          blueprints: store.blueprints(user.id).map((row) => ({
            id: row.id,
            name: row.name,
            category: row.category,
            summary: row.summary,
            estimatedBlocks: row.block_count,
            favorite: Boolean(row.favorite),
            createdAt: row.created_at,
          })),
        });
      }

      if (request.method === "POST" && url.pathname === "/api/mobile/blueprints") {
        const body = await readJson(request);
        const preview = store.previewForUser(body.previewId, user.id);
        if (!preview) throw new HttpError(404, "Save a preview that belongs to this account.");
        const name = String(body.name || preview.structure || "Blueprint").trim().slice(0, 60);
        if (!name) throw new HttpError(400, "Name the blueprint.");
        const id = store.saveBlueprint({
          userId: user.id,
          name,
          category: preview.structure || "structure",
          summary: preview.summary,
          instructionJson: preview.instruction_json,
          blockCount: preview.block_count,
        });
        return json(201, { id });
      }

      const blueprintMatch = url.pathname.match(/^\/api\/mobile\/blueprints\/([0-9a-f-]{36})(?:\/(rename|favorite|duplicate|preview))?$/i);
      if (blueprintMatch) {
        const current = store.blueprint(blueprintMatch[1], user.id);
        if (!current) throw new HttpError(404, "Blueprint was not found.");
        const action = blueprintMatch[2];
        if (request.method === "DELETE" && !action) {
          store.deleteBlueprint(current.id, user.id);
          return json(200, { deleted: true });
        }
        if (request.method === "POST" && action === "rename") {
          const body = await readJson(request);
          const name = String(body.name || "").trim().slice(0, 60);
          if (!name) throw new HttpError(400, "Name the blueprint.");
          store.renameBlueprint(current.id, user.id, name);
          return json(200, { id: current.id, name });
        }
        if (request.method === "POST" && action === "favorite") {
          const body = await readJson(request);
          store.favoriteBlueprint(current.id, user.id, Boolean(body.favorite));
          return json(200, { id: current.id });
        }
        if (request.method === "POST" && action === "duplicate") {
          const id = store.saveBlueprint({
            userId: user.id,
            name: `${current.name} copy`.slice(0, 60),
            category: current.category,
            summary: current.summary,
            instructionJson: current.instruction_json,
            blockCount: current.block_count,
          });
          return json(201, { id });
        }
        if (request.method === "POST" && action === "preview") {
          const link = store.activeLink(user.id);
          if (!link) throw new HttpError(403, "Pair a world before reusing a blueprint.");
          store.touchBlueprint(current.id, user.id);
          const instruction = JSON.parse(current.instruction_json);
          const id = randomUUID();
          store.savePreview({
            id,
            userId: user.id,
            worldId: link.world_id,
            linkId: link.id,
            summary: current.summary,
            instructionJson: current.instruction_json,
            blockCount: current.block_count,
            width: instruction.dimensions?.width || 0,
            depth: instruction.dimensions?.depth || 0,
            height: instruction.dimensions?.height || 0,
            floors: instruction.floors || null,
            material: instruction.material || null,
            structure: instruction.structure || null,
            warningsJson: JSON.stringify(["Reused from your library. Approval is still required."]),
            createdAt: Date.now(),
            expiresAt: Date.now() + 15 * 60_000,
          });
          return json(200, publicPreview(store.previewForUser(id, user.id)));
        }
      }

      if (request.method === "POST" && url.pathname === "/api/mobile/transcribe") {
        const length = Number(request.headers.get("content-length") || 0);
        if (length > 2_000_000) throw new HttpError(413, "The recording is larger than 2 MB.");
        const audio = readAudioUpload(Buffer.from(await request.arrayBuffer()), request.headers.get("content-type"));
        const text = await (options.transcribe || transcribeWithWhisper)(audio);
        if (typeof text !== "string" || !text.trim()) throw new HttpError(422, "No speech was detected.");
        return json(200, { text: text.trim().slice(0, 500) });
      }

      throw new HttpError(404, "That cloud route does not exist.");
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.expose : "Something went wrong.";
      if (status === 500) console.error("[cloud-api]", error instanceof Error ? error.message : "error");
      return json(status, { message });
    }
  };
}

export async function defaultPlanner(prompt) {
  const url = process.env.OLLAMA_URL || "";
  if (!isLocalOllamaUrl(url) || !isLocalOllamaModel(process.env.OLLAMA_MODEL || "")) return null;
  const response = await fetch(new URL("/api/chat", url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: OLLAMA_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new HttpError(503, "The local planner is not responding. Use a standard build command.");
  const body = await response.json();
  return body.message?.content || "";
}

export async function supabaseUser(token) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new HttpError(503, "Authentication is not configured.");
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: key },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new HttpError(401, "Your session expired. Sign in again.");
  const body = await response.json();
  if (!body?.id) throw new HttpError(401, "Your session expired. Sign in again.");
  return { id: body.id, email: body.email || "" };
}
