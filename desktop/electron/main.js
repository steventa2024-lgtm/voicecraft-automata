import { app, BrowserWindow, ipcMain, safeStorage, session, shell } from "electron";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan, describeInstruction, isLocalOllamaUrl, parseCommand, validatePlannerResponse, OLLAMA_SYSTEM_PROMPT } from "../../packages/protocol/src/index.js";
import { openStore } from "../../bridge/store.js";
import { exportBlueprint, importBlueprint } from "../../packages/protocol/src/blueprints.js";
import { createPkce } from "../../packages/protocol/src/security.js";
import { externalUrl, mergeSettings, publicSettings, scrubChildEnv, senderAllowed, validateInvoke } from "./policy.js";
import { createCompanion } from "./companion.js";
import { nextJobStatus } from "./job-status.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_PORT = Number(process.env.ZP_DESKTOP_PORT || 5173);
const isDev = process.env.ZP_DESKTOP_DEV === "1";
const root = app.isPackaged ? path.join(__dirname, "..") : path.join(__dirname, "..", "..");

let win = null;
let bridge = null;
let bridgeSocket = null;
let authToken = "";
const memorySession = { current: null };
const jobs = new Map();
let planWaiter = null;
let activeJob = null;

function userData() {
  return app.getPath("userData");
}

function settingsPath() {
  return path.join(userData(), "settings.json");
}

function readSettings() {
  const defaults = {
    appOrigin: process.env.ZEROPULSE_APP_URL || "",
    supabaseUrl: process.env.ZEROPULSE_SUPABASE_URL || "",
    supabasePublishableKey: process.env.ZEROPULSE_SUPABASE_PUBLISHABLE_KEY || "",
    minecraftHost: "localhost",
    minecraftPort: 25565,
    minecraftUsername: "ZeroPulse",
    minecraftVersion: "",
    minecraftAuth: "offline",
    bridgePort: 8765,
    ollamaUrl: "http://127.0.0.1:11434",
    ollamaModel: "",
    confirmDestructive: true,
    protectedPolicy: "abort",
    chatControl: false,
    theme: "navy",
  };
  try {
    return { ...defaults, ...JSON.parse(readFileSync(settingsPath(), "utf8")) };
  } catch {
    return defaults;
  }
}

function writeSettings(next) {
  mkdirSync(userData(), { recursive: true });
  const merged = mergeSettings(readSettings(), next);
  writeFileSync(settingsPath(), JSON.stringify(merged, null, 2));
  return publicSettings(merged);
}

function sessionFile() {
  return path.join(userData(), "session.bin");
}

function saveSession(value) {
  memorySession.current = value;
  if (!value) {
    rmSync(sessionFile(), { force: true });
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) return;
  writeFileSync(sessionFile(), safeStorage.encryptString(JSON.stringify(value)));
}

function loadSession() {
  if (memorySession.current) return memorySession.current;
  if (!existsSync(sessionFile()) || !safeStorage.isEncryptionAvailable()) return null;
  try {
    memorySession.current = JSON.parse(safeStorage.decryptString(readFileSync(sessionFile())));
    return memorySession.current;
  } catch {
    return null;
  }
}

function send(event) {
  if (win && !win.isDestroyed()) win.webContents.send("zp:event", event);
}

function store() {
  return openStore(userData());
}

