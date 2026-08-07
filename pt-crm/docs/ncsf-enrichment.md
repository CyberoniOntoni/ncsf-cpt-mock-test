# NCSF-informed enrichment (FloorScribe)

## Purpose

Coach-facing playbooks, assessment templates, and retrieval phrase boosts were enriched with concepts commonly taught in NCSF CPT and related screening / program-design material. This is **coaching support inside the product** — not a reprint of NCSF courseware, not a certification substitute, and **not medical advice**.

## Chapters / topic areas that informed enrichment

| Area | Typical NCSF focus (CPT / related) | How it shows up in FloorScribe |
|------|------------------------------------|---------------------------|
| Movement / posture | Kinetic chain, posture patterns (upper/lower cross language), local stabilizers, form vs force closure | Screens (plank, wall angel, single-leg bridge, seated posture) + corrective playbooks |
| Prep / programming | Needs analysis, preparation phase, functional warm-up, cool-down, progressive preparation, FITT | Programming playbooks + `PHRASE_BOOSTS` |
| Health markers | Resting heart rate, blood pressure awareness, BMI caveats, waist circumference | Assessment-style playbooks + boosts (no clinical diagnosis paths) |
| Special populations (Ch. 17) | Older adults, youth, pregnancy, hypertension, diabetes | Dedicated `ncsf-*` playbooks + umbrella scope/clearance playbook |
| Nutrition / weight (Ch. 8 / 11) | Protein distribution, multifactorial weight management, energy balance | Nutrition playbooks + boosts |

Exact chapter numbers vary by edition; treat the table as **topic alignment**, not a page-level map of any single textbook.

## Disclaimer

- Content is written for **personal trainers coaching movement and programs**.
- Do **not** treat templates or AI retrieval as clinical diagnosis, medical clearance, or NCSF-official text.
- Pain, red flags, and special populations still require referral and professional judgment outside this app.
- NCSF remains the authority for its own curriculum; this file only documents product enrichment sources at a high level.

## Assessment slugs added (NCSF-grounded screens)

| Slug | Name | Coaching intent |
|------|------|-----------------|
| `plank-hold-screen` | Plank Hold Screen | Trunk stability endurance (seconds, form notes, pain) |
| `wall-angel-screen` | Wall Angel Screen | Thoracic / shoulder mobility (pass/fail, pain, notes) |
| `single-leg-glute-bridge` | Single-Leg Glute Bridge Screen | Glute activation / hip extension (hold + quality, laterality) |
| `seated-posture-screen` | Seated Posture Screen | Desk-relevant posture snapshot (head, shoulders, rib–pelvis stack) |

Existing templates (e.g. `posture-static`, `overhead-squat`, `pushup-screen`) were left in place; these are **additive**. Tags include `ncsf` so coach exercise suggestions can link related playbooks.

## Playbooks (`ncsf-*`) — 20 in seed

Defined in `src/db/ncsf-playbooks-data.ts` as `NCSF_PLAYBOOKS`, spread into seed via `...NCSF_PLAYBOOKS` in `src/db/seed-playbooks.ts`. Seed **upserts by slug** and refreshes search chunks.

### Conventions

- Shared disclaimer on every body via `NCSF_DISCLAIMER`
- 4–5 follow-ups, 5–6 steps, 3–4 interventions, 3–4 red flags
- Safety / special-pop entries include `contraindications`
- Trigger phrases include retrieval boost strings so phrase scoring can fire
- Umbrella `ncsf-special-populations-caution` does **not** steal specific-population query phrases (older adult, youth, pregnancy, etc.) — those go to dedicated playbooks

### Catalog

| Slug | Topic |
|------|--------|
| `ncsf-needs-analysis-priority` | Needs analysis / goal priority |
| `ncsf-kinetic-chain-local-global` | Kinetic chain; local vs global |
| `ncsf-form-force-closure` | Form vs force closure framing |
| `ncsf-preparation-phase` | Preparation phase language |
| `ncsf-warmup-types` | Warm-up types / functional prep |
| `ncsf-cooldown-basics` | Cool-down / blood pooling |
| `ncsf-resting-vitals-screen` | Resting vitals awareness |
| `ncsf-body-comp-bmi-caveats` | Body comp / BMI caveats |
| `ncsf-upper-cross-corrective` | Upper cross–style coaching |
| `ncsf-lower-cross-corrective` | Lower cross–style coaching |
| `ncsf-special-populations-caution` | Scope & clearance umbrella |
| `ncsf-older-adult-training` | Older adult / senior training |
| `ncsf-youth-training` | Youth / adolescent training |
| `ncsf-pregnancy-exercise` | Pregnancy / prenatal caution |
| `ncsf-hypertension-training` | Hypertension / high BP training |
| `ncsf-diabetes-exercise-caution` | Diabetes / hypo awareness |
| `ncsf-protein-training-support` | Protein / training support |
| `ncsf-weight-management-coaching` | Weight management / energy balance |
| `ncsf-resistance-progression` | Resistance progression |
| `ncsf-cardio-programming-basics` | Cardio / CRF programming |

### Related core playbooks (no `ncsf-` prefix)

**34** process / screen / pain playbooks live in `src/db/core-playbooks-data.ts` (`CORE_PLAYBOOKS`). Examples: `forward-head-rounded-shoulders`, `anterior-pelvic-tilt-coaching`, `warmup-design`, `core-bracing-basics`, `program-design-basics`, `pain-traffic-light`, `progressive-overload`.

Core and NCSF pair intentionally:
- Core `warmup-design` ↔ NCSF warm-up types
- Core `fat-loss-training-bias` ↔ NCSF weight-management coaching
- Core `progressive-overload` ↔ NCSF resistance progression

### Reseed note (local PGlite)

Restart the app after pulling playbook changes. Seed upserts by slug and rebuilds chunks so titles, triggers, and bodies refresh on existing DBs.

## Code touchpoints

- Assessment catalog: `src/db/assessment-templates-data.ts`
- Core playbooks: `src/db/core-playbooks-data.ts` (`CORE_PLAYBOOKS`)
- NCSF playbooks: `src/db/ncsf-playbooks-data.ts` (`NCSF_PLAYBOOKS`)
- Coach retrieval boosts: `src/lib/ai/retrieval.ts` (`PHRASE_BOOSTS`)
- Playbook seed: `src/db/seed-playbooks.ts` (`[...CORE_PLAYBOOKS, ...NCSF_PLAYBOOKS]`)
