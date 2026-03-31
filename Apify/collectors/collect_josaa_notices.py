from apify_client import ApifyClient
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import json
import os
import re
import sys
import time

ACTOR_ID = "apify/web-scraper"

START_URLS = [
    "https://josaa.nic.in/archive/",
    "https://josaa.nic.in/schedule/",
    "https://josaa.nic.in/information-bulletin/",
    "https://josaa.nic.in/certificate-format/",
]

ROOT_DIR = Path(__file__).resolve().parent.parent
BASE_DIR = ROOT_DIR / "cei_raw" / "josaa_notices"
DOCS_DIR = BASE_DIR / "pdfs"
JSON_FILE = BASE_DIR / "notice_list.json"
META_FILE = BASE_DIR / "run_meta.json"
FAIL_FILE = BASE_DIR / "download_failures.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/146.0.0.0 Safari/537.36"
)


def ensure_dirs() -> None:
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)


def save_json(path: Path, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def safe_filename(text: str, fallback: str = "document", max_len: int = 150) -> str:
    text = (text or "").strip()
    text = re.sub(r'[<>:"/\\|?*]+', "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        text = fallback
    return text[:max_len].strip()


def download_file(url: str, out_path: Path, referer: str, timeout: int = 60) -> None:
    req = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": referer,
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        content = resp.read()

    with open(out_path, "wb") as f:
        f.write(content)


PAGE_FUNCTION = r"""
async function pageFunction(context) {
    const { request, log } = context;

    await new Promise(resolve => setTimeout(resolve, 2000));

    const docExtRegex = /\.(pdf|doc|docx|xls|xlsx|csv)$/i;
    const candidates = Array.from(document.querySelectorAll('a[href]'));

    const rows = candidates.map((a) => {
        const hrefAttr = a.getAttribute('href') || '';
        const href = new URL(hrefAttr, window.location.href).href;
        const anchorText = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim();

        const container =
            a.closest('li, tr, .row, .col, p, div, td') ||
            a.parentElement ||
            a;

        const containerText = (container?.innerText || anchorText || '')
            .replace(/\s+/g, ' ')
            .trim();

        const isDocumentHref = docExtRegex.test(href);
        const hasDocumentCue =
            /accessible version|view\s*\/\s*download|view\b|download\b/i.test(containerText) ||
            /business rule|schedule|certificate|faq|seat matrix|public notice|restrictions|help centers|opening and closing ranks/i.test(containerText);

        if (!isDocumentHref && !hasDocumentCue) {
            return null;
        }

        // Try to derive year/session from nearby text
        const yearMatch = containerText.match(/\b(20\d{2})\b/);

        let title = containerText
            .replace(/\bAccessible Version\b\s*:?\s*/ig, '')
            .replace(/\bView\s*\/\s*Download\b/ig, '')
            .replace(/\bView\b/ig, '')
            .replace(/\bDownload\b/ig, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!title) {
            title = anchorText || href.split('/').pop() || 'JoSAA document';
        }

        return {
            sourcePage: request.url,
            pageTitle: document.title || '',
            title,
            fileUrl: href,
            sessionYear: yearMatch ? yearMatch[1] : null,
        };
    }).filter(Boolean);

    const seen = new Set();
    const deduped = rows.filter(item => {
        const key = item.fileUrl;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    log.info(`Extracted ${deduped.length} document links from ${request.url}`);
    return deduped;
}
"""


def main() -> None:
    token = os.getenv("APIFY_TOKEN")
    if not token:
        print("ERROR: APIFY_TOKEN is missing.")
        print("Open a fresh CMD after setx, then run again.")
        sys.exit(1)

    ensure_dirs()
    client = ApifyClient(token)

    run_input = {
        "startUrls": [{"url": url} for url in START_URLS],
        "linkSelector": "",
        "pageFunction": PAGE_FUNCTION,
        "injectJQuery": False,
        "proxyConfiguration": {
            "useApifyProxy": True
        },
        "waitUntil": ["domcontentloaded", "networkidle2"],
        "debugLog": False,
        "browserLog": False,
    }

    print("Starting JoSAA Web Scraper run...")
    run = client.actor(ACTOR_ID).call(run_input=run_input)

    dataset_id = run["defaultDatasetId"]
    run_id = run["id"]
    items = list(client.dataset(dataset_id).iterate_items())

    meta = {
        "runId": run_id,
        "datasetId": dataset_id,
        "startUrls": START_URLS,
        "savedAtEpoch": int(time.time()),
        "itemCount": len(items),
    }
    save_json(META_FILE, meta)

    error_items = [x for x in items if isinstance(x, dict) and x.get("#error")]
    if error_items:
        save_json(JSON_FILE, items)
        print("Run returned error items instead of document records.")
        print(json.dumps(error_items[0], ensure_ascii=False, indent=2))
        sys.exit(2)

    normalized = []
    seen_urls = set()

    for item in items:
        file_url = (item.get("fileUrl") or "").strip()
        if not file_url or file_url in seen_urls:
            continue
        seen_urls.add(file_url)

        title = (item.get("title") or "").strip()
        source_page = (item.get("sourcePage") or "").strip()
        page_title = (item.get("pageTitle") or "").strip()
        session_year = item.get("sessionYear")

        parsed = urlparse(file_url)
        original_name = Path(parsed.path).name or "document"

        normalized.append({
            "sourcePage": source_page,
            "pageTitle": page_title,
            "title": title,
            "fileUrl": file_url,
            "sessionYear": session_year,
            "originalFileName": original_name,
        })

    normalized.sort(key=lambda x: ((x.get("sessionYear") or ""), x.get("title") or ""), reverse=True)
    save_json(JSON_FILE, normalized)

    print(f"Saved {len(normalized)} JoSAA document records to: {JSON_FILE.resolve()}")

    failures = []
    downloaded = 0
    skipped = 0

    for idx, item in enumerate(normalized, start=1):
        file_url = item["fileUrl"]
        title = safe_filename(item.get("title", "document"))
        original_name = safe_filename(item.get("originalFileName", "document"))
        year = safe_filename(str(item.get("sessionYear") or "unknown-year"))

        ext = Path(original_name).suffix or ".bin"
        file_name = f"{idx:03d} - {year} - {title}{ext if not original_name.lower().endswith(ext.lower()) else ''}"

        # Preserve original filename if it already has a usable extension
        if re.search(r"\.(pdf|doc|docx|xls|xlsx|csv)$", original_name, re.I):
            file_name = f"{idx:03d} - {year} - {title} - {original_name}"

        out_path = DOCS_DIR / file_name

        if out_path.exists() and out_path.stat().st_size > 0:
            skipped += 1
            continue

        try:
            download_file(file_url, out_path, referer=item.get("sourcePage") or START_URLS[0])
            downloaded += 1
            print(f"Downloaded: {out_path.name}")
        except Exception as e:
            failures.append({
                "title": item.get("title"),
                "fileUrl": file_url,
                "sourcePage": item.get("sourcePage"),
                "error": str(e),
            })
            print(f"Failed: {file_url} -> {e}")

    save_json(FAIL_FILE, failures)

    print("\nDone.")
    print(f"Run ID: {run_id}")
    print(f"Dataset ID: {dataset_id}")
    print(f"JSON: {JSON_FILE.resolve()}")
    print(f"Docs folder: {DOCS_DIR.resolve()}")
    print(f"Downloaded: {downloaded}")
    print(f"Skipped existing: {skipped}")
    print(f"Failures: {len(failures)}")


if __name__ == "__main__":
    main()