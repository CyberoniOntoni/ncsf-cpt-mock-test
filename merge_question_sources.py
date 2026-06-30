"""Merge quiz.txt, extraq.docx, and questions.docx into questions_bank.json."""
from __future__ import annotations

import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
QUESTIONS_BANK_JSON = ROOT / "questions_bank.json"

_spec = importlib.util.spec_from_file_location(
    "build_master_database", str(ROOT / "build_master_database.py")
)
_bmd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bmd)


def bank_record(item: dict) -> dict:
    record = {
        "question": item["q"],
        "answer": item["a"],
        "wrong": item["wrong"],
        "explanation": item.get("base_exp", ""),
        "source": item.get("source", ""),
    }
    if item.get("imagePaths"):
        record["imagePaths"] = item["imagePaths"]
    if item.get("optionImages"):
        record["optionImages"] = item["optionImages"]
    return record


def main() -> int:
    merged, stats = _bmd.merge_quiz_docx_sources()
    deduped, removed = _bmd.deduplicate_near_duplicates(merged)

    payload = {
        "version": "combined-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sources": ["quiz.txt", "extraq.docx", "questions.docx"],
        "stats": {
            **stats,
            "pre_dedup_count": len(merged),
            "deduplicated_count": len(deduped),
            "duplicates_removed": removed,
        },
        "questions": [bank_record(item) for item in deduped],
    }

    QUESTIONS_BANK_JSON.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {QUESTIONS_BANK_JSON}")
    print(f"  quiz.txt: {stats['quiz_count']}")
    print(f"  extraq.docx (new): {stats['extraq_added']}")
    print(f"  extraq.docx (enhanced existing): {stats['extraq_enhanced']}")
    print(f"  questions.docx (new): {stats['questions_docx_added']}")
    print(f"  questions.docx (enhanced existing): {stats['questions_docx_enhanced']}")
    if removed:
        print(f"  near-duplicates removed: {removed} (from {len(merged)})")
    print(f"  total in bank: {len(deduped)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())