from __future__ import annotations

import argparse
import json
import logging
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterable

import pdfplumber

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_INPUT_DIR = PROJECT_ROOT / "phase3_acpc" / "raw" / "acpc_gujarat" / "be_btech" / "2025"
DEFAULT_MANIFEST_FILE = "document_manifest.ndjson"
DEFAULT_SEAT_OUTPUT = PROJECT_ROOT / "normalized" / "acpc_seat_matrix.ndjson"
DEFAULT_CUTOFF_OUTPUT = PROJECT_ROOT / "normalized" / "acpc_cutoffs.ndjson"
DEFAULT_PROVENANCE_OUTPUT = PROJECT_ROOT / "evidence" / "acpc_provenance.ndjson"
DEFAULT_LOG_FILE = PROJECT_ROOT / "phase3_acpc" / "acpc_be_btech_ingest.log"

ACPC_SOURCE_FAMILY = "ACPC"
ACPC_SOURCE_AUTHORITY = "Admission Committee for Professional Courses (ACPC), Gujarat"
COURSE_FAMILY = "BE/BTECH"
STATE = "Gujarat"
SESSION = "2025-26"
ROUND = "Round 3"

SEAT_TITLE = "Round 3 Institute Wise Intake and allotted Status"
CUTOFF_TITLES = {
    "Round 3 Analysis Closure Rank Wise": "rank_wise",
    "Round 3 Analysis Closure Program Wise": "program_wise",
    "Round 3 Analysis Closure Institute Wise Program Wise": "institute_wise_program_wise",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest ACPC BE/BTECH Round 3 PDFs into normalized NDJSON")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR, help="Directory with downloaded ACPC PDFs")
    parser.add_argument("--seat-output", type=Path, default=DEFAULT_SEAT_OUTPUT, help="Seat-matrix NDJSON output")
    parser.add_argument("--cutoff-output", type=Path, default=DEFAULT_CUTOFF_OUTPUT, help="Cutoff NDJSON output")
    parser.add_argument(
        "--provenance-output",
        type=Path,
        default=DEFAULT_PROVENANCE_OUTPUT,
        help="Combined provenance NDJSON output",
    )
    parser.add_argument("--log-file", type=Path, default=DEFAULT_LOG_FILE, help="Log file path")
    return parser.parse_args()


def setup_logging(log_file: Path) -> None:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.StreamHandler(), logging.FileHandler(log_file, encoding="utf-8")],
    )


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def ensure_file(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text("", encoding="utf-8")


def write_ndjson(path: Path, rows: list[dict[str, Any]]) -> None:
    ensure_file(path)
    if rows:
        content = "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n"
    else:
        content = ""
    path.write_text(content, encoding="utf-8")


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    cleaned = cleaned.strip("-")
    return cleaned or "unknown"


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    text = re.sub(r"[\x00-\x1f\x7f]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_institute_type(value: str) -> str:
    cleaned = clean_text(value)
    lowered = cleaned.lower().replace(" ", "")
    if lowered in {"self-fin", "self-fin.", "self-financed", "self-finance", "self-fin.", "self-fin"}:
        return "Self-Fin"
    if lowered == "govt":
        return "GOVT"
    if lowered == "gia":
        return "GIA"
    if lowered == "sfi":
        return "SFI"
    return cleaned


def parse_number(value: str) -> int:
    cleaned = clean_text(value)
    try:
        number = Decimal(cleaned)
    except InvalidOperation as exc:
        raise ValueError(f"Not a numeric value: {value!r}") from exc

    if number == number.to_integral():
        return int(number)
    raise ValueError(f"Expected an integer-like value, got {value!r}")


def load_manifest(input_dir: Path) -> list[dict[str, str]]:
    manifest_path = input_dir / DEFAULT_MANIFEST_FILE
    if not manifest_path.exists():
        raise SystemExit(f"Missing ACPC manifest file: {manifest_path}")

    rows: list[dict[str, str]] = []
    for line in manifest_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        rows.append(json.loads(line))
    return rows


def iter_pdf_rows(pdf_path: Path) -> Iterable[tuple[int, list[str]]]:
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            table = page.extract_table()
            if not table:
                continue
            for row in table:
                cells = [clean_text(cell) for cell in row]
                yield page_number, cells


def is_seat_data_row(cells: list[str]) -> bool:
    if len(cells) != 6:
        return False
    if not cells[0] or not cells[1] or not cells[2]:
        return False
    if cells[0] == "Name of Institute":
        return False
    try:
        parse_number(cells[3])
        parse_number(cells[4])
        parse_number(cells[5])
    except ValueError:
        return False
    return True


def is_cutoff_data_row(cells: list[str]) -> bool:
    if len(cells) != 6:
        return False
    if not cells[0] or not cells[1] or not cells[2] or not cells[3] or not cells[4]:
        return False
    if cells[0] in {"Inst_Name", "Course_name"}:
        return False
    try:
        parse_number(cells[5])
    except ValueError:
        return False
    return True


def build_seat_stable_key(institution_name: str, program_name: str, institute_type: str) -> str:
    return "-".join(
        [
            "acpc-seat",
            slugify(STATE),
            slugify(COURSE_FAMILY),
            slugify(SESSION),
            slugify(ROUND),
            slugify(institution_name),
            slugify(program_name),
            slugify(institute_type),
        ]
    )


def build_cutoff_stable_key(
    institution_name: str,
    program_name: str,
    category: str,
    board: str,
    institute_type: str,
) -> str:
    return "-".join(
        [
            "acpc-cutoff",
            slugify(STATE),
            slugify(COURSE_FAMILY),
            slugify(SESSION),
            slugify(ROUND),
            slugify(institution_name),
            slugify(program_name),
            slugify(category),
            slugify(board),
            slugify(institute_type),
        ]
    )


def build_provenance_row(
    *,
    stable_key: str,
    entity_type: str,
    doc: dict[str, str],
    page_number: int,
    fields: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "stableKey": stable_key,
        "entityType": entity_type,
        "sourceFamily": ACPC_SOURCE_FAMILY,
        "sourceAuthority": doc.get("sourceAuthority", ACPC_SOURCE_AUTHORITY),
        "sourcePageUrl": doc.get("sourcePageUrl", ""),
        "pdfUrl": doc.get("pdfUrl", ""),
        "documentTitle": doc.get("documentTitle", ""),
        "sourceDocumentType": doc.get("documentTitle", ""),
        "session": SESSION,
        "round": ROUND,
        "pdfPageNumber": page_number,
        "localFile": doc.get("localFile", ""),
        "fields": fields,
    }


def parse_seat_rows(doc: dict[str, str], input_dir: Path, extracted_at: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int]:
    pdf_path = input_dir / doc["localFile"]
    if not pdf_path.exists():
        raise SystemExit(f"Missing ACPC seat PDF: {pdf_path}")

    entries: list[dict[str, Any]] = []
    provenance_rows: list[dict[str, Any]] = []
    parsed_rows = 0

    for page_number, cells in iter_pdf_rows(pdf_path):
        if not is_seat_data_row(cells):
            continue

        institution_name_raw, program_name_raw, institute_type_raw, intake_raw, allotted_raw, vacant_raw = cells
        institution_name = clean_text(institution_name_raw)
        program_name = clean_text(program_name_raw)
        institute_type = normalize_institute_type(institute_type_raw)
        stable_key = build_seat_stable_key(institution_name, program_name, institute_type)

        entry = {
            "stableKey": stable_key,
            "entityType": "counsellingSeatMatrix",
            "state": STATE,
            "courseFamily": COURSE_FAMILY,
            "session": SESSION,
            "round": ROUND,
            "institutionName": institution_name,
            "institutionNameRaw": institution_name_raw,
            "programName": program_name,
            "programNameRaw": program_name_raw,
            "instituteType": institute_type,
            "instituteTypeRaw": institute_type_raw,
            "seatMatrixType": "counselling_intake_allotted_vacant",
            "acpcIntake": parse_number(intake_raw),
            "allottedCount": parse_number(allotted_raw),
            "vacantCount": parse_number(vacant_raw),
            "sourceFamily": ACPC_SOURCE_FAMILY,
            "sourceAuthority": doc.get("sourceAuthority", ACPC_SOURCE_AUTHORITY),
            "sourceUrl": doc.get("pdfUrl", ""),
            "sourcePageUrl": doc.get("sourcePageUrl", ""),
            "sourceDocumentType": doc.get("documentTitle", ""),
            "documentDate": "",
            "fetchedAt": doc.get("downloadedAt", extracted_at),
            "extractedAt": extracted_at,
            "officialityLevel": "official",
            "confidence": 0.97,
            "evidencePointer": f"acpc_provenance.ndjson#{stable_key}",
        }
        entries.append(entry)

        provenance_rows.append(
            build_provenance_row(
                stable_key=stable_key,
                entity_type="counsellingSeatMatrix",
                doc=doc,
                page_number=page_number,
                fields=[
                    {"field": "institutionName", "value": institution_name},
                    {"field": "programName", "value": program_name},
                    {"field": "instituteType", "value": institute_type},
                    {"field": "acpcIntake", "value": parse_number(intake_raw)},
                    {"field": "allottedCount", "value": parse_number(allotted_raw)},
                    {"field": "vacantCount", "value": parse_number(vacant_raw)},
                    {"field": "session", "value": SESSION},
                    {"field": "round", "value": ROUND},
                ],
            )
        )
        parsed_rows += 1

    return entries, provenance_rows, parsed_rows


def normalize_cutoff_cells(title: str, cells: list[str]) -> dict[str, str]:
    if title == "Round 3 Analysis Closure Program Wise":
        program_name_raw, institution_name_raw, category_raw, board_raw, institute_type_raw, closing_raw = cells
    else:
        institution_name_raw, program_name_raw, category_raw, board_raw, institute_type_raw, closing_raw = cells

    return {
        "institution_name_raw": institution_name_raw,
        "program_name_raw": program_name_raw,
        "category_raw": category_raw,
        "board_raw": board_raw,
        "institute_type_raw": institute_type_raw,
        "closing_raw": closing_raw,
    }


def parse_cutoff_rows(
    docs: list[dict[str, str]],
    input_dir: Path,
    extracted_at: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, int]]:
    entries_by_key: dict[str, dict[str, Any]] = {}
    provenance_rows: list[dict[str, Any]] = []
    conflicts: list[str] = []
    stats = {"rawRows": 0, "deduplicated": 0, "duplicates": 0}

    for doc in docs:
        pdf_path = input_dir / doc["localFile"]
        if not pdf_path.exists():
            raise SystemExit(f"Missing ACPC cutoff PDF: {pdf_path}")

        view_type = CUTOFF_TITLES[doc["documentTitle"]]

        for page_number, cells in iter_pdf_rows(pdf_path):
            if not is_cutoff_data_row(cells):
                continue

            stats["rawRows"] += 1
            raw_values = normalize_cutoff_cells(doc["documentTitle"], cells)

            institution_name = clean_text(raw_values["institution_name_raw"])
            program_name = clean_text(raw_values["program_name_raw"])
            category = clean_text(raw_values["category_raw"])
            board = clean_text(raw_values["board_raw"])
            institute_type = normalize_institute_type(raw_values["institute_type_raw"])
            closing_rank = parse_number(raw_values["closing_raw"])

            stable_key = build_cutoff_stable_key(
                institution_name=institution_name,
                program_name=program_name,
                category=category,
                board=board,
                institute_type=institute_type,
            )

            entry = {
                "stableKey": stable_key,
                "entityType": "counsellingCutoff",
                "state": STATE,
                "courseFamily": COURSE_FAMILY,
                "session": SESSION,
                "round": ROUND,
                "cutoffKind": "closing_rank",
                "institutionName": institution_name,
                "institutionNameRaw": raw_values["institution_name_raw"],
                "programName": program_name,
                "programNameRaw": raw_values["program_name_raw"],
                "category": category,
                "categoryRaw": raw_values["category_raw"],
                "board": board,
                "boardRaw": raw_values["board_raw"],
                "instituteType": institute_type,
                "instituteTypeRaw": raw_values["institute_type_raw"],
                "closingRank": closing_rank,
                "sourceFamily": ACPC_SOURCE_FAMILY,
                "sourceAuthority": doc.get("sourceAuthority", ACPC_SOURCE_AUTHORITY),
                "sourceUrl": doc.get("sourcePageUrl", ""),
                "sourcePageUrl": doc.get("sourcePageUrl", ""),
                "sourceDocumentType": "ACPC BE/BTECH Round 3 closure rank PDFs",
                "documentDate": "",
                "fetchedAt": doc.get("downloadedAt", extracted_at),
                "extractedAt": extracted_at,
                "officialityLevel": "official",
                "confidence": 0.96,
                "evidencePointer": f"acpc_provenance.ndjson#{stable_key}",
            }

            existing = entries_by_key.get(stable_key)
            if existing is None:
                entries_by_key[stable_key] = entry
                stats["deduplicated"] += 1
            else:
                if existing["closingRank"] != closing_rank:
                    conflicts.append(
                        (
                            f"Conflicting closingRank for {stable_key}: "
                            f"{existing['closingRank']} vs {closing_rank} "
                            f"from {doc['documentTitle']}"
                        )
                    )
                else:
                    stats["duplicates"] += 1

            provenance_row = build_provenance_row(
                stable_key=stable_key,
                entity_type="counsellingCutoff",
                doc=doc,
                page_number=page_number,
                fields=[
                    {"field": "institutionName", "value": institution_name},
                    {"field": "programName", "value": program_name},
                    {"field": "category", "value": category},
                    {"field": "board", "value": board},
                    {"field": "instituteType", "value": institute_type},
                    {"field": "closingRank", "value": closing_rank},
                    {"field": "session", "value": SESSION},
                    {"field": "round", "value": ROUND},
                ],
            )
            provenance_row["viewType"] = view_type
            provenance_rows.append(provenance_row)

    if conflicts:
        raise SystemExit(
            "Conflicting official cutoff values detected across Round 3 PDFs:\n" + "\n".join(conflicts[:20])
        )

    entries = list(entries_by_key.values())
    return entries, provenance_rows, stats


def main() -> int:
    args = parse_args()
    setup_logging(args.log_file)

    input_dir = args.input_dir if args.input_dir.is_absolute() else PROJECT_ROOT / args.input_dir
    seat_output = args.seat_output if args.seat_output.is_absolute() else PROJECT_ROOT / args.seat_output
    cutoff_output = args.cutoff_output if args.cutoff_output.is_absolute() else PROJECT_ROOT / args.cutoff_output
    provenance_output = (
        args.provenance_output if args.provenance_output.is_absolute() else PROJECT_ROOT / args.provenance_output
    )

    manifest_rows = load_manifest(input_dir)

    seat_doc = next((row for row in manifest_rows if row.get("documentTitle") == SEAT_TITLE), None)
    if seat_doc is None:
        raise SystemExit(f"Seat PDF manifest entry not found for title: {SEAT_TITLE}")

    cutoff_docs = [row for row in manifest_rows if row.get("documentTitle") in CUTOFF_TITLES]
    if len(cutoff_docs) != len(CUTOFF_TITLES):
        raise SystemExit(f"Expected {len(CUTOFF_TITLES)} cutoff PDFs, found {len(cutoff_docs)}")

    extracted_at = now_utc()

    seat_entries, seat_provenance, seat_raw_rows = parse_seat_rows(seat_doc, input_dir, extracted_at)
    cutoff_entries, cutoff_provenance, cutoff_stats = parse_cutoff_rows(cutoff_docs, input_dir, extracted_at)

    seat_entries.sort(key=lambda item: (item["institutionName"], item["programName"], item["instituteType"]))
    cutoff_entries.sort(
        key=lambda item: (
            item["institutionName"],
            item["programName"],
            item["category"],
            item["board"],
            item["instituteType"],
        )
    )
    provenance_rows = seat_provenance + cutoff_provenance
    provenance_rows.sort(key=lambda item: (item["entityType"], item["stableKey"], item["documentTitle"], item["pdfPageNumber"]))

    write_ndjson(seat_output, seat_entries)
    write_ndjson(cutoff_output, cutoff_entries)
    write_ndjson(provenance_output, provenance_rows)

    logging.info(
        "ACPC ingest summary: seat_raw_rows=%s seat_rows=%s cutoff_raw_rows=%s cutoff_rows=%s cutoff_duplicates=%s provenance_rows=%s",
        seat_raw_rows,
        len(seat_entries),
        cutoff_stats["rawRows"],
        len(cutoff_entries),
        cutoff_stats["duplicates"],
        len(provenance_rows),
    )
    print(
        "ACPC ingest summary:",
        {
            "seat_raw_rows": seat_raw_rows,
            "seat_rows": len(seat_entries),
            "cutoff_raw_rows": cutoff_stats["rawRows"],
            "cutoff_rows": len(cutoff_entries),
            "cutoff_duplicates": cutoff_stats["duplicates"],
            "provenance_rows": len(provenance_rows),
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
