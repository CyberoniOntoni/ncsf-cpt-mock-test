# Design: Phase B — Business CRM (earn keep)

**Date:** 2026-08-07  
**Status:** Implemented  
**Product:** pt-crm Floor OS  
**Related:** [crm-product-vision.md](../../crm-product-vision.md), [happy-path.md](../../happy-path.md), Phase A floor daily

---

## 1. Problem

Floor sessions are solid; the CRM still under-serves the **business day**:

1. **No explicit follow-ups** — rebook / renew / call-backs live in the trainer’s head.
2. **Needs you is noisy for appointments** — full 48h appt list competes with true action items.
3. **Pack renew is multi-step** — empty pack → recreate name/total by hand.

**North-star alignment:** clients retained and sessions sold. Phase B makes follow-ups and renewals first-class without invoice/payment complexity.

**Out of sequence:** invoices/payments (B4 deferred), real WhatsApp/SMS, Phase C programming.

---

## 2. Goals and non-goals

### Goals

| ID | Goal | Measurable success |
|----|------|--------------------|
| B1 | Client tasks / follow-ups | Create, due date, mark done, delete on client CRM; open tasks surface on Home Needs you |
| B2 | Today agenda | Home **Agenda** lists upcoming booked sessions (48h); appts only in Needs you when ≤4h |
| B3 | One-tap pack renew | Empty/no active pack → **Renew pack** prefills last name/total; `#crm-pack` deep-link opens form with prefill |

### Non-goals

- Invoices, payments, tax, receipts
- Push notifications / calendar sync
- Shared org task board (tasks stay client-scoped)
- Real outbound messaging

---

## 3. Data model

**`client_tasks`** (`SCHEMA_VERSION` 11):

| Column | Notes |
|--------|--------|
| id, organization_id, client_id | Multi-tenant |
| title | Required |
| due_at | Optional |
| status | `open` \| `done` |
| created_at, completed_at | Audit |

Indexes: org, client, due_at.

---

## 4. Surfaces

### Client CRM panel

- **Follow-ups** section (`#crm-tasks`): open/done list, checkbox toggle, remove, add form.
- **Renew pack** when no active pack and a prior pack exists; form prefill via `lastPackage`.

### Home

- **Agenda** — `upcomingAppts` as first-class list (deep-link `#crm-appointments`).
- **Needs you** — `open_task` kind; appts only if start ≤4h; one row per client (kind rank includes `open_task`).

### Signals (`listOrgCrmSignalsAction`)

- Open tasks: status open, due ≤7 days / overdue / no due, exclude inactive/draft clients, cap 15.

---

## 5. Deep links

| Hash | Behavior |
|------|----------|
| `#crm-pack` | Scroll pack; if no active → open form (+ prefill last pack) |
| `#crm-appointments` | Scroll bookings; open form if none upcoming |
| `#crm-checkin` | Open check-in form |
| `#crm-tasks` | Open add-task form + scroll |

---

## 6. Success criteria

- [x] Schema + actions for tasks
- [x] Client panel Follow-ups + Renew pack
- [x] Home Agenda + open_task Needs you
- [x] Deep links including `#crm-tasks`
- [x] happy-path docs updated
- [ ] Local smoke after SCHEMA 11 restart
