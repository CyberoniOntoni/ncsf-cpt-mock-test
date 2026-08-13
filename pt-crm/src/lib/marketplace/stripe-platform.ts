import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { marketplaceProfiles, platformCharges } from "@/db/schema";
import { FEATURED_DAYS } from "./types";

export type CheckoutSession = { id: string; url: string };

export async function createPlatformCheckoutSession(opts: {
  chargeId: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession> {
  const secret = process.env.STRIPE_SECRET_KEY || "";
  if (!secret || process.env.MOCK_STRIPE === "true") {
    const origin = new URL(opts.successUrl).origin;
    return {
      id: `cs_test_${opts.chargeId}`,
      url: `${origin}/api/stripe/mock-complete?chargeId=${encodeURIComponent(opts.chargeId)}`,
    };
  }

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", opts.successUrl);
  body.set("cancel_url", opts.cancelUrl);
  body.set("metadata[chargeId]", opts.chargeId);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", opts.currency.toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", String(opts.amountCents));
  body.set(
    "line_items[0][price_data][product_data][name]",
    "FloorScribe marketplace fee"
  );

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe checkout failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { id: string; url: string };
  return { id: json.id, url: json.url };
}

export async function markPlatformChargePaid(opts: {
  chargeId: string;
  paidAt: Date;
}): Promise<void> {
  const db = await getDb();
  const [chg] = await db
    .select()
    .from(platformCharges)
    .where(eq(platformCharges.id, opts.chargeId))
    .limit(1);
  if (!chg) return;
  await db
    .update(platformCharges)
    .set({ status: "paid", paidAt: opts.paidAt })
    .where(eq(platformCharges.id, opts.chargeId));
  if (chg.kind === "featured_month" && chg.profileId) {
    const until = new Date(opts.paidAt);
    until.setUTCDate(until.getUTCDate() + FEATURED_DAYS);
    await db
      .update(marketplaceProfiles)
      .set({ featuredUntil: until, updatedAt: opts.paidAt })
      .where(eq(marketplaceProfiles.id, chg.profileId));
  }
}
