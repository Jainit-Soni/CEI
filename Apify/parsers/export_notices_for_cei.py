from pathlib import Path
import json
import re
from collections import defaultdict, Counter

ROOT_DIR = Path(__file__).resolve().parent.parent

INPUT_FILE = ROOT_DIR / "cei_normalized" / "cei_import_ready" / "notices_cei_ready.ndjson"
OUT_DIR = ROOT_DIR / "cei_final_exports" / "notices"

ALL_FILE = OUT_DIR / "notices_all.json"
INDEX_FILE = OUT_DIR / "notices_index.json"
SUMMARY_FILE = OUT_DIR / "notices_export_summary.json"
BY_AUTHORITY_DIR = OUT_DIR / "notices_by_authority"


def clean_text(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def slugify_filename(text: str, fallback: str = "unknown") -> str:
    text = clean_text(text).lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")
    return text or fallback


def load_ndjson(path: Path) -> list[dict]:
    records = []
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")

    with path.open("r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"Skipping bad JSON in line {line_num}: {e}")

    return records


def safe_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def normalize_record(record: dict) -> dict:
    authority = clean_text(record.get("authority"))
    doc_type = clean_text(record.get("doc_type")) or "document"
    title = clean_text(record.get("title"))
    session_year = clean_text(str(record.get("session_year") or "")) or None
    tags = [clean_text(str(x)).lower() for x in safe_list(record.get("tags")) if clean_text(str(x))]
    tags = list(dict.fromkeys(tags))

    normalized = {
        "notice_id": clean_text(record.get("notice_id")),
        "entity_type": "notice",
        "source_id": clean_text(record.get("source_id")),
        "authority": authority,
        "doc_type": doc_type,
        "title": title,
        "page_title": clean_text(record.get("page_title")) or None,
        "session_year": session_year,
        "source_page": clean_text(record.get("source_page")) or None,
        "file_url": clean_text(record.get("file_url")) or None,
        "local_file_path": clean_text(record.get("local_file_path")) or None,
        "original_file_name": clean_text(record.get("original_file_name")) or None,
        "tags": tags,
        "search_text": clean_text(record.get("search_text")),
        "is_active": bool(record.get("is_active", True)),
    }
    return normalized


def build_index_record(record: dict) -> dict:
    return {
        "notice_id": record.get("notice_id"),
        "authority": record.get("authority"),
        "doc_type": record.get("doc_type"),
        "title": record.get("title"),
        "session_year": record.get("session_year"),
        "tags": record.get("tags", []),
        "is_active": record.get("is_active", True),
    }


def sort_key(record: dict):
    session_year = record.get("session_year") or ""
    authority = record.get("authority") or ""
    doc_type = record.get("doc_type") or ""
    title = record.get("title") or ""
    return (session_year, authority, doc_type, title)


def main():
    records = load_ndjson(INPUT_FILE)
    if not records:
        print("No records found in input file.")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    BY_AUTHORITY_DIR.mkdir(parents=True, exist_ok=True)

    normalized_records = [normalize_record(r) for r in records]
    normalized_records.sort(key=sort_key, reverse=True)

    all_records = {
        "meta": {
            "entity_type": "notice",
            "total": len(normalized_records),
            "source_file": str(INPUT_FILE),
        },
        "items": normalized_records,
    }

    with ALL_FILE.open("w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)

    index_records = [build_index_record(r) for r in normalized_records]
    with INDEX_FILE.open("w", encoding="utf-8") as f:
        json.dump(index_records, f, ensure_ascii=False, indent=2)

    by_authority = defaultdict(list)
    for record in normalized_records:
        authority = record.get("authority") or "unknown"
        by_authority[authority].append(record)

    for authority, items in by_authority.items():
        filename = slugify_filename(authority) + ".json"
        out_path = BY_AUTHORITY_DIR / filename
        payload = {
            "meta": {
                "authority": authority,
                "total": len(items),
                "entity_type": "notice",
            },
            "items": items,
        }
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    authority_counts = Counter((r.get("authority") or "unknown") for r in normalized_records)
    doc_type_counts = Counter((r.get("doc_type") or "unknown") for r in normalized_records)
    session_year_counts = Counter((r.get("session_year") or "unknown") for r in normalized_records)

    summary = {
        "input_file": str(INPUT_FILE),
        "output_dir": str(OUT_DIR),
        "total_records": len(normalized_records),
        "authority_counts": dict(authority_counts),
        "doc_type_counts": dict(doc_type_counts),
        "session_year_counts": dict(session_year_counts),
        "files_written": {
            "notices_all": str(ALL_FILE),
            "notices_index": str(INDEX_FILE),
            "by_authority_dir": str(BY_AUTHORITY_DIR),
        },
    }

    with SUMMARY_FILE.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("Notice export complete.")
    print(f"All notices: {ALL_FILE}")
    print(f"Index: {INDEX_FILE}")
    print(f"By authority: {BY_AUTHORITY_DIR}")
    print(f"Summary: {SUMMARY_FILE}")
    print(f"Total exported: {len(normalized_records)}")


if __name__ == "__main__":
    main()