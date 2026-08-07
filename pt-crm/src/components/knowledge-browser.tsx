"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, Card, EmptyState, Input } from "./ui";

export type KnowledgePlaybook = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string | null;
  tags: string;
  triggerPhrases: string;
  followUpQuestions: string[];
  solutionSteps: string[];
  interventions: string[];
  redFlags: string[];
  contraindications: string | null;
  body: string;
  organizationId: string | null;
};

const CATEGORY_META: Record<
  string,
  { label: string; tone: "green" | "amber" | "default" | "red"; blurb: string }
> = {
  assessment: {
    label: "Assessment",
    tone: "green",
    blurb: "Screens, red flags, when to re-test",
  },
  corrective: {
    label: "Corrective",
    tone: "amber",
    blurb: "Pain-aware coaching frames & regressions",
  },
  programming: {
    label: "Programming",
    tone: "default",
    blurb: "Plans, sets, progression, sessions",
  },
  safety: {
    label: "Safety",
    tone: "red",
    blurb: "Scope, medical clearance, special populations",
  },
  nutrition: {
    label: "Nutrition",
    tone: "green",
    blurb: "Coach-level habits — not clinical dietetics",
  },
  business: {
    label: "Coaching ops",
    tone: "default",
    blurb: "Intake, adherence, client process",
  },
  other: {
    label: "Other",
    tone: "default",
    blurb: "",
  },
};

/** Preferred chip / section order; unknown cats sort alpha after these. */
const CATEGORY_ORDER = [
  "assessment",
  "corrective",
  "programming",
  "safety",
  "nutrition",
  "business",
  "other",
];

function categoryLabel(c: string) {
  return CATEGORY_META[c]?.label || c;
}

function sortCategories(cats: string[]) {
  return [...cats].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function isNcsf(p: KnowledgePlaybook) {
  if ((p.slug || "").toLowerCase().startsWith("ncsf-")) return true;
  const tags = (p.tags || "").toLowerCase();
  return tags
    .split(",")
    .map((t) => t.trim())
    .includes("ncsf");
}

function matchesQuery(p: KnowledgePlaybook, q: string) {
  if (!q) return true;
  const hay = [
    p.title,
    p.slug || "",
    p.summary || "",
    p.tags,
    p.triggerPhrases,
    p.body,
    p.contraindications || "",
    ...(p.followUpQuestions || []),
    ...(p.solutionSteps || []),
    ...(p.interventions || []),
    ...(p.redFlags || []),
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t));
}

