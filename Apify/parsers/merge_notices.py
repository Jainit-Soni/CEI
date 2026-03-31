from pathlib import Path
import json

ROOT_DIR = Path(__file__).resolve().parent.parent

INPUT_FILES = [
    ROOT_DIR / "cei_normalized" / "ingestion_ready" / "nta_notices_ready.ndjson",
    ROOT_DIR / "cei_normalized" / "ingestion_ready" / "josaa_notices_ready.ndjson",
]

OUT_FILE = ROOT_DIR / "cei_normalized" / "notices.ndjson"


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
                print(f"Skipping bad JSON in {path.name} line {line_num}: {e}")

    return records


def build_dedupe_key(record: dict):
    authority = (record.get("authority") or "").strip().lower()
    title = (record.get("title") or "").strip().lower()
    file_url = (record.get("file_url") or record.get("fileUrl") or "").strip().lower()
    source_page = (record.get("source_page") or "").strip().lower()
    session_year = str(record.get("session_year") or "").strip().lower()

    if file_url:
        return ("file_url", file_url)

    return ("fallback", authority, title, session_year, source_page)


def sort_key(record: dict):
    session_year = str(record.get("session_year") or "")
    authority = (record.get("authority") or "")
    title = (record.get("title") or "")
    return (session_year, authority, title)


def main():
    merged = []
    seen = set()
    source_counts = {}

    for path in INPUT_FILES:
        records = load_ndjson(path)
        source_counts[path.name] = len(records)

        for record in records:
            key = build_dedupe_key(record)
            if key in seen:
                continue
            seen.add(key)
            merged.append(record)

    merged.sort(key=sort_key, reverse=True)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with OUT_FILE.open("w", encoding="utf-8") as f:
        for record in merged:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print("Merge complete.")
    print(f"Output: {OUT_FILE}")
    print(f"Input counts: {source_counts}")
    print(f"Final merged count: {len(merged)}")


if __name__ == "__main__":
    main()