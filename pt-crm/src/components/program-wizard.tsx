"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import {
  createProgramFromWizardAction,
  previewProgramAction,
  type CreateProgramInput,
} from "@/app/actions/programs";
import { listClientsAction } from "@/app/actions/clients";
import type { BuiltProgram, ProgramGoal } from "@/lib/program-builder";
import { groupExercisesIntoBlocks } from "@/lib/exercise-groups";
import {
  getMesocycleWeek,
  MESOCYCLE_WEEK_OPTIONS,
} from "@/lib/mesocycle";
import {
  formatGroupBadge,
  formatGroupRoleTitle,
  formatGroupTitle,
  formatPrescription,
  formatRestLabel,
  formatSchemeName,
} from "@/lib/workout-labels";
import { cn, fullName } from "@/lib/utils";
import { FocusShell } from "@/components/page-shell";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Label,
  SectionLabel,
  Textarea,
} from "./ui";

type ClientOpt = {
  id: string;
  firstName: string;
  lastName: string;
  goals: string | null;
  experienceLevel: string | null;
  injuries: string | null;
};

const GOALS: { value: ProgramGoal; label: string; hint: string }[] = [
  {
    value: "general",
    label: "General fitness",
    hint: "Balanced mix — good default",
  },
  {
    value: "strength",
    label: "Strength",
    hint: "Heavier compounds, lower reps",
  },
  {
    value: "hypertrophy",
    label: "Build muscle",
    hint: "More volume, pump work",
  },
  {
    value: "fat_loss",
    label: "Fat loss / conditioning",
    hint: "Density and work capacity",
  },
  {
    value: "mobility",
    label: "Mobility focus",
    hint: "Extra prep and control",
  },
];

const STEPS = ["Basics", "Constraints", "Preview"] as const;

const DAYS_OPTIONS = [2, 3, 4, 5, 6] as const;
const MINUTES_OPTIONS = [30, 45, 60, 75] as const;
const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

const selectClass =
  "min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

const chipBase =
  "min-h-11 rounded-lg border px-3.5 py-2 text-sm tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70";

function chipClass(selected: boolean, className?: string) {
  return cn(
    chipBase,
    selected
      ? "border-emerald-600 bg-emerald-950/40 text-emerald-100 ring-1 ring-emerald-500/40"
      : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
    className
  );
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
}

/** schemeMix: { scheme, count }[] or Record<string, number> */
function asSchemeMix(v: unknown): { scheme: string; count: number }[] {
  if (Array.isArray(v)) {
    return v
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const r = row as { scheme?: unknown; count?: unknown };
        const scheme = typeof r.scheme === "string" ? r.scheme : null;
        const count =
          typeof r.count === "number" && Number.isFinite(r.count)
            ? r.count
            : null;
        if (!scheme || count == null) return null;
        return { scheme, count };
      })
      .filter((x): x is { scheme: string; count: number } => x != null);
  }
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .filter(([, n]) => typeof n === "number")
      .map(([scheme, count]) => ({ scheme, count: count as number }));
  }
  return [];
}

