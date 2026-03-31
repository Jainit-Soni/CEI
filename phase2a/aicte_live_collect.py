import argparse
import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Iterable

from playwright.async_api import Error as PlaywrightError
from playwright.async_api import async_playwright

DASHBOARD_URL = "https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php"
COURSE_ENDPOINT = "https://facilities.aicte-india.org/dashboard/pages/php/approvedcourse.php"

DEFAULT_HEADERS = {
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
}

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MANUAL_INPUT_DIR = PROJECT_ROOT / "phase2a" / "manual_inputs" / "aicte"
DEFAULT_INPUT_FILE = MANUAL_INPUT_DIR / "aicte_colleges-response.json"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "phase2a" / "raw" / "aicte_live"
DEFAULT_SUMMARY_FILE = DEFAULT_OUTPUT_DIR / "collection_summary.json"
DEFAULT_LOG_FILE = DEFAULT_OUTPUT_DIR / "collector.log"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Live AICTE course/intake collector")
    parser.add_argument("--limit", type=int, default=10, help="Number of institute IDs to consider from the linkage file")
    parser.add_argument("--year", default="2025-2026", help="Academic year value expected by the endpoint")
    parser.add_argument("--course-token", default="1", help="Course token expected by the endpoint, e.g. 1")
    parser.add_argument("--input-file", type=Path, default=DEFAULT_INPUT_FILE, help="Path to institute-linkage JSON")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Directory to save raw JSON responses")
    parser.add_argument("--summary-file", type=Path, default=DEFAULT_SUMMARY_FILE, help="Summary JSON output path")
    parser.add_argument("--log-file", type=Path, default=DEFAULT_LOG_FILE, help="Collector log path")
    parser.add_argument("--timeout-ms", type=int, default=60000, help="Navigation/request timeout in milliseconds")
    parser.add_argument("--pause-ms", type=int, default=1500, help="Pause between institute requests in milliseconds")
    parser.add_argument("--retries", type=int, default=2, help="Retries per institute request")
    return parser.parse_args()


def setup_logging(log_file: Path) -> None:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(log_file, encoding="utf-8"),
        ],
    )


def discover_input_file(path: Path) -> Path:
    if path.exists():
        return path

    candidates = sorted(MANUAL_INPUT_DIR.glob("*colleges*.json"))
    if candidates:
        return candidates[0]

    raise FileNotFoundError(
        f"Could not find institute linkage JSON. Expected {path} or a *colleges*.json file under {MANUAL_INPUT_DIR}"
    )


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def iter_rows(data: Any) -> Iterable[Any]:
    if isinstance(data, list):
        for item in data:
            yield item
    elif isinstance(data, dict):
        for key in ("data", "rows", "results", "items"):
            value = data.get(key)
            if isinstance(value, list):
                for item in value:
                    yield item


def extract_institute_id(row: Any) -> str | None:
    if isinstance(row, list):
        if row and isinstance(row[0], str) and row[0].strip():
            return row[0].strip()
        return None

    if isinstance(row, dict):
        for key in (
            "aicteid",
            "aicteId",
            "AICTE_ID",
            "AICTEID",
            "id",
            "institute_id",
            "instituteId",
        ):
            value = row.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    return None


def describe_linkage_payload(data: Any) -> str:
    if data is None:
        return "valid_json_null_zero_institutes"

    if isinstance(data, list):
        if not data:
            return "empty_list_zero_institutes"
        return "list_rows_present"

    if isinstance(data, dict):
        for key in ("data", "rows", "results", "items"):
            value = data.get(key)
            if isinstance(value, list):
                if not value:
                    return f"empty_{key}_list_zero_institutes"
                return f"{key}_rows_present"
        return "object_without_supported_row_list"

    return f"unsupported_top_level_{type(data).__name__}"


def is_zero_coverage_linkage_reason(reason: str) -> bool:
    return reason.endswith("_zero_institutes")


