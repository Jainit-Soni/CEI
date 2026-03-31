from pathlib import Path
import json
import argparse

ROOT = Path.cwd()

DIRS = [
    "collectors",
    "configs",
    "configs/sources",
    "cei_raw",
    "cei_raw/nta_noticeboard",
    "cei_raw/nta_noticeboard/pdfs",
    "cei_raw/josaa_notices",
    "cei_raw/josaa_notices/pdfs",
    "cei_raw/nta_exam_pages",
    "cei_raw/nta_exam_pages/docs",
    "cei_raw/college_pages",
    "cei_raw/college_pages/docs",
    "cei_normalized",
    "cei_normalized/ingestion_ready",
    "parsers",
    "logs",
    "logs/collector_runs",
    "logs/parser_runs",
    "logs/errors",
    "temp",
]

FILES = {
    "collectors/collect_nta_notice_archive.py": '''from pathlib import Path

def main():
    print("TODO: implement NTA notice archive collector")

if __name__ == "__main__":
    main()
''',

    "collectors/collect_josaa_notices.py": '''from pathlib import Path

def main():
    print("TODO: implement JoSAA notices collector")

if __name__ == "__main__":
    main()
''',

    "collectors/collect_nta_exam_pages.py": '''from pathlib import Path

def main():
    print("TODO: implement NTA exam pages collector")

if __name__ == "__main__":
    main()
''',

    "collectors/collect_college_pages.py": '''from pathlib import Path

def main():
    print("TODO: implement college pages collector")

if __name__ == "__main__":
    main()
''',

    "parsers/normalize_nta_notices.py": '''import json
from pathlib import Path

RAW_FILE = Path("cei_raw/nta_noticeboard/notice_list.json")
OUT_FILE = Path("cei_normalized/ingestion_ready/nta_notices_ready.ndjson")

def main():
    if not RAW_FILE.exists():
        print(f"Missing raw file: {RAW_FILE}")
        return

    data = json.loads(RAW_FILE.read_text(encoding="utf-8"))
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with OUT_FILE.open("w", encoding="utf-8") as f:
        for item in data:
            record = {
                "source_id": "nta_noticeboard",
                "authority": "NTA",
                "doc_type": "notice",
                "title": item.get("title"),
                "source_page": item.get("sourcePage"),
                "file_url": item.get("pdfUrl"),
                "raw_index": item.get("index"),
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\\n")

    print(f"Saved normalized file to: {OUT_FILE}")

if __name__ == "__main__":
    main()
''',

    "parsers/normalize_josaa_notices.py": '''def main():
    print("TODO: implement JoSAA notice normalizer")

if __name__ == "__main__":
    main()
''',

    "parsers/normalize_nta_exam_pages.py": '''def main():
    print("TODO: implement NTA exam pages normalizer")

if __name__ == "__main__":
    main()
''',

    "parsers/normalize_college_pages.py": '''def main():
    print("TODO: implement college pages normalizer")

if __name__ == "__main__":
    main()
''',

    "configs/settings.json": json.dumps({
        "base_raw_dir": "cei_raw",
        "base_normalized_dir": "cei_normalized",
        "default_timeout_seconds": 60,
        "user_agent": "Mozilla/5.0"
    }, indent=2),

    "configs/sources/nta_noticeboard.json": json.dumps({
        "source_id": "nta_noticeboard",
        "source_type": "official_notice_archive",
        "source_url": "https://www.nta.ac.in/NoticeBoardArchive",
        "collector": "collect_nta_notice_archive.py",
        "raw_output_dir": "cei_raw/nta_noticeboard"
    }, indent=2),

    "configs/sources/josaa_notices.json": json.dumps({
        "source_id": "josaa_notices",
        "source_type": "official_notice_archive",
        "source_url": "https://josaa.nic.in/",
        "collector": "collect_josaa_notices.py",
        "raw_output_dir": "cei_raw/josaa_notices"
    }, indent=2),

    "configs/sources/nta_exam_pages.json": json.dumps({
        "source_id": "nta_exam_pages",
        "source_type": "official_exam_pages",
        "source_url": "https://www.nta.ac.in/",
        "collector": "collect_nta_exam_pages.py",
        "raw_output_dir": "cei_raw/nta_exam_pages"
    }, indent=2),

    "configs/sources/college_pages.json": json.dumps({
        "source_id": "college_pages",
        "source_type": "official_college_pages",
        "source_url": "https://example.edu/",
        "collector": "collect_college_pages.py",
        "raw_output_dir": "cei_raw/college_pages"
    }, indent=2),

    "cei_raw/nta_noticeboard/source_manifest.json": json.dumps({
        "source_id": "nta_noticeboard",
        "authority": "NTA",
        "type": "notice_archive",
        "source_page": "https://www.nta.ac.in/NoticeBoardArchive",
        "local_pdf_dir": "cei_raw/nta_noticeboard/pdfs"
    }, indent=2),

    "cei_raw/josaa_notices/source_manifest.json": json.dumps({
        "source_id": "josaa_notices",
        "authority": "JoSAA",
        "type": "notice_archive",
        "source_page": "https://josaa.nic.in/",
        "local_pdf_dir": "cei_raw/josaa_notices/pdfs"
    }, indent=2),

    "cei_raw/nta_exam_pages/source_manifest.json": json.dumps({
        "source_id": "nta_exam_pages",
        "authority": "NTA",
        "type": "exam_pages",
        "source_page": "https://www.nta.ac.in/",
        "local_docs_dir": "cei_raw/nta_exam_pages/docs"
    }, indent=2),

    "cei_raw/college_pages/source_manifest.json": json.dumps({
        "source_id": "college_pages",
        "authority": "multiple",
        "type": "college_pages",
        "source_page": "https://example.edu/",
        "local_docs_dir": "cei_raw/college_pages/docs"
    }, indent=2),

    "cei_raw/nta_noticeboard/notice_list.json": "[]\n",
    "cei_raw/nta_noticeboard/run_meta.json": "{}\n",
    "cei_raw/nta_noticeboard/download_failures.json": "[]\n",

    "cei_raw/josaa_notices/notice_list.json": "[]\n",
    "cei_raw/josaa_notices/run_meta.json": "{}\n",
    "cei_raw/josaa_notices/download_failures.json": "[]\n",

    "cei_raw/nta_exam_pages/pages.json": "[]\n",
    "cei_raw/nta_exam_pages/run_meta.json": "{}\n",
    "cei_raw/nta_exam_pages/download_failures.json": "[]\n",

    "cei_raw/college_pages/pages.json": "[]\n",
    "cei_raw/college_pages/run_meta.json": "{}\n",
    "cei_raw/college_pages/download_failures.json": "[]\n",

    "cei_normalized/notices.ndjson": "",
    "cei_normalized/documents.ndjson": "",
    "cei_normalized/exams.ndjson": "",
    "cei_normalized/colleges.ndjson": "",

    ".env": "APIFY_TOKEN=\n",

    "README.md": '''# CEI Apify Pipeline

## Structure
- collectors/ -> raw collection scripts
- parsers/ -> normalization scripts
- cei_raw/ -> raw downloaded and extracted source data
- cei_normalized/ -> CEI-ready normalized data
- logs/ -> collector/parser logs

## First steps
1. Put your Apify token in `.env`
2. Implement `collectors/collect_nta_notice_archive.py`
3. Run collector
4. Run `parsers/normalize_nta_notices.py`
''',

    "run_collector.py": '''import subprocess
import sys
from pathlib import Path

COLLECTORS = {
    "nta_noticeboard": "collectors/collect_nta_notice_archive.py",
    "josaa_notices": "collectors/collect_josaa_notices.py",
    "nta_exam_pages": "collectors/collect_nta_exam_pages.py",
    "college_pages": "collectors/collect_college_pages.py",
}

def main():
    if len(sys.argv) < 2:
        print("Usage: python run_collector.py <source_id>")
        print("Available:", ", ".join(COLLECTORS.keys()))
        return

    source_id = sys.argv[1]
    script = COLLECTORS.get(source_id)

    if not script:
        print(f"Unknown source_id: {source_id}")
        return

    path = Path(script)
    if not path.exists():
        print(f"Missing collector: {path}")
        return

    subprocess.run([sys.executable, str(path)], check=True)

if __name__ == "__main__":
    main()
'''
}


def write_file(path: Path, content: str, force: bool = False) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        return f"SKIPPED  {path}"
    path.write_text(content, encoding="utf-8")
    return f"CREATED  {path}"


def main():
    parser = argparse.ArgumentParser(description="Bootstrap CEI Apify folder structure")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    args = parser.parse_args()

    print(f"Root: {ROOT}\n")

    for d in DIRS:
        full = ROOT / d
        full.mkdir(parents=True, exist_ok=True)
        print(f"DIR      {full}")

    print()
    for file_path, content in FILES.items():
        result = write_file(ROOT / file_path, content, force=args.force)
        print(result)

    print("\nDone.")
    print("Use --force if you want to overwrite existing files.")


if __name__ == "__main__":
    main()