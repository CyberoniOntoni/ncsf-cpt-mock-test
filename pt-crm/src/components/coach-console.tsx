"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Send,
  BookmarkPlus,
  Sparkles,
  ExternalLink,
  UserPlus,
  MessageSquarePlus,
} from "lucide-react";
import {
  executeCoachActionAction,
  sendCoachMessageAction,
} from "@/app/actions/coach";
import { saveRecommendationToClientAction } from "@/app/actions/clients";
import type { CrmAction } from "@/lib/ai/schemas";
import { Alert, Button, Card, Textarea, Badge } from "./ui";
import {
  CoachClientPicker,
  type CoachClientPick,
} from "./coach-client-picker";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  structured?: Record<string, unknown> | null;
};

type ClientHit = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  goals: string | null;
};

type ExerciseSuggestion = {
  id?: string;
  name: string;
  movementPattern?: string;
  equipment?: string[];
  reason?: string;
  cues?: string;
};

function getActions(structured?: Record<string, unknown> | null): CrmAction[] {
  if (!structured || !Array.isArray(structured.actions)) return [];
  return structured.actions as CrmAction[];
}

function lastUserText(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return null;
}

function messageNeedsClient(structured?: Record<string, unknown> | null) {
  return getActions(structured).some((a) => a.kind === "select_client_hint");
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/(^|[^A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1");
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function asExerciseList(v: unknown): ExerciseSuggestion[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is ExerciseSuggestion =>
      !!x && typeof x === "object" && typeof (x as ExerciseSuggestion).name === "string"
  );
}

function PromptChip({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-zinc-700/90 bg-zinc-900/50 px-3 py-1.5 text-left text-xs text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export function CoachConsole({
  clientId,
  clientName,
  onSelectClient,
}: {
  clientId?: string | null;
  clientName?: string | null;
  /** Parent updates workspace active client */
  onSelectClient?: (client: ClientHit) => void;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevClientId = useRef<string | null | undefined>(clientId);
  const retryingRef = useRef(false);
  /** Sync store so pick → parent clientId update still sees the pending prompt */
  const pendingRetryRef = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, showClientPicker]);

  // Auto-clear transient success / info banners
  useEffect(() => {
    if (!saved && !actionMsg) return;
    const t = setTimeout(() => {
      setSaved(null);
      setActionMsg(null);
    }, 3000);
    return () => clearTimeout(t);
  }, [saved, actionMsg]);

  // Reset chat when switching clients or clearing; keep when first selecting
  useEffect(() => {
    const prev = prevClientId.current;
    prevClientId.current = clientId;

    // Clear workspace client → fresh coach thread
    if (prev && !clientId) {
      setConversationId(null);
      setMessages([]);
      setError(null);
      setSaved(null);
      setActionMsg(null);
      setShowClientPicker(false);
      setPendingRetry(null);
      pendingRetryRef.current = null;
      return;
    }

    if (prev && clientId && prev !== clientId) {
      setConversationId(null);
      setMessages([]);
      setError(null);
      setSaved(null);
      setActionMsg(null);
      setShowClientPicker(false);
      setPendingRetry(null);
      pendingRetryRef.current = null;
      return;
    }

    if (clientId) {
      setShowClientPicker(false);
    }

    // After user picks a client for a blocked intent, re-run their last question
    const retryText = pendingRetryRef.current || pendingRetry;
    if (!prev && clientId && retryText && !retryingRef.current) {
      pendingRetryRef.current = null;
      setPendingRetry(null);
      retryingRef.current = true;
      void (async () => {
        try {
          setActionMsg("Client selected — continuing…");
          await sendWithClient(retryText, clientId);
          setActionMsg(null);
        } finally {
          retryingRef.current = false;
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional on clientId
  }, [clientId]);

  function rememberRetry(text: string) {
    pendingRetryRef.current = text;
    setPendingRetry(text);
  }

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setSaved(null);
    setActionMsg(null);
    setShowClientPicker(false);
    setPendingRetry(null);
    pendingRetryRef.current = null;
    setInput("");
  }

  async function sendWithClient(text: string, activeClientId?: string | null) {
    const cid = activeClientId !== undefined ? activeClientId : clientId;
    setError(null);
    setSaved(null);
    setBusy(true);
    try {
      const res = await sendCoachMessageAction({
        message: text,
        conversationId,
        clientId: cid,
      });
      setConversationId(res.conversationId);
      setMessages((m) => {
        // Avoid duplicating user bubble if we already added it in onSend
        const last = m[m.length - 1];
        const base =
          last?.role === "user" && last.content === text
            ? m
            : [
                ...m,
                {
                  id: `local_${Date.now()}`,
                  role: "user" as const,
                  content: text,
                },
              ];
        return [
          ...base,
          {
            id: res.message.id,
            role: "assistant" as const,
            content: res.message.content,
            structured: res.message.structured,
          },
        ];
      });
      if (messageNeedsClient(res.message.structured)) {
        setShowClientPicker(true);
        rememberRetry(text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get response");
    } finally {
      setBusy(false);
    }
  }

  async function onSend(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    if (!textOverride) setInput("");
    setError(null);
    setSaved(null);
    setActionMsg(null);
    const tempId = `local_${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await sendCoachMessageAction({
        message: text,
        conversationId,
        clientId,
      });
      setConversationId(res.conversationId);
      setMessages((m) => [
        ...m,
        {
          id: res.message.id,
          role: "assistant",
          content: res.message.content,
          structured: res.message.structured,
        },
      ]);
      if (messageNeedsClient(res.message.structured)) {
        setShowClientPicker(true);
        rememberRetry(text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get response");
    } finally {
      setBusy(false);
    }
  }

  function pickClient(c: CoachClientPick) {
    const hit: ClientHit = {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      status: c.status,
      goals: c.goals,
    };
    const last = pendingRetryRef.current || pendingRetry || lastUserText(messages);
    if (last) rememberRetry(last);
    setShowClientPicker(false);
    setActionMsg(
      `Selected ${c.firstName}${c.lastName ? ` ${c.lastName}` : ""} — continuing…`
    );
    onSelectClient?.(hit);
  }

  async function saveLastSolution() {
    if (!clientId) return;
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    setBusy(true);
    try {
      await saveRecommendationToClientAction(
        clientId,
        "Coach recommendation",
        last.content,
        conversationId || undefined,
        last.structured || undefined
      );
      setSaved("Saved to client notes");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: CrmAction) {
    setError(null);
    setActionMsg(null);

    if (action.kind === "select_client_hint") {
      const last = lastUserText(messages);
      if (last) rememberRetry(last);
      setShowClientPicker(true);
      setActionMsg("Pick a client below, then I’ll continue with your request.");
      return;
    }

    // Pure navigation — default routes if href omitted (LLM / partial payloads)
    const cid = action.payload?.clientId || clientId || undefined;
    const navDefaults: Partial<Record<CrmAction["kind"], string>> = {
      open_program_wizard: cid
        ? `/programs/new?client=${encodeURIComponent(cid)}`
        : "/programs/new",
      open_sessions: cid
        ? `/sessions?client=${encodeURIComponent(cid)}`
        : "/sessions",
      open_programs: cid
        ? `/programs?client=${encodeURIComponent(cid)}`
        : "/programs",
      open_library: "/library",
      open_equipment: "/library/equipment",
      open_knowledge: "/knowledge",
      open_history: "/history",
      open_client: cid ? `/clients/${cid}` : undefined,
      open_assessments: cid ? `/clients/${cid}/assessments` : undefined,
    };
    if (
      action.kind === "open_program_wizard" ||
      action.kind === "open_client" ||
      action.kind === "open_assessments" ||
      action.kind === "open_sessions" ||
      action.kind === "open_programs" ||
      action.kind === "open_program" ||
      action.kind === "open_library" ||
      action.kind === "open_equipment" ||
      action.kind === "open_knowledge" ||
      action.kind === "open_history"
    ) {
      const href =
        action.href ||
        navDefaults[action.kind] ||
        (action.kind === "open_program" && action.payload?.programId
          ? `/programs/${action.payload.programId}`
          : undefined);
      if (href) {
        router.push(href);
        return;
      }
      if (
        (action.kind === "open_client" || action.kind === "open_assessments") &&
        !cid
      ) {
        const last = lastUserText(messages);
        if (last) rememberRetry(last);
        setShowClientPicker(true);
        setActionMsg("Pick a client first, then open that destination.");
        return;
      }
      setError(`No destination for “${action.label}”`);
      return;
    }

    const isMutate =
      action.kind === "create_program" ||
      action.kind === "start_session" ||
      action.kind === "insert_correctives" ||
      action.kind === "apply_mesocycle" ||
      action.kind === "advance_mesocycle";

    if (isMutate) {
      if (action.kind === "create_program" && !clientId && !action.payload?.clientId) {
        const last = lastUserText(messages);
        if (last) rememberRetry(last);
        setShowClientPicker(true);
        setError("Select a client first, then create a program.");
        return;
      }
      // Resume via href when no program day (e.g. open in-progress session)
      if (
        action.kind === "start_session" &&
        !action.payload?.programDayId &&
        action.href
      ) {
        router.push(action.href);
        return;
      }
      if (action.kind === "start_session" && !action.payload?.programDayId) {
        setError("Missing program day — open a program and tap Start session.");
        return;
      }
      if (
        (action.kind === "insert_correctives" ||
          action.kind === "apply_mesocycle" ||
          action.kind === "advance_mesocycle") &&
        !action.payload?.programId
      ) {
        setError("Missing program — open Coach with a client that has an active plan.");
        return;
      }
      setBusy(true);
      try {
        const payload = {
          ...action,
          payload: {
            ...action.payload,
            clientId: action.payload?.clientId || clientId,
          },
        };
        const res = await executeCoachActionAction(payload);
        if (res.href) {
          setActionMsg(res.message || "Done");
          router.push(res.href);
          router.refresh();
        } else if (res.message) {
          setActionMsg(res.message);
        } else {
          setError(`“${action.label}” completed but has no link to open.`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (action.href) {
      router.push(action.href);
      return;
    }
    setError(`No destination for “${action.label}”`);
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastStructured = lastAssistant?.structured;
  const isSolution = lastStructured?.type === "solution";
  const isLastMessage = (id: string) => lastAssistant?.id === id;

  const busyLabel =
    messages.length === 0 || !lastAssistant
      ? "Looking up playbooks…"
      : "Thinking…";

  return (
    <Card className="flex min-h-[min(26rem,65dvh)] flex-1 flex-col border-zinc-800/90 sm:min-h-[400px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-100">Coach</h2>
          <p className="text-xs text-zinc-500">
            {clientName
              ? `Working with ${clientName}`
              : "Playbooks always · pick a client for CRM actions"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {messages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={newChat}
              disabled={busy}
              aria-label="New chat"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              New chat
            </Button>
          )}
          {!clientId && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowClientPicker((v) => !v)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {showClientPicker ? "Hide" : "Select client"}
            </Button>
          )}
          {clientId && isSolution && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={saveLastSolution}
              disabled={busy}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save note
            </Button>
          )}
        </div>
      </div>

      {showClientPicker && !clientId && (
        <div className="mb-3">
          <CoachClientPicker
            onPick={pickClient}
            onCancel={() => setShowClientPicker(false)}
          />
        </div>
      )}

      <div className="mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 sm:max-h-[min(28rem,50dvh)]">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/40 p-4">
            <p className="text-sm font-medium text-zinc-200">
              {clientName
                ? `What do you need for ${clientName}?`
                : "Floor coach — ask anything"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {clientName
                ? "Quick prompts use this client’s profile, playbooks, and equipment."
                : "Playbooks work without a client. Select one for programs and sessions."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {clientId ? (
                <>
                  <PromptChip
                    label="Design 3-day program"
                    disabled={busy}
                    onClick={() =>
                      void onSend("Create a 3-day program for this client")
                    }
                  />
                  <PromptChip
                    label="Start session"
                    disabled={busy}
                    onClick={() =>
                      void onSend("Start a session for this client")
                    }
                  />
                  <PromptChip
                    label="Client brief"
                    disabled={busy}
                    onClick={() =>
                      void onSend(
                        "Give me a quick client brief — goals, recent work, and what to focus on next"
                      )
                    }
                  />
                  <PromptChip
                    label="Prep today's session"
                    disabled={busy}
                    onClick={() =>
                      void onSend("Help me prep today's session for this client")
                    }
                  />
                  <PromptChip
                    label="Progress loads"
                    disabled={busy}
                    onClick={() =>
                      void onSend(
                        "How should I progress loads for this client?"
                      )
                    }
                  />
                  <PromptChip
                    label="Re-test screens"
                    disabled={busy}
                    onClick={() => void onSend("Re-test assessments")}
                  />
                </>
              ) : (
                <>
                  <PromptChip
                    label="Select client"
                    disabled={busy}
                    onClick={() => setShowClientPicker(true)}
                  />
                  <PromptChip
                    label="Needs analysis"
                    disabled={busy}
                    onClick={() =>
                      void onSend(
                        "Walk me through needs analysis for a new client"
                      )
                    }
                  />
                  <PromptChip
                    label="Older adult training"
                    disabled={busy}
                    onClick={() =>
                      void onSend(
                        "Key coaching points for older adult training"
                      )
                    }
                  />
                  <PromptChip
                    label="Warm-up"
                    disabled={busy}
                    onClick={() =>
                      void onSend(
                        "How should I structure a functional warm-up?"
                      )
                    }
                  />
                  <PromptChip
                    label="Shoulder pain"
                    disabled={busy}
                    onClick={() =>
                      void onSend(
                        "How do I progress a client with shoulder pain?"
                      )
                    }
                  />
                  <PromptChip
                    label="Progressive overload"
                    disabled={busy}
                    onClick={() =>
                      void onSend(
                        "Explain progressive overload for intermediate clients"
                      )
                    }
                  />
                </>
              )}
            </div>
            {!clientId && (
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
                Tip: try playbook topics like needs analysis, older adult
                training, or warm-up — or open{" "}
                <Link
                  href="/knowledge"
                  className="text-emerald-500 hover:underline"
                >
                  Knowledge
                </Link>
                .
              </p>
            )}
          </div>
        )}
        {messages.map((m) => {
          const actions = getActions(m.structured);
          const showSuggestions = m.role === "assistant" && isLastMessage(m.id);
          return (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-8 rounded-xl bg-emerald-900/30 px-3 py-2 text-sm text-emerald-50"
                  : "mr-4 rounded-xl bg-zinc-800/60 px-3 py-2 text-sm text-zinc-200"
              }
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
                {m.role === "user" ? "You" : "Coach"}
                {m.structured?.type === "solution" && (
                  <Badge tone="green">Solution</Badge>
                )}
                {m.structured?.type === "follow_up" && (
                  <Badge tone="amber">Follow-up</Badge>
                )}
                {actions.length > 0 && <Badge tone="green">Actions</Badge>}
              </div>

              {m.role === "assistant" ? (
                <AssistantBody content={m.content} structured={m.structured} />
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed text-[13px] sm:text-sm">
                  {m.content}
                </div>
              )}

              {m.role === "assistant" && actions.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 border-t border-zinc-700/80 pt-3">
                  {actions.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-950/40 px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-100">
                          {a.label}
                        </div>
                        {a.description && (
                          <div className="text-xs text-zinc-500">
                            {a.description}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        className="shrink-0 text-xs"
                        variant={
                          a.kind === "create_program" ||
                          a.kind === "start_session" ||
                          a.kind === "insert_correctives" ||
                          a.kind === "apply_mesocycle" ||
                          a.kind === "advance_mesocycle" ||
                          a.kind === "select_client_hint"
                            ? "primary"
                            : "secondary"
                        }
                        disabled={busy}
                        onClick={() => void runAction(a)}
                      >
                        {a.kind === "select_client_hint" ? (
                          <UserPlus className="h-3.5 w-3.5" />
                        ) : a.kind === "create_program" ||
                          a.kind === "start_session" ||
                          a.kind === "insert_correctives" ||
                          a.kind === "apply_mesocycle" ||
                          a.kind === "advance_mesocycle" ? (
                          <Sparkles className="h-3.5 w-3.5" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5" />
                        )}
                        {a.kind === "select_client_hint"
                          ? "Select"
                          : a.kind === "create_program" ||
                              a.kind === "start_session" ||
                              a.kind === "insert_correctives" ||
                              a.kind === "apply_mesocycle" ||
                              a.kind === "advance_mesocycle"
                            ? a.label.length > 28
                              ? a.kind === "start_session"
                                ? /resume/i.test(a.label)
                                  ? "Resume"
                                  : "Start"
                                : a.kind === "create_program"
                                  ? "Create"
                                  : "Apply"
                              : a.label
                            : "Open"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {showSuggestions && (
                <SuggestionChips
                  structured={m.structured}
                  actions={actions}
                  clientId={clientId}
                  busy={busy}
                  onSend={(t) => void onSend(t)}
                />
              )}
            </div>
          );
        })}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {busyLabel}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <Alert tone="error" className="mb-2 text-xs">
          {error}
        </Alert>
      )}
      {saved && (
        <Alert tone="success" className="mb-2 text-xs">
          {saved}
        </Alert>
      )}
      {actionMsg && (
        <Alert tone="info" className="mb-2 text-xs">
          {actionMsg}
        </Alert>
      )}

      <div className="space-y-2">
        {clientName && (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-800/50 bg-emerald-950/40 px-2.5 py-0.5 text-[11px] text-emerald-300/90">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate">{clientName}</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            placeholder={
              clientName
                ? `Ask about ${clientName}…`
                : "Ask coach — select client for CRM actions"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
            className="min-h-[52px] max-h-36 resize-y"
            disabled={busy}
          />
          <Button
            type="button"
            size="lg"
            onClick={() => void onSend()}
            disabled={busy || !input.trim()}
            loading={busy}
            className="shrink-0"
            aria-label="Send"
          >
            {!busy && <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
        Coaching support only — not a medical diagnosis. Uses playbooks, client
        profile, and equipment.{" "}
        <Link href="/programs" className="text-emerald-500 hover:underline">
          Programs
        </Link>
        {" · "}
        <Link href="/sessions" className="text-emerald-500 hover:underline">
          Sessions
        </Link>
        {" · "}
        <Link href="/library" className="text-emerald-500 hover:underline">
          Library
        </Link>
        {" · "}
        <Link href="/knowledge" className="text-emerald-500 hover:underline">
          Knowledge
        </Link>
        {" · "}
        <Link href="/history" className="text-emerald-500 hover:underline">
          History
        </Link>
      </p>
    </Card>
  );
}

/* ─── Message body helpers (same file) ─────────────────────────────────── */

function AssistantBody({
  content,
  structured,
}: {
  content: string;
  structured?: Record<string, unknown> | null;
}) {
  const type = structured?.type;

  if (type === "solution") {
    const body = renderSolutionBody(structured, content);
    if (body) return body;
  }

  if (type === "follow_up") {
    const body = renderFollowUpBody(structured, content);
    if (body) return body;
  }

  return (
    <div className="whitespace-pre-wrap leading-relaxed text-[13px] sm:text-sm">
      {stripMarkdown(content)}
    </div>
  );
}

function renderSolutionBody(
  structured: Record<string, unknown> | null | undefined,
  fallbackContent: string
) {
  if (!structured) return null;

  const summary =
    typeof structured.summary === "string" ? stripMarkdown(structured.summary) : "";
  const interventions = asStringArray(structured.interventions).map(stripMarkdown);
  const exercises = asExerciseList(structured.exerciseSuggestions);
  const redFlags = asStringArray(structured.redFlags).map(stripMarkdown);
  const referOut = structured.referOut === true;
  const playbookTitles = asStringArray(structured.playbookTitles).map(stripMarkdown);
  const confidence =
    typeof structured.confidence === "string" ? structured.confidence : null;
  const likelyFactors = asStringArray(structured.likelyFactors).map(stripMarkdown);
  const followUpAssessments = asStringArray(structured.followUpAssessments).map(
    stripMarkdown
  );
  const disclaimer =
    typeof structured.disclaimer === "string"
      ? stripMarkdown(structured.disclaimer)
      : null;

  // Incomplete structured payload → plain text
  if (!summary && interventions.length === 0 && exercises.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 text-[13px] leading-relaxed sm:text-sm">
      {summary ? (
        <p className="font-medium text-zinc-100">{summary}</p>
      ) : (
        <div className="whitespace-pre-wrap text-zinc-200">
          {stripMarkdown(fallbackContent)}
        </div>
      )}

      {likelyFactors.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Context
          </div>
          <ul className="list-disc space-y-1 pl-4 text-zinc-300">
            {likelyFactors.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {interventions.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Plan
          </div>
          <ul className="list-disc space-y-1 pl-4 text-zinc-300">
            {interventions.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {exercises.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Exercises
          </div>
          <ul className="space-y-1.5">
            {exercises.map((e, i) => {
              const eq =
                e.equipment && e.equipment.length > 0
                  ? e.equipment.join(", ")
                  : null;
              return (
                <li
                  key={e.id || `${e.name}-${i}`}
                  className="rounded-lg border border-zinc-700/60 bg-zinc-950/30 px-2.5 py-1.5"
                >
                  <div className="font-medium text-zinc-100">{e.name}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {eq && <span>{eq}</span>}
                    {eq && e.reason && <span> · </span>}
                    {e.reason && (
                      <span className="text-zinc-400">
                        {stripMarkdown(e.reason)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {followUpAssessments.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Next checks
          </div>
          <ul className="list-disc space-y-1 pl-4 text-zinc-300">
            {followUpAssessments.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {redFlags.length > 0 && (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-2.5 py-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-400/90">
            Red flags
          </div>
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-100/90">
            {redFlags.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {referOut && (
        <div className="rounded-lg border border-amber-700/70 bg-amber-950/40 px-2.5 py-2 text-xs text-amber-100">
          Refer out before aggressive loading when red flags apply.
        </div>
      )}

      {(playbookTitles.length > 0 || confidence) && (
        <div className="border-t border-zinc-700/50 pt-2 text-[11px] text-zinc-500">
          {playbookTitles.length > 0 && (
            <span>
              Sources:{" "}
              {playbookTitles.map((t, i) => (
                <span key={`${t}-${i}`}>
                  {i > 0 ? ", " : null}
                  <Link
                    href={`/knowledge?q=${encodeURIComponent(t)}`}
                    className="text-emerald-400/90 hover:underline"
                  >
                    {t}
                  </Link>
                </span>
              ))}
            </span>
          )}
          {playbookTitles.length > 0 && confidence && <span> · </span>}
          {confidence && <span>Confidence: {confidence}</span>}
        </div>
      )}

      {disclaimer && (
        <p className="text-[11px] leading-snug text-zinc-600">{disclaimer}</p>
      )}
    </div>
  );
}

function renderFollowUpBody(
  structured: Record<string, unknown> | null | undefined,
  fallbackContent: string
) {
  if (!structured) return null;
  const intro =
    typeof structured.intro === "string" ? stripMarkdown(structured.intro) : "";
  const questions = asStringArray(structured.questions).map(stripMarkdown);

  if (questions.length === 0) return null;

  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed sm:text-sm">
      <p className="text-zinc-200">
        {intro ||
          "A few follow-up questions so the plan is specific:"}
      </p>
      <ol className="list-decimal space-y-1.5 pl-4 text-zinc-300">
        {questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ol>
      <p className="text-xs text-zinc-500">
        Reply with answers in any format and I’ll propose a plan.
      </p>
      {/* Keep fallback content out of view when structured is complete */}
      {!intro && !questions.length && (
        <div className="whitespace-pre-wrap">{stripMarkdown(fallbackContent)}</div>
      )}
    </div>
  );
}

function SuggestionChips({
  structured,
  actions,
  clientId,
  busy,
  onSend,
}: {
  structured?: Record<string, unknown> | null;
  actions: CrmAction[];
  clientId?: string | null;
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const fromStructured = asStringArray(structured?.suggestions);
  const chips: string[] = [...fromStructured];

  // Soft defaults after a solution when client is set and no structured suggestions
  if (
    chips.length === 0 &&
    structured?.type === "solution" &&
    clientId
  ) {
    const actionKinds = new Set(actions.map((a) => a.kind));
    const labelsLower = actions.map((a) => a.label.toLowerCase());
    const hasLog =
      actionKinds.has("start_session") ||
      actionKinds.has("open_sessions") ||
      labelsLower.some((l) => l.includes("session") || l.includes("log"));
    const hasProgram =
      actionKinds.has("create_program") ||
      actionKinds.has("open_program_wizard") ||
      actionKinds.has("open_programs") ||
      labelsLower.some((l) => l.includes("program"));

    if (!hasLog) chips.push("Start session");
    if (!hasProgram) chips.push("Design program");
  }

  if (chips.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-700/60 pt-2.5">
      {chips.map((s) => (
        <PromptChip
          key={s}
          label={s}
          disabled={busy}
          onClick={() => {
            // Map soft defaults to full prompts
            if (s === "Start session" || s === "Log a session") {
              onSend("Start a session for this client");
              return;
            }
            if (s === "Design program") {
              onSend("Create a 3-day program for this client");
              return;
            }
            onSend(s);
          }}
        />
      ))}
    </div>
  );
}
