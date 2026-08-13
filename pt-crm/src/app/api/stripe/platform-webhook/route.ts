import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { markPlatformChargePaid } from "@/lib/marketplace/stripe-platform";

export const dynamic = "force-dynamic";

function verifyStripeSignature(raw: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    })
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = createHmac("sha256", secret)
    .update(`${t}.${raw}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const sig = req.headers.get("stripe-signature") || "";
  if (secret) {
    if (!verifyStripeSignature(raw, sig, secret)) {
      return NextResponse.json({ error: "bad signature" }, { status: 400 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "webhook secret required" }, { status: 500 });
  }

  let payload: {
    type?: string;
    data?: { object?: { id?: string; metadata?: { chargeId?: string } } };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (payload.type === "checkout.session.completed") {
    const chargeId = payload.data?.object?.metadata?.chargeId;
    if (chargeId) {
      await markPlatformChargePaid({ chargeId, paidAt: new Date() });
    }
  }
  return NextResponse.json({ received: true });
}
