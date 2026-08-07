"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  Mail,
  Phone,
  Ruler,
  AlertTriangle,
  Target,
  X,
  User,
  Dumbbell,
} from "lucide-react";
import { Badge, Button, Card } from "./ui";
import { formatMeasurementSummary } from "@/lib/measurements";
import { fullName } from "@/lib/utils";

export type ActiveClientDetail = {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    status: string;
    goals: string | null;
    experienceLevel: string | null;
    occupation: string | null;
    lifestyleNotes: string | null;
    medicalHistory: string | null;
    injuries: string | null;
    medications: string | null;
    contraindications: string | null;
    tags: string | null;
    dateOfBirth: string | null;
    sex: string | null;
  };
  measurements: {
    id: string;
    takenAt: Date | string | null;
    heightCm: number | null;
    weightKg: number | null;
    bodyFatPct: number | null;
    chestCm: number | null;
    waistCm: number | null;
    hipsCm: number | null;
    notes: string | null;
    metrics?: Record<string, number | string> | null;
  }[];
  assessments: {
    assessment: {
      id: string;
      takenAt: Date | string | null;
      results: Record<string, unknown>;
      summary: string | null;
      notes: string | null;
    };
    template: { name: string } | null;
  }[];
  notes: {
    id: string;
    title: string | null;
    body: string;
    kind: string;
    createdAt: Date | string | null;
  }[];
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function Field({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "default" | "warn";
}) {
  if (!children || children === "—") return null;
  return (
    <div>
      <div
        className={
          tone === "warn"
            ? "text-[10px] font-semibold uppercase tracking-wide text-amber-500/90"
            : "text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
        }
      >
        {label}
      </div>
      <div className="mt-0.5 text-sm leading-snug text-zinc-200 whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}

export function ActiveClientPanel({
  data,
  loading,
  onClear,
  expanded = true,
  onToggleExpand,
  /** Nested under home launch card — drop duplicate chrome/actions */
  embedded = false,
}: {
  data: ActiveClientDetail | null;
  loading?: boolean;
  onClear: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  embedded?: boolean;
}) {
  if (loading) {
    return (
      <Card
        className={
          embedded
            ? "border-zinc-800 bg-zinc-950/40"
            : "border-emerald-900/40 bg-emerald-950/20"
        }
      >
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 rounded bg-zinc-800" />
          <div className="h-3 w-full rounded bg-zinc-800" />
          <div className="h-3 w-3/4 rounded bg-zinc-800" />
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const { client, measurements, assessments, notes } = data;
  const latest = measurements[0];
  const recentAssessments = assessments.slice(0, 3);
  const recentNotes = notes.slice(0, 2);
  const hasFlags = !!(client.injuries || client.contraindications);

  const body = (
    <div className={embedded ? "px-1 py-1 sm:px-0" : "border-t border-emerald-900/30 px-3 py-4 sm:px-4"}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
            <Target className="h-3.5 w-3.5" aria-hidden />
            Goals & history
          </div>
          <Field label="Goals">{client.goals || null}</Field>
          <Field label="Injuries / limitations" tone="warn">
            {client.injuries || null}
          </Field>
          <Field label="Contraindications" tone="warn">
            {client.contraindications || null}
          </Field>
          <Field label="Medical history">
            {client.medicalHistory || null}
          </Field>
          <Field label="Medications">{client.medications || null}</Field>
          {!client.goals &&
            !client.injuries &&
            !client.contraindications &&
            !client.medicalHistory &&
            !client.medications && (
              <p className="text-xs text-zinc-600">No history on file yet.</p>
            )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
            <Ruler className="h-3.5 w-3.5" aria-hidden />
            Measurements
          </div>
          {!latest ? (
            <p className="text-sm text-zinc-500">None yet.</p>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
              <div className="text-[10px] text-zinc-500">
                {fmtDate(latest.takenAt)}
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-zinc-200">
                {formatMeasurementSummary(latest)}
              </p>
            </div>
          )}
          <Link
            href={`/clients/${client.id}`}
            className="inline-block text-[11px] font-medium text-emerald-400 hover:underline"
          >
            Log measurement →
          </Link>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden />
              Screens
            </div>
            <Link
              href={`/clients/${client.id}/assessments`}
              className="text-[10px] font-medium text-emerald-400 hover:underline"
            >
              Open →
            </Link>
          </div>
          {recentAssessments.length === 0 ? (
            <p className="text-sm text-zinc-500">No screens yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentAssessments.map(({ assessment, template }) => (
                <li
                  key={assessment.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 py-1.5 text-xs"
                >
                  <div className="font-medium text-zinc-200">
                    {template?.name || "Screen"}
                  </div>
                  <div className="text-[10px] text-zinc-600">
                    {fmtDate(assessment.takenAt)}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-zinc-500">
                    {assessment.summary || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {recentNotes.length > 0 && (
            <div className="pt-1">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                Notes
              </div>
              <ul className="space-y-1">
                {recentNotes.map((n) => (
                  <li
                    key={n.id}
                    className="line-clamp-2 text-xs text-zinc-500"
                  >
                    <span className="text-zinc-400">
                      {n.title || n.kind}
                    </span>
                    {" — "}
                    {n.body}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Embedded under home launch card: body only (no duplicate header CTAs)
  if (embedded) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        {hasFlags && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-900/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/90">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
            <span className="min-w-0">
              {client.injuries && (
                <span>
                  <span className="font-medium text-amber-200">Injuries: </span>
                  {client.injuries}
                </span>
              )}
              {client.injuries && client.contraindications && " · "}
              {client.contraindications && (
                <span>
                  <span className="font-medium text-amber-200">Avoid: </span>
                  {client.contraindications}
                </span>
              )}
            </span>
          </div>
        )}
        {expanded && body}
        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-300"
          >
            Hide snapshot
          </button>
        )}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden border-emerald-800/40 bg-gradient-to-br from-emerald-950/25 via-zinc-900/80 to-zinc-900/60 p-0">
      {/* Header — always visible */}
      <div className="flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-900/50 text-emerald-300 ring-1 ring-emerald-800/50">
            <User className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-50">
                {fullName(client.firstName, client.lastName)}
              </h2>
              <Badge tone="green">{client.status}</Badge>
              {client.experienceLevel && (
                <Badge className="capitalize">{client.experienceLevel}</Badge>
              )}
              {hasFlags && <Badge tone="amber">Flags</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400">
              {client.email && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Mail className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="max-w-[12rem] truncate">{client.email}</span>
                </span>
              )}
              {client.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3 shrink-0" aria-hidden />
                  {client.phone}
                </span>
              )}
              {client.occupation && <span>{client.occupation}</span>}
            </div>
            {client.goals && !expanded && (
              <p className="mt-1.5 line-clamp-1 text-xs text-zinc-500">
                {client.goals}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/programs/new?client=${client.id}`}>
            <Button type="button" size="sm" variant="secondary">
              <Dumbbell className="h-3.5 w-3.5" />
              Program
            </Button>
          </Link>
          <Link href={`/clients/${client.id}#progress`}>
            <Button type="button" size="sm" variant="ghost">
              Progress
            </Button>
          </Link>
          <Link href={`/clients/${client.id}`}>
            <Button type="button" size="sm" variant="ghost">
              <ExternalLink className="h-3.5 w-3.5" />
              Profile
            </Button>
          </Link>
          {onToggleExpand && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onToggleExpand}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span className="sr-only sm:not-sr-only sm:ml-0">
                {expanded ? "Less" : "More"}
              </span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClear}
            aria-label="Clear sticky client"
            className="text-zinc-500"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {hasFlags && (
        <div className="mx-3 mb-3 flex items-start gap-2 rounded-lg border border-amber-900/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/90 sm:mx-4">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
          <span className="min-w-0">
            {client.injuries && (
              <span>
                <span className="font-medium text-amber-200">Injuries: </span>
                {client.injuries}
              </span>
            )}
            {client.injuries && client.contraindications && " · "}
            {client.contraindications && (
              <span>
                <span className="font-medium text-amber-200">Avoid: </span>
                {client.contraindications}
              </span>
            )}
          </span>
        </div>
      )}

      {expanded && body}
    </Card>
  );
}
