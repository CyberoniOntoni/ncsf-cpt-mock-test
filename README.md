# NCSF CPT Free Mock Test

Free practice exam for the NCSF Certified Personal Trainer (CPT) certification.

**Live site:** [https://ncsf.50bar.app/](https://ncsf.50bar.app/)

## Features

- 150 randomized questions per attempt from the full practice pool
- Sources: Quizlet bank, YouTube video questions, `extraq.docx`, and `questions.docx`
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

Combine the three primary source files into one bank, then build the exam:

```bash
python merge_question_sources.py   # quiz.txt + extraq.docx + questions.docx → questions_bank.json
python build_master_database.py    # questions_bank.json + youtube bank → web/questions.js
```

`questions_bank.json` is the single merged source for the Quizlet export and both Word banks. Re-run `merge_question_sources.py` after editing any of `quiz.txt`, `extraq.docx`, or `questions.docx`.

Requires `quiz.txt`, `extraq.docx`, `questions.docx`, and `manual_references.json` in the repo root.

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