"""Re-export questions_bank.json from web/questions.js (migration / recovery only)."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import question_utils as qu

ROOT = Path(__file__).resolve().parent
QUESTIONS_BANK_JSON = ROOT / "questions_bank.json"
QUESTIONS_JS = ROOT / "web" / "questions.js"


def strip_manual_suffix(explanation: str) -> str:
    text = (explanation or "").strip()
    for marker in ("NCSF Manual reference:", " This question tests"):
        if marker in text:
            text = text.split(marker)[0]
    return text.strip()


def load_exam_questions() -> list[dict]:
    text = QUESTIONS_JS.read_text(encoding="utf-8")
    match = re.search(r"const EXAM_QUESTIONS = (\[.*?\]);", text, re.S)
    if not match:
        raise RuntimeError(f"Could not parse EXAM_QUESTIONS from {QUESTIONS_JS}")
    return json.loads(match.group(1))


def js_to_bank(q: dict) -> dict:
    correct = q["options"][q["correctIndex"]]
    record = {
        "number": q["id"],
        "question": q["question"],
        "answer": correct,
        "wrong": [opt for i, opt in enumerate(q["options"]) if i != q["correctIndex"]],
        "explanation": strip_manual_suffix(q.get("explanation", "")),
    }
    if q.get("imagePaths"):
        record["imagePaths"] = q["imagePaths"]
    if q.get("optionImages"):
        record["optionImages"] = q["optionImages"]
    return record


def main() -> int:
    records = [js_to_bank(q) for q in load_exam_questions()]
    records.sort(key=lambda r: r["number"])

    seen_numbers: set[int] = set()
    seen_text: dict[str, int] = {}
    for record in records:
        if record["number"] in seen_numbers:
            raise ValueError(f"Duplicate number: {record['number']}")
        seen_numbers.add(record["number"])
        key = qu.normalize_question(record["question"])
        if key in seen_text:
            raise ValueError(f"Duplicate text: Q{seen_text[key]} & Q{record['number']}")
        seen_text[key] = record["number"]

    payload = {
        "version": "unified-v2",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "description": "Canonical question bank. Edit this file, then run build_master_database.py.",
        "stats": {
            "total": len(records),
            "number_min": records[0]["number"],
            "number_max": records[-1]["number"],
        },
        "questions": records,
    }
    QUESTIONS_BANK_JSON.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(records)} questions to {QUESTIONS_BANK_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())