"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  listAssessmentTemplatesAction,
  saveClientAssessmentAction,
} from "@/app/actions/clients";
import {
  compareAssessments,
  overallTrend,
  summarizeResults,
  type AssessmentFieldDef,
} from "@/lib/assessments";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  SectionLabel,
  Spinner,
  Textarea,
} from "./ui";
import {
  AssessmentFormFields,
  AssessmentHowTo,
} from "./assessment-form-fields";
import { ClipboardList } from "lucide-react";

type Template = {
  id: string;
  name: string;
  description: string | null;
  purpose?: string | null;
  instructions: string | null;
  fields: AssessmentFieldDef[];
  slug: string;
};

type AssessmentRow = {
  assessment: {
    id: string;
    templateId: string;
    takenAt: Date | string | null;
    results: Record<string, unknown>;
    summary: string | null;
    notes: string | null;
  };
  template: {
    id?: string;
    name: string;
    fields?: AssessmentFieldDef[] | null;
    description?: string | null;
    purpose?: string | null;
    instructions?: string | null;
  } | null;
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const trendTone = {
  improved: "green" as const,
  declined: "red" as const,
  mixed: "amber" as const,
  same: "default" as const,
  "n/a": "default" as const,
};

const changeColor: Record<string, string> = {
  improved: "text-emerald-400",
  declined: "text-red-400",
  same: "text-zinc-500",
  unknown: "text-zinc-500",
};

const trendLabel = {
  improved: "Improved vs baseline",
  declined: "Declined vs baseline",
  mixed: "Mixed vs baseline",
  same: "Unchanged vs baseline",
  "n/a": "No comparison yet",
};

export function ClientAssessmentsPanel({
  clientId,
  assessments,
}: {
  clientId: string;
  assessments: AssessmentRow[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  useEffect(() => {
    void listAssessmentTemplatesAction()
      .then((rows) => setTemplates(rows as unknown as Template[]))
      .finally(() => setTemplatesLoading(false));
  }, []);

  const byTemplate = useMemo(() => {
    const map = new Map<
      string,
      {
        templateId: string;
        name: string;
        description: string | null;
        purpose: string | null;
        instructions: string | null;
        fields: AssessmentFieldDef[];
        history: AssessmentRow["assessment"][];
      }
    >();

    for (const row of assessments) {
      const tid = row.assessment.templateId;
      const name = row.template?.name || "Assessment";
      const fields = (row.template?.fields || []) as AssessmentFieldDef[];
      if (!map.has(tid)) {
        map.set(tid, {
          templateId: tid,
          name,
          description: row.template?.description || null,
          purpose: row.template?.purpose || null,
          instructions: row.template?.instructions || null,
          fields,
          history: [],
        });
      }
      map.get(tid)!.history.push(row.assessment);
    }

    for (const t of templates) {
      if (!map.has(t.id)) {
        map.set(t.id, {
          templateId: t.id,
          name: t.name,
          description: t.description,
          purpose: t.purpose || null,
          instructions: t.instructions,
          fields: t.fields || [],
          history: [],
        });
      } else {
        const g = map.get(t.id)!;
        if ((!g.fields || !g.fields.length) && t.fields?.length) {
          g.fields = t.fields;
        }
        g.description = t.description || g.description;
        g.purpose = t.purpose || g.purpose;
        g.instructions = t.instructions || g.instructions;
        g.name = t.name || g.name;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [assessments, templates]);

  function startRetest(templateId: string, prefill?: Record<string, unknown>) {
    setOpenTemplateId(templateId);
    setError(null);
    setNotes("");
    const seed: Record<string, string> = {};
    if (prefill) {
      for (const [k, v] of Object.entries(prefill)) {
        if (v != null && v !== "") seed[k] = String(v);
      }
    }
    setResults(seed);
  }

  function saveRetest(template: {
    id: string;
    name: string;
    fields: AssessmentFieldDef[];
  }) {
    setError(null);
    startTransition(async () => {
      try {
        const fields = template.fields || [];
        const payload: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(results)) {
          if (v !== "") payload[k] = v;
        }
        const summary = summarizeResults(fields, payload);
        await saveClientAssessmentAction(
          clientId,
          template.id,
          payload,
          notes,
          summary
        );
        setOpenTemplateId(null);
        setResults({});
        setNotes("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionLabel as="h2" className="mb-1">
            Movement screens
          </SectionLabel>
          <p className="text-xs text-zinc-500">
            Expand a screen for how-to · re-test anytime · compare to baseline
          </p>
        </div>
        <Link
          href={`/?client=${clientId}`}
          className="shrink-0 text-xs font-medium text-emerald-400 hover:underline"
        >
          Ask coach about latest screens →
        </Link>
      </div>

      {error && (
        <Alert tone="error" className="mb-3 text-xs">
          {error}
        </Alert>
      )}

      {templatesLoading && byTemplate.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
          <Spinner /> Loading screens…
        </div>
      ) : byTemplate.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No screens available"
          description="Assessment templates appear here after seed. Check the app has finished starting."
          className="py-8"
        />
      ) : (
        <div className="space-y-3">
          {byTemplate.map((group) => {
            const history = [...group.history].sort((a, b) => {
              const ta = a.takenAt ? new Date(a.takenAt).getTime() : 0;
              const tb = b.takenAt ? new Date(b.takenAt).getTime() : 0;
              return tb - ta;
            });
            const latest = history[0];
            const baseline = history.length
              ? history[history.length - 1]
              : null;
            const fields = group.fields || [];
            const deltas =
              baseline && latest && baseline.id !== latest.id
                ? compareAssessments(
                    fields,
                    (baseline.results || {}) as Record<string, unknown>,
                    (latest.results || {}) as Record<string, unknown>
                  )
                : [];
            const trend = overallTrend(deltas);
            const isOpen = openTemplateId === group.templateId;
            const showHist = expandedHistory === group.templateId;
            const hasHistory = history.length > 0;

            return (
              <div
                key={group.templateId}
                className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40"
              >
                <div className="p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-zinc-100">
                        {group.name}
                      </div>
                      {group.description && (
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                          {group.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        {!hasHistory && <Badge>Not tested yet</Badge>}
                        {latest && (
                          <span className="tabular-nums">
                            Latest {fmtDate(latest.takenAt)}
                          </span>
                        )}
                        {history.length > 1 && baseline && (
                          <span className="tabular-nums">
                            · Baseline {fmtDate(baseline.takenAt)}
                          </span>
                        )}
                        {history.length > 1 && (
                          <Badge tone={trendTone[trend]}>
                            {trendLabel[trend]}
                          </Badge>
                        )}
                        {history.length === 1 && (
                          <Badge tone="green">Baseline set</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {history.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedHistory(
                              showHist ? null : group.templateId
                            )
                          }
                        >
                          {showHist
                            ? "Hide history"
                            : `History (${history.length})`}
                        </Button>
                      )}
                      {!isOpen && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          className="min-h-9 min-w-[5.5rem]"
                          onClick={() =>
                            startRetest(
                              group.templateId,
                              (latest?.results as Record<string, unknown>) ||
                                undefined
                            )
                          }
                        >
                          {hasHistory ? "Re-test" : "Run screen"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {!isOpen && (
                    <div className="mt-3">
                      <AssessmentHowTo
                        description={null}
                        purpose={group.purpose}
                        instructions={group.instructions}
                        defaultOpen={!hasHistory}
                      />
                    </div>
                  )}

                  {latest && !isOpen && (
                    <div className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Latest result
                      </div>
                      <div className="mt-0.5">
                        {latest.summary ||
                          summarizeResults(
                            fields,
                            (latest.results || {}) as Record<string, unknown>
                          ) ||
                          "—"}
                      </div>
                    </div>
                  )}

                  {deltas.length > 0 && !isOpen && (
                    <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-900/80 text-zinc-500">
                          <tr>
                            <th className="px-2.5 py-2 font-medium">Field</th>
                            <th className="px-2.5 py-2 font-medium">Baseline</th>
                            <th className="px-2.5 py-2 font-medium">Latest</th>
                            <th className="px-2.5 py-2 font-medium">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deltas.map((d) => (
                            <tr
                              key={d.key}
                              className="border-t border-zinc-800/80"
                            >
                              <td className="px-2.5 py-1.5 text-zinc-300">
                                {d.label}
                              </td>
                              <td className="px-2.5 py-1.5 tabular-nums text-zinc-500">
                                {d.baseline}
                              </td>
                              <td className="px-2.5 py-1.5 tabular-nums text-zinc-200">
                                {d.latest}
                              </td>
                              <td
                                className={`px-2.5 py-1.5 capitalize ${changeColor[d.change]}`}
                              >
                                {d.change}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {showHist && (
                    <ul className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
                      {history.map((h, idx) => (
                        <li
                          key={h.id}
                          className="flex w-full items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium tabular-nums text-zinc-100">
                                {fmtDate(h.takenAt)}
                              </span>
                              {idx === history.length - 1 && (
                                <Badge>baseline</Badge>
                              )}
                              {idx === 0 && history.length > 1 && (
                                <Badge tone="green">latest</Badge>
                              )}
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                              {h.summary || JSON.stringify(h.results)}
                            </div>
                            {h.notes && (
                              <div className="mt-0.5 text-[11px] text-zinc-600">
                                Note: {h.notes}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {isOpen && (
                  <div className="space-y-3 border-t border-emerald-900/40 bg-emerald-950/15 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                        {hasHistory ? "New re-test" : "First screen"}
                      </div>
                    </div>
                    <AssessmentHowTo
                      purpose={group.purpose}
                      instructions={group.instructions}
                      defaultOpen
                    />
                    <AssessmentFormFields
                      fields={fields}
                      values={results}
                      onChange={(key, value) =>
                        setResults((r) => ({ ...r, [key]: value }))
                      }
                    />
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Session notes
                      </label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Pain? cues? environment?"
                        className="min-h-[64px]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() =>
                          saveRetest({
                            id: group.templateId,
                            name: group.name,
                            fields,
                          })
                        }
                        loading={pending}
                      >
                        Save screen
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setOpenTemplateId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
