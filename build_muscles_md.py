"""Scan quiz content for muscle mentions and write MUSCLES.md."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
QUESTIONS_JS = ROOT / "shuffledtest" / "questions.js"
OUTPUT = ROOT / "shuffledtest" / "MUSCLES.md"

# Longer / more specific patterns first so overlapping terms resolve correctly.
MUSCLE_PATTERNS: list[tuple[str, str, str]] = [
    # (regex, display name, category)
    (r"\brotator cuff\b", "Rotator cuff", "Shoulder group"),
    (r"\bhip flexors?\b", "Hip flexors", "Hip group"),
    (r"\bhip abductors?\b", "Hip abductors", "Hip group"),
    (r"\bhip adductors?\b", "Hip adductors", "Hip group"),
    (r"\bgluteus maximus\b", "Gluteus maximus", "Hip / glute"),
    (r"\bgluteus medius\b", "Gluteus medius", "Hip / glute"),
    (r"\bgluteus minimus\b", "Gluteus minimus", "Hip / glute"),
    (r"\btensor fasciae latae\b", "Tensor fasciae latae", "Hip / glute"),
    (r"\bTFL\b", "TFL (tensor fasciae latae)", "Hip / glute"),
    (r"\bgluteals?\b", "Gluteal", "Hip / glute"),
    (r"\bglutes?\b", "Glutes", "Hip / glute"),
    (r"\brectus femoris\b", "Rectus femoris", "Quadriceps"),
    (r"\bvastus lateralis\b", "Vastus lateralis", "Quadriceps"),
    (r"\bvastus medialis\b", "Vastus medialis", "Quadriceps"),
    (r"\bvastus intermedius\b", "Vastus intermedius", "Quadriceps"),
    (r"\bquadriceps\b", "Quadriceps", "Quadriceps"),
    (r"\bquads\b", "Quads", "Quadriceps"),
    (r"\bbiceps femoris\b", "Biceps femoris", "Hamstrings"),
    (r"\bsemitendinosus\b", "Semitendinosus", "Hamstrings"),
    (r"\bsemimembranosus\b", "Semimembranosus", "Hamstrings"),
    (r"\bhamstrings?\b", "Hamstrings", "Hamstrings"),
    (r"\badductor brevis\b", "Adductor brevis", "Hip group"),
    (r"\badductor longus\b", "Adductor longus", "Hip group"),
    (r"\badductor magnus\b", "Adductor magnus", "Hip group"),
    (r"\biliopsoas\b", "Iliopsoas", "Hip flexor"),
    (r"\bpsoas major\b", "Psoas major", "Hip flexor"),
    (r"\bpsoas\b", "Psoas", "Hip flexor"),
    (r"\biliacus\b", "Iliacus", "Hip flexor"),
    (r"\bgastrocnemius\b", "Gastrocnemius", "Lower leg"),
    (r"\bsoleus\b", "Soleus", "Lower leg"),
    (r"\bcalves\b", "Calves", "Lower leg"),
    (r"\btibialis anterior\b", "Tibialis anterior", "Lower leg"),
    (r"\btibialis posterior\b", "Tibialis posterior", "Lower leg"),
    (r"\bperoneals?\b", "Peroneals", "Lower leg"),

    (r"\bbiceps brachii\b", "Biceps brachii", "Upper arm"),
    (r"\btriceps brachii\b", "Triceps brachii", "Upper arm"),
    (r"\bbrachialis\b", "Brachialis", "Upper arm"),
    (r"\bbrachioradialis\b", "Brachioradialis", "Upper arm"),
    (r"\bbiceps\b", "Biceps", "Upper arm"),
    (r"\btriceps\b", "Triceps", "Upper arm"),
    (r"\bpectoralis major\b", "Pectoralis major", "Chest"),
    (r"\bpectoralis\b", "Pectoralis", "Chest"),
    (r"\bpectorals?\b", "Pectorals", "Chest"),
    (r"\bpecs\b", "Pecs", "Chest"),
    (r"\bdeltoids?\b", "Deltoid", "Shoulder"),
    (r"\blatissimus dorsi\b", "Latissimus dorsi", "Back"),
    (r"\blats\b", "Lats", "Back"),
    (r"\btrapezius\b", "Trapezius", "Back"),
    (r"\brhomboids?\b", "Rhomboids", "Back"),
    (r"\bserratus anterior\b", "Serratus anterior", "Back / shoulder"),
    (r"\blevator scapulae\b", "Levator scapulae", "Back / neck"),
    (r"\berector spinae\b", "Erector spinae", "Trunk"),
    (r"\brectus abdominis\b", "Rectus abdominis", "Trunk"),
    (r"\bexternal oblique\b", "External oblique", "Trunk"),
    (r"\binternal oblique\b", "Internal oblique", "Trunk"),
    (r"\bobliques\b", "Obliques", "Trunk"),
    (r"\boblique\b", "Oblique", "Trunk"),
    (r"\btransverse abdominis\b", "Transverse abdominis", "Trunk"),
    (r"\babdominals?\b", "Abdominals", "Trunk"),
    (r"\bcore muscles?\b", "Core muscles", "Trunk"),
    (r"\bquadratus lumborum\b", "Quadratus lumborum", "Trunk"),
    (r"\bmultifidus\b", "Multifidus", "Trunk"),
    (r"\bsupraspinatus\b", "Supraspinatus", "Rotator cuff"),
    (r"\binfraspinatus\b", "Infraspinatus", "Rotator cuff"),
    (r"\bteres minor\b", "Teres minor", "Rotator cuff"),
    (r"\bteres major\b", "Teres major", "Back / shoulder"),
    (r"\bsubscapularis\b", "Subscapularis", "Rotator cuff"),
    (r"\bpiriformis\b", "Piriformis", "Hip"),
    (r"\bsartorius\b", "Sartorius", "Thigh"),
    (r"\bgracilis\b", "Gracilis", "Thigh"),
    (r"\bpronators?\b", "Pronators", "Forearm"),
    (r"\bsupinators?\b", "Supinators", "Forearm"),
    (r"\bforearm flexors?\b", "Forearm flexors", "Forearm"),
    (r"\bforearm extensors?\b", "Forearm extensors", "Forearm"),
]

# Exercise phrases that contain muscle words but are not anatomy references.
BLOCKLIST_PHRASES = [
    "nordic hamstrings",
    "hamstring curl",
    "hamstring curls",
    "leg curl",
    "leg curls",
    "romanian deadlift",
    "stiff-leg deadlift",
    "good morning",
    "good mornings",
]

COMPILED = [(re.compile(pattern, re.IGNORECASE), name, category) for pattern, name, category in MUSCLE_PATTERNS]


def load_questions() -> list[dict]:
    text = QUESTIONS_JS.read_text(encoding="utf-8")
    marker = "const EXAM_QUESTIONS = "
    start = text.index(marker) + len(marker)
    depth = 0
    for index, char in enumerate(text[start:], start):
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : index + 1])
    raise RuntimeError("Could not parse EXAM_QUESTIONS from questions.js")


def mask_blocklist(text: str) -> str:
    masked = text
    for phrase in BLOCKLIST_PHRASES:
        masked = re.sub(re.escape(phrase), " " * len(phrase), masked, flags=re.IGNORECASE)
    return masked


def find_matches(text: str) -> list[tuple[str, str, str]]:
    masked = mask_blocklist(text)
    lower = masked.lower()
    found: list[tuple[str, str, str]] = []
    used_spans: list[tuple[int, int]] = []

    for regex, name, category in COMPILED:
        for match in regex.finditer(lower):
            span = (match.start(), match.end())
            if any(not (span[1] <= used[0] or span[0] >= used[1]) for used in used_spans):
                continue
            original = text[match.start() : match.end()]
            found.append((original, name, category))
            used_spans.append(span)
    return found


def snippet(text: str, match_text: str, width: int = 90) -> str:
    index = text.lower().find(match_text.lower())
    if index < 0:
        return text[:width]
    start = max(0, index - 35)
    end = min(len(text), index + len(match_text) + 55)
    excerpt = text[start:end].replace("\n", " ").strip()
    if start > 0:
        excerpt = "..." + excerpt
    if end < len(text):
        excerpt = excerpt + "..."
    return excerpt


def main() -> None:
    questions = load_questions()
    entries: dict[str, dict] = {}

    for question in questions:
        question_id = question.get("id")
        fields = [
            ("question", question.get("question", "")),
            ("options", question.get("options", [])),
            ("explanation", question.get("explanation", "")),
        ]

        for field_name, content in fields:
            if field_name == "options":
                for option_index, option in enumerate(content):
                    for matched, name, category in find_matches(option):
                        entry = entries.setdefault(
                            name,
                            {
                                "category": category,
                                "count": 0,
                                "question": 0,
                                "options": 0,
                                "explanation": 0,
                                "question_ids": set(),
                                "samples": [],
                            },
                        )
                        entry["count"] += 1
                        entry["options"] += 1
                        entry["question_ids"].add(question_id)
                        if len(entry["samples"]) < 4:
                            entry["samples"].append(
                                f"Q{question_id} option {option_index + 1}: {snippet(option, matched)}"
                            )
            else:
                for matched, name, category in find_matches(content):
                    entry = entries.setdefault(
                        name,
                        {
                            "category": category,
                            "count": 0,
                            "question": 0,
                            "options": 0,
                            "explanation": 0,
                            "question_ids": set(),
                            "samples": [],
                        },
                    )
                    entry["count"] += 1
                    entry[field_name] += 1
                    entry["question_ids"].add(question_id)
                    if len(entry["samples"]) < 4:
                        entry["samples"].append(f"Q{question_id} {field_name}: {snippet(content, matched)}")

    categories: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    for name, data in entries.items():
        categories[data["category"]].append((name, data))

    ranked = sorted(entries.items(), key=lambda pair: (-pair[1]["count"], pair[0].lower()))

    lines = [
        "# Muscles and Muscle Groups in Quiz Content",
        "",
        "Inventory of anatomical muscle terms found in **questions**, **answer options**, and **explanations**.",
        f"Source: `shuffledtest/questions.js` ({len(questions)} questions).",
        "",
        "Use this list to decide which preview images to place in `shuffledtest/images/muscles/`.",
        "",
        "## Summary",
        "",
        f"- **Unique terms / groups:** {len(entries)}",
        f"- **Total mentions:** {sum(item['count'] for item in entries.values())}",
        f"- **Questions referencing at least one term:** {len({qid for item in entries.values() for qid in item['question_ids']})}",
        "",
        "## Review checklist (by frequency)",
        "",
        "Suggested filename column is optional — use whatever naming you prefer when dropping screenshots into `images/muscles/`.",
        "",
        "| Term | Category | Mentions | Suggested image file |",
        "| --- | --- | ---: | --- |",
    ]

    for name, data in ranked:
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        lines.append(f"| {name} | {data['category']} | {data['count']} | `{slug}.png` |")

    lines.extend(
        [
            "",
            "Columns in detailed tables below:",
            "- **Mentions** — total occurrences across question + options + explanation",
            "- **Q / O / E** — counts in question stem, options, and explanation",
            "- **Question IDs** — quiz items where the term appears",
            "",
            "---",
            "",
        ]
    )

    category_order = [
        "Shoulder group",
        "Rotator cuff",
        "Shoulder",
        "Chest",
        "Upper arm",
        "Forearm",
        "Back",
        "Back / shoulder",
        "Back / neck",
        "Trunk",
        "Hip group",
        "Hip / glute",
        "Hip flexor",
        "Hip",
        "Quadriceps",
        "Hamstrings",
        "Thigh",
        "Lower leg",
    ]

    seen_categories = set()
    for category in category_order:
        if category not in categories:
            continue
        seen_categories.add(category)
        lines.extend(render_category(category, categories[category]))

    for category in sorted(set(categories) - seen_categories):
        lines.extend(render_category(category, categories[category]))

    lines.extend(
        [
            "## Notes",
            "",
            "- Exercise names that embed muscle words (e.g. Nordic hamstrings, hamstring curl) are excluded from this inventory.",
            "- Some short terms (e.g. **biceps**, **triceps**, **glutes**) may refer to context-dependent anatomy; review samples before choosing images.",
            "- After you add screenshots to `images/muscles/`, we can wire them into the glossary and tap/click previews.",
            "",
        ]
    )

    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUTPUT} ({len(entries)} unique terms)")


def render_category(category: str, items: list[tuple[str, dict]]) -> list[str]:
    items.sort(key=lambda pair: (-pair[1]["count"], pair[0].lower()))
    lines = [
        f"## {category}",
        "",
        "| Term | Mentions | Q | O | E | Question IDs |",
        "| --- | ---: | ---: | ---: | ---: | --- |",
    ]
    for name, data in items:
        ids = ", ".join(str(qid) for qid in sorted(data["question_ids"]))
        lines.append(
            f"| {name} | {data['count']} | {data['question']} | {data['options']} | {data['explanation']} | {ids} |"
        )
    lines.extend(["", "### Sample contexts", ""])
    for name, data in items:
        lines.append(f"**{name}**")
        for sample in data["samples"]:
            lines.append(f"- {sample}")
        lines.append("")
    lines.append("---")
    lines.append("")
    return lines


if __name__ == "__main__":
    main()