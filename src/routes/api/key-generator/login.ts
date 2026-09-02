import { createFileRoute } from "@tanstack/react-router";
import { ApiError, errorResponse, readJson } from "@/lib/server/auth.server";
import {
  assertLoginAllowed,
  clearLoginFailures,
  createKeygenSessionCookie,
  recordLoginFailure,
  requireSameOrigin,
  verifyKeygenCredentials,
} from "@/lib/server/keygen-auth.server";

export const Route = createFileRoute("/api/key-generator/login")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      requireSameOrigin(request);
      assertLoginAllowed(request);
      const { username, password } = await readJson<{ username?: unknown; password?: unknown }>(request);
      if (typeof username !== "string" || typeof password !== "string" || username.length > 128 || password.length > 512) {
        throw new ApiError(400, "invalid_credentials", "Enter the private admin username and password.");
      }
      if (!(await verifyKeygenCredentials(username, password))) {
        recordLoginFailure(request);
        throw new ApiError(401, "invalid_credentials", "The username or password is incorrect.");
      }
      clearLoginFailures(request);
      return Response.json(
        { ok: true },
        { headers: { "set-cookie": await createKeygenSessionCookie(request), "cache-control": "no-store" } },
      );
    } catch (error) {
      return errorResponse(error);
    }
  } } },
});