export function KnowledgeBrowser({
  playbooks,
}: {
  playbooks: KnowledgePlaybook[];
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [ncsfOnly, setNcsfOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const s = new Set(playbooks.map((p) => p.category || "other"));
    return ["all", ...sortCategories(Array.from(s))];
  }, [playbooks]);

  const filtered = useMemo(() => {
    return playbooks
      .filter((p) => {
        if (category !== "all" && (p.category || "other") !== category)
          return false;
        if (ncsfOnly && !isNcsf(p)) return false;
        return matchesQuery(p, q.trim());
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [playbooks, q, category, ncsfOnly]);

  const byCategory = useMemo(() => {
    return filtered.reduce<Record<string, KnowledgePlaybook[]>>((acc, p) => {
      const c = p.category || "other";
      (acc[c] ||= []).push(p);
      return acc;
    }, {});
  }, [filtered]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of playbooks) {
      const c = p.category || "other";
      m[c] = (m[c] || 0) + 1;
    }
    return m;
  }, [playbooks]);

  const countEntries = useMemo(
    () => sortCategories(Object.keys(counts)).map((c) => [c, counts[c]] as const),
    [counts]
  );

  const catOrder = useMemo(
    () => sortCategories(Object.keys(byCategory)),
    [byCategory]
  );

  const ncsfCount = useMemo(
    () => playbooks.filter(isNcsf).length,
    [playbooks]
  );

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-950/50 text-emerald-400 ring-1 ring-emerald-900/40">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Knowledge base
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              {playbooks.length} coaching playbooks power the assistant.
              Expand a card for steps, interventions, and red flags — coaching
              support only, not medical diagnosis.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {countEntries.map(([c, n]) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setCategory((prev) => (prev === c ? "all" : c))
                  }
                  className="inline-flex"
                >
                  <Badge
                    tone={
                      category === c
                        ? "green"
                        : CATEGORY_META[c]?.tone || "default"
                    }
                  >
                    {categoryLabel(c)} · {n}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className={`pl-9 ${q ? "pr-9" : ""}`}
            placeholder="Search playbooks, tags, triggers, NCSF…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <select
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all"
                ? "All categories"
                : `${categoryLabel(c)}${counts[c] ? ` (${counts[c]})` : ""}`}
            </option>
          ))}
        </select>
        {ncsfCount > 0 && (
          <button
            type="button"
            onClick={() => setNcsfOnly((v) => !v)}
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              ncsfOnly
                ? "border-sky-800/60 bg-sky-950/40 text-sky-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
            aria-pressed={ncsfOnly}
          >
            NCSF only
            <span className="ml-1.5 text-xs opacity-70">{ncsfCount}</span>
          </button>
        )}
        <span className="text-xs text-zinc-500">{filtered.length} shown</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="No playbooks match"
          description="Try another search, clear the category or NCSF filter, or browse Safety for scope and clearance guidance."
          className="py-12"
        />
      ) : (
        <div className="space-y-8">
          {catOrder.map((cat) => (
            <section key={cat}>
              <div className="mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-400/90">
                  {categoryLabel(cat)}
                </h2>
                {CATEGORY_META[cat]?.blurb && (
                  <p className="mt-0.5 text-xs text-zinc-600">
                    {CATEGORY_META[cat].blurb}
                  </p>
                )}
              </div>
              <div className="grid gap-2.5">
                {byCategory[cat].map((p) => {
                  const open = openId === p.id;
                  const tags = (p.tags || "")
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                  const ncsf = isNcsf(p);
                  return (
                    <Card
                      key={p.id}
                      className={`overflow-hidden p-0 transition ${
                        open
                          ? "border-emerald-900/40 bg-emerald-950/10"
                          : "hover:border-zinc-700"
                      }`}
                    >
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 px-3.5 py-3 text-left sm:px-4"
                        onClick={() => setOpenId(open ? null : p.id)}
                        aria-expanded={open}
                      >
                        <span className="mt-0.5 text-zinc-500">
                          {open ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-zinc-100">
                              {p.title}
                            </span>
                            {ncsf && <Badge tone="sky">NCSF</Badge>}
                            {!p.organizationId && (
                              <Badge tone="green">Global</Badge>
                            )}
                            {p.redFlags?.length > 0 && (
                              <Badge tone="amber">Red flags</Badge>
                            )}
                          </div>
                          {p.summary && (
                            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                              {p.summary}
                            </p>
                          )}
                          {tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {tags.slice(0, 6).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-500"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>

                      {open && (
                        <div className="space-y-3 border-t border-zinc-800 px-3.5 py-3 sm:px-4 sm:pl-10">
                          {p.triggerPhrases && (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                Coach triggers
                              </div>
                              <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                                {p.triggerPhrases}
                              </p>
                            </div>
                          )}

                          {p.body && (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                Overview
                              </div>
                              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                                {p.body}
                              </p>
                            </div>
                          )}

                          {p.followUpQuestions?.length > 0 && (
                            <div>
                              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                <Sparkles className="h-3 w-3 text-emerald-500" />
                                Ask the client
                              </div>
                              <ul className="space-y-1 text-sm text-zinc-400">
                                {p.followUpQuestions.map((fq) => (
                                  <li
                                    key={fq}
                                    className="flex gap-2 leading-snug"
                                  >
                                    <span className="text-emerald-600">·</span>
                                    <span>{fq}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {p.solutionSteps?.length > 0 && (
                            <div>
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                Coaching steps
                              </div>
                              <ol className="list-decimal space-y-1 pl-4 text-sm text-zinc-300">
                                {p.solutionSteps.map((s) => (
                                  <li key={s} className="leading-snug">
                                    {s}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {p.interventions?.length > 0 && (
                            <div>
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                Sample interventions
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {p.interventions.map((i) => (
                                  <span
                                    key={i}
                                    className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-1 text-xs text-zinc-400"
                                  >
                                    {i}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {p.redFlags?.length > 0 && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-900/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/90">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                              <div>
                                <span className="font-semibold text-amber-200">
                                  Red flags
                                </span>
                                <ul className="mt-1 space-y-0.5">
                                  {p.redFlags.map((r) => (
                                    <li key={r}>{r}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}

                          {p.contraindications && (
                            <p className="text-xs text-zinc-500">
                              <span className="font-medium text-zinc-400">
                                Caution:{" "}
                              </span>
                              {p.contraindications}
                            </p>
                          )}

                          <p className="text-[10px] text-zinc-600">
                            Coaching support only — not a medical diagnosis or
                            treatment plan.
                          </p>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
