let meta = #{
    name: "lane-b-programming",
    description: "Lane B programming brain: constraints, substitutions, mesocycle, assessment correctives",
    when_to_use: "Implement or re-run PT CRM programming intelligence (Lane B)",
    phases: [
        #{ title: "Libs", detail: "four pure modules in parallel" },
        #{ title: "Integrate", detail: "wire builder + server actions" },
        #{ title: "UI", detail: "wizard + program detail" },
        #{ title: "Verify", detail: "tsc + smoke" },
    ],
};

let root = if args == () { "pt-crm" } else if args.root == () { "pt-crm" } else { args.root };

phase("Libs");
log("Spawning four pure-library agents under " + root);

let lib_jobs = [];

// ── 1. Constraints ──────────────────────────────────────────────────
let p1 = "";
p1 += "You are implementing Lane B for the PT CRM Next.js app at workspace root `" + root + "`.\n";
p1 += "CREATE file `" + root + "/src/lib/program-constraints.ts` (new file only — do not edit other files).\n\n";
p1 += "Requirements:\n";
p1 += "1. Export type ClientConstraintProfile with: preferTags: string[], avoidTags: string[], avoidNameRegexes: RegExp[], forceMobility: boolean, notes: string[], injuryFlags: string[].\n";
p1 += "2. Export function buildConstraintProfile(input: { injuries?: string|null; goals?: string|null; preferMobility?: boolean; contraindications?: string|null }): ClientConstraintProfile.\n";
p1 += "   Detect flags from free text (case-insensitive): shoulder/rotator/apley/scratch → shoulder; knee → knee; low back/lumbar → lumbar; hip → hip; ankle → ankle; wrist/elbow → elbow_wrist.\n";
p1 += "3. For each flag, push preferTags (e.g. shoulder-friendly, mobility, scapula) and avoidTags / name patterns (e.g. avoid aggressive overhead when shoulder).\n";
p1 += "4. Export function exerciseViolatesConstraints(ex: { name: string; tags: string; movementPattern: string; difficulty?: string }, profile: ClientConstraintProfile): boolean.\n";
p1 += "5. Export function scoreExerciseForConstraints(ex, profile): number — higher is better; penalize avoid tags/names, boost prefer tags.\n";
p1 += "6. Export function formatConstraintSummary(profile): string for coach-facing notes.\n";
p1 += "Use TypeScript strict style matching sibling files. No React. Read `" + root + "/src/lib/progression.ts` for style reference only.\n";
p1 += "When done, confirm the file path and list exported symbols.";
lib_jobs.push(#{
    prompt: p1,
    label: "lib:constraints",
    capability_mode: "all",
});

// ── 2. Substitutions ────────────────────────────────────────────────
let p2 = "";
p2 += "You are implementing Lane B for the PT CRM at `" + root + "`.\n";
p2 += "CREATE file `" + root + "/src/lib/exercise-substitutions.ts` only.\n\n";
p2 += "Import type ExerciseWithAvailability from `@/lib/exercises` if useful, or define a minimal ExerciseLike type with: id, name, movementPattern, tags, difficulty, available, equipmentNames, cues, primaryMuscles, missingEquipment.\n\n";
p2 += "Requirements:\n";
p2 += "1. Export type SubCandidate = { exercise: ExerciseLike; score: number; reasons: string[] }.\n";
p2 += "2. Export function rankSubstitutions(opts: { current: ExerciseLike; pool: ExerciseLike[]; limit?: number; preferSamePattern?: boolean; requireAvailable?: boolean }): SubCandidate[].\n";
p2 += "   Scoring: same movementPattern +5; overlapping tags +1 each; same primary muscle words +2; available +2; beginner boost +1; same difficulty +1; name similarity soft boost; exclude current.id; requireAvailable default true.\n";
p2 += "3. Export function bestSubstitution(...): ExerciseLike | null — top rank or null.\n";
p2 += "4. Export function samePatternAlternatives(pattern, pool, excludeId, limit): ExerciseLike[].\n";
p2 += "Keep pure functions, no DB. Style like `" + root + "/src/lib/progression.ts`.\n";
p2 += "When done, list exports.";
lib_jobs.push(#{
    prompt: p2,
    label: "lib:substitutions",
    capability_mode: "all",
});

