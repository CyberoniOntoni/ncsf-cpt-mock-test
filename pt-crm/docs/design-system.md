# pt-crm Design System

**Status:** Adopted  
**Date:** 2026-08-06  
**Scope:** Product UI for the multi-tenant PT CRM (floor + desk).  
**Sources:** Multi-agent design brainstorm (system, IA, brand, code feasibility).

---

## 1. Product framing

pt-crm is a **client-context floor workbench** for freelance personal trainers—not a content portal, wellness app, or AI chat home.

| Question home/session must answer | Not the job of chrome |
|-----------------------------------|------------------------|
| Who is active? | Full analytics |
| What’s next? | Marketing empty states |
| What needs me? | Decorative animation |
| Log the work | Dual competing CTAs |

**Personality:** Precise · Grounded · Operational  
**Mood:** Command deck (tempered)—dark zinc, scarce emerald, amber for risk, red only for true danger.

**No light mode in v1.** Ship excellent dark for gym glare first.

---

## 2. Design principles

1. **Floor first, desk second** — Primary controls must work one-handed mid-set (≥44–48px). Desk may densify; floor never shrinks.
2. **One primary action per surface** — Emerald is scarce. One CTA rank (Continue session > Start day > Design program > Add client).
3. **State over decoration** — Prefer status (in progress, needs you, flags) over chrome and illustration.
4. **Honest numbers** — Loads, reps, rest, volume use `tabular-nums`, high contrast, unambiguous units.
5. **Calm AI** — Coach assists; never auto-runs on load; never blocks logging. Plain text only (no markdown in chat).

---

## 3. User modes (shell adapts; no mode toggle)

| Mode | Inference | Shell bias |
|------|-----------|------------|
| Floor session | Active logger / in-progress session | Large targets, sticky logger actions, coach collapsed |
| Between clients | Home, short dwell | Resume strip + client launch |
| Desk planning | Programs, library, intake | Full nav, denser lists |
| Admin | Settings | Quiet, never on critical path |

---

## 4. Visual tokens

### 4.1 Color roles

| Role | Tailwind / intent | Usage |
|------|-------------------|--------|
| Canvas | `zinc-950` | App background |
| Surface | `zinc-900` / `zinc-900/60` | Cards, panels |
| Well | `zinc-950` / `zinc-950/40` | Nested inputs, log rows |
| Border | `zinc-800` default, `zinc-700` interactive | Dividers, card edges |
| Text primary | `zinc-50` / `zinc-100` | Titles, body |
| Text secondary | `zinc-400` | Supporting |
| Text meta | `zinc-500` | Labels, timestamps |
| **Action / success** | `emerald-600` fill, `emerald-500` hover, `emerald-400` focus/icons | Primary CTA, success, live |
| **Wash success** | `emerald-950/20–40` | Soft success panels |
| **Warn** | `amber-*` | Rest done, needs-you, soft caution |
| **Danger** | `red-700` / rose | Delete, hard fail; label always |
| **Pain** | Amber border + label (not only red) | Per-set pain flag |

**Ban:** Blue info accent, purple AI accent, rainbow charts, emerald full-bleed hero panels for non-primary content.

### 4.2 Typography

| Use | Size / weight |
|-----|----------------|
| Page title | `text-2xl font-semibold tracking-tight` |
| Section label | `text-[11px] font-semibold uppercase tracking-wide text-zinc-500` (class: `section-label`) |
| Body | `text-sm text-zinc-100–200` |
| Meta | `text-xs text-zinc-500` |
| Floor numbers | `text-base+ font-medium tabular-nums` |
| Timer | `text-2xl font-semibold tabular-nums` |

Font: Geist Sans (existing). Mono for rare code-like IDs only.

### 4.3 Spacing & radius

- **Grid:** 4px base (`gap-1`…`gap-8`). Floor vertical rhythm looser (`gap-3`/`gap-4`); desk tighter.
- **Page pad:** `.page-pad` (1.25rem mobile → 1.5rem sm+).
- **Radius:** `rounded-md` chips; `rounded-lg` controls; `rounded-xl` cards; `rounded-full` avatars.
- **Elevation:** Border + light `shadow-black/20`; avoid heavy glass blur stacks.

### 4.4 Motion

- Hover/press: 150–200ms.
- Timer: continuous progress bar.
- PR: optional one-shot highlight; no confetti every set.
- Honor `prefers-reduced-motion`.
- No layout thrash on set complete.

---

## 5. Component architecture

### 5.1 Tiers

| Tier | Rule | Examples |
|------|------|----------|
| **Primitives** | Only in `src/components/ui.tsx` | Button, Input, Card, Badge, Alert, EmptyState, PageHeader, Spinner, Skeleton, SectionLabel |
| **Patterns** | Product-specific compositions | Resume strip, launch card, set row, rest timer, sticky client, list row |
| **Screens** | Routes compose patterns only | Home, session logger, program detail |

Screens must not invent one-off primary button colors.

### 5.2 Button

| Variant | Use |
|---------|-----|
| `primary` | Single main action |
| `secondary` | Supporting |
| `ghost` | Tertiary / toolbar |
| `danger` | Destructive |

| Size | Use |
|------|-----|
| `sm` | Toolbars, dense lists, floor secondary |
| `md` | Default forms |
| `lg` | Rare hero floor CTAs |

### 5.3 Badge tones

| Tone | Use |
|------|-----|
| `default` | Neutral tags |
| `green` | Available, success, active |
| `amber` | Needs you, in progress, caution |
| `red` | Error, cancelled |
| `sky` (info) | Load/reps chips, neutral highlight |

Always pair color with text.

### 5.4 Card

