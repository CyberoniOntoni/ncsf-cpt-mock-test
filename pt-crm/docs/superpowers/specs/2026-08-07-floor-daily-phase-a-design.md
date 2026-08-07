# Design: Phase A — Floor daily friction

**Date:** 2026-08-07  
**Status:** Implemented  
**Product:** pt-crm Floor OS  
**Related:** [crm-product-vision.md](../../crm-product-vision.md), [happy-path.md](../../happy-path.md), [design-system.md](../../design-system.md)

---

## 1. Problem

Trainers use pt-crm under gym noise. Recent work shipped close-loop, cues, Apply progression, and shortcuts, but daily friction remains:

1. **Too much density** — multiple exercises expanded; current set competes with noise.
2. **Slow first set** — last loads often exist but progression is a second tap; start still feels like setup work.
3. **Close-loop gaps** — Program/Progress links sometimes missing; book next not prefilled from last session length.
4. **Cue/notes pollution** — program/mesocycle meta still leaks into floor attention (partially fixed; extend).
5. **Feedback inconsistency** — set complete / rest / flash can feel spammy or easy to miss.

**North-star alignment:** sessions logged per trainer per week. Phase A optimizes time-to-first-set and session completion confidence.

**Out of sequence for now:** business CRM (Phase B), smarter programming (Phase C), deploy/ops, real messaging, invoices.

---

## 2. Goals and non-goals

### Goals

| ID | Goal | Measurable success |
|----|------|--------------------|
| G1 | First set logged fast | Sticky client + program → open logger → first set marked done in under 30 seconds on a repeat client |
| G2 | Current work is obvious | Only **current** exercise fully expanded by default; others collapsed to one-line rows |
| G3 | Close-loop unambiguous | After complete: Share/Copy + Book next + Open client + **Program** + **Progress** when ids exist |
| G4 | Cues stay quiet | Floor cue strip shows **short coaching cue only**; long program meta stays behind disclosure |
| G5 | Feedback is clear, not noisy | Set complete: brief flash + rest when configured; no stacked conflicting banners |

### Non-goals (Phase A)

- New set schemes or EMOM redesign  
- Full logger rewrite / mobile-native app  
- Tasks, invoices, real WhatsApp send  
- Coach append exercise (Phase C)  
- Nav IA collapse to 4 areas (later UX window)  
- Schema version bump unless strictly required (prefer no migration)

---

## 3. Scope (features)

### A1 — Current-set density (UI)

**Behavior**

- While `status === "in_progress"`:
  - **Current** exercise = first incomplete log (existing `currentExId`).
  - Default collapse: all non-current exercises **collapsed** (one-line header: name, scheme chip, sets done/total).
  - Current exercise **expanded**.
  - When current completes, next incomplete auto-expands and scrolls into view (already partial — make deterministic).
- Completed exercises stay collapsed unless user expands.
- Grouped supersets: collapse the **group** as a unit when none of its members is current; expand group when any member is current.
- User override: manual expand/collapse always respected until session ends or user hits “Focus current” (optional small control near sticky bar).

**Files (expected)**

- `src/components/session-logger.tsx` — collapse defaults, group collapse, optional Focus control  
- Possibly extract pure helper `isExerciseCollapsed(defaultRules)` for testability in `src/lib/session-focus.ts` (new, small)

**Not in A1:** hide entire exercise list; virtualized list; bottom-sheet only mode.

---

### A2 — Faster first set (start + optional auto-apply)

**Today**

- `startSessionFromProgramDayAction` already prefills set weights from last completed session via `initSetLogsFromScheme(..., prevSets)`.
- UI still requires **Apply** for progression (kg/reps tip).

**Behavior**

1. **Keep** last-load prefill on start (no regression).
2. **On logger mount** (new session only, not resume): for each log with a progression suggestion of kind `load` or `hold` with `suggestedKg > 0`, **do not** auto-mutate weights by default — too surprising mid-block.
3. Instead add **one emerald control on first incomplete exercise** when suggestions exist: **“Prep open sets”** that:
   - Applies last loads if any open set has null weight (Fill last batch), then  
   - Applies progression tip for **current** exercise only (same as keyboard **A**).
4. Optional user preference later: skip. **Not in Phase A** — single explicit button is enough.

**Alternative considered:** auto-apply all progressions on start. Rejected: mutates program intent without consent; dangerous on deload weeks.

**Files**

- `src/components/session-logger.tsx` — Prep open sets control near current exercise header / sticky actions  
- Reuse `applyProgression`, fill-last path already present

---

### A3 — Close-loop completeness

**Behavior**

- Meta row always includes when available:
  - Home  
  - **Program** → `program?.id || session.programId` (already partially shipped; verify on completed sessions that had `programId`)  
  - **Progress** → `/clients/{id}#progress` when client present  
  - All sessions  
  - Remove  
- **Book next** form defaults:
  - `datetime-local` = next whole hour (existing)  
  - **duration** = last completed session `durationMin` for this client if available, else current session duration, else 60  
- On book success, keep “Next: {when}” line (existing).

**Server (only if needed)**

- Prefer client-side: SessionLogger already has `durationMin` on completed session. For “last duration for client”, optional lightweight field on `getSessionAction` payload: `lastBookedDurationMin` from previous completed session — **only if** single query is cheap. Else use current session duration only (YAGNI).

**Files**

- `src/components/session-logger.tsx`  
- Optionally `src/app/actions/sessions.ts` `getSessionAction` for last duration hint  

---

### A4 — Cue purity (extend)

**Behavior**

