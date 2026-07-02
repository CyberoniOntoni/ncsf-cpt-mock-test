"""Build web/questions.js from questions_bank.json."""
from __future__ import annotations

import importlib.util
import json
import random
from pathlib import Path

import question_utils as qu

ROOT = Path(__file__).resolve().parent
QUESTIONS_BANK_JSON = ROOT / "questions_bank.json"
OUTPUT = ROOT / "web" / "questions.js"
MANIFEST_JSON = ROOT / "merged_database_manifest.json"

DISTRACTOR_FIXES = {
    "which of the following is a key recommendation when creating an exercise prescription for an obese client": [
        "Increase high-impact plyometric training to maximize caloric burn",
        "Focus on maximal heavy resistance training above 90% 1RM initially",
        "Use only static stretching as the primary mode of exercise",
    ],
    "when constructing an exercise prescription for an obese client which of the following is an important recommendation": [
        "Increase high-impact plyometric training to maximize caloric burn",
        "Focus on maximal heavy resistance training above 90% 1RM initially",
        "Use only static stretching as the primary mode of exercise",
    ],
}


def load_bank() -> tuple[list[dict], dict]:
    if not QUESTIONS_BANK_JSON.exists():
        raise FileNotFoundError(f"{QUESTIONS_BANK_JSON.name} not found.")
    payload = json.loads(QUESTIONS_BANK_JSON.read_text(encoding="utf-8"))
    questions = payload.get("questions")
    if not isinstance(questions, list) or not questions:
        raise ValueError(f"{QUESTIONS_BANK_JSON.name} has no questions array")
    return questions, payload


def validate_bank(records: list[dict]) -> None:
    numbers: set[int] = set()
    text_keys: dict[str, int] = {}
    for record in records:
        number = record.get("number")
        if number is None:
            raise ValueError(f"Missing number: {record.get('question', '')[:80]}")
        if number in numbers:
            raise ValueError(f"Duplicate question number: {number}")
        numbers.add(number)

        key = qu.normalize_question(record["question"])
        if key in text_keys:
            raise ValueError(
                f"Duplicate question text: Q{text_keys[key]} and Q{number} — "
                f"{record['question'][:80]}"
            )
        text_keys[key] = number


def apply_distractor_fixes(record: dict) -> None:
    key = qu.normalize_question(record["question"])
    fixed = DISTRACTOR_FIXES.get(key)
    if fixed:
        answer = record["answer"].lower()
        record["wrong"] = [w for w in fixed if w.lower() != answer][:3]


def to_exam_question(record: dict, manual_ref: dict | None) -> dict:
    apply_distractor_fixes(record)
    explanation = qu.enrich_explanation(
        record["question"],
        record["answer"],
        record["wrong"],
        record.get("explanation", ""),
        manual_ref,
    )
    options = record["wrong"] + [record["answer"]]
    random.shuffle(options)
    entry = {
        "id": record["number"],
        "question": record["question"],
        "options": options,
        "correctIndex": options.index(record["answer"]),
        "explanation": explanation,
    }
    if manual_ref and manual_ref.get("reference_text"):
        entry["manualReference"] = manual_ref["reference_text"]
    if record.get("imagePaths"):
        entry["imagePaths"] = record["imagePaths"]
    if record.get("optionImages"):
        entry["optionImages"] = record["optionImages"]
    return entry


def write_questions_js(questions: list[dict]) -> None:
    OUTPUT.write_text(
        "const EXAM_QUESTIONS = " + json.dumps(questions, indent=2, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


def main() -> int:
    records, payload = load_bank()
    validate_bank(records)
    manual_by_question = qu.load_manual_references()

    random.seed(42)
    output = [
        to_exam_question(record, manual_by_question.get(qu.normalize_question(record["question"])))
        for record in sorted(records, key=lambda r: r["number"])
    ]

    write_questions_js(output)
    ids = [q["id"] for q in output]
    manifest = {
        "total_questions": len(output),
        "number_min": min(ids),
        "number_max": max(ids),
        "bank_version": payload.get("version"),
        "retired_numbers": payload.get("stats", {}).get("retired_numbers", []),
        "output": str(OUTPUT.relative_to(ROOT)),
    }
    MANIFEST_JSON.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    with_ref = sum(1 for q in output if q.get("manualReference"))
    print(f"Built {len(output)} questions → {OUTPUT}")
    print(f"  manual references: {with_ref}/{len(output)}")

    _spec = importlib.util.spec_from_file_location(
        "add_missing_manual_refs", str(ROOT / "add_missing_manual_refs.py")
    )
    _amr = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_amr)
    backfill = _amr.backfill_missing_references(output, write_report=False)
    if backfill["added"]:
        write_questions_js(output)
        print(f"  backfilled {backfill['added']} manual references from PDFs")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())