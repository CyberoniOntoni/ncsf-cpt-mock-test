# NCSF CPT Free Mock Test

Free practice exam for the NCSF Certified Personal Trainer (CPT) certification.

**Live site:** [https://ncsf.50bar.app/](https://ncsf.50bar.app/)

## Features

- 150 randomized questions per attempt from the full practice pool
- 409-question verified practice pool (`questions_bank.json`)
- Shuffled answer options every attempt
- Instant feedback with detailed explanations for wrong answers
- 70% passing score (105/150 correct)
- Illustrated questions where available

## Local development

```bash
cd web
npm install
npx wrangler pages dev .
```

## Rebuild question database

Edit `questions_bank.json`, then rebuild:

```bash
python build_master_database.py    # questions_bank.json → web/questions.js (auto PDF backfill)
```

Each question has a stable `number` field (e.g. Q80). Retired numbers are listed in `retired_numbers`.

## Deploy to Cloudflare Pages

```bash
python build_master_database.py
cd web
npm install
npm run deploy
```

Optional local helper (not committed — copy from example):

```bash
cp web/deploy_pages.example.py web/deploy_pages.py
# Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in your environment
python web/deploy_pages.py
```

Configured custom domain: `ncsf.50bar.app` (Cloudflare Pages project `ncsf-mock-exam`). Never commit API tokens or `.env` files.

If the custom domain shows “CNAME record not set”, add this DNS record once in the Cloudflare dashboard for `50bar.app`:

| Type | Name | Target | Proxied |
|------|------|--------|---------|
| CNAME | `ncsf` | `ncsf-mock-exam.pages.dev` | Yes |

## Project structure

| Path | Purpose |
|------|---------|
| `web/` | Web app (HTML, CSS, JS, images) |
| `questions_bank.json` | Combined question bank (`quiz.txt` + `extraq.docx` + `questions.docx`) |
| `merge_question_sources.py` | Builds `questions_bank.json` from the three source files |
| `build_master_database.py` | Merges `questions_bank.json` + YouTube bank into `questions.js` |
| `parse_quiz_txt.py` | Quizlet source parser and explanation engine |
| `parse_ncsf_questions.py` | YouTube/video question bank |
| `parse_extraq_docx.py` | Supplemental DOCX questions + images |
| `quiz.txt` | Primary 150-question Quizlet export |
| `extraq.docx` | Supplemental questions with figures |
| `questions.docx` | Additional questions with explanations and images |
| `manual_references.json` | NCSF manual reference metadata |

## License

Study tool for personal certification prep. NCSF is a trademark of its respective owner.