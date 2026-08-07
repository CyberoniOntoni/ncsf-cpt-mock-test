"use server";

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { conversations, messages } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatCoachResponseForChat, runCoachTurn } from "@/lib/ai/coach";
import type { CrmAction } from "@/lib/ai/schemas";
import { createProgramFromWizardAction } from "@/app/actions/programs";
import { startSessionFromProgramDayAction } from "@/app/actions/sessions";
import type { ProgramGoal } from "@/lib/program-builder";
import { assertClientInOrg } from "@/lib/tenant";
import { id } from "@/lib/utils";

export async function listConversationsAction() {
  const session = await requireSession();
  const db = await getDb();
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.organizationId, session.organizationId))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);
}

export async function getConversationAction(conversationId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!conv) return null;
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
  return { conversation: conv, messages: msgs };
}

export async function sendCoachMessageAction(input: {
  message: string;
  conversationId?: string | null;
  clientId?: string | null;
}) {
  const session = await requireSession();
  const db = await getDb();
  const text = input.message.trim();
  if (!text) throw new Error("Empty message");

  // Reject cross-tenant client ids early
  if (input.clientId) {
    await assertClientInOrg(input.clientId, session.organizationId);
  }

  let conversationId = input.conversationId || null;
  if (!conversationId) {
    conversationId = id("conv");
    await db.insert(conversations).values({
      id: conversationId,
      organizationId: session.organizationId,
      userId: session.userId,
      clientId: input.clientId || null,
      title: text.slice(0, 80),
    });
  } else {
    // ensure belongs to org
    const [conv] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.organizationId, session.organizationId)
        )
      )
      .limit(1);
    if (!conv) throw new Error("Conversation not found");
    if (input.clientId && !conv.clientId) {
      await db
        .update(conversations)
        .set({ clientId: input.clientId, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    }
  }

  await db.insert(messages).values({
    id: id("msg"),
    conversationId,
    role: "user",
    content: text,
  });

  const prior = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  const history = prior
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(0, -1) // exclude the message we just added from "prior" for history - actually prior includes it
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // history for model should not include the latest user message twice
  const historyForModel = history.slice(0, -1);

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  const response = await runCoachTurn({
    organizationId: session.organizationId,
    clientId: input.clientId || conv?.clientId,
    userMessage: text,
    history: historyForModel,
  });

  const formatted = formatCoachResponseForChat(response);
  const assistantId = id("msg");
  await db.insert(messages).values({
    id: assistantId,
    conversationId,
    role: "assistant",
    content: formatted.content,
    structured: formatted.structured,
  });

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return {
    conversationId,
    message: {
      id: assistantId,
      role: "assistant" as const,
      content: formatted.content,
      structured: formatted.structured,
    },
  };
}

/**
 * Execute a CRM action proposed by the coach (e.g. create program now).
 */
export async function executeCoachActionAction(action: CrmAction) {
  const session = await requireSession();

  if (action.kind === "create_program") {
    const p = action.payload || {};
    if (!p.clientId) {
      throw new Error("Select a client before creating a program");
    }
    await assertClientInOrg(p.clientId, session.organizationId);
    const goal = (p.goal || "general") as ProgramGoal;
    const { programId } = await createProgramFromWizardAction({
      clientId: p.clientId,
      title: p.title,
      goal,
      daysPerWeek: p.daysPerWeek || 3,
      sessionMinutes: p.sessionMinutes || 45,
      experienceLevel: p.experienceLevel,
      notes: p.notes,
      preferMobility: p.preferMobility,
      activate: p.activate !== false,
    });
    return {
      ok: true as const,
      kind: "create_program" as const,
      programId,
      href: `/programs/${programId}`,
      message: "Program created from client profile and available equipment.",
    };
  }

  // Lane D: mutate existing program
  if (action.kind === "insert_correctives") {
    const programId = action.payload?.programId;
    if (!programId) throw new Error("Missing program for correctives");
    const {
      insertCorrectivesAction,
    } = await import("@/app/actions/programs");
    const res = await insertCorrectivesAction(programId);
    const msg =
      res.inserted > 0
        ? `Inserted ${res.inserted} corrective(s).`
        : res.reason === "no_correctives"
          ? "No correctives matched this client’s history."
          : "No new correctives inserted.";
    return {
      ok: true as const,
      kind: "insert_correctives" as const,
      programId,
      href: `/programs/${programId}`,
      message: msg,
    };
  }

  if (action.kind === "apply_mesocycle") {
    const programId = action.payload?.programId;
    if (!programId) throw new Error("Missing program for mesocycle");
    const week = action.payload?.mesocycleWeek ?? 4;
    const { applyMesocycleToProgramAction } = await import(
      "@/app/actions/programs"
    );
    const res = await applyMesocycleToProgramAction(programId, week);
    return {
      ok: true as const,
      kind: "apply_mesocycle" as const,
      programId,
      href: `/programs/${programId}`,
      message: `Applied ${res.label} from baseline prescriptions.`,
    };
  }

  if (action.kind === "advance_mesocycle") {
    const programId = action.payload?.programId;
    if (!programId) throw new Error("Missing program to advance");
    const { advanceMesocycleWeekAction } = await import(
      "@/app/actions/programs"
    );
    const res = await advanceMesocycleWeekAction(programId);
    return {
      ok: true as const,
      kind: "advance_mesocycle" as const,
      programId,
      href: `/programs/${programId}`,
      message: `Advanced to ${res.label}.`,
    };
  }

  if (action.kind === "append_exercise") {
    const programDayId = action.payload?.programDayId;
    const bankExerciseId = action.payload?.bankExerciseId;
    if (!programDayId || !bankExerciseId) {
      throw new Error("Missing day or exercise for append");
    }
    const { addProgramExerciseAction } = await import("@/app/actions/programs");
    const res = await addProgramExerciseAction({
      programDayId,
      bankExerciseId,
      opts: { isWarmup: !!action.payload?.isWarmup },
    });
    return {
      ok: true as const,
      kind: "append_exercise" as const,
      programId: res.programId,
      href: `/programs/${res.programId}`,
      message: `Added ${res.name} to ${res.dayName}.`,
    };
  }

  if (action.kind === "start_session") {
    const dayId = action.payload?.programDayId;
    if (!dayId) throw new Error("Missing program day for session");
    const res = await startSessionFromProgramDayAction(dayId, {
      forceNew: !!action.payload?.forceNewSession,
    });
    return {
      ok: true as const,
      kind: "start_session" as const,
      sessionId: res.sessionId,
      href: `/sessions/${res.sessionId}`,
      message: res.resumed
        ? "Resumed in-progress session."
        : "Session started — log sets and complete when done.",
    };
  }

  // Navigation-only actions
  if (action.href) {
    return {
      ok: true as const,
      kind: action.kind,
      href: action.href,
      message: null as string | null,
    };
  }

  throw new Error(`Action “${action.kind}” cannot be executed here`);
}
