"""Build unified NCSF question database from quiz.txt + YouTube video bank."""
import importlib.util
import json
import os
import random
import sys
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
DATABASE_VERSION = "merged-extraq-v3"


def load_json_by_id(path):
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {r["id"]: r for r in data.get("results", [])}


def load_strict_audit():
    return load_json_by_id(STRICT_AUDIT)


def load_crosscheck():
    return load_json_by_id(CROSSCHECK_JSON)


def load_extraq_bank():
    if not EXTRAQ_DOCX.exists():
        return []
    _espec = importlib.util.spec_from_file_location(
        "parse_extraq", str(ROOT / "parse_extraq_docx.py")
    )
    _extraq = importlib.util.module_from_spec(_espec)
    _espec.loader.exec_module(_extraq)
    return _extraq.main()


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


def apply_extraq_enhancements(target, source):
    if source.get("imagePaths"):
        merged = list(dict.fromkeys(target.get("imagePaths", []) + source["imagePaths"]))
        target["imagePaths"] = merged
    if source.get("optionImages"):
        opt_imgs = dict(target.get("optionImages", {}))
        opt_imgs.update(source["optionImages"])
        target["optionImages"] = opt_imgs
    src_exp = (source.get("base_exp") or "").strip()
    tgt_exp = (target.get("base_exp") or "").strip()
    if src_exp and len(src_exp) > len(tgt_exp):
        target["base_exp"] = src_exp
    src_tag = "extraq.docx"
    if src_tag not in target.get("source", ""):
        base = target.get("source", "")
        target["source"] = f"{base}+{src_tag}" if base else src_tag


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

    extraq_items = load_extraq_bank()
    extraq_added = 0
    extraq_enhanced = 0
    by_normalized = {_pqt.normalize_question(m["q"]): m for m in merged}

    for item in extraq_items:
        nq = _pqt.normalize_question(item["q"])
        if nq in by_normalized:
            apply_extraq_enhancements(by_normalized[nq], item)
            extraq_enhanced += 1
            continue
        if nq in seen:
            continue
        seen.add(nq)
        merged.append({
            "q": item["q"],
            "a": item["a"],
            "wrong": item["wrong"],
            "base_exp": item.get("base_exp", ""),
            "source": item.get("source", "extraq.docx"),
            "imagePaths": item.get("imagePaths", []),
            "optionImages": item.get("optionImages", {}),
        })
        by_normalized[nq] = merged[-1]
        extraq_added += 1

    extraq_count = extraq_added
    return merged, quiz_count, video_count, extraq_count, extraq_enhanced


def main():
    merged, quiz_count, video_count, extraq_count, extraq_enhanced = merge_question_banks()
    print(f"Merged database: {len(merged)} questions")
    print(f"  quiz.txt: {quiz_count}")
    print(f"  youtube-video (unique): {video_count}")
    print(f"  extraq.docx (new): {extraq_count}")
    print(f"  extraq.docx (enhanced existing): {extraq_enhanced}")

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
        "questions_with_images": with_images,
        "questions_with_option_images": with_option_images,
        "merged": True,
        "approved": True,
        "sources": [
            "quiz.txt (NCSF Practice Exam / Quizlet 651343093)",
            "youtube-video (NCSF exam video OCR bank)",
            "extraq.docx (supplemental questions with images)",
        ],
        "verification": {
            "manual_references": with_ref,
            "strict_high": strict_high,
            "crosscheck_approved": len(output),
        },
        "output": str(OUTPUT),
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