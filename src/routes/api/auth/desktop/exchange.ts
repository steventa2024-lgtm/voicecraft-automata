import { createFileRoute } from "@tanstack/react-router";
import { errorResponse, readJson } from "@/lib/server/auth.server";
import { exchangeDesktopCode } from "@/lib/server/desktop-auth.server";

export const Route = createFileRoute("/api/auth/desktop/exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await readJson<{ code?: unknown; verifier?: unknown; state?: unknown }>(request);
          return Response.json(await exchangeDesktopCode(body));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});