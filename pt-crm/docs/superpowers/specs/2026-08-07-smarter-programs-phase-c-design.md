# Design: Phase C — Smarter programs

**Date:** 2026-08-07  
**Status:** Implemented  
**Product:** pt-crm Floor OS  
**Related:** [crm-product-vision.md](../../crm-product-vision.md), [happy-path.md](../../happy-path.md), Phase A floor daily, Phase B business CRM

---

## 1. Problem

Programs are generated, mesocycled, corrected, and swapped — but trainers **cannot add an exercise to a day** without regenerating. Coach can Apply correctives/meso, not “add face pulls to Day A.” Exercise suggestion cards are read-only. Session improvisation never writes back to the plan.

**North-star:** sessions logged per week. Phase C makes the plan editable like a smart spreadsheet so trainers keep logging without leaving Floor OS for Excel.

**Naming:** Product Phase C = smarter programs. **Not** vision CRM Phase C (comms/GDPR).

---

## 2. Goals and non-goals

### Goals

| ID | Goal | Success |
|----|------|---------|
| C1 | Desk append | On program detail, **Add exercise** per day opens bank picker; appends standalone row at end of day |
| C2 | Shared server action | `addProgramExerciseAction` with org checks, equipment availability, cues, meso baseline seed |
| C3 | Coach append | NL “add X to program” / “add face pulls to day 1” → Apply `append_exercise` mutates plan |
| C4 | Docs/smoke | happy-path §5; pure helper covered in smoke-programming |

### Non-goals (this ship)

- Drag reorder
- Mid-session add ad-hoc log
- Session → program promote
- Coach swap CRM action (desk swap already exists)
- Progression write-back into program targets
- Schema migration / new tables
- Multi-exercise group invent (append = straight, standalone only)

---

## 3. Architecture

```
Coach NL → detectIntent(append_exercise)
         → coach proposes CrmAction append_exercise
         → executeCoachActionAction
         → addProgramExerciseAction(programDayId, bankExerciseId, opts)

Program detail → ExerciseBankPicker → addProgramExerciseAction
```

No `SCHEMA_VERSION` bump. Insert into existing `program_exercises`.

---

## 4. Data / action contract

### `addProgramExerciseAction`

```ts
addProgramExerciseAction(input: {
  programDayId: string;
  bankExerciseId: string;
  opts?: {
    isWarmup?: boolean;
    sets?: number;
    reps?: string;
    rpe?: string | null;
    restSec?: number | null;
    notes?: string | null;
  };
}): Promise<{
  ok: true;
  programExerciseId: string;
  programId: string;
  name: string;
  dayName: string;
}>
```

Rules:

1. Tenant: program.organizationId === session org.
2. Bank exercise exists and **available** (same as swap).
3. `sortOrder` = max(existing)+1 (or 0 if empty).
4. Default rx: sets 3, reps `"8-10"`, rpe `"7"`, restSec 90; warmups: sets 2, reps `"8-10"`, rpe `"5-6"`, restSec 45.
5. `setScheme: "straight"`, no group fields.
6. Notes: bank cues unless opts.notes provided.
7. Seed `generationMeta.baselinePrescriptions[newPeId]` so later meso apply has a baseline.

### Coach action

| Field | Value |
|-------|--------|
| kind | `append_exercise` |
| payload.programId | required |
| payload.programDayId | preferred; else first day by dayIndex |
| payload.bankExerciseId | required for execute |
| payload.exerciseName | optional display; resolve bank by id or name fuzzy |
| payload.isWarmup | optional |

Intent patterns (before insert_correctives collision):

- `add|append|include` + exercise-ish + `to (the )?program|day|plan`
- `add face pulls` style when client has active program

Resolve name: case-insensitive includes match on bank; prefer available; if ambiguous, propose open program + list top matches as open_program (no mutate).

---

## 5. UI

### Program detail

Per day header actions: existing Regen day + **Add exercise**. Toggle shows `ExerciseBankPicker` (`title="Add exercise"`). On pick → `addProgramExerciseAction` → refresh + toast.

### Coach console

Treat `append_exercise` like other mutate kinds (Apply button, `executeCoachActionAction`).

---

## 6. Success criteria

- [x] Trainer adds bank exercise to a day without regen
- [x] Coach Apply appends to active program day
- [x] Unavailable equipment rejected with clear error
- [x] `npx tsc --noEmit` clean
- [x] smoke-programming covers sort + rank helpers
- [x] happy-path updated
- [x] Local commit only
