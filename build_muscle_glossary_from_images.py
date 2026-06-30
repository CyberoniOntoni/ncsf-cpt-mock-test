"""Build muscle-glossary.js from images in web/images/muscles/."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IMAGES_DIR = ROOT / "web" / "images" / "muscles"
OUTPUT = ROOT / "web" / "muscle-glossary.js"

# id matches {id}.png unless image is overridden. Aliases are longest-first in the index.
GLOSSARY_SPEC: list[dict] = [
    {"id": "hamstrings", "label": "Hamstrings", "aliases": ["hamstrings", "hamstring"]},
    {"id": "biceps-femoris", "label": "Biceps femoris", "aliases": ["biceps femoris"]},
    {"id": "semitendinosus", "label": "Semitendinosus", "aliases": ["semitendinosus"]},
    {"id": "semimembranosus", "label": "Semimembranosus", "aliases": ["semimembranosus"]},
    {"id": "quadriceps", "label": "Quadriceps", "aliases": ["quadriceps", "quads"]},
    {"id": "rectus-femoris", "label": "Rectus femoris", "aliases": ["rectus femoris"]},
    {"id": "vastus-lateralis", "label": "Vastus lateralis", "aliases": ["vastus lateralis"]},
    {"id": "vastus-medialis", "label": "Vastus medialis", "aliases": ["vastus medialis"]},
    {"id": "vastus-intermedius", "label": "Vastus intermedius", "aliases": ["vastus intermedius"]},
    {"id": "deltoid", "label": "Deltoid", "aliases": ["deltoid", "deltoids"]},
    {"id": "gastrocnemius", "label": "Gastrocnemius", "aliases": ["gastrocnemius"]},
    {"id": "soleus", "label": "Soleus", "aliases": ["soleus"]},
    {"id": "calves", "label": "Calves", "aliases": ["calves"]},
    {"id": "tibialis-anterior", "label": "Tibialis anterior", "aliases": ["tibialis anterior"]},
    {"id": "triceps", "label": "Triceps", "aliases": ["triceps brachii", "triceps"]},
    {"id": "hip-flexors", "label": "Hip flexors", "aliases": ["hip flexors", "hip flexor"]},
    {"id": "iliopsoas", "label": "Iliopsoas", "aliases": ["iliopsoas"]},
    {"id": "glutes", "label": "Glutes", "aliases": ["glutes", "glute"]},
    {"id": "gluteal", "label": "Gluteal", "aliases": ["gluteal", "gluteals"]},
    {"id": "gluteus-maximus", "label": "Gluteus maximus", "aliases": ["gluteus maximus"]},
    {"id": "gluteus-medius", "label": "Gluteus medius", "aliases": ["gluteus medius", "glute medius"]},
    {"id": "gluteus-minimus", "label": "Gluteus minimus", "aliases": ["gluteus minimus"]},
    {"id": "tensor-fasciae-latae", "label": "Tensor fasciae latae", "aliases": ["tensor fasciae latae", "tensor fascia latae"]},
    {"id": "tfl-tensor-fasciae-latae", "label": "TFL", "aliases": ["tfl"], "image": "tfl-tensor-fasciae-latae.png"},
    {"id": "adductor-magnus", "label": "Adductor magnus", "aliases": ["adductor magnus"]},
    {"id": "piriformis", "label": "Piriformis", "aliases": ["piriformis"]},
    {"id": "latissimus-dorsi", "label": "Latissimus dorsi", "aliases": ["latissimus dorsi", "latissimus"]},
    {"id": "lats", "label": "Lats", "aliases": ["lats"]},
    {"id": "trapezius", "label": "Trapezius", "aliases": ["trapezius"]},
    {"id": "rhomboids", "label": "Rhomboids", "aliases": ["rhomboids", "rhomboid"]},
    {"id": "levator-scapulae", "label": "Levator scapulae", "aliases": ["levator scapulae"]},
    {"id": "rotator-cuff", "label": "Rotator cuff", "aliases": ["rotator cuff", "sits"]},
    {"id": "supraspinatus", "label": "Supraspinatus", "aliases": ["supraspinatus"]},
    {"id": "infraspinatus", "label": "Infraspinatus", "aliases": ["infraspinatus"]},
    {"id": "subscapularis", "label": "Subscapularis", "aliases": ["subscapularis"]},
    {"id": "teres-minor", "label": "Teres minor", "aliases": ["teres minor"]},
    {"id": "pectoralis-major", "label": "Pectoralis major", "aliases": ["pectoralis major", "pectorals", "pecs"]},
    {"id": "pectoralis", "label": "Pectoralis", "aliases": ["pectoralis"]},
    {"id": "biceps-brachii", "label": "Biceps brachii", "aliases": ["biceps brachii"]},
    {"id": "biceps", "label": "Biceps", "aliases": ["biceps"]},
    {"id": "abdominals", "label": "Abdominals", "aliases": ["abdominals", "abdominal"]},
    {"id": "rectus-abdominis", "label": "Rectus abdominis", "aliases": ["rectus abdominis"]},
    {"id": "obliques", "label": "Obliques", "aliases": ["obliques", "oblique"]},
    {"id": "external-oblique", "label": "External oblique", "aliases": ["external oblique"]},
    {"id": "transverse-abdominis", "label": "Transverse abdominis", "aliases": ["transverse abdominis"]},
    {"id": "erector-spinae", "label": "Erector spinae", "aliases": ["erector spinae"]},
    {"id": "quadratus-lumborum", "label": "Quadratus lumborum", "aliases": ["quadratus lumborum"]},
]


def image_path(entry: dict) -> str:
    filename = entry.get("image") or f"{entry['id']}.png"
    return f"images/muscles/{filename}"


def main() -> None:
    available = {p.name for p in IMAGES_DIR.glob("*.png")}
    glossary: dict[str, dict] = {}
    alias_index: list[dict[str, str]] = []
    seen_aliases: dict[str, str] = {}

    for spec in GLOSSARY_SPEC:
        entry_id = spec["id"]
        filename = spec.get("image") or f"{entry_id}.png"
        if filename not in available:
            raise FileNotFoundError(f"Missing muscle image for {entry_id}: {filename}")

        aliases = [alias.lower() for alias in spec.get("aliases", [])]
        glossary[entry_id] = {
            "label": spec["label"],
            "image": image_path(spec),
            "aliases": aliases,
        }

        for alias in aliases:
            if alias in seen_aliases:
                raise ValueError(f"Duplicate alias {alias!r} ({seen_aliases[alias]} vs {entry_id})")
            seen_aliases[alias] = entry_id
            alias_index.append({"alias": alias, "id": entry_id})

    alias_index.sort(key=lambda item: len(item["alias"]), reverse=True)

    wired_images = {spec.get("image") or f"{spec['id']}.png" for spec in GLOSSARY_SPEC}
    unused_images = sorted(available - wired_images)
    if unused_images:
        print(f"Note: unused images (no glossary entry): {', '.join(unused_images)}")

    missing_on_disk = sorted(wired_images - available)
    if missing_on_disk:
        raise RuntimeError(f"Glossary references missing images: {', '.join(missing_on_disk)}")

    js = (
        "/** Auto-generated from web/images/muscles via build_muscle_glossary_from_images.py. */\n"
        "const MUSCLE_GLOSSARY = "
        + json.dumps(glossary, indent=2)
        + ";\n\nconst MUSCLE_ALIAS_INDEX = "
        + json.dumps(alias_index, indent=2)
        + ";\n"
    )
    OUTPUT.write_text(js, encoding="utf-8")
    print(f"Wrote {OUTPUT} ({len(glossary)} entries, {len(alias_index)} aliases, {len(wired_images)} images)")


if __name__ == "__main__":
    main()