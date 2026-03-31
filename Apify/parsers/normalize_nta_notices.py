from pathlib import Path
import json
import re

RAW_FILE = Path("cei_raw/nta_noticeboard/notice_list.json")
PDF_DIR = Path("cei_raw/nta_noticeboard/pdfs")
OUT_FILE = Path("cei_normalized/ingestion_ready/nta_notices_ready.ndjson")


def slugify(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def build_pdf_index(pdf_dir: Path) -> dict:
    pdf_map = {}
    if not pdf_dir.exists():
        return pdf_map

    for file in pdf_dir.iterdir():
        if not file.is_file():
            continue
        if file.suffix.lower() != ".pdf":
            continue

        name = file.name

        # Expected format from collector:
        # 001 - Title - OriginalFileName.pdf
        match = re.match(r"^(\d+)\s*-\s*(.*?)\s*-\s*(.+)$", name)
        if match:
            idx = int(match.group(1))
            title = slugify(match.group(2))
            pdf_map[(idx, title)] = str(file.resolve())

    return pdf_map


def main():
    if not RAW_FILE.exists():
        print(f"Missing raw file: {RAW_FILE}")
        return

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    data = json.loads(RAW_FILE.read_text(encoding="utf-8"))
    pdf_map = build_pdf_index(PDF_DIR)

    written = 0

    with OUT_FILE.open("w", encoding="utf-8") as f:
        for item in data:
            try:
                idx = int(item.get("index", 0))
            except Exception:
                idx = 0

            title = (item.get("title") or "").strip()
            title_key = slugify(title)

            local_pdf_path = pdf_map.get((idx, title_key))

            record = {
                "source_id": "nta_noticeboard",
                "authority": "NTA",
                "doc_type": "notice",
                "title": title,
                "source_page": item.get("sourcePage"),
                "file_url": item.get("pdfUrl"),
                "local_file_path": local_pdf_path,
                "original_file_name": item.get("originalFileName"),
                "raw_index": idx,
                "tags": ["nta", "notice"],
            }

            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            written += 1

    print(f"Saved {written} normalized records to: {OUT_FILE.resolve()}")


if __name__ == "__main__":
    main()