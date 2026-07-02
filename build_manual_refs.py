"""Index NCSF manuals and build chapter/page references for quiz explanations."""
import json
import re
from pathlib import Path

import fitz

MANUAL_DIR = Path(r"C:\Users\r413\OneDrive\Desktop\NCSF")
QUESTIONS_BANK_JSON = Path(r"D:\Software\Grok\questions_bank.json")
OUTPUT_JSON = Path(r"D:\Software\Grok\manual_references.json")
REPORT_PATH = Path(r"D:\Software\Grok\manual_verification_report.txt")

CHAPTER_NAMES = {
    1: "Introduction to Personal Training",
    2: "Functional Anatomy and Training Instruction",
    3: "Kinetic Chain Function, Dysfunction, and Corrective Exercise",
    4: "Human Physiology",
    5: "Evaluating Health and Physical Fitness",
    6: "Physical Activity and Risk for Disease",
    7: "Resting and Active Fitness Assessments",
    8: "Understanding Nutrition",
    9: "Exploring Dietary Supplements",
    10: "Body Composition",
    11: "Weight Management",
    12: "Exercise Program Components",
    13: "Anaerobic Resistance Training",
    14: "Cardiorespiratory Fitness",
    15: "Flexibility",
    16: "Introduction to Exercise Programming",
    17: "Working with Special Populations",
}

TOPIC_CHAPTERS = [
    (("muscle", "agonist", "antagonist", "rotator", "deltoid", "squat", "lunge", "curl", "deadlift", "bench", "press", "fly", "row", "spot", "kinetic chain", "lordotic", "sagittal", "proprioception", "hamstring", "gluteus", "rectus", "tricep", "biceps", "scapula", "abduction", "flexion", "extension", "eccentric", "concentric", "isometric"), [2, 3, 13, 15]),
    (("nutrition", "vitamin", "protein", "fat", "calor", "fiber", "supplement", "diet", "carbohydrate", "potassium", "saturated", "trans fatty", "glycogen", "glucose", "lactic"), [8, 9, 11]),
    (("blood pressure", "hypertension", "cardiovascular", "heart rate", "vo2", "aerobic", "hdl", "ldl", "stroke volume", "ischemia", "vascular", "atherosclerosis", "cardiorespiratory", "epoc", "altitude", "karvonen", "rpe", "borg"), [4, 6, 14]),
    (("screen", "assessment", "referral", "hsq", "par-q", "informed consent", "ethics", "liability", "scope", "certification", "record", "goal", "validity", "goniometer", "sit-and-reach", "body fat", "bmi", "bioelectrical", "girth", "amenorrhea", "rmr"), [1, 5, 7, 10]),
    (("child", "elderly", "older", "pregnant", "diabetes", "obese", "arthritis", "hypertensive", "beta blocker", "sarcopenia", "special population"), [6, 10, 11, 17]),
    (("periodization", "circuit", "intensity", "overload", "fitt", "pyramid", "superset", "drop set", "contrast", "steady-state", "cool down", "warm", "static stretch", "doms", "1rm", "hypertrophy", "power", "plyometric", "functional training"), [12, 13, 14, 16]),
]


