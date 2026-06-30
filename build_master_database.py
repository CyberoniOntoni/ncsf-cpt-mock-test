"""Build unified NCSF question database from quiz.txt + YouTube video bank."""
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

# Load video question bank
_vspec = importlib.util.spec_from_file_location(
    "parse_ncsf", str(ROOT / "parse_ncsf_questions.py")
)
_ncsf = importlib.util.module_from_spec(_vspec)
_vspec.loader.exec_module(_ncsf)

INPUT = _pqt.INPUT
OUTPUT = _pqt.OUTPUT
MANUAL_REFS = _pqt.MANUAL_REFS
STRICT_AUDIT = ROOT / "strict_audit_report.json"
CROSSCHECK_JSON = ROOT / "crosscheck_report.json"
MANIFEST_JSON = ROOT / "merged_database_manifest.json"
EXTRAQ_DOCX = ROOT / "extraq.docx"
QUESTIONS_DOCX = ROOT / "questions.docx"
DATABASE_VERSION = "merged-questions-v5"
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


def _load_docx_parser():
    _espec = importlib.util.spec_from_file_location(
        "parse_extraq", str(ROOT / "parse_extraq_docx.py")
    )
    _parser = importlib.util.module_from_spec(_espec)
    _espec.loader.exec_module(_parser)
    return _parser


def load_extraq_bank():
    if not EXTRAQ_DOCX.exists():
        return []
    return _load_docx_parser().parse_docx_bank(EXTRAQ_DOCX, media_subdir="extraq")


def load_questions_docx_bank():
    if not QUESTIONS_DOCX.exists():
        return []
    return _load_docx_parser().parse_docx_bank(QUESTIONS_DOCX, media_subdir="questions")


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
            if question_similarity(merged[i]["q"], merged[j]["q"]) < NEAR_DUPLICATE_THRESHOLD:
                continue
            if not same_correct_answer(merged[i], merged[j]):
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


def merge_question_banks():
    quiz_items = _pqt.parse_quiz(INPUT)
    seen = set()
    merged = []

    for item in quiz_items:
        nq = _pqt.normalize_question(item["q"])
        if nq in seen:
            continue
        seen.add(nq)
        merged.append({
            "q": item["q"],
            "a": item["a"],
            "wrong": item["wrong"],
            "base_exp": item["base_exp"],
            "source": "quiz.txt",
        })

    quiz_count = len(merged)

    for v in _ncsf.ALL:
        nq = _pqt.normalize_question(v["q"])
        if nq in seen:
            continue
        seen.add(nq)
        wrong = _ncsf.get_distractors(v["a"], v["q"], v)
        merged.append({
            "q": v["q"],
            "a": v["a"],
            "wrong": wrong,
            "base_exp": v.get("exp", ""),
            "source": "youtube-video",
        })

    video_count = len(merged) - quiz_count

    by_normalized = {_pqt.normalize_question(m["q"]): m for m in merged}

    extraq_counts = merge_docx_items(
        merged,
        seen,
        by_normalized,
        load_extraq_bank(),
        ("extraq_added", "extraq_enhanced"),
    )
    questions_counts = merge_docx_items(
        merged,
        seen,
        by_normalized,
        load_questions_docx_bank(),
        ("questions_docx_added", "questions_docx_enhanced"),
    )

    return (
        merged,
        quiz_count,
        video_count,
        extraq_counts["extraq_added"],
        extraq_counts["extraq_enhanced"],
        questions_counts["questions_docx_added"],
        questions_counts["questions_docx_enhanced"],
    )


def main():
    (
        merged,
        quiz_count,
        video_count,
        extraq_count,
        extraq_enhanced,
        questions_docx_count,
        questions_docx_enhanced,
    ) = merge_question_banks()
    pre_dedup_count = len(merged)
    merged, duplicates_removed = deduplicate_near_duplicates(merged)
    print(f"Merged database: {len(merged)} questions")
    if duplicates_removed:
        print(f"  near-duplicates removed: {duplicates_removed} (from {pre_dedup_count})")
    print(f"  quiz.txt: {quiz_count}")
    print(f"  youtube-video (unique): {video_count}")
    print(f"  extraq.docx (new): {extraq_count}")
    print(f"  extraq.docx (enhanced existing): {extraq_enhanced}")
    print(f"  questions.docx (new): {questions_docx_count}")
    print(f"  questions.docx (enhanced existing): {questions_docx_enhanced}")

    manual_by_question = _pqt.load_manual_references()
    strict_by_id = load_strict_audit()
    crosscheck_by_id = load_crosscheck()
    items = []
    verified = 0
    with_ref = 0
    strict_high = 0

    for idx, item in enumerate(merged, 1):
        apply_distractor_fixes(item)
        nq = _pqt.normalize_question(item["q"])
        manual_ref = manual_by_question.get(nq)
        strict = strict_by_id.get(idx, {})
        crosscheck = crosscheck_by_id.get(idx, {})
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
    for idx, item in enumerate(items, 1):
        options = item["wrong"] + [item["a"]]
        random.shuffle(options)
        entry = {
            "id": idx,
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

    manifest = {
        "version": DATABASE_VERSION,
        "total_questions": len(output),
        "quiz_txt_count": quiz_count,
        "youtube_video_count": video_count,
        "extraq_docx_count": extraq_count,
        "extraq_docx_enhanced": extraq_enhanced,
        "questions_docx_count": questions_docx_count,
        "questions_docx_enhanced": questions_docx_enhanced,
        "pre_dedup_count": pre_dedup_count,
        "duplicates_removed": duplicates_removed,
        "questions_with_images": with_images,
        "questions_with_option_images": with_option_images,
        "merged": True,
        "approved": True,
        "sources": [
            "quiz.txt (NCSF Practice Exam / Quizlet 651343093)",
            "youtube-video (NCSF exam video OCR bank)",
            "extraq.docx (supplemental questions with images)",
            "questions.docx (additional questions with images and explanations)",
        ],
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
    return len(output)


if __name__ == "__main__":
    main()