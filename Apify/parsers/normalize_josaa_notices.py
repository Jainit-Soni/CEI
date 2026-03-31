from pathlib import Path
import json
import re

ROOT_DIR = Path(__file__).resolve().parent.parent
RAW_FILE = ROOT_DIR / "cei_raw" / "josaa_notices" / "notice_list.json"
PDF_DIR = ROOT_DIR / "cei_raw" / "josaa_notices" / "pdfs"
OUT_FILE = ROOT_DIR / "cei_normalized" / "ingestion_ready" / "josaa_notices_ready.ndjson"


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

        if file.suffix.lower() not in {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv"}:
            continue

        name = file.name

        # Expected collector pattern:
        # 001 - 2025 - Some Title - original.pdf
        match = re.match(r"^(\d+)\s*-\s*(.*?)\s*-\s*(.*?)\s*-\s*(.+)$", name)
        if match:
            idx = int(match.group(1))
            year = (match.group(2) or "").strip()
            title = slugify(match.group(3))
            pdf_map[(idx, year, title)] = str(file.resolve())
            continue

        # Fallback pattern:
        # 001 - Some Title - original.pdf
        match2 = re.match(r"^(\d+)\s*-\s*(.*?)\s*-\s*(.+)$", name)
        if match2:
            idx = int(match2.group(1))
            title = slugify(match2.group(2))
            pdf_map[(idx, "", title)] = str(file.resolve())

    return pdf_map


def guess_doc_type(title: str, page_title: str) -> str:
    hay = f"{title} {page_title}".lower()

    if "schedule" in hay:
        return "schedule"
    if "business rule" in hay or "information bulletin" in hay:
        return "information_bulletin"
    if "certificate" in hay:
        return "certificate_format"
    if "seat matrix" in hay:
        return "seat_matrix"
    if "opening and closing rank" in hay or "opening & closing rank" in hay:
        return "opening_closing_rank"
    if "faq" in hay:
        return "faq"
    if "public notice" in hay or "notice" in hay:
        return "notice"

    return "document"


def main():
    if not RAW_FILE.exists():
        print(f"Missing raw file: {RAW_FILE}")
        return

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    data = json.loads(RAW_FILE.read_text(encoding="utf-8"))
    pdf_map = build_pdf_index(PDF_DIR)

    written = 0

    with OUT_FILE.open("w", encoding="utf-8") as f:
        for idx, item in enumerate(data, start=1):
            title = (item.get("title") or "").strip()
            page_title = (item.get("pageTitle") or "").strip()
            source_page = item.get("sourcePage")
            file_url = item.get("fileUrl")
            session_year = str(item.get("sessionYear") or "").strip()
            original_file_name = item.get("originalFileName")

            key_exact = (idx, session_year, slugify(title))
            key_no_year = (idx, "", slugify(title))

            local_file_path = pdf_map.get(key_exact) or pdf_map.get(key_no_year)

            record = {
                "source_id": "josaa_notices",
                "authority": "JoSAA",
                "doc_type": guess_doc_type(title, page_title),
                "title": title,
                "page_title": page_title,
                "source_page": source_page,
                "file_url": file_url,
                "local_file_path": local_file_path,
                "original_file_name": original_file_name,
                "session_year": session_year or None,
                "raw_index": idx,
                "tags": ["josaa", "counselling", "admissions"],
            }

            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            written += 1

    print(f"Saved {written} normalized records to: {OUT_FILE}")


if __name__ == "__main__":
    main()