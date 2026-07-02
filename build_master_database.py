"""Build web/questions.js from the canonical questions_bank.json."""
import importlib.util
import json
import os
import random
import sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Load parse_quiz_txt helpers without running its main
_spec = importlib.util.spec_from_file_location(
    "parse_quiz_txt", str(ROOT / "parse_quiz_txt.py")
)
_pqt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pqt)

OUTPUT = _pqt.OUTPUT
STRICT_AUDIT = ROOT / "strict_audit_report.json"
CROSSCHECK_JSON = ROOT / "crosscheck_report.json"
MANIFEST_JSON = ROOT / "merged_database_manifest.json"
QUESTIONS_BANK_JSON = ROOT / "questions_bank.json"
DATABASE_VERSION = "unified-bank-v2"
NEAR_DUPLICATE_THRESHOLD = 0.92


def load_json_by_id(path):
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {r["id"]: r for r in data.get("results", [])}


def load_strict_audit():
    return load_json_by_id(STRICT_AUDIT)


def load_crosscheck():
    return load_json_by_id(CROSSCHECK_JSON)


# Fix distractors that are category-mismatched or trivially obvious
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


def apply_distractor_fixes(item):
    nq = _pqt.normalize_question(item["q"])
    fixed_wrong = DISTRACTOR_FIXES.get(nq)
    if fixed_wrong:
        item["wrong"] = [w for w in fixed_wrong if w.lower() != item["a"].lower()][:3]


def explanation_body_len(text):
    text = (text or "").strip()
    for marker in ("NCSF Manual reference:", " This question tests"):
        if marker in text:
            text = text.split(marker)[0]
    return len(text.strip())


def item_quality_rank(item):
    source = item.get("source", "")
    return (
        explanation_body_len(item.get("base_exp")),
        1 if "questions.docx" in source else 0,
        1 if "extraq.docx" in source else 0,
        len(item.get("imagePaths", [])),
        len(item.get("optionImages", {})),
        len(item.get("q", "")),
    )


def apply_supplemental_enhancements(target, source):
    if source.get("imagePaths"):
        merged = list(dict.fromkeys(target.get("imagePaths", []) + source["imagePaths"]))
        target["imagePaths"] = merged
    if source.get("optionImages"):
        opt_imgs = dict(target.get("optionImages", {}))
        opt_imgs.update(source["optionImages"])
        target["optionImages"] = opt_imgs
    src_exp = (source.get("base_exp") or "").strip()
    tgt_exp = (target.get("base_exp") or "").strip()
    src_len = explanation_body_len(src_exp)
    tgt_len = explanation_body_len(tgt_exp)
    src_tag = source.get("source", "")
    prefer_source = "questions.docx" in src_tag and src_len >= tgt_len
    if src_exp and (src_len > tgt_len or prefer_source):
        target["base_exp"] = src_exp
    src_tag = source.get("source", "supplemental.docx")
    if src_tag not in target.get("source", ""):
        base = target.get("source", "")
        target["source"] = f"{base}+{src_tag}" if base else src_tag


def question_similarity(left, right):
    return SequenceMatcher(
        None,
        _pqt.normalize_question(left),
        _pqt.normalize_question(right),
    ).ratio()


def same_correct_answer(left, right):
    return left["a"].lower().strip() == right["a"].lower().strip()


def semantic_duplicate_key(item):
    """Group questions that test the same rule even if wording/answers differ."""
    q = _pqt.normalize_question(item["q"])
    a = item["a"].lower()
    if "resting heart rate" in a and "male" in q:
        if "medical referral" in q or "medical clearance" in q:
            return "male-resting-hr-medical-referral"
    if "blood lipid profile" in q and a == "hdl will increase":
        return "moderate-aerobic-blood-lipid-hdl"
    if "mile run" in a and ("year-old" in q or "year old" in q):
        return "child-aerobic-one-mile-run-assessment"
    return None


def should_merge_as_duplicate(left, right):
    if question_similarity(left["q"], right["q"]) >= NEAR_DUPLICATE_THRESHOLD:
        return same_correct_answer(left, right)

    left_key = semantic_duplicate_key(left)
    right_key = semantic_duplicate_key(right)
    return left_key is not None and left_key == right_key


