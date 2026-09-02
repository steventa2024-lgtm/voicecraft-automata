import { ApiError } from "./auth.server";

const COOKIE_NAME = "zp_keygen_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

type KeygenSession = {
  v: 1;
  sub: "key-generator";
  iat: number;
  exp: number;
  nonce: string;
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function adminConfig() {
  const username = process.env["KEYGEN_ADMIN_USERNAME"] || "";
  const passwordHash = process.env["KEYGEN_ADMIN_PASSWORD_HASH"] || "";
  const sessionSecret = process.env["KEYGEN_SESSION_SECRET"] || "";
  if (!username || !passwordHash || sessionSecret.length < 32) {
    throw new ApiError(
      503,
      "keygen_unconfigured",
      "The private key generator has not been configured on this server.",
    );
  }
  return { username, passwordHash, sessionSecret };
}

async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, iterationsText, saltText, digestText] = encodedHash.split(".");
  const iterations = Number(iterationsText);
  if (
    algorithm !== "pbkdf2-sha256" ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    !saltText ||
    !digestText
  ) {
    throw new ApiError(503, "keygen_invalid_config", "The private key generator credential is misconfigured.");
  }
  const salt = base64UrlDecode(saltText);
  const expected = base64UrlDecode(digestText);
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      passwordKey,
      expected.byteLength * 8,
    ),
  );
  return constantTimeEqual(actual, expected);
}

async function sessionKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await sessionKey(secret),
    new TextEncoder().encode(value),
  );
  return base64UrlEncode(new Uint8Array(signature));
}

function cookieValue(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=") || null;
  }
  return null;
}

function clientKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError(403, "invalid_origin", "This request was rejected.");
  }
}

export function assertLoginAllowed(request: Request): void {
  const key = clientKey(request);
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.delete(key);
    return;
  }
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    throw new ApiError(429, "too_many_attempts", "Too many sign-in attempts. Try again in 15 minutes.");
  }
}

export function recordLoginFailure(request: Request): void {
  const key = clientKey(request);
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  attempt.count += 1;
}

export function clearLoginFailures(request: Request): void {
  loginAttempts.delete(clientKey(request));
}

export async function verifyKeygenCredentials(username: string, password: string): Promise<boolean> {
  const config = adminConfig();
  const [usernameMatches, passwordMatches] = await Promise.all([
    Promise.all([sha256Bytes(username), sha256Bytes(config.username)]).then(([left, right]) =>
      constantTimeEqual(left, right),
    ),
    verifyPassword(password, config.passwordHash),
  ]);
  return usernameMatches && passwordMatches;
}

export async function createKeygenSessionCookie(request: Request): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: KeygenSession = {
    v: 1,
    sub: "key-generator",
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  };
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(encoded, adminConfig().sessionSecret);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encoded}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function clearKeygenSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export async function requireKeygenAdmin(request: Request): Promise<void> {
  const token = cookieValue(request);
  if (!token) throw new ApiError(401, "keygen_signin_required", "Private admin sign-in is required.");
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new ApiError(401, "invalid_keygen_session", "Your private admin session expired.");
  const config = adminConfig();
  const valid = await crypto.subtle.verify(
    "HMAC",
    await sessionKey(config.sessionSecret),
    base64UrlDecode(signature),
    new TextEncoder().encode(encoded),
  );
  if (!valid) throw new ApiError(401, "invalid_keygen_session", "Your private admin session expired.");
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as KeygenSession;
    const now = Math.floor(Date.now() / 1000);
    if (payload.v !== 1 || payload.sub !== "key-generator" || payload.exp <= now || payload.iat > now + 60) {
      throw new Error("invalid session");
    }
  } catch {
    throw new ApiError(401, "invalid_keygen_session", "Your private admin session expired.");
  }
}