- Floor **Cue ·** strip: short bank cue / first clause only (already improved).  
- **Notes** field: long program/meso dumps stay in **collapsed “Coach notes (program)”** (shipped).  
- **Start seed** (`startSessionFromProgramDayAction`): seed notes with **bank cue only** when program `ex.notes` is empty; if program notes are mesocycle-tagged dumps, prefer bank cue for seed so new sessions don’t reopen the mess.  
  - Rule: if `ex.notes` matches mesocycle/scheme dump patterns OR length > 140, seed bank cue (or null) instead of raw notes.  
  - Program-authored short notes still seed.

**Files**

- `src/app/actions/sessions.ts` — seed filter  
- Shared pure helper optional: `src/lib/session-notes.ts` `isProgramMetaDump(text)` used by logger + start  

---

### A5 — Feedback consistency

**Behavior**

- On set complete (toggle done true):
  - One short success flash (“Set done” / exercise complete when all sets done) — max one visible flash; replace previous non-error flash.  
  - Start rest if auto-rest on (existing).  
  - Do **not** stack rest + long multi-line flash.  
- On Prep open sets / Apply: flash once (“Applied …”).  
- Error flashes stay until dismiss or next action (existing).

**Files**

- `src/components/session-logger.tsx` — `flash` / `toggleSetDone` paths only  

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Session page (RSC)                                       │
│  getSessionAction → SessionLogger                        │
└───────────────────────────┬─────────────────────────────┘
                            │ props: session, client, program, logs
                            ▼
┌─────────────────────────────────────────────────────────┐
│ SessionLogger (client)                                   │
│  • focus rules (A1)                                      │
│  • Prep open sets (A2)                                   │
│  • close-loop (A3)                                       │
│  • cue/notes display (A4 UI)                             │
│  • flash policy (A5)                                     │
└───────────────────────────┬─────────────────────────────┘
                            │ server actions (unchanged contract)
                            ▼
┌─────────────────────────────────────────────────────────┐
│ sessions.ts                                              │
│  startSessionFromProgramDayAction — seed notes (A4)      │
│  getSessionAction — optional last duration (A3)          │
│  complete / save — no pack/stage changes in Phase A      │
└─────────────────────────────────────────────────────────┘
│ pure libs: progression, session-sets, optional           │
│ session-focus / session-notes helpers                    │
└─────────────────────────────────────────────────────────┘
```

**Principles**

- No new tables or SCHEMA_VERSION bump.  
- Prefer pure helpers for collapse/notes rules so `smoke-floor` can assert them.  
- One emerald primary per surface: live logger = Complete session; after complete = Share/Copy summary; Prep open sets = secondary emerald-outline or secondary button near current exercise (not competing sticky Complete).

---

## 5. Data flow

### Start session

1. Trainer: Start session (Home / program day).  
2. `startSessionFromProgramDayAction`: build setLogs with last weights; seed notes with **filtered** notes/cues.  
3. Navigate to `/sessions/{id}`.  
4. Logger mounts: apply A1 collapse; show Prep open sets if current exercise has suggestion or null weights.

### During session

1. Space / complete set → A5 flash + rest.  
2. Completing last set of current → next exercise expands (A1).  
3. A / Apply / Prep → open sets only, undoable.

### Complete

1. `completeSessionAction` (unchanged pack/meso side effects).  
2. Close-loop UI (A3): share, book (duration default), program/progress links.

---

## 6. Error handling

| Case | Behavior |
|------|----------|
| Prep with no suggestion and all weights filled | Flash “Sets already prepped” (info) |
| Apply with no open sets | Existing “No open sets” |
| Missing programId | Hide Program link; still show Progress if client |
| Book next fails | Error flash; form stays open |
| Offline draft restore | Collapse rules re-run after restore; don’t wipe draft |

---

## 7. Testing / verification

1. **Unit / pure:** `isProgramMetaDump`, collapse default for current vs done (if extracted).  
2. **`npx tsx scripts/smoke-floor.ts`** — progression still passes; add case for zero-load reps (already) + meta dump helper if extracted.  
3. **`npx tsc --noEmit`**.  
4. **Browser happy path:**  
   - Marcus (or demo client) → Start session → only first incomplete expanded → Prep open sets → Space set → Complete → Program + Progress links → Book next duration matches session.  
5. **No console errors** on logger.

---

## 8. Implementation order

1. A4 seed filter + shared meta-dump helper (small, safe).  
2. A1 collapse defaults + group focus.  
3. A2 Prep open sets.  
4. A3 close-loop duration + link audit.  
5. A5 flash polish.  
6. Docs: `happy-path.md` Phase A bullets.  
7. Smoke + tsc + local commit (no GitHub push unless asked).

---

## 9. Phase B / C (roadmap only — not this implementation)

Locked sequence after Phase A exit criteria:

- **B:** Tasks/follow-ups, Today appointments strip, pack renew one-tap, optional invoice stub.  
- **C:** Coach append/swap exercise, stronger substitute UX, regen day with last-session constraints.

Do not start B until A success criteria in §2 hold in real use.

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Over-collapse frustrates power users | Manual expand + optional Focus current; remember expand for session lifetime |
| Prep mutates too much | Only current exercise progression; fill null weights only |
| Program link still missing | Fallback `session.programId`; never rely on join-only |
| session-logger.tsx size | Extract pure helpers; avoid large new components unless needed |

---

## 11. Approval

- Product sequence: **A → B → C** approved in brainstorm.  
- This document defines **Phase A only** for the next implementation plan.  
- Implementation proceeds via `writing-plans` after user review of this spec.
