import type Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiError, errorResponse } from "./auth.server";
import { getStripe, isPlanTier, tierForPrice, type PlanTier } from "./stripe.server";

const objectId = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id;

async function syncSubscription(subscription: Stripe.Subscription, explicitUserId?: string) {
  const db = supabaseAdmin as any;
  const customerId = objectId(subscription.customer);
  let userId = explicitUserId || subscription.metadata["userId"];
  if (!userId && customerId) {
    const { data } = await db
      .from("voicecraft_profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = data?.id;
  }
  if (!userId) throw new Error(`Cannot map Stripe subscription ${subscription.id} to a user`);

  const metadataTier = subscription.metadata["planTier"];
  const priceId = subscription.items.data[0]?.price?.id;
  const planTier: PlanTier = isPlanTier(metadataTier)
    ? metadataTier
    : tierForPrice(priceId) || "starter";
  const { error } = await db
    .from("voicecraft_profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      plan_tier: planTier,
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

export async function handleStripeWebhook(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    const secret = process.env["STRIPE_WEBHOOK_SECRET"];
    if (!signature || !secret) {
      throw new ApiError(400, "invalid_webhook", "Webhook signature is missing.");
    }

    const rawBody = await request.text();
    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
    } catch {
      throw new ApiError(400, "invalid_webhook", "Webhook signature verification failed.");
    }

    const db = supabaseAdmin as any;
    const { data: seen } = await db
      .from("voicecraft_stripe_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();
    if (seen) return Response.json({ received: true, duplicate: true });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = objectId(session.subscription);
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(
          subscription,
          session.metadata?.["userId"] || session.client_reference_id || undefined,
        );
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    }

    const { error } = await db.from("voicecraft_stripe_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
    });
    if (error && error.code !== "23505") throw error;
    return Response.json({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
}