def load_institute_ids(path: Path, limit: int) -> tuple[list[str], str]:
    data = read_json(path)
    linkage_reason = describe_linkage_payload(data)
    ids: list[str] = []
    seen: set[str] = set()

    for row in iter_rows(data):
        institute_id = extract_institute_id(row)
        if not institute_id:
            continue
        if institute_id in seen:
            continue
        seen.add(institute_id)
        ids.append(institute_id)
        if len(ids) >= limit:
            break

    if not ids and linkage_reason.endswith("_rows_present"):
        linkage_reason = f"{linkage_reason}_but_no_extractable_institute_ids"

    return ids, linkage_reason


def slash_wrap(value: str) -> str:
    value = value.strip().strip("/")
    return f"/{value}/"


def output_file_for(output_dir: Path, institute_id: str, year: str, course_token: str) -> Path:
    safe_id = institute_id.replace("/", "_")
    safe_year = year.replace("/", "-")
    safe_course = course_token.replace("/", "_")
    return output_dir / f"{safe_id}__course_{safe_course}__year_{safe_year}.json"


async def initial_page_load(page, timeout_ms: int) -> None:
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            await page.goto(
                DASHBOARD_URL,
                wait_until="domcontentloaded",
                timeout=timeout_ms,
            )
            await page.wait_for_timeout(3000)
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logging.warning("Initial dashboard load failed (attempt %s): %s", attempt, exc)
            await page.wait_for_timeout(2000)

    raise RuntimeError(f"Failed to load AICTE dashboard after retries: {last_error}")


async def fetch_course_payload(page, institute_id: str, course_token: str, year: str) -> dict[str, Any]:
    params = {
        "method": "fetchdata",
        "aicteid": slash_wrap(institute_id),
        "course": slash_wrap(course_token),
        "year": slash_wrap(year),
    }

    result = await page.evaluate(
        """
        async ({ endpoint, params, headers }) => {
            const url = new URL(endpoint);
            for (const [key, value] of Object.entries(params)) {
                url.searchParams.set(key, value);
            }

            try {
                const response = await fetch(url.toString(), {
                    method: "GET",
                    headers,
                    credentials: "include"
                });

                const text = await response.text();
                return {
                    ok: response.ok,
                    status: response.status,
                    finalUrl: url.toString(),
                    text
                };
            } catch (error) {
                return {
                    ok: false,
                    status: 0,
                    finalUrl: url.toString(),
                    text: "",
                    error: String(error)
                };
            }
        }
        """,
        {
            "endpoint": COURSE_ENDPOINT,
            "params": params,
            "headers": DEFAULT_HEADERS,
        },
    )

    return result


def classify_payload(text: str) -> tuple[str, Any, int]:
    stripped = (text or "").strip()
    if not stripped:
        return "empty", None, 0

    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return "malformed", None, 0

    if isinstance(parsed, list):
        return ("populated" if len(parsed) > 0 else "empty"), parsed, len(parsed)

    if isinstance(parsed, dict):
        for key in ("data", "rows", "results", "items"):
            value = parsed.get(key)
            if isinstance(value, list):
                return ("populated" if len(value) > 0 else "empty"), parsed, len(value)
        return "malformed", parsed, 0

    return "malformed", parsed, 0