def parse_quiz(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    blocks, cur = [], []
    for line in lines:
        if line.strip() == "":
            if cur:
                blocks.append(cur)
                cur = []
        else:
            cur.append(line.strip())
    if cur:
        blocks.append(cur)

    items = []
    for block in blocks:
        if len(block) < 6:
            continue
        ans = block[-1].lower()
        opts, qparts = {}, []
        for line in block[:-1]:
            m = re.match(r"^([a-d])\.\s*(.+)$", line, re.I)
            if m:
                opts[m.group(1).lower()] = m.group(2).strip()
            else:
                qparts.append(line)
        if len(opts) == 4 and ans in opts:
            items.append({
                "question": " ".join(qparts),
                "correct": opts[ans],
                "options": opts,
            })
    return items


def chapter_num_from_filename(name):
    m = re.search(r"Chapter_(\d+)", name)
    return int(m.group(1)) if m else 0


def extract_printed_page(text):
    nums = re.findall(r"\b(\d{2,3})\b", text[:120])
    for n in nums:
        val = int(n)
        if 1 <= val <= 999:
            return val
    return None


def normalize(text):
    text = text.lower()
    text = re.sub(r"[^\w\s%./-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize(text, min_len=4):
    return {w for w in re.findall(r"[a-z0-9%./-]+", text.lower()) if len(w) >= min_len}


def search_terms_for_item(item):
    q = normalize(item["question"])
    a = normalize(item["correct"])
    terms = set()

    # Full answer phrases (longest first)
    if len(a) >= 5:
        terms.add(a)

    # Multi-word answer chunks
    words = a.split()
    for i in range(len(words)):
        for j in range(i + 2, min(i + 6, len(words) + 1)):
            phrase = " ".join(words[i:j])
            if len(phrase) >= 8:
                terms.add(phrase)

    # Significant answer words
    for w in words:
        if len(w) >= 5 and w not in {"above", "below", "their", "which", "would", "should"}:
            terms.add(w)

    # Question keywords
    stop = {
        "which", "following", "would", "should", "their", "client", "exercise",
        "training", "during", "after", "before", "about", "known", "term",
        "termed", "called", "most", "best", "greatest", "primary", "common",
        "appropriate", "inappropriate", "represents", "causes", "lead", "make",
        "type", "ability", "actions", "impact", "health", "well", "being",
    }
    for w in tokenize(q, 5):
        if w not in stop:
            terms.add(w)

    return sorted(terms, key=len, reverse=True)


def preferred_chapters(question):
    q = question.lower()
    chapters = set()
    for keys, chs in TOPIC_CHAPTERS:
        if any(k in q for k in keys):
            chapters.update(chs)
    return chapters or set(range(1, 18))


def build_manual_index():
    pages = []
    for pdf_path in sorted(MANUAL_DIR.glob("NCSF_Chapter_*.pdf")):
        ch = chapter_num_from_filename(pdf_path.name)
        doc = fitz.open(pdf_path)
        for i in range(doc.page_count):
            text = doc[i].get_text()
            norm = normalize(text)
            printed = extract_printed_page(text)
            pages.append({
                "chapter": ch,
                "chapter_name": CHAPTER_NAMES.get(ch, f"Chapter {ch}"),
                "pdf_page": i + 1,
                "printed_page": printed,
                "text": text,
                "norm": norm,
                "file": pdf_path.name,
            })
        doc.close()
    return pages


def score_page(page, terms, preferred):
    norm = page["norm"]
    score = 0
    matched = []

    for term in terms[:25]:
        if term in norm:
            weight = min(len(term) // 4, 8) + (3 if page["chapter"] in preferred else 0)
            score += weight
            matched.append(term)
            if len(matched) >= 5:
                break

    if not matched:
        return 0, []

    # Bonus for answer-heavy pages
    return score, matched


def find_references(item, pages):
    terms = search_terms_for_item(item)
    preferred = preferred_chapters(item["question"])

    scored = []
    for page in pages:
        s, matched = score_page(page, terms, preferred)
        if s > 0:
            scored.append((s, page, matched))

    scored.sort(key=lambda x: (-x[0], x[1]["chapter"], x[1]["pdf_page"]))

    refs = []
    seen = set()
    for s, page, matched in scored[:4]:
        key = (page["chapter"], page["printed_page"] or page["pdf_page"])
        if key in seen:
            continue
        seen.add(key)
        page_label = page["printed_page"] or page["pdf_page"]
        refs.append({
            "chapter": page["chapter"],
            "chapter_name": page["chapter_name"],
            "page": page_label,
            "pdf_page": page["pdf_page"],
            "matched_terms": matched[:3],
            "score": s,
        })
        if len(refs) >= 2:
            break

    verified = bool(refs) and refs[0]["score"] >= 4
    return refs, verified, terms[:8]


def format_reference_line(refs):
    if not refs:
        return "NCSF Certified Personal Trainer Manual (verify in your chapter materials)."
    parts = []
    for r in refs:
        parts.append(f"Ch. {r['chapter']} ({r['chapter_name']}), p. {r['page']}")
    return "NCSF Manual reference: " + "; ".join(parts) + "."


def load_questions_bank():
    payload = json.loads(QUESTIONS_BANK_JSON.read_text(encoding="utf-8"))
    return [
        {
            "id": record["number"],
            "question": record["question"],
            "correct": record["answer"],
        }
        for record in payload["questions"]
    ]


def main():
    items = load_questions_bank()
    print(f"Indexing manuals in {MANUAL_DIR}...")
    pages = build_manual_index()
    print(f"Indexed {len(pages)} pages across {len(set(p['chapter'] for p in pages))} chapters")

    results = []
    verified_count = 0
    weak = []

    for item in items:
        qid = item["id"]
        refs, verified, search_terms = find_references(item, pages)
        if verified:
            verified_count += 1
        else:
            weak.append((qid, item["question"][:80], item["correct"]))

        results.append({
            "id": qid,
            "question": item["question"],
            "correct": item["correct"],
            "verified": verified,
            "search_terms": search_terms,
            "references": refs,
            "reference_text": format_reference_line(refs),
        })

    OUTPUT_JSON.write_text(json.dumps(results, indent=2), encoding="utf-8")

    lines = [
        f"NCSF Manual Verification Report",
        f"Questions: {len(items)}",
        f"Verified (manual text match): {verified_count}/{len(items)}",
        f"Weak/no match: {len(weak)}",
        "",
    ]
    if weak:
        lines.append("Questions needing manual review:")
        for qid, q, a in weak:
            lines.append(f"  Q{qid}: {q}... => {a}")

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Verified: {verified_count}/{len(items)}")
    print(f"Wrote {OUTPUT_JSON}")
    print(f"Wrote {REPORT_PATH}")


if __name__ == "__main__":
    main()