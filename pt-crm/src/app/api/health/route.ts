import { NextResponse } from "next/server";
import { getDb, getPGlite } from "@/db";
import { organizations } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Unauthenticated liveness/readiness probe for Docker / reverse proxies.
 * Does not leak secrets; reports safe operational status only.
 */
export async function GET() {
  const started = Date.now();
  try {
    const db = await getDb();
    await getPGlite();
    // Light query to prove DB is readable
    await db.select({ id: organizations.id }).from(organizations).limit(1);

    const authSecret = process.env.AUTH_SECRET || "";
    const weakAuth =
      !authSecret ||
      authSecret === "change-me-in-production" ||
      authSecret === "dev-only-change-me-floorscribe-secret-key" ||
      authSecret === "dev-only-change-me-pt-crm-secret-key" ||
      authSecret.length < 24;

    return NextResponse.json(
      {
        ok: true,
        status: "healthy",
        uptimeSec: Math.floor(process.uptime()),
        latencyMs: Date.now() - started,
        nodeEnv: process.env.NODE_ENV || "development",
        aiConfigured: !!(process.env.XAI_API_KEY || process.env.AI_API_KEY),
        authSecretConfigured: !!authSecret && !weakAuth,
        warnings: [
          ...(weakAuth && process.env.NODE_ENV === "production"
            ? ["AUTH_SECRET is missing or weak — set a long random secret before production use"]
            : []),
        ],
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        error: e instanceof Error ? e.message : "unknown",
        latencyMs: Date.now() - started,
      },
      { status: 503 }
    );
  }
}
