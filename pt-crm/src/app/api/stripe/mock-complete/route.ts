import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { platformCharges } from "@/db/schema";
import { markPlatformChargePaid } from "@/lib/marketplace/stripe-platform";

export const dynamic = "force-dynamic";

function redirectUnpaid() {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/settings?paid=0" },
  });
}

export async function GET(req: Request) {
  if (
    process.env.MOCK_STRIPE !== "true" ||
    process.env.NODE_ENV === "production"
  ) {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const chargeId = new URL(req.url).searchParams.get("chargeId") || "";
  if (!chargeId) {
    return redirectUnpaid();
  }
  const db = await getDb();
  const [chg] = await db
    .select({ status: platformCharges.status })
    .from(platformCharges)
    .where(eq(platformCharges.id, chargeId))
    .limit(1);
  if (!chg || chg.status !== "due") {
    return redirectUnpaid();
  }
  await markPlatformChargePaid({ chargeId, paidAt: new Date() });
  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/settings?paid=1" },
  });
}
