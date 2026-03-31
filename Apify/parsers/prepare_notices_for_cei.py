from pathlib import Path
import json
import hashlib
import re
from collections import Counter

ROOT_DIR = Path(__file__).resolve().parent.parent

INPUT_FILE = ROOT_DIR / "cei_normalized" / "notices.ndjson"
OUT_DIR = ROOT_DIR / "cei_normalized" / "cei_import_ready"
OUT_FILE = OUT_DIR / "notices_cei_ready.ndjson"
SUMMARY_FILE = OUT_DIR / "notices_summary.json"


def clean_text(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_tags(tags):
    if not tags:
        return []
    cleaned = []
    seen = set()
    for tag in tags:
        tag = clean_text(str(tag)).lower()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        cleaned.append(tag)
    return cleaned


def make_notice_id(record: dict) -> str:
    authority = clean_text(record.get("authority", "")).lower()
    title = clean_text(record.get("title", "")).lower()
    file_url = clean_text(record.get("file_url", "")).lower()
    session_year = clean_text(str(record.get("session_year") or "")).lower()

    raw = f"{authority}|{title}|{file_url}|{session_year}"
    digest = hashlib.md5(raw.encode("utf-8")).hexdigest()[:16]
    return f"notice_{digest}"


def build_search_text(record: dict) -> str:
    parts = [
        record.get("title"),
        record.get("authority"),
        record.get("doc_type"),
        record.get("page_title"),
        record.get("source_page"),
        " ".join(record.get("tags", [])),
        str(record.get("session_year") or ""),
    ]
    return clean_text(" | ".join([p for p in parts if p]))


def load_ndjson(path: Path):
    records = []
    if not path.exists():
        print(f"Missing input file: {path}")
        return records

    with path.open("r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"Skipping bad JSON line {line_num}: {e}")

    return records


def main():
    records = load_ndjson(INPUT_FILE)
    if not records:
        print("No input records found.")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    authority_counts = Counter()
    doc_type_counts = Counter()
    year_counts = Counter()

    written = 0

    with OUT_FILE.open("w", encoding="utf-8") as f:
        for record in records:
            title = clean_text(record.get("title"))
            authority = clean_text(record.get("authority"))
            doc_type = clean_text(record.get("doc_type")) or "document"
            source_id = clean_text(record.get("source_id"))
            source_page = clean_text(record.get("source_page"))
            file_url = clean_text(record.get("file_url") or record.get("fileUrl"))
            local_file_path = clean_text(record.get("local_file_path"))
            original_file_name = clean_text(record.get("original_file_name"))
            page_title = clean_text(record.get("page_title"))
            session_year = clean_text(str(record.get("session_year") or "")) or None
            tags = normalize_tags(record.get("tags"))

            cei_record = {
                "notice_id": make_notice_id(record),
                "entity_type": "notice",
                "source_id": source_id,
                "authority": authority,
                "doc_type": doc_type,
                "title": title,
                "page_title": page_title or None,
                "session_year": session_year,
                "source_page": source_page or None,
                "file_url": file_url or None,
                "local_file_path": local_file_path or None,
                "original_file_name": original_file_name or None,
                "tags": tags,
                "search_text": build_search_text({
                    "title": title,
                    "authority": authority,
                    "doc_type": doc_type,
                    "page_title": page_title,
                    "source_page": source_page,
                    "tags": tags,
                    "session_year": session_year,
                }),
                "is_active": True,
            }

            f.write(json.dumps(cei_record, ensure_ascii=False) + "\n")
            written += 1

            authority_counts[authority or "unknown"] += 1
            doc_type_counts[doc_type or "unknown"] += 1
            year_counts[session_year or "unknown"] += 1

    summary = {
        "input_file": str(INPUT_FILE),
        "output_file": str(OUT_FILE),
        "total_records": written,
        "authority_counts": dict(authority_counts),
        "doc_type_counts": dict(doc_type_counts),
        "session_year_counts": dict(year_counts),
    }

    with SUMMARY_FILE.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("CEI notice prep complete.")
    print(f"Output: {OUT_FILE}")
    print(f"Summary: {SUMMARY_FILE}")
    print(f"Total records: {written}")


if __name__ == "__main__":
    main()