// ── 3. Mesocycle ────────────────────────────────────────────────────
let p3 = "";
p3 += "You are implementing Lane B for PT CRM at `" + root + "`.\n";
p3 += "CREATE file `" + root + "/src/lib/mesocycle.ts` only.\n\n";
p3 += "Requirements:\n";
p3 += "1. Export type MesocycleWeek = 1 | 2 | 3 | 4 | 5 | 6.\n";
p3 += "2. Export type MesocyclePlan = { week: MesocycleWeek; label: string; isDeload: boolean; volumeMult: number; intensityHint: string; rpeBias: number; notes: string }.\n";
p3 += "3. Export function getMesocycleWeek(week: number): MesocyclePlan — clamp 1-6.\n";
p3 += "   Week1 intro volumeMult 0.9 rpe slightly easier; W2 build 1.0; W3 peak 1.05-1.1; W4 deload 0.6-0.7 isDeload true; W5 rebuild 1.0; W6 peak 1.05.\n";
p3 += "4. Export function applyMesocycleToPrescription(input: { sets: number; reps: string; rpe: string|null; restSec: number|null }, plan: MesocyclePlan): { sets: number; reps: string; rpe: string|null; restSec: number|null; note: string|null }.\n";
p3 += "   On deload: reduce sets (min 1), optionally keep reps, lower RPE numbers if parseable, note 'Deload week'.\n";
p3 += "   On build/peak: optionally bump sets by volumeMult when sets>=3.\n";
p3 += "5. Export function parseRepRange and adjustRepsForWeek if helpful (or import patterns from progression).\n";
p3 += "6. Export MESOCYCLE_WEEK_OPTIONS for UI: { value, label }[].\n";
p3 += "Pure TS, no React/DB. When done, list exports.";
lib_jobs.push(#{
    prompt: p3,
    label: "lib:mesocycle",
    capability_mode: "all",
});

// ── 4. Assessment correctives ───────────────────────────────────────
let p4 = "";
p4 += "You are implementing Lane B for PT CRM at `" + root + "`.\n";
p4 += "CREATE file `" + root + "/src/lib/assessment-correctives.ts` only.\n";
p4 += "Read `" + root + "/src/db/assessment-templates-data.ts` and `" + root + "/src/lib/assessments.ts` for field keys/slugs (read-only).\n\n";
p4 += "Requirements:\n";
p4 += "1. Export type CorrectivePrescription = { id: string; reason: string; preferTags: string[]; patterns: string[]; exerciseNameHints: string[]; priority: number }.\n";
p4 += "2. Export function correctivesFromAssessmentResults(opts: { templateSlug: string; results: Record<string, unknown>; summary?: string|null }): CorrectivePrescription[].\n";
p4 += "   Map common fails: back-scratch / apley fail or poor → shoulder mobility correctives; ankle-df-wall low cm or fail → ankle DF; overhead squat limited → hip/ankle/tspine; any pain flags → gentle mobility.\n";
p4 += "3. Export function correctivesFromClientHistory(injuries?: string|null): CorrectivePrescription[] from free text.\n";
p4 += "4. Export function mergeCorrectives(lists: CorrectivePrescription[][]): CorrectivePrescription[] — dedupe by id, keep highest priority.\n";
p4 += "5. Export function matchExercisesForCorrective(corrective, pool: { id: string; name: string; tags: string; movementPattern: string; available: boolean; cues?: string|null }[], limit?: number): typeof pool — available first, tag/pattern match.\n";
p4 += "Pure TS. When done, list exports.";
lib_jobs.push(#{
    prompt: p4,
    label: "lib:correctives",
    capability_mode: "all",
});

let lib_results = parallel(lib_jobs);
let lib_ok = 0;
for r in lib_results {
    if r != () && r.success { lib_ok += 1; }
    else { log("lib agent failed or empty"); }
}
log("Libs phase: " + lib_ok.to_string() + "/4 succeeded");

phase("Integrate");
let p_int = "";
p_int += "You integrate Lane B into the PT CRM at `" + root + "`.\n";
p_int += "The pure libs should exist:\n";
p_int += "- `" + root + "/src/lib/program-constraints.ts`\n";
p_int += "- `" + root + "/src/lib/exercise-substitutions.ts`\n";
p_int += "- `" + root + "/src/lib/mesocycle.ts`\n";
p_int += "- `" + root + "/src/lib/assessment-correctives.ts`\n";
p_int += "Read them first. If any missing, create minimal stubs so integration compiles.\n\n";
p_int += "EDIT these files only:\n";
p_int += "1. `" + root + "/src/lib/program-builder.ts`\n";
p_int += "2. `" + root + "/src/app/actions/programs.ts`\n\n";
p_int += "program-builder.ts:\n";
p_int += "- Extend ProgramBuilderInput with: mesocycleWeek?: number; assessmentHints?: { templateSlug: string; results: Record<string, unknown>; summary?: string|null }[]; contraindications?: string|null.\n";
p_int += "- Use buildConstraintProfile from program-constraints; filter/score pickExercise with scoreExerciseForConstraints and exerciseViolatesConstraints (skip violators).\n";
p_int += "- Apply getMesocycleWeek + applyMesocycleToPrescription to single-exercise prescriptions (and group member reps/rpe when reasonable).\n";
p_int += "- After building each day (or once on day 0), if assessmentHints or injuries warrant, insert 1-2 warmup mobility correctives at sortOrder start using matchExercisesForCorrective (isWarmup true, scheme straight).\n";
p_int += "- Put constraint summary, mesocycle label, and corrective ids into BuiltProgram.meta.\n\n";
p_int += "programs.ts actions:\n";
p_int += "- Extend CreateProgramInput with mesocycleWeek?: number.\n";
p_int += "- previewProgramAction + createProgramFromWizardAction: load client assessments (latest per template if tables exist: clientAssessments + assessmentTemplates), pass assessmentHints; pass mesocycleWeek; use assertClientInOrg/getClientInOrg from tenant when loading client.\n";
p_int += "- Add suggestSubstitutionsAction(exerciseRowId: string, limit?: number) using rankSubstitutions + listExercisesForOrg, org-scoped.\n";
p_int += "- Add applyMesocycleToProgramAction(programId, week: number) — scale sets/reps/rpe on all program exercises via applyMesocycleToPrescription, update generationMeta.\n";
p_int += "- Add insertCorrectivesAction(programId) — load client injuries + latest assessments, for each day insert missing correctives as warmup rows (avoid duplicates by exerciseId/name).\n";
p_int += "Revalidate paths. Match existing drizzle/action style. Do not rewrite unrelated code.\n";
p_int += "Run `npx tsc --noEmit` in `" + root + "` and fix errors you introduce.";

