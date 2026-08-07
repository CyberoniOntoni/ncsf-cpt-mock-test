# pt-crm Product Vision — CRM Rethink

**Status:** Strategic draft (multi-agent brainstorm, 2026-08-06)  
**Agents:** Product strategy · Workflow IA · Domain/data · UX simplification  
**Related:** [design-system.md](./design-system.md)

---

## 1. Executive decision

### Primary identity

**Floor OS for freelance personal trainers** — not a client portal, not an AI chat product, not a pure program studio.

| Identity | Role |
|----------|------|
| **Primary** | Floor OS — start, run, close sessions under gym noise |
| **Secondary** | Thin program layer — enough plan to run next session |
| **Tertiary** | CRM spine — relationship stage + next action (+ money later) |
| **Sidecar** | Coach AI / knowledge — context tools, never the home hero |

**Positioning line:** *The OS you open between clients — not another client portal they ignore.*

**North-star metric:** sessions logged per trainer per week.  
**Secondary:** time-to-first-set after open; % sessions with a summary shared.

---

## 2. What we over-index vs under-index

### Already strong (keep investing)
- Session logger (offline draft, rest/EMOM, undo, PR, pain, summary)
- Sticky client + home resume / launch / needs-you
- Program builder with constraints, correctives, mesocycle
- Assessments, measurements, progress
- Design system (floor-first dark zinc/emerald)

### Overbuilt relative to solo-PT willingness-to-pay (before retention)
- Deep mesocycle/volume as peer product surface
- Equipment inventory as nav peer
- Knowledge/playbooks + coach as primary value
- Multi-tenant/org machinery ahead of multi-trainer seats

### Underbuilt CRM spine
- Relationship **stage** (lead → active → pause → alumni)
- **Packages / credits** (commercial state)
- **Appointments** (booked time ≠ completed session)
- **Tasks / follow-ups**
- **Comms log** (WhatsApp/email reality)
- **Invoices / payments**

---

## 3. Domain objects trainers think in

| Object | Meaning | Current home |
|--------|---------|--------------|
| **Client** | Person + relationship + constraints | Clients + sticky chip |
| **Session** | Today’s hour = unit of value | Sessions + logger |
| **Program / Plan** | What we’re progressing this block | Programs |
| **Assessment / Measurement** | Readiness & proof | Client assessments |
| **Note / Follow-up** | Admin debt | Notes / needs-you heuristic |
| **Exercise** | Primitive | Library (should be picker, not product) |

**Rule:** Instances hang under **Client**. Templates hang under **Assets**. Calendar hangs under **Today**.

---

## 4. Proposed IA (replace feature museum)

### Mental model (3 layers)
1. **Who** — people & stage  
2. **What** — work for that person (session, plan, money, comms)  
3. **How I work** — assets & self  

### Primary nav (4)

| Nav | Role |
|-----|------|
| **Today** | Day board: resume, next, needs-you, renewals (later) |
| **People** | Pipeline + client record |
| **Plans** | Programs / builder (desk) |
| **Studio** | Library, knowledge, equipment, org settings |

**Sessions are not a 5th peer product** — full-screen from Today / Client.  
**Coach** = ambient assist with sticky client context, not a peer tab.

### Client record (spine)

**Header always:** Name · Stage · Package (later) · **Start session** · Message (later)

| Tab | Contents |
|-----|----------|
| **Today** | Next action, open tasks, package alert, last note |
| **Sessions** | Timeline + enter floor logger |
| **Program** | Active plan, meso, regen, correctives |
| **Progress** | Measurements, assessments, PRs |
| **Plan & pay** | Packages, invoices (Phase B) |
| **Comms** | Notes + message log (Phase C) |
| **Profile** | Intake, goals, injuries, consent |

### Continuum: floor vs desk
One data model, **two densities** — not two apps. Sticky client survives both. Floor = Session mode; desk = full client record.

---

## 5. Vocabulary

| Term | Use |
|------|-----|
| **Session** | Live or completed training event (product word) |
| **Program / Plan** | Multi-week assigned structure |
| **Log** | Verb / set rows inside a session |
| **Workout** | Client-facing nickname only — not nav |

Copy: **Start session** · **Session log** · **Program day**.

---

## 6. Day-part jobs

| When | Job | Surface |
|------|-----|---------|
| **Morning** | Who am I seeing? Red flags? | Today |
| **Floor** | Log sets; don’t drop phone | Session logger only |
| **Evening** | Close loop: note, rebook, tweak plan | Session summary → client |

---

## 7. Competitive stance

| vs | Win by |
|----|--------|
| Trainerize | Trainer-first floor speed, not portal bloat |
| TrueCoach | In-person session OS + assessments |
| Excel | Structured history + progression without sheets |
| WhatsApp + notes | Durable training record |

