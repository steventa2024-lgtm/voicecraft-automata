import Stripe from "stripe";
import { ApiError } from "./auth.server";

export type PlanTier = "starter" | "builder_pro" | "architect";

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  const secret = process.env["STRIPE_SECRET_KEY"];
  if (!secret) throw new ApiError(503, "billing_unconfigured", "Stripe billing is not configured.");
  stripeClient ||= new Stripe(secret);
  return stripeClient;
}

export function isPlanTier(value: unknown): value is PlanTier {
  return value === "starter" || value === "builder_pro" || value === "architect";
}

export function priceForTier(tier: PlanTier): string {
  const prices: Record<PlanTier, string | undefined> = {
    starter: process.env["STRIPE_PRICE_STARTER"],
    builder_pro: process.env["STRIPE_PRICE_BUILDER_PRO"],
    architect: process.env["STRIPE_PRICE_ARCHITECT"],
  };
  const price = prices[tier];
  if (!price) throw new ApiError(503, "price_unconfigured", `Stripe price for ${tier} is not configured.`);
  return price;
}

export function tierForPrice(priceId: string | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === process.env["STRIPE_PRICE_STARTER"]) return "starter";
  if (priceId === process.env["STRIPE_PRICE_BUILDER_PRO"]) return "builder_pro";
  if (priceId === process.env["STRIPE_PRICE_ARCHITECT"]) return "architect";
  return null;
}

export function publicOrigin(request: Request): string {
  const configured = process.env["PUBLIC_APP_URL"]?.replace(/\/$/, "");
  return configured || new URL(request.url).origin;
}
