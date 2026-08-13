"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { clients, notifications } from "@/db/schema";
import { requireClientSession } from "@/lib/client-auth";

export async function updatePortalPreferencesAction(prefs: {
  sessionReminders?: boolean;
  invoiceAlerts?: boolean;
  programUpdates?: boolean;
}) {
  const session = await requireClientSession();
  const db = await getDb();
  await db
    .update(clients)
    .set({
      notificationPreferences: {
        sessionReminders: prefs.sessionReminders !== false,
        invoiceAlerts: prefs.invoiceAlerts !== false,
        programUpdates: prefs.programUpdates !== false,
      },
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clients.id, session.clientId),
        eq(clients.organizationId, session.organizationId)
      )
    );
  revalidatePath("/portal/profile");
  return { ok: true as const };
}

export async function markPortalNotificationReadAction(notificationId: string) {
  const session = await requireClientSession();
  const db = await getDb();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.organizationId, session.organizationId),
        eq(notifications.clientId, session.clientId)
      )
    );
  revalidatePath("/portal/dashboard");
  return { ok: true as const };
}
