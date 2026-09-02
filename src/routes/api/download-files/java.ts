import { createFileRoute } from "@tanstack/react-router";
import { errorResponse } from "@/lib/server/auth.server";
import { serveLocalDownload } from "@/lib/server/downloads.server";

export const Route = createFileRoute("/api/download-files/java")({
  server: { handlers: { GET: async ({ request }) => {
    try {
      return await serveLocalDownload("java", request);
    } catch (error) {
      return errorResponse(error);
    }
  } } },
});
