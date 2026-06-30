"""Add NCSF manual references to questions.js explanations that lack them."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
QUESTIONS_JS = ROOT / "shuffledtest" / "questions.js"
REPORT_PATH = ROOT / "manual_refs_added_report.txt"

_spec = importlib.util.spec_from_file_location("build_manual_refs", ROOT / "build_manual_refs.py")
_bmr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bmr)

MARKER = "NCSF Manual reference:"

EXPLANATION_STOP = {
    "about", "after", "also", "because", "before", "being", "between", "client",
    "during", "exercise", "following", "however", "individual", "muscle", "muscles",
    "other", "performance", "should", "their", "there", "these", "those", "through",
    "training", "which", "while", "would",
}


def load_questions() -> list[dict]:
    text = QUESTIONS_JS.read_text(encoding="utf-8")
    start = text.index("const EXAM_QUESTIONS = ") + len("const EXAM_QUESTIONS = ")
    depth = 0
    for index, char in enumerate(text[start:], start):
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : index + 1])
    raise RuntimeError("Could not parse EXAM_QUESTIONS")


def save_questions(questions: list[dict]) -> None:
    QUESTIONS_JS.write_text(
        "const EXAM_QUESTIONS = " + json.dumps(questions, indent=2, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


def has_manual_reference(question: dict) -> bool:
    if question.get("manualReference", "").strip():
        return True
    return MARKER in (question.get("explanation") or "")


def quiz_item(question: dict) -> dict:
    return {
        "question": question["question"],
        "correct": question["options"][question["correctIndex"]],
    }


def explanation_terms(question: dict, limit: int = 20) -> list[str]:
    explanation = question.get("explanation", "")
    if MARKER in explanation:
        explanation = explanation.split(MARKER, 1)[0]
    norm = _bmr.normalize(explanation)
    terms = []
    for word in _bmr.tokenize(norm, 6):
        if word in EXPLANATION_STOP:
            continue
        if len(word) >= 6:
            terms.append(word)
    return terms[:limit]


def collect_refs_from_terms(terms: list[str], question: dict, pages: list[dict]) -> list[dict]:
    preferred = _bmr.preferred_chapters(question["question"])
    scored = []
    for page in pages:
        score, matched = _bmr.score_page(page, terms, preferred)
        if score > 0:
            scored.append((score, page, matched))
    scored.sort(key=lambda item: (-item[0], item[1]["chapter"], item[1]["pdf_page"]))

    refs = []
    seen = set()
    for score, page, matched in scored[:8]:
        key = (page["chapter"], page["printed_page"] or page["pdf_page"])
        if key in seen:
            continue
        seen.add(key)
        refs.append(
            {
                "chapter": page["chapter"],
                "chapter_name": page["chapter_name"],
                "page": page["printed_page"] or page["pdf_page"],
                "pdf_page": page["pdf_page"],
                "matched_terms": matched[:3],
                "score": score,
            }
        )
        if len(refs) >= 2:
            break
    return refs


def phrase_hits_pages(phrase: str, pages: list[dict], preferred: set[int]) -> list[dict]:
    needle = _bmr.normalize(phrase)
    if len(needle) < 4:
        return []

    hits = []
    for page in pages:
        if needle in page["norm"]:
            bonus = 3 if page["chapter"] in preferred else 0
            hits.append((len(needle) + bonus, page))
    hits.sort(key=lambda item: (-item[0], item[1]["chapter"], item[1]["pdf_page"]))
    return [page for _, page in hits[:4]]


def pages_to_refs(pages: list[dict], matched_terms: list[str]) -> list[dict]:
    refs = []
    seen = set()
    for page in pages:
        key = (page["chapter"], page["printed_page"] or page["pdf_page"])
        if key in seen:
            continue
        seen.add(key)
        refs.append(
            {
                "chapter": page["chapter"],
                "chapter_name": page["chapter_name"],
                "page": page["printed_page"] or page["pdf_page"],
                "pdf_page": page["pdf_page"],
                "matched_terms": matched_terms[:3],
                "score": 5,
            }
        )
        if len(refs) >= 2:
            break
    return refs


def find_references_for_question(question: dict, pages: list[dict]) -> tuple[list[dict], bool, str]:
    item = quiz_item(question)
    preferred = _bmr.preferred_chapters(question["question"])

    refs, verified, _ = _bmr.find_references(item, pages)
    if refs:
        return refs, verified, "question+answer"

    extra = explanation_terms(question)
    if extra:
        refs = collect_refs_from_terms(extra, question, pages)
        if refs:
            return refs, refs[0]["score"] >= 4, "explanation-terms"

    for phrase in [item["correct"], item["question"]]:
        phrase = phrase.strip()
        if len(phrase) < 5:
            continue
        hit_pages = phrase_hits_pages(phrase, pages, preferred)
        if hit_pages:
            refs = pages_to_refs(hit_pages, [_bmr.normalize(phrase)[:40]])
            return refs, refs[0]["score"] >= 4, "phrase-search"

    for option in question.get("options", []):
        if option == item["correct"]:
            continue
        if len(option) < 8:
            continue
        hit_pages = phrase_hits_pages(option, pages, preferred)
        if hit_pages:
            refs = pages_to_refs(hit_pages, [_bmr.normalize(option)[:40]])
            return refs, False, "option-phrase"

    combined = list(dict.fromkeys(_bmr.search_terms_for_item(item) + explanation_terms(question, 30)))
    refs = collect_refs_from_terms(combined[:30], question, pages)
    if refs:
        return refs, refs[0]["score"] >= 4, "combined"

    return [], False, "none"


def append_reference(explanation: str, reference_text: str) -> str:
    explanation = (explanation or "").strip()
    if not reference_text or reference_text in explanation or MARKER in explanation:
        return explanation
    return f"{explanation.rstrip()} {reference_text}"


def main() -> None:
    questions = load_questions()
    missing = [q for q in questions if not has_manual_reference(q)]
    print(f"Questions missing manual reference: {len(missing)}/{len(questions)}")

    if not missing:
        print("Nothing to do.")
        return

    print(f"Indexing NCSF manuals in {_bmr.MANUAL_DIR}...")
    pages = _bmr.build_manual_index()
    print(f"Indexed {len(pages)} pages")

    added = 0
    verified = 0
    weak = []
    still_missing = []
    methods: dict[str, int] = {}

    for question in questions:
        if has_manual_reference(question):
            continue

        refs, is_verified, method = find_references_for_question(question, pages)
        methods[method] = methods.get(method, 0) + 1
        reference_text = _bmr.format_reference_line(refs)

        if reference_text.endswith("(verify in your chapter materials)."):
            still_missing.append(
                {
                    "id": question["id"],
                    "question": question["question"][:100],
                }
            )
            continue

        question["explanation"] = append_reference(question["explanation"], reference_text)
        question["manualReference"] = reference_text
        question["manualVerified"] = is_verified
        added += 1
        if is_verified:
            verified += 1
        else:
            weak.append(
                {
                    "id": question["id"],
                    "question": question["question"][:90],
                    "reference": reference_text,
                    "method": method,
                    "score": refs[0]["score"] if refs else 0,
                }
            )

    save_questions(questions)

    lines = [
        f"Added manual references: {added}",
        f"Verified (score >= 4): {verified}",
        f"Weak matches: {len(weak)}",
        f"Still missing (no PDF match): {len(still_missing)}",
        f"Methods: {methods}",
        "",
    ]
    if weak:
        lines.append("Weak matches:")
        for item in weak[:25]:
            lines.append(
                f"  Q{item['id']} [{item['method']}, score {item['score']}]: {item['reference']}"
            )
        if len(weak) > 25:
            lines.append(f"  ... and {len(weak) - 25} more")
        lines.append("")
    if still_missing:
        lines.append("No match found:")
        for item in still_missing:
            lines.append(f"  Q{item['id']}: {item['question']}")

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:8]))
    print(f"Wrote {REPORT_PATH}")
    print(f"Updated {QUESTIONS_JS}")


if __name__ == "__main__":
    main()