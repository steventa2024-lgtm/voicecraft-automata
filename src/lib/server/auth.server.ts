import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json(
    { error: "internal_error", message: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

export function getBearerToken(request: Request): string {
  const value = request.headers.get("authorization") || "";
  if (!value.startsWith("Bearer ") || value.length < 20) {
    throw new ApiError(401, "unauthorized", "Sign in to continue.");
  }
  return value.slice(7);
}

export async function requireApiUserClient(
  request: Request,
): Promise<{ user: User; client: SupabaseClient }> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new ApiError(503, "auth_unconfigured", "Authentication is not configured.");
  const token = getBearerToken(request);
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "invalid_session", "Your session expired. Sign in again.");
  return { user: data.user, client };
}

export async function requireApiUser(request: Request): Promise<User> {
  return (await requireApiUserClient(request)).user;
}

export async function requireAdmin(request: Request): Promise<User> {
  const user = await requireApiUser(request);
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("voicecraft_profiles")
    .select("is_admin,email")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  const whitelist = (process.env["ADMIN_EMAILS"] || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const email = (data?.email || user.email || "").toLowerCase();
  if (!data?.is_admin && !whitelist.includes(email)) {
    throw new ApiError(403, "admin_required", "Administrator access is required.");
  }
  return user;
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "invalid_json", "The request body must be valid JSON.");
  }
}
