import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients } from "@/db/schema";

/**
 * Load a client only if it belongs to the organization.
 * Returns null when missing or cross-tenant.
 */
export async function getClientInOrg(
  clientId: string,
  organizationId: string
) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.id, clientId), eq(clients.organizationId, organizationId))
    )
    .limit(1);
  return row || null;
}

/** Throws if client is missing or not in the caller's org. */
export async function assertClientInOrg(
  clientId: string,
  organizationId: string
) {
  const row = await getClientInOrg(clientId, organizationId);
  if (!row) {
    throw new Error("Client not found");
  }
  return row;
}