async function refreshAccount() {
  const current = loadSession();
  const settings = readSettings();
  if (!current?.accessToken || !settings.appOrigin) {
    return { signedIn: false, reason: current ? "Website origin is not configured." : "Signed out" };
  }
  try {
    const response = await fetch(new URL("/api/account/me", settings.appOrigin), {
      headers: { authorization: `Bearer ${current.accessToken}` },
      signal: AbortSignal.timeout(12_000),
    });
    const body = await response.json();
    if (response.status === 401 && current.refreshToken) {
      const refreshed = await refreshTokens();
      if (!refreshed) return { signedIn: false, reason: "Session expired. Sign in again." };
      return refreshAccount();
    }
    if (!response.ok) return { signedIn: true, stale: true, email: current.email, error: body.message || "Account status is unavailable." };
    return {
      signedIn: true,
      email: body.user?.email || current.email,
      plan: body.profile?.unlimited_tester ? "unlimited_tester" : body.profile?.plan_tier,
      subscription: body.profile?.subscription_status,
      unlimited: Boolean(body.profile?.unlimited_tester),
      tasks: body.usage?.task_count ?? 0,
      blocks: body.usage?.block_count ?? 0,
    };
  } catch (error) {
    return {
      signedIn: true,
      stale: true,
      email: current.email,
      error: `Offline. Local previews still work. Builds stay blocked until the account can be checked. ${error.message}`,
    };
  }
}

