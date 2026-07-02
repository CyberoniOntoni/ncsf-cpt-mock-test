"""Shared helpers for the question bank build pipeline."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANUAL_REFS = ROOT / "manual_references.json"


def normalize_question(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[_\s]+", " ", text)
    text = re.sub(r"[^\w\s%./-]", "", text)
    return text


def load_manual_references() -> dict:
    if not MANUAL_REFS.exists():
        return {}
    data = json.loads(MANUAL_REFS.read_text(encoding="utf-8"))
    return {normalize_question(item["question"]): item for item in data}


def append_manual_reference(explanation: str, reference_text: str) -> str:
    if not reference_text or reference_text in explanation:
        return explanation
    if "NCSF Manual reference:" in explanation:
        return explanation
    return f"{explanation.rstrip()} {reference_text}"


def enrich_explanation(question, correct, wrong, base, manual_ref=None) -> str:
    del question, correct, wrong  # bank carries the authoritative explanation
    base = (base or "").strip()
    base = re.sub(
        r" This question tests.*?NCSF Certified Personal Trainer exam\.",
        "",
        base,
    )
    ref_text = (manual_ref or {}).get("reference_text", "")
    return append_manual_reference(base, ref_text)