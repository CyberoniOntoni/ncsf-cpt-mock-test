"use server";

import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { clientDocuments, clients } from "@/db/schema";
import { requireClientSession } from "@/lib/client-auth";
import { REQUIRED_PORTAL_DOCUMENTS } from "@/lib/portal-documents";

export async function signPortalDocumentAction(input: {
  documentId: string;
  signatureData: string;
}) {
  const session = await requireClientSession();
  const sig = (input.signatureData || "").trim();
  if (!sig.startsWith("data:image")) {
    return { ok: false as const, error: "Sign in the box first" };
  }

  const db = await getDb();
  const [doc] = await db
    .select()
    .from(clientDocuments)
    .where(
      and(
        eq(clientDocuments.id, input.documentId),
        eq(clientDocuments.organizationId, session.organizationId),
        eq(clientDocuments.clientId, session.clientId)
      )
    )
    .limit(1);
  if (!doc) return { ok: false as const, error: "Document not found" };
  if (doc.status === "signed") return { ok: true as const };

  const h = await headers();
  const template = REQUIRED_PORTAL_DOCUMENTS.find((d) => d.type === doc.type);
  const hash = createHash("sha256")
    .update(`${doc.type}:${doc.documentVersion}:${template?.body || doc.title}:${sig}`)
    .digest("hex");

  await db
    .update(clientDocuments)
    .set({
      status: "signed",
      signatureData: sig,
      documentHash: hash,
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip"),
      userAgent: h.get("user-agent"),
      signedAt: new Date(),
    })
    .where(eq(clientDocuments.id, doc.id));

  const pending = await db
    .select({ id: clientDocuments.id })
    .from(clientDocuments)
    .where(
      and(
        eq(clientDocuments.organizationId, session.organizationId),
        eq(clientDocuments.clientId, session.clientId),
        eq(clientDocuments.status, "pending")
      )
    )
    .limit(1);

  if (pending.length === 0) {
    await db
      .update(clients)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(clients.id, session.clientId),
          eq(clients.organizationId, session.organizationId)
        )
      );
  }

  revalidatePath("/portal/onboarding");
  revalidatePath("/portal/dashboard");
  return { ok: true as const, finished: pending.length === 0 };
}
