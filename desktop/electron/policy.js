const CHANNELS = new Set([
  "auth.status",
  "auth.signIn",
  "auth.password",
  "auth.signOut",
  "bridge.start",
  "bridge.stop",
  "bridge.command",
  "bridge.approve",
  "bridge.cancel",
  "bridge.pause",
  "bridge.resume",
  "settings.get",
  "settings.set",
  "library.list",
  "library.save",
  "library.duplicate",
  "library.delete",
  "library.favorite",
  "library.import",
  "library.export",
  "history.list",
  "history.undo",
  "history.redo",
  "ollama.health",
  "ollama.plan",
  "devices.approve",
  "devices.revoke",
  "devices.list",
  "companion.status",
  "companion.arm",
  "companion.permissions",
  "companion.revoke",
  "companion.stop",
  "shell.open",
  "app.info",
]);

const SETTING_KEYS = new Set([
  "appOrigin",
  "supabaseUrl",
  "supabasePublishableKey",
  "minecraftHost",
  "minecraftPort",
  "minecraftUsername",
  "minecraftVersion",
  "minecraftAuth",
  "bridgePort",
  "ollamaUrl",
  "ollamaModel",
  "confirmDestructive",
  "protectedPolicy",
  "chatControl",
  "theme",
]);

function isHttpUrl(value, { localOnly = false } = {}) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (localOnly) {
      return url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
    }
    return url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname));
  } catch {
    return false;
  }
}

export function validateInvoke(channel, payload = {}) {
  if (!CHANNELS.has(channel)) return { ok: false, error: "That action is not available." };
  const input = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  if (channel === "bridge.command") {
    const text = String(input.text || "");
    const templateId = input.instruction?.templateId;
    if (templateId) {
      if (!/^[a-z0-9-]{3,80}$/.test(String(templateId))) return { ok: false, error: "Choose a structure template." };
      return { ok: true, channel, payload: { text: text.trim().slice(0, 500), instruction: input.instruction } };
    }
    if (!text.trim() || text.length > 500) return { ok: false, error: "Enter a command under 500 characters." };
    return { ok: true, channel, payload: { text: text.trim(), instruction: input.instruction || null } };
  }
  if (channel === "companion.permissions") {
    return { ok: true, channel, payload: { build: input.build === true, view: false, input: false } };
  }
  if (channel === "companion.revoke") {
    return { ok: true, channel, payload: { deviceId: String(input.deviceId || "").slice(0, 80) } };
  }
  if (channel === "bridge.approve" || channel === "history.undo" || channel === "history.redo") {
    return { ok: true, channel, payload: { jobId: String(input.jobId || "") } };
  }
  if (channel === "bridge.start") {
    const port = Number(input.port);
    const bridgePort = Number(input.bridgePort || 8765);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: "Minecraft port is invalid." };
    if (!Number.isInteger(bridgePort) || bridgePort < 1024 || bridgePort > 65535) {
      return { ok: false, error: "Bridge port is invalid." };
    }
    const host = String(input.host || "localhost").trim();
    if (!/^[A-Za-z0-9.-]{1,253}$/.test(host)) return { ok: false, error: "Minecraft host is invalid." };
    const username = String(input.username || "ZeroPulse").trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return { ok: false, error: "Bot username must be 3–16 letters, numbers, or underscores." };
    return {
      ok: true,
      channel,
      payload: {
        host,
        port,
        bridgePort,
        username,
        version: String(input.version || "").slice(0, 16),
        auth: input.auth === "microsoft" ? "microsoft" : "offline",
      },
    };
  }
  if (channel === "settings.set") {
    const next = {};
    for (const [key, value] of Object.entries(input)) {
      if (!SETTING_KEYS.has(key)) return { ok: false, error: "Unknown setting." };
      next[key] = value;
    }
    if (next.appOrigin && !isHttpUrl(String(next.appOrigin))) return { ok: false, error: "Account website must be an https or local URL." };
    if (next.supabaseUrl && !isHttpUrl(String(next.supabaseUrl))) return { ok: false, error: "Supabase URL is invalid." };
    if (next.ollamaUrl && !isHttpUrl(String(next.ollamaUrl), { localOnly: true })) {
      return { ok: false, error: "Ollama must use a localhost URL." };
    }
    if (next.supabasePublishableKey && String(next.supabasePublishableKey).startsWith("sb_secret")) {
      return { ok: false, error: "A service-role key cannot be stored in the desktop app." };
    }
    return { ok: true, channel, payload: next };
  }
  if (channel === "auth.password") {
    const email = String(input.email || "");
    const password = String(input.password || "");
    if (!email.includes("@") || email.length > 200 || password.length < 8 || password.length > 200) {
      return { ok: false, error: "Enter the email and password for your ZeroPulse account." };
    }
    return { ok: true, channel, payload: { email, password } };
  }
  if (channel === "shell.open") {
    const pathName = String(input.path || "/");
    if (!pathName.startsWith("/") || pathName.startsWith("//") || pathName.includes("\\") || pathName.length > 120) {
      return { ok: false, error: "That page cannot be opened." };
    }
    return { ok: true, channel, payload: { path: pathName } };
  }
  if (channel === "ollama.plan") {
    const prompt = String(input.prompt || "");
    if (!prompt.trim() || prompt.length > 1000) return { ok: false, error: "Describe the build in under 1000 characters." };
    return { ok: true, channel, payload: { prompt: prompt.trim() } };
  }
  if (channel === "library.import") {
    const text = String(input.text || "");
    if (text.length > 200_000) return { ok: false, error: "Blueprint file is too large." };
    return { ok: true, channel, payload: { text } };
  }
  return { ok: true, channel, payload: input };
}

export function externalUrl(appOrigin, pathName) {
  const checked = validateInvoke("shell.open", { path: pathName });
  if (!checked.ok) return null;
  if (!appOrigin || !isHttpUrl(appOrigin)) return null;
  const url = new URL(checked.payload.path, appOrigin.endsWith("/") ? appOrigin : `${appOrigin}/`);
  const origin = new URL(appOrigin);
  if (url.origin !== origin.origin) return null;
  return url.toString();
}

export function senderAllowed(rawUrl, devPort) {
  if (!rawUrl) return false;
  if (rawUrl.startsWith("file:")) return true;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === String(devPort);
  } catch {
    return false;
  }
}

export function publicSettings(settings) {
  return { ...settings, supabasePublishableKey: settings.supabasePublishableKey ? "configured" : "" };
}

export function mergeSettings(current, patch) {
  const merged = { ...current };
  for (const [key, value] of Object.entries(patch || {})) {
    if (key === "supabasePublishableKey" && (value === "configured" || value === undefined)) continue;
    merged[key] = value;
  }
  return merged;
}

const PRIVILEGED_ENV = /SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY|STRIPE_|WHSEC|ZP_RELAY_KEY|SUPABASE_SERVICE/i;

export function scrubChildEnv(env) {
  const next = {};
  for (const [key, value] of Object.entries(env || {})) {
    if (key === "BRIDGE_AUTH_TOKEN" || PRIVILEGED_ENV.test(key)) continue;
    next[key] = value;
  }
  return next;
}
