import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, readJson, requireApiUser } from "@/lib/server/auth.server";
import { assertDesktopAuthRequest, issueDesktopCode } from "@/lib/server/desktop-auth.server";

export const Route = createFileRoute("/api/auth/desktop/issue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireApiUser(request);
          const body = await readJson<{ codeChallenge?: unknown; state?: unknown; redirectUri?: unknown }>(request);
          const checked = assertDesktopAuthRequest(body);
          return Response.json(await issueDesktopCode(user.id, checked));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
