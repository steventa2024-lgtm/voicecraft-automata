import { createFileRoute } from "@tanstack/react-router";
import { handleStripeWebhook } from "@/lib/server/stripe-webhook.server";

// Kept for existing Stripe endpoints. New Lovable deployments should use the
// /api/public/stripe-webhook alias so platform-level preview auth never intercepts events.
export const Route = createFileRoute("/api/billing/webhook")({
  server: { handlers: { POST: ({ request }) => handleStripeWebhook(request) } },
});
