from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "phase2a" / "manual_inputs" / "aicte"
DEFAULT_ENDPOINT = "https://facilities.aicte-india.org/dashboard/pages/php/approvedinstituteserver.php"
DEFAULT_DASHBOARD_URL = "https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php"

DEFAULT_HEADERS = {
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Referer": DEFAULT_DASHBOARD_URL,
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    ),
    "X-Requested-With": "XMLHttpRequest",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect official AICTE institute-list JSON for one state")
    parser.add_argument("--state", required=True, help="State label as shown on the AICTE dashboard, e.g. Karnataka")
    parser.add_argument("--output-file", type=Path, help="Path to save the raw institute-list JSON")
    parser.add_argument("--year", default="2025-2026", help="Academic year filter")
    parser.add_argument("--program", default="1", help="Program filter token; default 1 matches the dashboard default")
    parser.add_argument("--level", default="1", help="Level filter token; default 1 matches the dashboard default")
    parser.add_argument(
        "--institution-type",
        default="1",
        help="Institution type filter token; default 1 matches the dashboard default",
    )
    parser.add_argument("--women", default="1", help="Women filter token; default 1 matches the dashboard default")
    parser.add_argument(
        "--minority",
        default="1",
        help="Minority filter token; default 1 matches the dashboard default",
    )
    parser.add_argument("--course", default="1", help="Course filter token; default 1 matches the dashboard default")
    parser.add_argument("--timeout", type=int, default=60, help="HTTP timeout in seconds")
    parser.add_argument("--retries", type=int, default=2, help="Retry count for the HTTP request")
    return parser.parse_args()


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def slugify(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in value.strip())
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-") or "unknown"


def default_output_file(state: str) -> Path:
    return DEFAULT_OUTPUT_DIR / f"aicte_colleges-response-{slugify(state)}.json"


def normalize_state_value(state: str) -> str:
    cleaned = state.strip()
    if not cleaned:
        raise ValueError("State name cannot be empty")
    return f"{cleaned} "


def build_params(args: argparse.Namespace) -> dict[str, str]:
    return {
        "method": "fetchdata",
        "year": args.year,
        "program": args.program,
        "level": args.level,
        "institutiontype": args.institution_type,
        "Women": args.women,
        "Minority": args.minority,
        "state": normalize_state_value(args.state),
        "course": args.course,
    }


def iter_rows(payload: Any) -> Iterable[Any]:
    if isinstance(payload, list):
        yield from payload
        return

    if isinstance(payload, dict):
        for key in ("data", "rows", "results", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                yield from value
                return


def count_rows(payload: Any) -> int:
    return sum(1 for _ in iter_rows(payload))


def fetch_json(endpoint: str, params: dict[str, str], timeout: int, retries: int) -> tuple[str, Any, str]:
    last_error: Exception | None = None

    for attempt in range(1, retries + 2):
        request_url = f"{endpoint}?{urlencode(params)}"
        request = Request(request_url, headers=DEFAULT_HEADERS, method="GET")
        try:
            with urlopen(request, timeout=timeout) as response:
                raw_bytes = response.read()
            raw_text = raw_bytes.decode("utf-8")
            parsed = json.loads(raw_text)
            return raw_text, parsed, request_url
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            logging.warning("Institute-list request failed on attempt %s: %s", attempt, exc)

    raise RuntimeError(f"Unable to collect AICTE institute-list JSON after retries: {last_error}")


def main() -> int:
    args = parse_args()
    setup_logging()

    output_file = args.output_file or default_output_file(args.state)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    params = build_params(args)
    raw_text, parsed, request_url = fetch_json(DEFAULT_ENDPOINT, params, args.timeout, args.retries)
    row_count = count_rows(parsed)

    output_file.write_text(raw_text, encoding="utf-8")

    logging.info("state=%s", args.state.strip())
    logging.info("request_url=%s", request_url)
    logging.info("row_count=%s", row_count)
    logging.info("output_path=%s", output_file)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
