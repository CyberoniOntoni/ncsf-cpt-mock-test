# NCSF CPT Free Mock Test

Free practice exam for the NCSF Certified Personal Trainer (CPT) certification.

**Live site:** [https://ncsf.50bar.app/](https://ncsf.50bar.app/)

## Features

- 150 randomized questions per attempt from a 409-question pool
- Stable pool IDs (e.g. Q80) for reporting issues
- Shuffled answer options every attempt
- Instant feedback with explanations
- 70% passing score (105/150 correct)
- Illustrated questions where available

## Local development

```bash
cd web
npm install
npx wrangler pages dev .
```

## Edit questions

1. Edit `questions_bank.json` (find questions by `number`)
2. Rebuild: `python build_master_database.py`
3. Deploy from `web/`

```bash
python build_master_database.py   # → web/questions.js (+ PDF manual-ref backfill)
cd web && npm run deploy
```

## Project structure

| Path | Purpose |
|------|---------|
| `web/` | Static exam app |
| `questions_bank.json` | Canonical question bank |
| `build_master_database.py` | Bank → `web/questions.js` |
| `question_utils.py` | Shared normalize/enrich helpers |
| `manual_references.json` | NCSF manual reference metadata |
| `consolidate_question_bank.py` | Recovery: re-export bank from `questions.js` |

## DNS (Cloudflare)

| Type | Name | Target | Proxied |
|------|------|--------|---------|
| CNAME | `ncsf` | `ncsf-mock-exam.pages.dev` | Yes |

## License

Study tool for personal certification prep. NCSF is a trademark of its respective owner.