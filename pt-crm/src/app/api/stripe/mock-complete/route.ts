import { NextResponse } from "next/server";
import { markPlatformChargePaid } from "@/lib/marketplace/stripe-platform";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY || "";
  if (secret && process.env.MOCK_STRIPE !== "true") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const chargeId = new URL(req.url).searchParams.get("chargeId") || "";
  if (!chargeId) {
    return NextResponse.json({ error: "missing charge" }, { status: 400 });
  }
  await markPlatformChargePaid({ chargeId, paidAt: new Date() });
  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/settings?paid=1" },
  });
}
