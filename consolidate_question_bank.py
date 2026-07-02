"""Build the single canonical questions_bank.json from the live question pool.

Run after editing questions_bank.json by hand, or to re-import from web/questions.js
when migrating. Day-to-day workflow: edit questions_bank.json → build_master_database.py
"""
from __future__ import annotations

import importlib.util
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
QUESTIONS_BANK_JSON = ROOT / "questions_bank.json"
QUESTIONS_JS = ROOT / "web" / "questions.js"
BANK_VERSION = "unified-v2"

_spec = importlib.util.spec_from_file_location(
    "parse_quiz_txt", str(ROOT / "parse_quiz_txt.py")
)
_pqt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pqt)


def load_exam_questions() -> list[dict]:
    text = QUESTIONS_JS.read_text(encoding="utf-8")
    match = re.search(r"const EXAM_QUESTIONS = (\[.*?\]);", text, re.S)
    if not match:
        raise RuntimeError(f"Could not parse EXAM_QUESTIONS from {QUESTIONS_JS}")
    return json.loads(match.group(1))


def strip_manual_suffix(explanation: str) -> str:
    text = (explanation or "").strip()
    for marker in ("NCSF Manual reference:", " This question tests"):
        if marker in text:
            text = text.split(marker)[0]
    return text.strip()


def js_record_to_bank(q: dict) -> dict:
    correct = q["options"][q["correctIndex"]]
    wrong = [opt for i, opt in enumerate(q["options"]) if i != q["correctIndex"]]
    record = {
        "number": q["id"],
        "question": q["question"],
        "answer": correct,
        "wrong": wrong,
        "explanation": strip_manual_suffix(q.get("explanation", "")),
        "source": q.get("source", "questions_bank.json"),
    }
    if q.get("imagePaths"):
        record["imagePaths"] = q["imagePaths"]
    if q.get("optionImages"):
        record["optionImages"] = q["optionImages"]
    return record


def validate_numbers(records: list[dict]) -> None:
    seen_numbers: set[int] = set()
    seen_questions: dict[str, int] = {}
    dup_questions: list[tuple[str, int, int]] = []

    for record in records:
        number = record["number"]
        if number in seen_numbers:
            raise ValueError(f"Duplicate question number: {number}")
        seen_numbers.add(number)

        key = _pqt.normalize_question(record["question"])
        if key in seen_questions:
            dup_questions.append((record["question"], seen_questions[key], number))
        else:
            seen_questions[key] = number

    if dup_questions:
        lines = [
            f"  Q{old} & Q{new}: {text[:80]}..."
            for text, old, new in dup_questions
        ]
        raise ValueError(
            "Duplicate question text detected:\n" + "\n".join(lines)
        )


def source_stats(records: list[dict]) -> dict:
    counts: dict[str, int] = defaultdict(int)
    for record in records:
        for part in record.get("source", "unknown").split("+"):
            counts[part.strip()] += 1
    return dict(sorted(counts.items()))


def main() -> int:
    exam = load_exam_questions()
    records = [js_record_to_bank(q) for q in exam]
    records.sort(key=lambda r: r["number"])
    validate_numbers(records)

    payload = {
        "version": BANK_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "description": (
            "Canonical NCSF CPT question bank. Edit this file, then run "
            "build_master_database.py to regenerate web/questions.js."
        ),
        "stats": {
            "total": len(records),
            "number_min": records[0]["number"],
            "number_max": records[-1]["number"],
            "sources": source_stats(records),
        },
        "questions": records,
    }

    QUESTIONS_BANK_JSON.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {QUESTIONS_BANK_JSON}")
    print(f"  questions: {len(records)}")
    print(f"  number range: Q{records[0]['number']}–Q{records[-1]['number']}")
    print(f"  sources: {payload['stats']['sources']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())