let int_res = agent(p_int, #{
    label: "integrate:builder-actions",
    capability_mode: "all",
});
if (int_res == () || !int_res.success) {
    log("Integrate agent failed — continuing to UI with caution");
}

phase("UI");
let p_ui = "";
p_ui += "You wire Lane B UI for PT CRM at `" + root + "`.\n";
p_ui += "Read exports from:\n";
p_ui += "- mesocycle MESOCYCLE_WEEK_OPTIONS\n";
p_ui += "- programs actions: suggestSubstitutionsAction, applyMesocycleToProgramAction, insertCorrectivesAction, CreateProgramInput.mesocycleWeek\n\n";
p_ui += "EDIT only:\n";
p_ui += "1. `" + root + "/src/components/program-wizard.tsx` — add mesocycle week selector (buttons or select) bound to form.mesocycleWeek (default 1); pass to preview/create; show meta.constraintSummary / mesocycle label from preview.meta if present.\n";
p_ui += "2. `" + root + "/src/components/program-detail.tsx` — add Programming brain card: mesocycle week apply button(s); Insert correctives button; when swapping, optionally call suggestSubstitutionsAction and show top 5 quick-pick buttons above ExerciseBankPicker.\n";
p_ui += "3. Optionally small `" + root + "/src/components/smart-substitutions.tsx` client component if cleaner.\n\n";
p_ui += "Match existing dark UI (Button, Badge, Card). No drive-by refactors.\n";
p_ui += "Run tsc in `" + root + "` and fix UI-related errors.";

let ui_res = agent(p_ui, #{
    label: "ui:wizard-detail",
    capability_mode: "all",
});
if (ui_res == () || !ui_res.success) {
    log("UI agent failed");
}

phase("Verify");
let p_ver = "";
p_ver += "Verify Lane B in `" + root + "`.\n";
p_ver += "1. Confirm these files exist and export expected symbols (read_file/grep):\n";
p_ver += "   program-constraints.ts, exercise-substitutions.ts, mesocycle.ts, assessment-correctives.ts\n";
p_ver += "2. Confirm program-builder uses constraints + mesocycle; programs.ts has suggestSubstitutionsAction, applyMesocycleToProgramAction, insertCorrectivesAction.\n";
p_ver += "3. Run `cd " + root + "; npx tsc --noEmit` and fix any errors you can fix in Lane B files only.\n";
p_ver += "4. Add or extend `" + root + "/scripts/smoke-programming.ts` that imports pure libs and asserts: constraint shoulder profile, substitution ranking same pattern, mesocycle week 4 isDeload, corrective from fake back-scratch fail. Run with npx tsx.\n";
p_ver += "5. Write a short summary of what was implemented and any gaps to scratch via writing `" + root + "/.lane-b-report.md`.\n";
p_ver += "Return a concise final summary.";

let ver = agent(p_ver, #{
    label: "verify:lane-b",
    capability_mode: "all",
});

let summary = "Lane B multi-agent run finished. ";
if (ver != () && ver.success) {
    summary += "Verify agent completed.";
} else {
    summary += "Verify agent had issues — check " + root + " manually.";
}
summary += " Libs ok: " + lib_ok.to_string() + "/4.";

complete(#{
    summary: summary,
    lib_ok: lib_ok,
    integrate_ok: int_res != () && int_res.success,
    ui_ok: ui_res != () && ui_res.success,
    verify_ok: ver != () && ver.success,
});