async function refreshTokens() {
  const current = loadSession();
  const settings = readSettings();
  if (!current?.refreshToken || !settings.supabaseUrl || !settings.supabasePublishableKey) return false;
  const response = await fetch(`${settings.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: settings.supabasePublishableKey, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: current.refreshToken }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) return false;
  saveSession({
    accessToken: body.access_token,
    refreshToken: body.refresh_token || current.refreshToken,
    email: current.email,
  });
  return true;
}

async function runnerToken() {
  const current = loadSession();
  const settings = readSettings();
  if (!current?.accessToken || !settings.appOrigin) {
    throw new Error("Sign in and set the account website before approving a build.");
  }
  const response = await fetch(new URL("/api/builder/token", settings.appOrigin), {
    method: "POST",
    headers: { authorization: `Bearer ${current.accessToken}` },
  });
  const body = await response.json();
  if (!response.ok || !body.token) throw new Error(body.message || "Build authorization was refused.");
  return body.token;
}

const companion = createCompanion({
  version: app.getVersion(),
  bridgeRunning: () => Boolean(bridgeSocket && bridgeSocket.readyState === 1),
  activeJob: () => activeJob,
  accountEmail: () => loadSession()?.email || null,
  approve: async (instruction, plan) => {
    if (!bridgeSocket || bridgeSocket.readyState !== 1) throw new Error("The Minecraft bridge is not running on this PC.");
    const event = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        planWaiter = null;
        reject(new Error("The desktop did not prepare a build plan."));
      }, 8000);
      planWaiter = (next) => {
        clearTimeout(timer);
        resolve(next);
      };
      try {
        bridgeCommand({ type: "command", instruction: { ...instruction, raw: instruction.templateId, approved: false } });
      } catch (error) {
        clearTimeout(timer);
        planWaiter = null;
        reject(error);
      }
    });
    if (event.fingerprint !== plan.fingerprint || event.count !== plan.count) {
      throw new Error("The bridge plan did not match the approved preview.");
    }
    const token = await runnerToken();
    bridgeCommand({ type: "approve", jobId: event.jobId, runnerToken: token });
    return { ok: true, jobId: event.jobId, count: plan.count };
  },
  control: async (action) => {
    if (action === "undo" || action === "redo") {
      const token = await runnerToken();
      bridgeCommand({ type: action, runnerToken: token });
      return;
    }
    bridgeCommand({ type: action });
  },
});

function bridgeCommand(payload) {
  if (!bridgeSocket || bridgeSocket.readyState !== 1) throw new Error("The local bridge is not running.");
  bridgeSocket.send(JSON.stringify(payload));
}

function stopBridge() {
  bridgeSocket?.close();
  bridgeSocket = null;
  if (bridge) {
    bridge.kill();
    bridge = null;
  }
  rmSync(path.join(userData(), "bridge.pid"), { force: true });
  send({ type: "bridge", running: false, message: "Bridge stopped." });
}

function startBridge(config) {
  if (bridge) stopBridge();
  const lock = path.join(userData(), "bridge.pid");
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"));
    try {
      process.kill(pid, 0);
      throw new Error("Another ZeroPulse bridge is already running.");
    } catch (error) {
      if (error.message.includes("already")) throw error;
    }
  }
  authToken = randomBytes(24).toString("hex");
  const settings = readSettings();
  const entry = app.isPackaged
    ? path.join(process.resourcesPath, "bridge", "index.js")
    : path.join(root, "bridge", "index.js");
  bridge = spawn(process.execPath, [entry], {
    env: {
      ...scrubChildEnv(process.env),
      ELECTRON_RUN_AS_NODE: "1",
      BRIDGE_AUTH_TOKEN: authToken,
      BRIDGE_HOST: "127.0.0.1",
      BRIDGE_PORT: String(config.bridgePort),
      MC_HOST: config.host,
      MC_PORT: String(config.port),
      MC_USERNAME: config.username,
      MC_VERSION: config.version,
      MC_AUTH: config.auth,
      MC_CHAT_CONTROL: settings.chatControl ? "1" : "0",
      ZP_API_URL: settings.appOrigin,
      ZP_DATA_DIR: userData(),
      ZP_RELAY_URL: "",
      ZP_RELAY_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  writeFileSync(lock, String(bridge.pid));
  const onLog = (chunk) => send({ type: "log", message: String(chunk).slice(0, 2000) });
  bridge.stdout.on("data", onLog);
  bridge.stderr.on("data", onLog);
  bridge.on("exit", (code) => {
    send({ type: "bridge", running: false, message: `Bridge exited (${code ?? "signal"}). It was not restarted automatically.` });
    bridge = null;
    rmSync(lock, { force: true });
  });
  setTimeout(() => connectBridge(config.bridgePort), 400);
  send({ type: "bridge", running: true, message: "Bridge process started." });
}

function connectBridge(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  bridgeSocket = socket;
  socket.addEventListener("open", () => socket.send(JSON.stringify({ type: "auth", token: authToken })));
  socket.addEventListener("message", (event) => {
    try {
      const parsed = JSON.parse(String(event.data));
      if (parsed.type === "plan" && planWaiter) {
        const waiter = planWaiter;
        planWaiter = null;
        waiter(parsed);
      }
      activeJob = nextJobStatus(activeJob, parsed);
      send({ type: "bridge-event", event: parsed });
    } catch {
      send({ type: "log", message: "Ignored an unreadable bridge event." });
    }
  });
  socket.addEventListener("close", () => {
    if (bridgeSocket === socket) bridgeSocket = null;
  });
  socket.addEventListener("error", () => send({ type: "log", message: "Desktop could not connect to the local bridge yet." }));
}

function previewFrom(input) {
  const instruction = input.instruction || parseCommand(input.text);
  if (!instruction.valid && instruction.action !== "stop" && instruction.action !== "pause" && instruction.action !== "resume") {
    return { instruction, blocks: [], count: 0, description: instruction.errors?.[0] || "Command was not understood." };
  }
  if (!["build", "preview", "clear", "inspect"].includes(instruction.action)) {
    return { instruction, blocks: [], count: 0, description: describeInstruction(instruction) };
  }
  try {
    const planning = instruction.action === "clear" ? instruction : { ...instruction, action: "build", valid: true };
    const plan = buildPlan(planning);
    return {
      instruction,
      blocks: plan.blocks,
      count: plan.count,
      limited: false,
      bounds: plan.bounds,
      materials: plan.materials,
      fingerprint: plan.fingerprint,
      warnings: plan.warnings,
      description: describeInstruction(instruction),
    };
  } catch (error) {
    return { instruction, blocks: [], count: 0, description: error.message };
  }
}

async function signInWithBrowser() {
  const settings = readSettings();
  if (!settings.appOrigin) throw new Error("Set the account website in Settings before signing in.");
  const pkce = createPkce();
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<html><body style='font-family:sans-serif;background:#07111f;color:#e7eefc'><p>You can return to ZeroPulse VoiceCraft.</p></body></html>");
      server.close();
      resolve({ code: url.searchParams.get("code"), state: url.searchParams.get("state") });
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const redirect = `http://127.0.0.1:${port}/callback`;
      const target = new URL("/auth/desktop", settings.appOrigin);
      target.searchParams.set("state", pkce.state);
      target.searchParams.set("code_challenge", pkce.challenge);
      target.searchParams.set("redirect_uri", redirect);
      shell.openExternal(target.toString()).catch(reject);
    });
    setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for the browser sign-in."));
    }, 180_000).unref?.();
  });
  if (code.state !== pkce.state) throw new Error("Sign-in state did not match. The attempt was discarded.");
  const response = await fetch(new URL("/api/auth/desktop/exchange", settings.appOrigin), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: code.code, verifier: pkce.verifier, state: pkce.state }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "Desktop sign-in was rejected.");
  saveSession({ accessToken: body.accessToken, refreshToken: body.refreshToken, email: body.user?.email });
  return refreshAccount();
}