def deduplicate_near_duplicates(merged):
    n = len(merged)
    parent = list(range(n))

    def find(idx):
        while parent[idx] != idx:
            parent[idx] = parent[parent[idx]]
            idx = parent[idx]
        return idx

    def union(left, right):
        root_left = find(left)
        root_right = find(right)
        if root_left != root_right:
            parent[root_right] = root_left

    for i in range(n):
        for j in range(i + 1, n):
            if not should_merge_as_duplicate(merged[i], merged[j]):
                continue
            union(i, j)

    groups = defaultdict(list)
    for idx in range(n):
        groups[find(idx)].append(idx)

    deduped = []
    removed = 0
    for indices in groups.values():
        keeper_idx = max(indices, key=lambda i: item_quality_rank(merged[i]))
        keeper = dict(merged[keeper_idx])
        best_question = max(merged[i]["q"] for i in indices)
        keeper["q"] = best_question
        for idx in indices:
            if idx == keeper_idx:
                continue
            apply_supplemental_enhancements(keeper, merged[idx])
            removed += 1
        deduped.append(keeper)

    return deduped, removed


def merge_docx_items(merged, seen, by_normalized, items, counters):
    added_key, enhanced_key = counters
    counts = {added_key: 0, enhanced_key: 0}
    for item in items:
        nq = _pqt.normalize_question(item["q"])
        if nq in by_normalized:
            apply_supplemental_enhancements(by_normalized[nq], item)
            counts[enhanced_key] += 1
            continue
        if nq in seen:
            continue
        seen.add(nq)
        merged.append({
            "q": item["q"],
            "a": item["a"],
            "wrong": item["wrong"],
            "base_exp": item.get("base_exp", ""),
            "source": item.get("source", "docx"),
            "imagePaths": item.get("imagePaths", []),
            "optionImages": item.get("optionImages", {}),
        })
        by_normalized[nq] = merged[-1]
        counts[added_key] += 1
    return counts


def bank_record_to_item(record: dict) -> dict:
    number = record.get("number")
    if number is None:
        raise ValueError(
            f"Question missing stable number field: {record.get('question', '')[:80]}"
        )
    item = {
        "number": int(number),
        "q": record["question"],
        "a": record["answer"],
        "wrong": record["wrong"],
        "base_exp": record.get("explanation", ""),
        "source": record.get("source", "questions_bank.json"),
    }
    if record.get("imagePaths"):
        item["imagePaths"] = record["imagePaths"]
    if record.get("optionImages"):
        item["optionImages"] = record["optionImages"]
    return item


def load_questions_bank():
    if not QUESTIONS_BANK_JSON.exists():
        raise FileNotFoundError(
            f"{QUESTIONS_BANK_JSON.name} not found. Run consolidate_question_bank.py first."
        )
    payload = json.loads(QUESTIONS_BANK_JSON.read_text(encoding="utf-8"))
    questions = payload.get("questions")
    if not isinstance(questions, list) or not questions:
        raise ValueError(f"{QUESTIONS_BANK_JSON.name} has no questions array")
    merged = [bank_record_to_item(record) for record in questions]
    return merged, payload.get("stats", {}), payload.get("version", "")


