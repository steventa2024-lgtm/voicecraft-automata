import { createFileRoute } from "@tanstack/react-router";
import { handleStripeWebhook } from "@/lib/server/stripe-webhook.server";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: { handlers: { POST: ({ request }) => handleStripeWebhook(request) } },
});