export function ProgramWizard({
  initialClientId,
  initialGoal,
  initialDaysPerWeek,
  initialSessionMinutes,
  initialExperience,
  initialPreferMobility,
  initialNotes,
}: {
  initialClientId?: string | null;
  initialGoal?: CreateProgramInput["goal"];
  initialDaysPerWeek?: number;
  initialSessionMinutes?: number;
  initialExperience?: string;
  initialPreferMobility?: boolean;
  initialNotes?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<BuiltProgram | null>(null);
  const [variationSeed, setVariationSeed] = useState(0);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const errorRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<CreateProgramInput>({
    clientId: initialClientId || null,
    title: "",
    goal: initialGoal || "general",
    daysPerWeek: initialDaysPerWeek || 3,
    sessionMinutes: initialSessionMinutes || 45,
    experienceLevel: initialExperience || "intermediate",
    notes: initialNotes || "",
    preferMobility: !!initialPreferMobility,
    activate: true,
    mesocycleWeek: 1,
  });

  useEffect(() => {
    void listClientsAction().then((rows) => {
      setClients(rows as ClientOpt[]);
      if (initialClientId) {
        const c = rows.find((x) => x.id === initialClientId) as
          | ClientOpt
          | undefined;
        if (c?.experienceLevel && !initialExperience) {
          setForm((f) => ({
            ...f,
            experienceLevel: c.experienceLevel || f.experienceLevel,
          }));
        }
        if (
          !initialPreferMobility &&
          c?.injuries &&
          /shoulder|mobility|scratch/i.test(c.injuries)
        ) {
          setForm((f) => ({ ...f, preferMobility: true }));
        }
      }
    });
  }, [initialClientId, initialExperience, initialPreferMobility]);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [error]);

  const selectedClient = clients.find((c) => c.id === form.clientId);

  const subtitle = useMemo(() => {
    if (selectedClient) {
      return `Building for ${fullName(
        selectedClient.firstName,
        selectedClient.lastName
      )} — split, schemes, and load from their profile and your floor gear.`;
    }
    return "Three steps: goal & days → constraints → preview. Link a client anytime for goals and injuries.";
  }, [selectedClient]);

  function initExpandedDays(draft: BuiltProgram) {
    const many = draft.days.length > 3;
    const next: Record<string, boolean> = {};
    draft.days.forEach((d, i) => {
      next[d.id] = many ? i === 0 : true;
    });
    setExpandedDays(next);
  }

  function runPreview(opts?: { regenerate?: boolean }) {
    if (pending) return;
    setError(null);
    setMsg(null);
    const seed = opts?.regenerate
      ? Date.now() + Math.floor(Math.random() * 1000)
      : variationSeed;
    if (opts?.regenerate) setVariationSeed(seed);

    startTransition(async () => {
      try {
        const draft = await previewProgramAction({
          ...form,
          variationSeed: seed,
        });
        setPreview(draft);
        initExpandedDays(draft);
        setStep(2);
        if (opts?.regenerate) {
          setMsg("New variation ready — skim schemes under each exercise.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Preview failed");
      }
    });
  }

  function save() {
    if (pending) return;
    setError(null);
    setMsg(null);
    startTransition(async () => {
      try {
        const { programId } = await createProgramFromWizardAction({
          ...form,
          title: form.title || preview?.title,
          variationSeed,
        });
        router.push(`/programs/${programId}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  const schemeCounts = preview
    ? preview.days
        .flatMap((d) => d.exercises)
        .reduce<Record<string, number>>((acc, ex) => {
          const k = ex.setScheme || "straight";
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {})
    : {};

  function setGoal(goal: ProgramGoal) {
    setForm((f) => ({ ...f, goal }));
  }

  function toggleDay(dayId: string) {
    setExpandedDays((prev) => ({ ...prev, [dayId]: !prev[dayId] }));
  }

  const mesoWeek = form.mesocycleWeek ?? 1;
  const mesoPlan = getMesocycleWeek(mesoWeek);

  const generationNotes = preview
    ? asStringList(preview.meta.generationNotes)
    : [];
  const splitRationale = preview ? asString(preview.meta.splitRationale) : null;
  const schemeMixMeta = preview ? asSchemeMix(preview.meta.schemeMix) : [];
  const estimatedMinutes = preview
    ? asNumber(preview.meta.estimatedMinutesPerDay)
    : null;
  const constraintSummary = preview
    ? asString(preview.meta.constraintSummary)
    : null;
  const hasWhyCard =
    !!preview &&
    !!(
      generationNotes.length ||
      splitRationale ||
      schemeMixMeta.length ||
      estimatedMinutes != null ||
      constraintSummary
    );

  return (
    <FocusShell floorFooter={step === 2 && !!preview} className="space-y-4">
      <div>
        <p className="section-label mb-1 text-emerald-500/90">Programs</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Design program
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>

      {/* Step indicator */}
      <nav
        aria-label="Wizard steps"
        className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-950/40 p-1"
      >
        {STEPS.map((label, i) => {
          const active = i === step;
          const done = i < step;
          const locked = i > step || (i === 2 && !preview);
          return (
            <button
              key={label}
              type="button"
              disabled={locked}
              onClick={() => {
                if (i <= step && !(i === 2 && !preview)) setStep(i);
              }}
              className={cn(
                "relative flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm",
                active
                  ? "bg-emerald-950/60 text-emerald-200 ring-1 ring-emerald-700/50"
                  : done
                    ? "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    : "text-zinc-600",
                locked && "cursor-not-allowed opacity-50"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-emerald-600 text-white"
                    : done
                      ? "bg-zinc-700 text-zinc-200"
                      : "bg-zinc-800 text-zinc-500"
                )}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
              </span>
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      <div ref={errorRef}>
        {error && (
          <Alert tone="error" className="mb-0">
            {error}
          </Alert>
        )}
        {msg && !error && (
          <Alert tone="success" className="mb-0">
            {msg}
          </Alert>
        )}
      </div>

      {step === 0 && (
        <Card className="space-y-5">
          <div>
            <Label htmlFor="pw-client">Client (optional)</Label>
            <select
              id="pw-client"
              className={selectClass}
              value={form.clientId || ""}
              onChange={(e) => {
                const clientId = e.target.value || null;
                const c = clients.find((x) => x.id === clientId);
                setForm((f) => ({
                  ...f,
                  clientId,
                  experienceLevel: c?.experienceLevel || f.experienceLevel,
                  preferMobility:
                    f.preferMobility ||
                    (!!c?.injuries &&
                      /shoulder|mobility|scratch/i.test(c.injuries)),
                }));
              }}
            >
              <option value="">— Template / no client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c.firstName, c.lastName)}
                </option>
              ))}
            </select>
            {selectedClient && (selectedClient.goals || selectedClient.injuries) && (
              <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3">
                {selectedClient.goals && (
                  <p className="min-w-0 flex-1 text-xs leading-snug text-emerald-200/90">
                    <span className="font-semibold text-emerald-400/90">
                      Goals ·{" "}
                    </span>
                    {selectedClient.goals}
                  </p>
                )}
                {selectedClient.injuries && (
                  <p className="min-w-0 flex-1 text-xs leading-snug text-amber-200/90">
                    <span className="font-semibold text-amber-400/90">
                      Watch ·{" "}
                    </span>
                    {selectedClient.injuries}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="pw-title">Title (optional)</Label>
            <Input
              id="pw-title"
              placeholder="Leave blank to auto-name from goal + days"
              value={form.title || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </div>

          <div>
            <SectionLabel className="mb-1.5">Primary goal</SectionLabel>
            <p className="mb-2 text-[11px] leading-snug text-zinc-500">
              Shapes split emphasis and set schemes — you can tweak after save.
            </p>
            <div
              className="grid gap-2 sm:grid-cols-2"
              role="group"
              aria-label="Primary goal"
            >
              {GOALS.map((g) => {
                const selected = form.goal === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setGoal(g.value);
                    }}
                    className={cn(
                      "min-h-11 rounded-lg border px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
                      selected
                        ? "border-emerald-500 bg-emerald-950/50 text-emerald-50 ring-2 ring-emerald-500/35"
                        : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900/80"
                    )}
                  >
                    <div className="font-medium">{g.label}</div>
                    <div
                      className={cn(
                        "mt-0.5 text-[11px] leading-snug",
                        selected ? "text-emerald-200/70" : "text-zinc-500"
                      )}
                    >
                      {g.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <SectionLabel className="mb-1.5">Days / week</SectionLabel>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Days per week"
              >
                {DAYS_OPTIONS.map((n) => {
                  const selected = form.daysPerWeek === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setForm((f) => ({ ...f, daysPerWeek: n }))
                      }
                      className={chipClass(selected, "min-w-[3.25rem]")}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <SectionLabel className="mb-1.5">Session length</SectionLabel>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Session minutes"
              >
                {MINUTES_OPTIONS.map((n) => {
                  const selected = form.sessionMinutes === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setForm((f) => ({ ...f, sessionMinutes: n }))
                      }
                      className={chipClass(selected)}
                    >
                      {n} min
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <SectionLabel className="mb-1.5">Experience</SectionLabel>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Experience level"
            >
              {EXPERIENCE_OPTIONS.map((opt) => {
                const selected =
                  (form.experienceLevel || "intermediate") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        experienceLevel: opt.value,
                      }))
                    }
                    className={chipClass(selected)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end border-t border-zinc-800 pt-4">
            <Button
              type="button"
              onClick={() => setStep(1)}
              disabled={pending}
              className="min-h-11"
            >
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-5">
          {selectedClient &&
            (selectedClient.goals || selectedClient.injuries) && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
                <SectionLabel className="mb-1.5 text-zinc-500">
                  From {fullName(selectedClient.firstName, selectedClient.lastName)}
                </SectionLabel>
                <ul className="space-y-1 text-xs leading-snug text-zinc-400">
                  {selectedClient.goals && (
                    <li>
                      <span className="text-emerald-400/90">Goals · </span>
                      {selectedClient.goals}
                    </li>
                  )}
                  {selectedClient.injuries && (
                    <li>
                      <span className="text-amber-400/90">Constraints · </span>
                      {selectedClient.injuries}
                    </li>
                  )}
                </ul>
              </div>
            )}

          <button
            type="button"
            role="switch"
            aria-checked={!!form.preferMobility}
            onClick={() =>
              setForm((f) => ({
                ...f,
                preferMobility: !f.preferMobility,
              }))
            }
            className={cn(
              "flex min-h-11 w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
              form.preferMobility
                ? "border-emerald-600/60 bg-emerald-950/30"
                : "border-zinc-700 bg-zinc-900/60 hover:border-zinc-600"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
                form.preferMobility
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : "border-zinc-600 bg-zinc-950"
              )}
            >
              {form.preferMobility && (
                <Check className="h-3 w-3" strokeWidth={2.5} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-100">
                Prefer mobility & warm-up work
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                Extra prep and control — useful with shoulder or movement limits.
              </span>
            </span>
          </button>

          <div>
            <SectionLabel className="mb-1.5">Training week</SectionLabel>
            <p className="mb-2 text-[11px] leading-snug text-zinc-500">
              Week in the block — scales volume and RPE (W4–6 often taper / deload).
            </p>
            <div
              className="grid grid-cols-3 gap-2 sm:grid-cols-6"
              role="group"
              aria-label="Mesocycle week"
            >
              {MESOCYCLE_WEEK_OPTIONS.map((opt) => {
                const selected = mesoWeek === opt.value;
                const plan = getMesocycleWeek(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={selected}
                    title={plan.notes}
                    onClick={() =>
                      setForm((f) => ({ ...f, mesocycleWeek: opt.value }))
                    }
                    className={cn(
                      "min-h-11 rounded-lg border px-2 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
                      selected
                        ? plan.isDeload
                          ? "border-amber-600 bg-amber-950/40 text-amber-100 ring-1 ring-amber-500/40"
                          : "border-emerald-600 bg-emerald-950/40 text-emerald-100 ring-1 ring-emerald-500/40"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    )}
                  >
                    <span className="block text-xs font-medium tabular-nums">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
              {mesoPlan.notes}
              {mesoPlan.isDeload && (
                <span className="ml-1 font-medium text-amber-400/90">
                  · Deload volume
                </span>
              )}
            </p>
          </div>

          <div>
            <Label htmlFor="pw-notes">Notes for the builder</Label>
            <Textarea
              id="pw-notes"
              placeholder="e.g. no back squat, prefer dumbbells, short Tuesdays, avoid overhead press…"
              value={form.notes || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/50"
              checked={!!form.activate}
              onChange={(e) =>
                setForm((f) => ({ ...f, activate: e.target.checked }))
              }
            />
            Mark active when saved
          </label>

          <div className="flex justify-between gap-2 border-t border-zinc-800 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(0)}
              disabled={pending}
              className="min-h-11"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={() => runPreview()}
              loading={pending}
              disabled={pending}
              className="min-h-11"
            >
              {pending ? "Building…" : "Generate preview"}
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && preview && (
        <div
          className="space-y-4 pb-4"
          key={String(preview.meta.variationSeed ?? 0)}
        >
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-400/80">
                  Preview
                </p>
                <h2 className="mt-0.5 text-lg font-semibold text-zinc-50">
                  {preview.title}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  <span className="capitalize">
                    {preview.splitType.replace(/_/g, " ")}
                  </span>
                  {" · "}
                  <span className="tabular-nums">{preview.daysPerWeek}</span>
                  ×/wk ·{" "}
                  <span className="tabular-nums">
                    {preview.sessionMinutes}
                  </span>{" "}
                  min
                  {estimatedMinutes != null && (
                    <>
                      {" · ~"}
                      <span className="tabular-nums">{estimatedMinutes}</span>
                      {" min/day"}
                    </>
                  )}
                </p>
              </div>
              <Badge tone="green" className="capitalize">
                {preview.goal.replace(/_/g, " ")}
              </Badge>
            </div>
            {preview.notes && (
              <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-400">
                {preview.notes}
              </p>
            )}

            {/* Scheme mix — compact */}
            {Object.keys(schemeCounts).length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-zinc-500">
                  Schemes
                </span>
                {Object.entries(schemeCounts).map(([id, count]) => (
                  <Badge
                    key={id}
                    tone={id === "straight" ? "default" : "amber"}
                  >
                    {formatSchemeName(id)}{" "}
                    <span className="tabular-nums">×{count}</span>
                  </Badge>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-zinc-600">
              Swap or edit exercises after you save.
            </p>
          </Card>

          {/* Why this plan */}
          {hasWhyCard && (
            <Card className="border-emerald-900/30 bg-emerald-950/10">
              <SectionLabel className="mb-2 text-emerald-400/80">
                Why this plan
              </SectionLabel>
              <div className="space-y-2 text-xs leading-snug text-zinc-400">
                {splitRationale && (
                  <p>
                    <span className="font-medium text-zinc-300">Split · </span>
                    {splitRationale}
                  </p>
                )}
                {generationNotes.length > 0 && (
                  <ul className="list-none space-y-1">
                    {generationNotes.map((note) => (
                      <li key={note.slice(0, 48)}>
                        <span className="text-zinc-600">· </span>
                        {note}
                      </li>
                    ))}
                  </ul>
                )}
                {schemeMixMeta.length > 0 && (
                  <p>
                    <span className="font-medium text-zinc-300">
                      Schemes ·{" "}
                    </span>
                    {schemeMixMeta
                      .map((s) => `${s.scheme.replace(/_/g, " ")} ×${s.count}`)
                      .join(" · ")}
                  </p>
                )}
                {estimatedMinutes != null && (
                  <p>
                    <span className="font-medium text-zinc-300">
                      Session estimate ·{" "}
                    </span>
                    <span className="tabular-nums">{estimatedMinutes}</span> min
                    / day
                  </p>
                )}
                {constraintSummary && (
                  <p className="border-t border-emerald-900/25 pt-2 text-zinc-500">
                    {constraintSummary}
                  </p>
                )}
              </div>
              {(() => {
                const meso = preview.meta.mesocycle as
                  | { label?: string; week?: number; notes?: string }
                  | undefined;
                const correctiveIds = Array.isArray(preview.meta.correctiveIds)
                  ? (preview.meta.correctiveIds as unknown[])
                  : [];
                const weekLabel =
                  meso?.label ||
                  (typeof preview.meta.mesocycleWeek === "number"
                    ? getMesocycleWeek(preview.meta.mesocycleWeek).label
                    : null);
                if (!weekLabel && correctiveIds.length === 0 && !meso?.notes) {
                  return null;
                }
                return (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-emerald-900/25 pt-2.5">
                    {weekLabel ? (
                      <Badge tone="green">{weekLabel}</Badge>
                    ) : null}
                    {correctiveIds.length > 0 ? (
                      <Badge tone="amber">
                        <span className="tabular-nums">
                          {correctiveIds.length}
                        </span>{" "}
                        corrective
                        {correctiveIds.length === 1 ? "" : "s"}
                      </Badge>
                    ) : null}
                    {meso?.notes ? (
                      <span className="text-[11px] text-zinc-500">
                        {meso.notes}
                      </span>
                    ) : null}
                  </div>
                );
              })()}
            </Card>
          )}

          {/* Fallback constraint / meso when Why card fields absent */}
          {!hasWhyCard &&
            (() => {
              const meso = preview.meta.mesocycle as
                | { label?: string; week?: number; notes?: string }
                | undefined;
              const correctiveIds = Array.isArray(preview.meta.correctiveIds)
                ? (preview.meta.correctiveIds as unknown[])
                : [];
              const weekLabel =
                meso?.label ||
                (typeof preview.meta.mesocycleWeek === "number"
                  ? getMesocycleWeek(preview.meta.mesocycleWeek).label
                  : null);
              if (!constraintSummary && !meso) return null;
              return (
                <Card className="border-emerald-900/30 bg-emerald-950/10">
                  <SectionLabel className="mb-2 text-emerald-400/80">
                    Plan context
                  </SectionLabel>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {weekLabel ? (
                      <Badge tone="green">{weekLabel}</Badge>
                    ) : null}
                    {correctiveIds.length > 0 ? (
                      <Badge tone="amber">
                        <span className="tabular-nums">
                          {correctiveIds.length}
                        </span>{" "}
                        corrective
                        {correctiveIds.length === 1 ? "" : "s"}
                      </Badge>
                    ) : null}
                  </div>
                  {constraintSummary ? (
                    <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">
                      {constraintSummary}
                    </p>
                  ) : null}
                  {meso?.notes ? (
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {meso.notes}
                    </p>
                  ) : null}
                </Card>
              );
            })()}

          {preview.days.map((day) => {
            const blocks = groupExercisesIntoBlocks(day.exercises);
            const open = expandedDays[day.id] ?? false;
            const exCount = day.exercises.length;
            return (
              <Card key={day.id} padding="none" className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleDay(day.id)}
                  className="flex min-h-11 w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-zinc-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/50"
                  aria-expanded={open}
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-100">{day.name}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {day.focus}
                      <span className="mx-1.5 text-zinc-700">·</span>
                      <span className="tabular-nums">{exCount}</span> exercise
                      {exCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="space-y-3 border-t border-zinc-800 px-4 py-3 text-sm">
                    {blocks.map((block) => {
                      if (block.type === "group") {
                        return (
                          <div
                            key={block.groupId}
                            className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-2.5"
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge tone="amber">
                                {formatSchemeName(block.kind)}
                              </Badge>
                              <span className="text-xs font-semibold text-zinc-100">
                                {formatGroupTitle(block.kind, block.label)}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                <span className="tabular-nums">
                                  {block.rounds}
                                </span>{" "}
                                rounds ·{" "}
                                {formatRestLabel(block.restBetweenRoundsSec)}{" "}
                                between rounds
                              </span>
                            </div>
                            {block.howTo && (
                              <p className="mb-2 text-[11px] leading-snug text-zinc-500">
                                {block.howTo}
                              </p>
                            )}
                            <ol className="space-y-1.5">
                              {block.members.map((ex, mi) => (
                                <li
                                  key={ex.id}
                                  className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-2"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="flex items-start gap-2">
                                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-950/50 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-800/40">
                                        {formatGroupBadge(ex.groupRole, mi)}
                                      </span>
                                      <div>
                                        <div className="font-medium text-zinc-100">
                                          {ex.exerciseName}
                                        </div>
                                        {formatGroupRoleTitle(ex.groupRole) && (
                                          <div className="text-[11px] text-amber-200/70">
                                            {formatGroupRoleTitle(ex.groupRole)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-[11px] tabular-nums text-zinc-400">
                                      {formatPrescription({
                                        sets: ex.sets,
                                        reps: ex.reps,
                                        rpe: ex.rpe,
                                      })}
                                    </span>
                                  </div>
                                  <div className="mt-1 pl-8 text-[11px] text-zinc-500">
                                    {mi < block.members.length - 1
                                      ? `${formatRestLabel(ex.restAfterSec ?? 15)} before next`
                                      : `${formatRestLabel(
                                          ex.restBetweenRoundsSec ??
                                            block.restBetweenRoundsSec
                                        )} after round`}
                                  </div>
                                </li>
                              ))}
                            </ol>
                          </div>
                        );
                      }

                      const ex = block.exercise;
                      return (
                        <div
                          key={ex.id}
                          className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-2.5 py-2"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="font-medium text-zinc-100">
                              {ex.isWarmup && (
                                <span className="mr-1.5 text-[10px] font-semibold uppercase text-emerald-400">
                                  Warm-up
                                </span>
                              )}
                              {ex.exerciseName}
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge
                              tone={
                                ex.setScheme && ex.setScheme !== "straight"
                                  ? "amber"
                                  : "default"
                              }
                            >
                              {formatSchemeName(ex.setScheme)}
                            </Badge>
                            <span className="text-[11px] tabular-nums text-zinc-500">
                              {formatPrescription({
                                sets: ex.sets,
                                reps: ex.reps,
                                rpe: ex.rpe,
                                summary: ex.setSchemeMeta?.summary,
                              })}
                              {ex.restSec
                                ? ` · ${formatRestLabel(ex.restSec)}`
                                : ""}
                            </span>
                          </div>
                          {ex.setSchemeMeta?.howTo && (
                            <p className="mt-1 text-[11px] leading-snug text-zinc-600">
                              {ex.setSchemeMeta.howTo}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Sticky floor actions */}
          <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:bottom-0 md:pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={pending}
                className="min-h-11 shrink-0"
              >
                Back
              </Button>
              <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => runPreview({ regenerate: true })}
                  loading={pending}
                  disabled={pending}
                  className="min-h-11"
                >
                  {pending ? "…" : "Try again"}
                </Button>
                <Button
                  type="button"
                  onClick={save}
                  loading={pending}
                  disabled={pending}
                  className="min-h-11 flex-1 sm:flex-initial"
                >
                  {pending ? "Saving…" : "Save program"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </FocusShell>
  );
}
