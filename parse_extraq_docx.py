"""Parse extraq.docx into NCSF exam questions with images."""
import importlib.util
import json
import os
import re
import shutil
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent
DOCX = ROOT / "extraq.docx"
EXTRACT_DIR = ROOT / "extraq_extracted"
MEDIA_OUT = ROOT / "shuffledtest" / "images" / "extraq"
OUTPUT_JSON = ROOT / "extraq_questions.json"

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

OPTION_RE = re.compile(r"^([a-d])[\.\)]\s*(.+)$", re.I)
QUESTION_RE = re.compile(r"^(\d+)\.\s*(.+)$", re.I)
ANSWER_RE = re.compile(r"^\(([a-d])\)\s*[-–—]?\s*(.*)$", re.I)


def extract_docx():
    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(DOCX) as z:
        z.extractall(EXTRACT_DIR)
        return z.read("word/document.xml"), z.read("word/_rels/document.xml.rels")


def load_rid_map(rels_xml):
    root = ET.fromstring(rels_xml)
    return {
        rel.get("Id"): rel.get("Target")
        for rel in root
        if "image" in rel.get("Type", "")
    }


def para_text(elem):
    parts = []
    for t in elem.findall(".//w:t", NS):
        if t.text:
            parts.append(t.text)
        if t.tail:
            parts.append(t.tail)
    return "".join(parts).strip()


def para_images(elem, rid_map):
    imgs = []
    for blip in elem.findall(".//a:blip", NS):
        rid = blip.get(f"{{{NS['r']}}}embed")
        if rid and rid in rid_map:
            imgs.append(rid_map[rid])
    return imgs


def parse_blocks(doc_xml, rid_map):
    root = ET.fromstring(doc_xml)
    body = root.find("w:body", NS)
    blocks = []
    for child in body:
        tag = child.tag.split("}")[-1]
        if tag == "p":
            text = para_text(child)
            imgs = para_images(child, rid_map)
            if text or imgs:
                blocks.append({"text": text, "images": imgs})
        elif tag == "tbl":
            for tr in child.findall(".//w:tr", NS):
                for tc in tr.findall("w:tc", NS):
                    for p in tc.findall(".//w:p", NS):
                        text = para_text(p)
                        imgs = para_images(p, rid_map)
                        if text or imgs:
                            blocks.append({"text": text, "images": imgs})
    return blocks


def normalize_option_key(letter):
    return letter.lower()


def copy_media_files(media_rel_paths):
    MEDIA_OUT.mkdir(parents=True, exist_ok=True)
    media_src = EXTRACT_DIR / "word"
    copied = {}
    for rel_path in media_rel_paths:
        fname = Path(rel_path).name
        if fname in copied:
            continue
        src = media_src / rel_path.replace("/", os.sep)
        if not src.exists():
            src = media_src / "media" / fname
        if not src.exists():
            continue
        dest = MEDIA_OUT / fname
        shutil.copy2(src, dest)
        copied[fname] = f"images/extraq/{fname}"
    return copied