async def collect_one(page, output_dir: Path, institute_id: str, course_token: str, year: str, retries: int) -> dict[str, Any]:
    target_file = output_file_for(output_dir, institute_id, year, course_token)

    if target_file.exists():
        existing_rows = 0
        try:
            existing_data = read_json(target_file)
            _, _, existing_rows = classify_payload(json.dumps(existing_data, ensure_ascii=False))
        except Exception:  # noqa: BLE001
            pass

        return {
            "institute_id": institute_id,
            "status": "skipped_existing",
            "rows": existing_rows,
            "file": str(target_file),
        }

    last_failure: str | None = None

    for attempt in range(1, retries + 2):
        response = await fetch_course_payload(page, institute_id, course_token, year)

        if not response.get("ok"):
            last_failure = response.get("error") or f"HTTP {response.get('status', 0)}"
            logging.warning("%s failed (%s) attempt %s", institute_id, last_failure, attempt)
            await page.wait_for_timeout(1000)
            continue

        classification, parsed, row_count = classify_payload(response.get("text", ""))

        if classification == "malformed":
            target_file.write_text(response.get("text", ""), encoding="utf-8")
            logging.warning("Malformed payload for %s (attempt %s)", institute_id, attempt)
            return {
                "institute_id": institute_id,
                "status": "malformed",
                "rows": row_count,
                "file": str(target_file),
                "request_url": response.get("finalUrl"),
            }

        if parsed is None:
            parsed_to_save: Any = []
        else:
            parsed_to_save = parsed

        target_file.write_text(json.dumps(parsed_to_save, ensure_ascii=False, indent=2), encoding="utf-8")
        logging.info("%s rows for %s (attempt %s)", row_count, institute_id, attempt)

        return {
            "institute_id": institute_id,
            "status": classification,
            "rows": row_count,
            "file": str(target_file),
            "request_url": response.get("finalUrl"),
        }

    return {
        "institute_id": institute_id,
        "status": "failed",
        "rows": 0,
        "file": str(target_file),
        "error": last_failure or "unknown failure",
    }


async def main() -> None:
    args = parse_args()
    setup_logging(args.log_file)

    input_file = discover_input_file(args.input_file)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.summary_file.parent.mkdir(parents=True, exist_ok=True)

    institute_ids, linkage_status = load_institute_ids(input_file, args.limit)
    if not institute_ids:
        if not is_zero_coverage_linkage_reason(linkage_status):
            raise ValueError(f"No institute IDs found in {input_file}; linkage_status={linkage_status}")

        summary = {
            "input_file": str(input_file),
            "output_dir": str(args.output_dir),
            "limit": args.limit,
            "year": args.year,
            "course_token": args.course_token,
            "linkage_status": linkage_status,
            "results": [],
            "totals": {
                "considered": 0,
                "successful": 0,
                "populated": 0,
                "empty": 0,
                "malformed": 0,
                "failed": 0,
                "skipped_existing": 0,
                "rows_returned": 0,
            },
        }
        args.summary_file.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        logging.info("Zero-institute linkage file: %s (%s)", input_file, linkage_status)
        return

    logging.info("Loaded %s institute IDs from %s (%s)", len(institute_ids), input_file, linkage_status)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/123.0.0.0 Safari/537.36"
            ),
            extra_http_headers={
                "Referer": DASHBOARD_URL,
            },
        )

        page = await context.new_page()

        try:
            await initial_page_load(page, args.timeout_ms)

            results: list[dict[str, Any]] = []
            for institute_id in institute_ids:
                result = await collect_one(
                    page=page,
                    output_dir=args.output_dir,
                    institute_id=institute_id,
                    course_token=args.course_token,
                    year=args.year,
                    retries=args.retries,
                )
                results.append(result)
                await page.wait_for_timeout(args.pause_ms)

        finally:
            await context.close()
            await browser.close()

    summary = {
        "input_file": str(input_file),
        "output_dir": str(args.output_dir),
        "limit": args.limit,
        "year": args.year,
        "course_token": args.course_token,
        "results": results,
        "totals": {
            "considered": len(institute_ids),
            "successful": sum(1 for r in results if r["status"] in {"populated", "empty"}),
            "populated": sum(1 for r in results if r["status"] == "populated"),
            "empty": sum(1 for r in results if r["status"] == "empty"),
            "malformed": sum(1 for r in results if r["status"] == "malformed"),
            "failed": sum(1 for r in results if r["status"] == "failed"),
            "skipped_existing": sum(1 for r in results if r["status"] == "skipped_existing"),
            "rows_returned": sum(int(r.get("rows", 0)) for r in results if r["status"] == "populated"),
        },
    }

    args.summary_file.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    logging.info("Collection summary: %s", summary["totals"])


if __name__ == "__main__":
    asyncio.run(main())