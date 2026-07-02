"""DEPRECATED — raw source merge replaced by questions_bank.json.

Edit questions_bank.json directly, then run:
  python build_master_database.py

To regenerate the bank from web/questions.js (one-time migration):
  python consolidate_question_bank.py
"""
from __future__ import annotations

import sys


def main() -> int:
    print(
        "merge_question_sources.py is deprecated.\n"
        "  Edit questions_bank.json, then: python build_master_database.py\n"
        "  Re-export bank from live pool: python consolidate_question_bank.py"
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())