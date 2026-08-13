import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clientDeficiencies } from "@/db/schema";
import { id } from "@/lib/utils";

/** One active row per (clientId, deficiencySlug); returns existing id or inserts. */
export async function upsertActiveClientDeficiency(opts: {
  organizationId: string;
  clientId: string;
  slug: string;
  source?: string;
  severity?: string;
  affectedSide?: string;
  notes?: string | null;
}): Promise<string> {
  const db = await getDb();
  const [existing] = await db
    .select({ id: clientDeficiencies.id })
    .from(clientDeficiencies)
    .where(
      and(
        eq(clientDeficiencies.clientId, opts.clientId),
        eq(clientDeficiencies.deficiencySlug, opts.slug),
        eq(clientDeficiencies.status, "active")
      )
    )
    .limit(1);
  if (existing) return existing.id;
  const idNew = id("cdef");
  await db.insert(clientDeficiencies).values({
    id: idNew,
    organizationId: opts.organizationId,
    clientId: opts.clientId,
    deficiencySlug: opts.slug,
    source: opts.source || "assessment",
    severity: opts.severity || "moderate",
    status: "active",
    affectedSide: opts.affectedSide || "bilateral",
    notes: opts.notes ?? null,
  });
  return idNew;
}