async function signInWithPassword(email, password) {
  const settings = readSettings();
  if (!settings.supabaseUrl || !settings.supabasePublishableKey) {
    throw new Error("Set the Supabase URL and publishable key in Settings. Do not enter a service-role key.");
  }
  const response = await fetch(`${settings.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: settings.supabasePublishableKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(body.error_description || body.msg || "Sign-in failed.");
  saveSession({ accessToken: body.access_token, refreshToken: body.refresh_token, email });
  return refreshAccount();
}

async function ollama(pathname, options) {
  const settings = readSettings();
  if (!isLocalOllamaUrl(settings.ollamaUrl)) throw new Error("Ollama URL must stay on localhost.");
  const response = await fetch(new URL(pathname, settings.ollamaUrl), { ...options, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
  return response.json();
}

async function handle(channel, payload) {
  if (channel === "app.info") {
    return { name: "ZeroPulse VoiceCraft", version: app.getVersion(), platform: process.platform, packaged: app.isPackaged };
  }
  if (channel === "settings.get") return publicSettings(readSettings());
  if (channel === "settings.set") return writeSettings(payload);
  if (channel === "auth.status") return refreshAccount();
  if (channel === "auth.signIn") return signInWithBrowser();
  if (channel === "auth.password") return signInWithPassword(payload.email, payload.password);
  if (channel === "auth.signOut") {
    saveSession(null);
    return { signedIn: false };
  }
  if (channel === "bridge.start") {
    startBridge(payload);
    return { running: true };
  }
  if (channel === "bridge.stop") {
    stopBridge();
    return { running: false };
  }
  if (channel === "bridge.command") {
    const preview = previewFrom(payload);
    if (preview.instruction?.raw || preview.instruction?.templateId) {
      try {
        bridgeCommand({ type: "command", instruction: { ...preview.instruction, approved: false } });
      } catch (error) {
        preview.bridge = error.message;
      }
    }
    return preview;
  }
  if (channel === "bridge.approve") {
    const token = await runnerToken();
    bridgeCommand({ type: "approve", jobId: payload.jobId, runnerToken: token });
    return { ok: true };
  }
  if (channel === "bridge.cancel") {
    bridgeCommand({ type: "cancel" });
    return { ok: true };
  }
  if (channel === "bridge.pause") {
    bridgeCommand({ type: "pause" });
    return { ok: true };
  }
  if (channel === "bridge.resume") {
    bridgeCommand({ type: "resume" });
    return { ok: true };
  }
  if (channel === "history.undo" || channel === "history.redo") {
    const token = await runnerToken();
    bridgeCommand({ type: channel.endsWith("undo") ? "undo" : "redo", runnerToken: token });
    return { ok: true };
  }
  if (channel === "history.list" || channel === "library.list" || channel === "devices.list") {
    const db = store();
    try {
      if (channel === "history.list") return db.listBuilds();
      if (channel === "devices.list") return db.listDevices();
      return db.listBlueprints();
    } finally {
      db.close();
    }
  }
  if (channel === "library.save") {
    const db = store();
    try {
      return { id: db.saveBlueprint(payload.blueprint) };
    } finally {
      db.close();
    }
  }
  if (channel === "library.duplicate" || channel === "library.delete" || channel === "library.favorite") {
    const db = store();
    try {
      if (channel === "library.duplicate") return { id: db.duplicateBlueprint(payload.id) };
      if (channel === "library.delete") {
        db.deleteBlueprint(payload.id);
        return { ok: true };
      }
      db.setFavorite(payload.id, Boolean(payload.favorite));
      return { ok: true };
    } finally {
      db.close();
    }
  }
  if (channel === "library.export") {
    const db = store();
    try {
      const row = db.listBlueprints().find((item) => item.id === payload.id);
      if (!row) throw new Error("Blueprint was not found.");
      return {
        text: exportBlueprint({
          name: row.name,
          category: row.category,
          structure: row.structure,
          material: row.material,
          size: row.size,
          floors: row.floors,
          dimensions: { width: row.width, depth: row.depth, height: row.height },
          favorite: Boolean(row.favorite),
          notes: row.notes,
          templateId: row.template_id || undefined,
          templateOptions: row.template_options ? JSON.parse(row.template_options) : undefined,
        }),
      };
    } finally {
      db.close();
    }
  }
  if (channel === "library.import") {
    const imported = importBlueprint(payload.text);
    if (!imported.ok) throw new Error(imported.error);
    const db = store();
    try {
      return { id: db.saveBlueprint(imported.blueprint) };
    } finally {
      db.close();
    }
  }
  if (channel === "devices.approve") {
    bridge?.send?.({ type: "approve-device", request: payload.request });
    return { ok: true };
  }
  if (channel === "devices.revoke") {
    bridge?.send?.({ type: "revoke-device", deviceId: payload.deviceId });
    const db = store();
    try {
      db.revokeDevice(payload.deviceId);
    } finally {
      db.close();
    }
    return { ok: true };
  }
  if (channel === "ollama.health") {
    const body = await ollama("/api/tags", {});
    return { ok: true, models: (body.models || []).map((model) => model.name) };
  }
  if (channel === "ollama.plan") {
    const settings = readSettings();
    if (!settings.ollamaModel) throw new Error("Set an installed Ollama model in Settings.");
    const body = await ollama("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: settings.ollamaModel,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: OLLAMA_SYSTEM_PROMPT },
          { role: "user", content: payload.prompt },
        ],
      }),
    });
    const plan = validatePlannerResponse(body.message?.content || "");
    if (!plan.ok) throw new Error(plan.error);
    return plan;
  }
  if (channel === "companion.status") return companion.status();
  if (channel === "companion.arm") return companion.arm();
  if (channel === "companion.permissions") return companion.setPermissions(payload);
  if (channel === "companion.revoke") return companion.revoke(payload.deviceId);
  if (channel === "companion.stop") return companion.stop();
  if (channel === "shell.open") {
    const target = externalUrl(readSettings().appOrigin, payload.path);
    if (!target) throw new Error("The account website is not configured, or the page is not on that site.");
    await shell.openExternal(target);
    return { ok: true };
  }
  throw new Error("Unhandled action.");
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#07111f",
    title: "ZeroPulse VoiceCraft",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  if (isDev) win.loadURL(`http://127.0.0.1:${DEV_PORT}`);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          isDev
            ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        ],
      },
    });
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });
  createWindow();
});

app.on("window-all-closed", () => {
  stopBridge();
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", stopBridge);

ipcMain.handle("zp:invoke", async (event, message) => {
  const frameUrl = event.senderFrame?.url || "";
  if (!senderAllowed(frameUrl, DEV_PORT)) throw new Error("The request did not come from the desktop app.");
  const checked = validateInvoke(message?.channel, message?.payload);
  if (!checked.ok) throw new Error(checked.error);
  return handle(checked.channel, checked.payload);
});

void jobs;
