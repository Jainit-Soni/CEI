from __future__ import annotations

import argparse
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_SOURCE_PAGE_URL = "https://gujacpc.admissions.nic.in/eservices-be_b-tech/"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "phase3_acpc" / "raw" / "acpc_gujarat" / "be_btech" / "2025"
DEFAULT_MANIFEST_FILE = "document_manifest.ndjson"
ACPC_SOURCE_AUTHORITY = "Admission Committee for Professional Courses (ACPC), Gujarat"

ROUND_3_TITLES = [
    "Round 3 Institute Wise Intake and allotted Status",
    "Round 3 Analysis Closure Rank Wise",
    "Round 3 Analysis Closure Program Wise",
    "Round 3 Analysis Closure Institute Wise Program Wise",
]

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect official ACPC BE/BTECH Round 3 PDFs")
    parser.add_argument("--source-page-url", default=DEFAULT_SOURCE_PAGE_URL, help="Official ACPC eServices page URL")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Directory for downloaded PDFs")
    parser.add_argument("--timeout", type=int, default=60, help="HTTP timeout in seconds")
    parser.add_argument("--retries", type=int, default=2, help="Retry count for each HTTP request")
    return parser.parse_args()


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_whitespace(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    cleaned = cleaned.strip("-")
    return cleaned or "unknown"


def request_with_retries(
    session: requests.Session,
    url: str,
    *,
    timeout: int,
    retries: int,
    stream: bool = False,
) -> requests.Response:
    last_error: Exception | None = None
    for attempt in range(1, retries + 2):
        try:
            response = session.get(url, timeout=timeout, stream=stream)
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            last_error = exc
            logging.warning("Request failed for %s on attempt %s: %s", url, attempt, exc)
    raise RuntimeError(f"Unable to fetch {url}: {last_error}")


def parse_round_3_documents(html: str, source_page_url: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    links_by_title: dict[str, str] = {}

    for anchor in soup.find_all("a", href=True):
        title = normalize_whitespace(anchor.get_text(" ", strip=True))
        if title not in ROUND_3_TITLES:
            continue
        links_by_title[title] = urljoin(source_page_url, anchor["href"])

    missing = [title for title in ROUND_3_TITLES if title not in links_by_title]
    if missing:
        raise SystemExit(f"Missing required ACPC Round 3 documents on {source_page_url}: {missing}")

    return [(title, links_by_title[title]) for title in ROUND_3_TITLES]


def write_manifest(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join(json.dumps(row, ensure_ascii=False) for row in rows)
    if content:
        content += "\n"
    path.write_text(content, encoding="utf-8")


def main() -> int:
    args = parse_args()
    setup_logging()

    output_dir = args.output_dir if args.output_dir.is_absolute() else PROJECT_ROOT / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)

    source_page_response = request_with_retries(
        session,
        args.source_page_url,
        timeout=args.timeout,
        retries=args.retries,
    )
    documents = parse_round_3_documents(source_page_response.text, args.source_page_url)

    manifest_rows: list[dict[str, str]] = []
    timestamp = now_utc()

    for title, pdf_url in documents:
        filename = f"{slugify(title)}.pdf"
        local_path = output_dir / filename

        pdf_response = request_with_retries(
            session,
            pdf_url,
            timeout=args.timeout,
            retries=args.retries,
            stream=True,
        )
        local_path.write_bytes(pdf_response.content)

        manifest_row = {
            "documentTitle": title,
            "sourceAuthority": ACPC_SOURCE_AUTHORITY,
            "sourcePageUrl": args.source_page_url,
            "pdfUrl": pdf_url,
            "localFile": filename,
            "downloadedAt": timestamp,
        }
        manifest_rows.append(manifest_row)

        logging.info("document_title=%s", title)
        logging.info("source_page_url=%s", args.source_page_url)
        logging.info("pdf_url=%s", pdf_url)
        logging.info("local_path=%s", local_path)

    write_manifest(output_dir / DEFAULT_MANIFEST_FILE, manifest_rows)
    logging.info("manifest_path=%s", output_dir / DEFAULT_MANIFEST_FILE)
    print(f"Collected {len(manifest_rows)} ACPC Round 3 documents into {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