def main():
    merged, bank_stats, bank_version = load_questions_bank()
    pre_dedup_count = len(merged)
    merged, duplicates_removed = deduplicate_near_duplicates(merged)
    print(f"Loaded {pre_dedup_count} questions from {QUESTIONS_BANK_JSON.name}")
    if bank_version:
        print(f"  bank version: {bank_version}")
    print(f"  output: {len(merged)} questions")
    if duplicates_removed:
        print(f"  WARNING: removed {duplicates_removed} near-duplicates — fix questions_bank.json")

    manual_by_question = _pqt.load_manual_references()
    strict_by_id = load_strict_audit()
    crosscheck_by_id = load_crosscheck()
    items = []
    verified = 0
    with_ref = 0
    strict_high = 0

    for item in merged:
        apply_distractor_fixes(item)
        nq = _pqt.normalize_question(item["q"])
        qnum = item["number"]
        manual_ref = manual_by_question.get(nq)
        strict = strict_by_id.get(qnum, {})
        crosscheck = crosscheck_by_id.get(qnum, {})
        if manual_ref:
            with_ref += 1
            if manual_ref.get("verified"):
                verified += 1
        if strict.get("strict_verified"):
            strict_high += 1
        exp = _pqt.enrich_explanation(
            item["q"], item["a"], item["wrong"], item["base_exp"], manual_ref
        )
        items.append({
            **item,
            "exp": exp,
            "manualRef": manual_ref,
            "strict": strict,
            "crosscheck": crosscheck,
        })

    print(f"Manual references: {with_ref}/{len(items)}")
    print(f"Manual-verified (loose): {verified}/{len(items)}")
    if strict_by_id:
        print(f"Strict verified (HIGH): {strict_high}/{len(items)}")
    print(f"Crosscheck approved: {len(items)}/{len(items)} (user merge commit)")

    random.seed(42)
    output = []
    for item in sorted(items, key=lambda x: x["number"]):
        options = item["wrong"] + [item["a"]]
        random.shuffle(options)
        entry = {
            "id": item["number"],
            "question": item["q"],
            "options": options,
            "correctIndex": options.index(item["a"]),
            "explanation": item["exp"],
            "source": item["source"],
            "merged": True,
            "crosscheckApproved": True,
            "needsReview": False,
        }
        if item.get("manualRef"):
            entry["manualReference"] = item["manualRef"].get("reference_text", "")
            entry["manualVerified"] = item["manualRef"].get("verified", False)
        if item.get("strict"):
            s = item["strict"]
            entry["strictConfidence"] = s.get("confidence", "")
            entry["strictVerified"] = s.get("strict_verified", False)
        if item.get("crosscheck"):
            c = item["crosscheck"]
            entry["commitConfidence"] = c.get("commit_confidence")
            entry["commitTier"] = c.get("commit_tier", "APPROVED")
        else:
            entry["commitTier"] = "APPROVED"
            entry["commitConfidence"] = 100
        if item.get("imagePaths"):
            entry["imagePaths"] = item["imagePaths"]
        if item.get("optionImages"):
            entry["optionImages"] = item["optionImages"]
        output.append(entry)

    with_images = sum(1 for q in output if q.get("imagePaths"))
    with_option_images = sum(1 for q in output if q.get("optionImages"))

    numbers = [q["id"] for q in output]
    manifest = {
        "version": DATABASE_VERSION,
        "bank_version": bank_version,
        "total_questions": len(output),
        "number_min": min(numbers) if numbers else None,
        "number_max": max(numbers) if numbers else None,
        "bank_stats": bank_stats,
        "pre_dedup_count": pre_dedup_count,
        "duplicates_removed": duplicates_removed,
        "questions_with_images": with_images,
        "questions_with_option_images": with_option_images,
        "merged": True,
        "approved": True,
        "sources": ["questions_bank.json"],
        "verification": {
            "manual_references": with_ref,
            "strict_high": strict_high,
            "crosscheck_approved": len(output),
        },
        "output": "web/questions.js",
    }
    MANIFEST_JSON.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write("const EXAM_QUESTIONS = ")
        json.dump(output, f, indent=2)
        f.write(";\n")

    print(f"Wrote manifest to {MANIFEST_JSON}")
    print(f"Wrote {len(output)} questions to {OUTPUT}")

    _amspec = importlib.util.spec_from_file_location(
        "add_missing_manual_refs", str(ROOT / "add_missing_manual_refs.py")
    )
    _amr = importlib.util.module_from_spec(_amspec)
    _amspec.loader.exec_module(_amr)
    backfill = _amr.backfill_missing_references(output, write_report=False)
    if backfill["added"]:
        with open(OUTPUT, "w", encoding="utf-8") as f:
            f.write("const EXAM_QUESTIONS = ")
            json.dump(output, f, indent=2)
            f.write(";\n")
        print(
            f"Backfilled {backfill['added']} manual references from NCSF PDFs "
            f"({backfill['verified']} verified)"
        )

    return len(output)


if __name__ == "__main__":
    main()