**Do not** out-portal Trainerize. **Out-floor** everyone. Excel refugees = acquisition channel.

---

## 8. Product principles (12 months)

1. **Session is the unit of value.** Features start, run, or close a session.  
2. **One active client, one path.** Sticky client is the product.  
3. **Floor latency over studio depth.** Defaults > wizard completeness.  
4. **Proof over advice.** Last loads, deltas, summaries > more AI prose.  
5. **Ship the paid loop weekly.** Intake → plan → session → summary before new systems.

### Stop / deprioritize
- Knowledge as a product line  
- Volume analytics as home hero  
- Equipment as nav peer (bury under Studio / program constraints)  
- Coach history as top-level nav  
- Client companion app, nutrition, full billing — until Floor OS retention is proven  

### Keep investing
- Offline logger, resume, sticky client  
- Session summary share  
- Progressive overload cues  
- Fast program from template  

---

## 9. Domain model v2 (evolve, don’t rewrite)

```
Org → Membership → User
Org → Client
  ├─ PackageEnrollment ← PackageProduct     [B]
  ├─ Appointment ──optional──► TrainingSession [A]
  ├─ TrainingSession ──optional debit──► PackageEnrollment [B]
  ├─ Invoice → Payment                      [B]
  ├─ Communication                          [C]
  ├─ Task                                   [A]
  ├─ Note / Measurement / Assessment        [keep]
  └─ Program → Days → Exercises             [keep]
```

Global catalogs stay global. All spine tables: `organizationId` + tenant guards.

### Heuristic vs real
| Fake for now | Real tables when |
|--------------|------------------|
| Quiet client / needs rebook | Tasks + appointments |
| “Active” status | Pipeline stages |
| Notes as “owed sessions” | Packages + debits |

---

## 10. Build phases (CRM spine)

### Phase A — Relationship ops
- Client **stage** (lead / active / pause / alumni) as first-class  
- **Tasks / follow-ups** (due date, client link)  
- **Appointments** (optional link to session)  
- Client **timeline** (sessions + notes + tasks)  
- Today: agenda heuristics + needs-you (already started)

### Phase B — Commercial
- Package products + enrollments  
- Debit on session complete  
- Simple invoices (manual paid)  
- Client header: sessions remaining  

### Phase C — Comms & trust
- Communication log + templates  
- Consent flags  
- Role-scoped medical visibility  
- Export / delete tools  

**Training graph (logger, programs, assessments) stays the differentiator** — CRM layers around `clients`.

---

## 11. UX simplification (90 days)

| Window | Move |
|--------|------|
| **1–30** | Nav → 4 areas (Today / People / Plans / Studio). Sessions from Today/Client only. Coach collapsed, client-bound. Home = command board only. |
| **31–60** | History → Client timeline. Knowledge → Studio + in-context retrieval. Library as picker-from-session/program. Unify copy → Session. |
| **61–90** | Progressive empty states by data maturity. Floor bottom bar: Today / People / primary Session. One emerald CTA per surface. |

---

## 12. Critical path screens (product definition)

1. **Today** — who to train, who is at risk  
2. **Client Today** — next commercial + coaching action  
3. **Floor session** — log the hour  
4. **Active program** — adjust plan  
5. **Progress + package** — proof + renewal  

If these five are excellent, Library/Knowledge/Settings are leverage, not identity.

---

## 13. Privacy as CRM deepens

- Injury/medical = sensitive; scope AI context deliberately  
- Consent for marketing vs operational messages  
- Roles: front desk may not need full medical  
- Retention rules for invoices vs chat  

---

## 14. Risks if we don’t pick a spine

- Feature museum (8 nav peers, no relationship state)  
- Great logger, weak rebook/renewal  
- Money as afterthought → silent churn  
- AI without a job on a person  
- Stage blindness (leads pollute active lists)  

---

## 15. Recommended vision (consensus)

**Floor OS** with a thin program layer and a growing **client spine** (stage → calendar → packages).

- **Do not** pivot to AI CRM or full program studio as identity.  
- **Do** subtract nav, hang work under Client/Session, add CRM tables only when heuristics fail.  
- **Measure** sessions/week, not features shipped.

---

## 16. Immediate next product bets (ordered)

| # | Bet | Why |
|---|-----|-----|
| 1 | **Client stage + timeline** | CRM spine without money |
| 2 | **Packages / credits** | Freelance retention |
| 3 | **Nav collapse to 4 + Session full-screen only** | Coherence |
| 4 | **Appointments (light)** | Real “Today” |
| 5 | **Comms log** | WhatsApp reality |

---

*End of CRM product vision. Implementation should follow this spine; design-system.md governs visual/floor craft.*
