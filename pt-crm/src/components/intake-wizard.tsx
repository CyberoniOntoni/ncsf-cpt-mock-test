"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addClientMeasurementAction,
  createDraftClientAction,
  finalizeClientAction,
  listAssessmentTemplatesAction,
  saveClientAssessmentAction,
  updateClientBasicsAction,
  updateClientHistoryAction,
  type IntakeBasics,
  type IntakeHistory,
  type IntakeMeasurement,
} from "@/app/actions/clients";
import {
  summarizeResults,
  type AssessmentFieldDef,
} from "@/lib/assessments";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Label,
  Textarea,
} from "./ui";
import {
  AssessmentFormFields,
  AssessmentHowTo,
} from "./assessment-form-fields";
import { ClientEquipmentPicker } from "./client-equipment-picker";

type Template = {
  id: string;
  name: string;
  description: string | null;
  purpose?: string | null;
  instructions: string | null;
  fields: AssessmentFieldDef[];
  slug: string;
};

const steps = [
  "Basics",
  "Goals & history",
  "Measurements",
  "Assessments",
  "Review",
] as const;

export function IntakeWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [completedAssessments, setCompletedAssessments] = useState<string[]>([]);
  const [openAssessmentId, setOpenAssessmentId] = useState<string | null>(null);

  const [basics, setBasics] = useState<IntakeBasics>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    sex: "",
    emergencyContact: "",
  });
  const [history, setHistory] = useState<IntakeHistory>({
    goals: "",
    experienceLevel: "",
    occupation: "",
    lifestyleNotes: "",
    medicalHistory: "",
    injuries: "",
    medications: "",
    contraindications: "",
  });
  const [measurement, setMeasurement] = useState<IntakeMeasurement>({});
  const [assessmentResults, setAssessmentResults] = useState<
    Record<string, Record<string, string>>
  >({});

  useEffect(() => {
    void listAssessmentTemplatesAction()
      .then((rows) => setTemplates(rows as unknown as Template[]))
      .catch((err) => console.error(err))
      .finally(() => setTemplatesLoading(false));
  }, []);

  async function nextFromBasics() {
    if (!basics.firstName.trim()) {
      setError("First name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!clientId) {
        const { clientId: id } = await createDraftClientAction(basics);
        setClientId(id);
      } else {
        await updateClientBasicsAction(clientId, basics);
      }
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function nextFromHistory() {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      await updateClientHistoryAction(clientId, history);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function nextFromMeasurements() {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      const hasAny = Object.values(measurement).some(
        (v) => v !== undefined && v !== null && v !== ""
      );
      if (hasAny) {
        await addClientMeasurementAction(clientId, measurement);
      }
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveAssessment(template: Template) {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      const results = assessmentResults[template.id] || {};
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(results)) {
        if (v !== "") payload[k] = v;
      }
      const summary = summarizeResults(template.fields || [], payload);
      await saveClientAssessmentAction(
        clientId,
        template.id,
        payload,
        undefined,
        summary
      );
      setCompletedAssessments((a) => [...new Set([...a, template.id])]);
      setOpenAssessmentId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      await finalizeClientAction(clientId);
      router.push(`/?client=${clientId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-pad mx-auto w-full max-w-2xl animate-in">
      <h1 className="text-2xl font-semibold tracking-tight">New client</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Guided intake — save progress step by step. Screens are optional.
      </p>

      {/* Step progress */}
      <div className="mt-5">
        <div className="flex gap-1">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition ${
                i < step
                  ? "bg-emerald-600"
                  : i === step
                    ? "bg-emerald-500"
                    : "bg-zinc-800"
              }`}
              title={s}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {steps.map((s, i) => (
            <Badge
              key={s}
              tone={i === step ? "green" : i < step ? "default" : "default"}
              className={i > step ? "opacity-50" : ""}
            >
              {i + 1}. {s}
            </Badge>
          ))}
        </div>
      </div>

      {error && (
        <Alert tone="error" className="mt-4 text-sm">
          {error}
        </Alert>
      )}

      <Card className="mt-4">
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Minimum: first name. Contact details help you find them later.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First name *</Label>
                <Input
                  value={basics.firstName}
                  onChange={(e) =>
                    setBasics({ ...basics, firstName: e.target.value })
                  }
                  autoFocus
                  placeholder="Alex"
                />
              </div>
              <div>
                <Label>Last name</Label>
                <Input
                  value={basics.lastName}
                  onChange={(e) =>
                    setBasics({ ...basics, lastName: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={basics.email}
                  onChange={(e) =>
                    setBasics({ ...basics, email: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={basics.phone}
                  onChange={(e) =>
                    setBasics({ ...basics, phone: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date of birth</Label>
                <Input
                  type="date"
                  value={basics.dateOfBirth || ""}
                  onChange={(e) =>
                    setBasics({ ...basics, dateOfBirth: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Sex</Label>
                <Input
                  value={basics.sex}
                  onChange={(e) =>
                    setBasics({ ...basics, sex: e.target.value })
                  }
                  placeholder="optional"
                />
              </div>
            </div>
            <div>
              <Label>Emergency contact</Label>
              <Input
                value={basics.emergencyContact}
                onChange={(e) =>
                  setBasics({ ...basics, emergencyContact: e.target.value })
                }
                placeholder="Name · phone"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => void nextFromBasics()}
                loading={busy}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Training goals and history — used by Coach and program design.
            </p>
            <div>
              <Label>Goals</Label>
              <Textarea
                value={history.goals}
                onChange={(e) =>
                  setHistory({ ...history, goals: e.target.value })
                }
                placeholder="e.g. get stronger for trail running, lose 5 kg, fix left knee pain with squats"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Experience</Label>
                <select
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={history.experienceLevel || ""}
                  onChange={(e) =>
                    setHistory({
                      ...history,
                      experienceLevel: e.target.value,
                    })
                  }
                >
                  <option value="">— Select —</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="returning">Returning after break</option>
                </select>
              </div>
              <div>
                <Label>Occupation</Label>
                <Input
                  value={history.occupation}
                  onChange={(e) =>
                    setHistory({ ...history, occupation: e.target.value })
                  }
                  placeholder="Desk job, retail, etc."
                />
              </div>
            </div>
            <div>
              <Label>Injuries / limitations</Label>
              <Textarea
                value={history.injuries}
                onChange={(e) =>
                  setHistory({ ...history, injuries: e.target.value })
                }
                placeholder="Current or past issues that change programming"
              />
            </div>
            <div>
              <Label>Medical history</Label>
              <Textarea
                value={history.medicalHistory}
                onChange={(e) =>
                  setHistory({ ...history, medicalHistory: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Medications</Label>
              <Input
                value={history.medications}
                onChange={(e) =>
                  setHistory({ ...history, medications: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Contraindications</Label>
              <Textarea
                value={history.contraindications}
                onChange={(e) =>
                  setHistory({
                    ...history,
                    contraindications: e.target.value,
                  })
                }
                placeholder="Anything the client or GP asked you to avoid"
              />
            </div>
            <p className="text-xs text-zinc-600">
              Medical fields are coaching context only — not clinical records.
            </p>
            {clientId && (
              <ClientEquipmentPicker
                clientId={clientId}
                clientName={basics.firstName}
                compact
              />
            )}
            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                type="button"
                onClick={() => void nextFromHistory()}
                loading={busy}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              Optional baseline measurements — skip if you&apos;ll measure later.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["heightCm", "Height (cm)"],
                  ["weightKg", "Weight (kg)"],
                  ["bodyFatPct", "Body fat %"],
                  ["chestCm", "Chest (cm)"],
                  ["waistCm", "Waist (cm)"],
                  ["hipsCm", "Hips (cm)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={measurement[key] ?? ""}
                    onChange={(e) =>
                      setMeasurement({
                        ...measurement,
                        [key]:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              More girths (biceps, wrist, thigh…) can be logged anytime from the
              client profile.
            </p>
            <div>
              <Label>Notes</Label>
              <Input
                value={measurement.notes || ""}
                onChange={(e) =>
                  setMeasurement({ ...measurement, notes: e.target.value })
                }
                placeholder="Scale used, time of day, etc."
              />
            </div>
            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(3)}
                >
                  Skip
                </Button>
                <Button
                  type="button"
                  onClick={() => void nextFromMeasurements()}
                  loading={busy}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-zinc-300">
                Movement screens (optional)
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Open a screen, follow the how-to, save results. You can re-test
                anytime from the client profile. Skip all if you prefer.
              </p>
            </div>

            {templatesLoading && (
              <p className="text-sm text-zinc-500">Loading screens…</p>
            )}

            {!templatesLoading && templates.length === 0 && (
              <p className="text-sm text-zinc-500">
                No templates available yet. Continue without screens.
              </p>
            )}

            <div className="space-y-2">
              {templates.map((t) => {
                const done = completedAssessments.includes(t.id);
                const open = openAssessmentId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`overflow-hidden rounded-xl border ${
                      open
                        ? "border-emerald-800/50 bg-emerald-950/10"
                        : "border-zinc-800 bg-zinc-950/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-zinc-100">{t.name}</div>
                        {t.description && (
                          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                            {t.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {done && <Badge tone="green">Saved</Badge>}
                        <Button
                          type="button"
                          size="sm"
                          variant={open ? "ghost" : "secondary"}
                          onClick={() =>
                            setOpenAssessmentId(open ? null : t.id)
                          }
                        >
                          {open ? "Close" : done ? "Edit / re-run" : "Run"}
                        </Button>
                      </div>
                    </div>

                    {open && (
                      <div className="space-y-3 border-t border-zinc-800 p-3">
                        <AssessmentHowTo
                          purpose={t.purpose}
                          instructions={t.instructions}
                          defaultOpen
                        />
                        <AssessmentFormFields
                          fields={t.fields || []}
                          values={assessmentResults[t.id] || {}}
                          onChange={(key, value) =>
                            setAssessmentResults({
                              ...assessmentResults,
                              [t.id]: {
                                ...(assessmentResults[t.id] || {}),
                                [key]: value,
                              },
                            })
                          }
                        />
                        <Button
                          type="button"
                          onClick={() => void saveAssessment(t)}
                          loading={busy}
                        >
                          Save this assessment
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between border-t border-zinc-800 pt-3">
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(4)}
                >
                  Skip remaining
                </Button>
                <Button type="button" onClick={() => setStep(4)}>
                  Continue to review
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-zinc-500">
              Confirm details, then activate the client and open the workspace.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Name
                </div>
                <div className="mt-0.5 font-medium text-zinc-100">
                  {basics.firstName} {basics.lastName}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Contact
                </div>
                <div className="mt-0.5 text-zinc-300">
                  {[basics.email, basics.phone].filter(Boolean).join(" · ") ||
                    "—"}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 sm:col-span-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Goals
                </div>
                <div className="mt-0.5 text-zinc-300">
                  {history.goals || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Experience
                </div>
                <div className="mt-0.5 capitalize text-zinc-300">
                  {history.experienceLevel || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Screens saved
                </div>
                <div className="mt-0.5 text-zinc-300">
                  {completedAssessments.length}
                  {templates.length > 0 && (
                    <span className="text-zinc-600">
                      {" "}
                      / {templates.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 sm:col-span-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Injuries / limitations
                </div>
                <div className="mt-0.5 text-zinc-300">
                  {history.injuries || "—"}
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button
                type="button"
                onClick={() => void finish()}
                loading={busy}
              >
                Activate client & open workspace
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
