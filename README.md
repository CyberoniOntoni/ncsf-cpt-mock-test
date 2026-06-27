# NCSF CPT Free Mock Test

Free practice exam for the NCSF Certified Personal Trainer (CPT) certification.

**Live site:** [https://ncsf.50bar.app/](https://ncsf.50bar.app/)

## Features

- 150 randomized questions per attempt from a 418-question pool
- Sources: Quizlet bank, YouTube video questions, and supplemental DOCX items
- Shuffled answer options every attempt
- Instant feedback with detailed explanations for wrong answers
- 70% passing score (105/150 correct)
- Illustrated questions where available

## Local development

```bash
cd shuffledtest
npm install
npx wrangler pages dev .
```

## Rebuild question database

```bash
python build_master_database.py
```

Requires `quiz.txt`, `extraq.docx`, and `manual_references.json` in the repo root.

## Deploy to Cloudflare Pages

```bash
python build_master_database.py
cd shuffledtest
npm install
npm run deploy
```

Optional local helper (not committed — copy from example):

```bash
cp shuffledtest/deploy_pages.example.py shuffledtest/deploy_pages.py
# Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in your environment
python shuffledtest/deploy_pages.py
```

Configured custom domain: `ncsf.50bar.app` (Cloudflare Pages project `ncsf-mock-exam`). Never commit API tokens or `.env` files.

If the custom domain shows “CNAME record not set”, add this DNS record once in the Cloudflare dashboard for `50bar.app`:

| Type | Name | Target | Proxied |
|------|------|--------|---------|
| CNAME | `ncsf` | `ncsf-mock-exam.pages.dev` | Yes |

## Project structure

| Path | Purpose |
|------|---------|
| `shuffledtest/` | Web app (HTML, CSS, JS, images) |
| `build_master_database.py` | Merges all question banks into `questions.js` |
| `parse_quiz_txt.py` | Quizlet source parser and explanation engine |
| `parse_ncsf_questions.py` | YouTube/video question bank |
| `parse_extraq_docx.py` | Supplemental DOCX questions + images |
| `quiz.txt` | Primary 150-question Quizlet export |
| `extraq.docx` | Supplemental questions with figures |
| `manual_references.json` | NCSF manual reference metadata |

## License

Study tool for personal certification prep. NCSF is a trademark of its respective owner.