def parse_questions(blocks):
    questions = []
    current = None
    pending_images = []

    def flush():
        nonlocal current, pending_images
        if not current or not current.get("answer_letter"):
            current = None
            pending_images = []
            return

        if current.get("_pre_option_images"):
            current.setdefault("image_paths", []).extend(current.pop("_pre_option_images"))
        letters = "abcd"
        options = []
        option_images = {}
        for letter in letters:
            opt = current["options"].get(letter)
            if not opt:
                continue
            options.append(opt)
            if letter in current.get("option_images", {}):
                option_images[opt] = current["option_images"][letter]

        ans_letter = current["answer_letter"]
        answer = current["options"].get(ans_letter, "")
        if not answer or len(options) < 4:
            current = None
            pending_images = []
            return

        questions.append({
            "question": current["question"].strip(),
            "options": options,
            "answer": answer,
            "answerLetter": ans_letter,
            "explanation": current.get("explanation", "").strip(),
            "imagePaths": list(current.get("image_paths", [])),
            "optionImages": option_images,
            "number": current.get("number"),
        })
        current = None
        pending_images = []

    for block in blocks:
        text = (block.get("text") or "").strip()
        images = block.get("images") or []

        if images and not text:
            pending_images.extend(images)
            if current is not None:
                current.setdefault("pending_images", []).extend(images)
            continue

        qm = QUESTION_RE.match(text)
        if qm:
            flush()
            current = {
                "number": int(qm.group(1)),
                "question": qm.group(2).strip(),
                "options": {},
                "option_images": {},
                "image_paths": [],
                "pending_images": list(pending_images),
            }
            pending_images = []
            if images:
                current["pending_images"].extend(images)
            continue

        if current is None:
            pending_images = []
            continue

        om = OPTION_RE.match(text)
        if om:
            letter = normalize_option_key(om.group(1))
            opt_text = om.group(2).strip()
            imgs = list(current.get("pending_images", [])) + images
            current["pending_images"] = []

            if not current["options"]:
                if imgs:
                    current["_pre_option_images"] = imgs
            elif imgs:
                if current.get("_pre_option_images"):
                    pre = current.pop("_pre_option_images")
                    current.setdefault("option_images", {})["a"] = pre[-1]
                current.setdefault("option_images", {})[letter] = imgs[-1]

            current["options"][letter] = opt_text
            continue

        am = ANSWER_RE.match(text)
        if am:
            if current.get("_pre_option_images"):
                current.setdefault("image_paths", []).extend(
                    current.pop("_pre_option_images")
                )
            current["answer_letter"] = normalize_option_key(am.group(1))
            current["explanation"] = am.group(2).strip()
            imgs = list(current.get("pending_images", [])) + images
            current["pending_images"] = []
            if imgs:
                current.setdefault("image_paths", []).extend(imgs)
            continue

        if not current.get("options") and text:
            current["question"] = f"{current['question']} {text}".strip()
            if images:
                current.setdefault("pending_images", []).extend(images)

    flush()
    return questions


def finalize_image_paths(questions):
    all_media = set()
    for q in questions:
        for rel in q.get("imagePaths", []):
            all_media.add(rel)
        for rel in q.get("optionImages", {}).values():
            all_media.add(rel)
    copied = copy_media_files(all_media)

    for q in questions:
        q["imagePaths"] = [
            copied[Path(p).name]
            for p in q.get("imagePaths", [])
            if Path(p).name in copied
        ]
        q["optionImages"] = {
            opt: copied[Path(rel).name]
            for opt, rel in q.get("optionImages", {}).items()
            if Path(rel).name in copied
        }


def to_bank_items(questions):
    _spec = importlib.util.spec_from_file_location(
        "parse_quiz_txt", str(ROOT / "parse_quiz_txt.py")
    )
    pqt = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(pqt)

    items = []
    for q in questions:
        correct = q["answer"]
        wrong = [o for o in q["options"] if o != correct]
        item = {
            "q": q["question"],
            "a": correct,
            "wrong": wrong,
            "base_exp": q.get("explanation") or pqt.lookup_base_explanation(q["question"], correct) or "",
            "source": "extraq.docx",
        }
        if q.get("imagePaths"):
            item["imagePaths"] = q["imagePaths"]
        if q.get("optionImages"):
            item["optionImages"] = q["optionImages"]
        items.append(item)
    return items


def main():
    doc_xml, rels_xml = extract_docx()
    rid_map = load_rid_map(rels_xml)
    blocks = parse_blocks(doc_xml, rid_map)

    debug_path = ROOT / "extraq_blocks.txt"
    with open(debug_path, "w", encoding="utf-8") as f:
        for i, b in enumerate(blocks):
            imgs = f" [IMG: {b['images']}]" if b.get("images") else ""
            f.write(f"{i:4d}| {b.get('text', '')}{imgs}\n")

    questions = parse_questions(blocks)
    finalize_image_paths(questions)
    bank_items = to_bank_items(questions)

    payload = {"questions": questions, "bank_items": bank_items}
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    with_img = sum(1 for q in questions if q.get("imagePaths"))
    with_opt_img = sum(1 for q in questions if q.get("optionImages"))
    print(f"Parsed {len(questions)} questions from extraq.docx")
    print(f"  question images: {with_img}")
    print(f"  option images: {with_opt_img}")
    print(f"Wrote {OUTPUT_JSON}")
    return bank_items


if __name__ == "__main__":
    main()