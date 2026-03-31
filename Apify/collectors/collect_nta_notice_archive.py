from apify_client import ApifyClient
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import json
import os
import re
import sys
import time

START_URL = "https://www.nta.ac.in/NoticeBoardArchive"
ACTOR_ID = "apify/web-scraper"

BASE_DIR = Path("cei_raw") / "nta_noticeboard"
PDF_DIR = BASE_DIR / "pdfs"
JSON_FILE = BASE_DIR / "notice_list.json"
META_FILE = BASE_DIR / "run_meta.json"
FAIL_FILE = BASE_DIR / "download_failures.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/146.0.0.0 Safari/537.36"
)


def safe_filename(text: str, fallback: str = "notice", max_len: int = 140) -> str:
    text = (text or "").strip()
    text = re.sub(r'[<>:"/\\|?*]+', "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        text = fallback
    return text[:max_len].strip()


def ensure_dirs() -> None:
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    PDF_DIR.mkdir(parents=True, exist_ok=True)


def save_json(path: Path, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def download_file(url: str, out_path: Path, timeout: int = 60) -> None:
    req = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": START_URL,
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        content = resp.read()

    with open(out_path, "wb") as f:
        f.write(content)


PAGE_FUNCTION = r"""
async function pageFunction(context) {
    const { request, log } = context;
    const selector = 'a[href*="/Download/Notice/"]';

    await new Promise((resolve, reject) => {
        const timeoutMs = 20000;
        const intervalMs = 500;
        const deadline = Date.now() + timeoutMs;

        const check = () => {
            const found = document.querySelector(selector);
            if (found) return resolve();
            if (Date.now() > deadline) {
                return reject(new Error(`Selector not found within ${timeoutMs}ms: ${selector}`));
            }
            setTimeout(check, intervalMs);
        };

        check();
    });

    const anchors = Array.from(document.querySelectorAll(selector));

    const rows = anchors.map((a, idx) => {
        const href = new URL(a.getAttribute('href'), window.location.href).href;

        const container =
            a.closest('li, tr, .row, .col, p, div') ||
            a.parentElement ||
            a;

        const rawText = (container.innerText || a.innerText || '')
            .replace(/\s+/g, ' ')
            .trim();

        const cleaned = rawText
            .replace(/Read More/ig, '')
            .replace(/Image/ig, '')
            .replace(/\s+/g, ' ')
            .trim();

        const numbered = cleaned.match(/^(\d+)\s+(.*)$/);

        return {
            sourcePage: request.url,
            index: numbered ? Number(numbered[1]) : idx + 1,
            title: numbered ? numbered[2].trim() : cleaned,
            pdfUrl: href,
        };
    });

    const seen = new Set();
    const deduped = rows.filter(item => {
        if (!item.pdfUrl) return false;
        if (seen.has(item.pdfUrl)) return false;
        seen.add(item.pdfUrl);
        return true;
    });

    log.info(`Extracted ${deduped.length} notice links from ${request.url}`);
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
        "startUrls": [{"url": START_URL}],
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

    print("Starting Web Scraper run...")
    run = client.actor(ACTOR_ID).call(run_input=run_input)

    dataset_id = run["defaultDatasetId"]
    run_id = run["id"]
    items = list(client.dataset(dataset_id).iterate_items())

    meta = {
        "runId": run_id,
        "datasetId": dataset_id,
        "startUrl": START_URL,
        "savedAtEpoch": int(time.time()),
        "itemCount": len(items),
    }
    save_json(META_FILE, meta)

    error_items = [x for x in items if isinstance(x, dict) and x.get("#error")]
    if error_items:
        save_json(JSON_FILE, items)
        print("Run returned error items instead of notice records.")
        print(json.dumps(error_items[0], ensure_ascii=False, indent=2))
        sys.exit(2)

    normalized = []
    for idx, item in enumerate(items, start=1):
        pdf_url = (item.get("pdfUrl") or "").strip()
        title = (item.get("title") or "").strip()
        source_page = (item.get("sourcePage") or START_URL).strip()
        index_val = item.get("index", idx)

        if not pdf_url:
            continue

        parsed = urlparse(pdf_url)
        original_name = Path(parsed.path).name or "notice.pdf"

        normalized.append({
            "sourcePage": source_page,
            "index": index_val,
            "title": title,
            "pdfUrl": pdf_url,
            "originalFileName": original_name,
        })

    def sort_key(x):
        try:
            return int(x.get("index", 999999))
        except Exception:
            return 999999

    normalized.sort(key=sort_key)
    save_json(JSON_FILE, normalized)

    print(f"Saved {len(normalized)} notice records to: {JSON_FILE.resolve()}")

    failures = []
    downloaded = 0
    skipped = 0

    for item in normalized:
        pdf_url = item["pdfUrl"]
        idx = item.get("index", 0)
        title = safe_filename(item.get("title", "notice"))
        original_name = safe_filename(item.get("originalFileName", "notice.pdf"), fallback="notice.pdf")

        try:
            idx_num = int(idx)
        except Exception:
            idx_num = 0

        file_name = f"{idx_num:03d} - {title} - {original_name}"
        out_path = PDF_DIR / file_name

        if out_path.exists() and out_path.stat().st_size > 0:
            skipped += 1
            continue

        try:
            download_file(pdf_url, out_path)
            downloaded += 1
            print(f"Downloaded: {out_path.name}")
        except Exception as e:
            failures.append({
                "index": idx,
                "title": item.get("title"),
                "pdfUrl": pdf_url,
                "error": str(e),
            })
            print(f"Failed: {pdf_url} -> {e}")

    save_json(FAIL_FILE, failures)

    print("\nDone.")
    print(f"Run ID: {run_id}")
    print(f"Dataset ID: {dataset_id}")
    print(f"JSON: {JSON_FILE.resolve()}")
    print(f"PDF folder: {PDF_DIR.resolve()}")
    print(f"Downloaded: {downloaded}")
    print(f"Skipped existing: {skipped}")
    print(f"Failures: {len(failures)}")


if __name__ == "__main__":
    main()