- Default: `rounded-xl border border-zinc-800 bg-zinc-900/60 p-4`.
- Padding prop: `sm` (`p-3`) | `md` (`p-4`).
- Nesting: at most one level of visual raise; inner groups use well fill *or* hairline, not both heavily.

### 5.5 Feedback

| Kind | Visual | Copy |
|------|--------|------|
| Success | Emerald Alert/toast | Verb-led: “Progress saved” |
| Warn | Amber | “Rest done”, soft validation |
| Error | Red + recovery | “Couldn’t save—retry” |
| Info | Zinc Alert | Neutral tips |

Floor: prefer inline flash over modal except destructive.

---

## 6. Layout templates

### 6.1 List shell
```
page-pad animate-in
  PageHeader (title, description, actions)
  [filters]
  body (full width)
```

### 6.2 Focus shell (floor flows)
```
page-pad animate-in mx-auto max-w-3xl
  optional back link
  title / progress
  body
  sticky footer (safe-area above bottom nav)
```

### 6.3 PageHeader

Use for all list/settings pages. Home and immersive logger may use compact status strip instead (documented exception).

### 6.4 Section labels

Use shared `section-label` / `<SectionLabel>` for “In progress”, “Client”, “Needs you”, form field groups.

---

## 7. Navigation & global chrome

### 7.1 Bottom nav (mobile primary)
Home · Clients · Sessions · Programs  
**More/overflow:** Library, Knowledge, History, Settings.

### 7.2 Badge rules
- Dot/number only for action required (in-progress count, needs-you).
- Never badge Library/Knowledge/Settings.
- Amber = caution; emerald = live session.

### 7.3 Sticky client (system)
- Persists in localStorage + `?client=` URL.
- Survives Programs/Sessions/Library when set.
- Clear on explicit clear or logout.
- **Future:** global chip in shell (Phase 2+); home already implements workspace sticky.

### 7.4 Coach
- Not a primary nav tab for floor.
- Collapsed by default on home; open on demand.
- Plain language; strip markdown.

---

## 8. Screen-specific guidance

### Home (hybrid)
- In progress → Client → Launch card → Needs you → Coach (collapsed).
- One primary: Continue session / Open program / Design program.

### Session logger
- Floor density; `h-11` set inputs; sticky Save/Complete.
- Rest timer above sticky bar; EMOM uses 60s interval semantics.
- Undo + pain + PR strip as patterns, not one-offs long-term.

### Programs
- Programming brain = secondary card; Start day is primary on day rows.
- Volume bars: zinc track, emerald fill.

### Empty states
One sentence + one CTA. Prefer `EmptyState` component.

---

## 9. Accessibility

- Contrast: primary text on zinc-950; avoid zinc-500 on zinc-800 for critical numbers.
- Focus: `ring-emerald-500` + offset on zinc-950.
- Tap targets ≥44px primary; logger rows ≥44–56px.
- Status never color-only.
- `prefers-reduced-motion` supported for animate-in / timer flash.

---

## 10. Iconography

- Lucide only; consistent stroke.
- Emerald for active/nav accent; zinc otherwise.
- No emoji as UI icons; no mascot illustrations in product chrome.
- Empty states: small icon well + copy + action.

---

## 11. Implementation roadmap

### Phase 1 — Normalize (**implemented 2026-08-06**)
- Extended `globals.css`: `.section-label`, `.page-shell`, `.page-focus`, DS CSS vars, reduced-motion for `.animate-in`.
- Extended `ui.tsx`: `SectionLabel`, Card `padding`, Badge `sky`, PageHeader `eyebrow`.
- Added `PageShell` / `FocusShell` in `src/components/page-shell.tsx`.
- Migrated list pages + equipment + client detail/assessments to `PageShell`.
- Home section labels → `SectionLabel`; session logger + program wizard → `FocusShell`.

### Phase 2 — Patterns (**implemented 2026-08-06**)
- Global sticky client chip in `AppShell` (desktop sidebar, mobile drawer + top bar).
- `ListRow` primitive; home resume + needs-you rows.
- `setStoredActiveClient(id, name)` + same-tab `ACTIVE_CLIENT_EVENT` / `subscribeActiveClient`.
- Sticky client banner on Programs + Sessions list pages.
- Logger uses `FocusShell floorFooter` (Phase 1) for bottom-nav clearance.

### Phase 3 — Full tokens
- Expand `@theme` semantic colors; gradually replace raw zinc/emerald strings.
- Chart kit; light mode only if desk demand is proven.

---

## 12. PR checklist (any UI change)

- [ ] Named tier: primitive / pattern / screen  
- [ ] Density: floor / desk  
- [ ] Single primary CTA  
- [ ] Feedback kind if user-visible result  
- [ ] Uses `PageHeader` or documented exception  
- [ ] No new accent color without design-system update  

---

## 13. Anti-patterns (ban)

1. Emerald large background washes for non-primary panels  
2. Multiple competing primary CTAs  
3. Sub-40px primary controls on floor  
4. Custom radii/shadows per feature  
5. Blue/purple “info/AI” drift  
6. Markdown in coach messages  
7. Confetti / loud motion during logging  
8. Status by color alone  
9. Mixing redesign with unrelated feature work in one PR without review  

---

## 14. North-star journey (acceptance)

1. **Home** — Resume open workout or select client; one clear primary action.  
2. **Program** — Open day → Start/Continue session.  
3. **Logger** — Log sets, rest, complete → summary → back to home.  

If any step requires hunting nav for the next obvious action, design failed.

---

## 15. Related docs / code

| Artifact | Path |
|----------|------|
| Primitives | `src/components/ui.tsx` |
| Global styles | `src/app/globals.css` |
| Shell | `src/components/app-shell.tsx` |
| Home | `src/components/home-workspace.tsx` |
| Logger | `src/components/session-logger.tsx` |

---

*End of design system document.*
