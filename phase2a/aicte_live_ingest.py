from __future__ import annotations

import argparse
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_RAW_DIR = PROJECT_ROOT / "phase2a" / "raw" / "aicte_live"
DEFAULT_MANUAL_PROGRAM_FILE = PROJECT_ROOT / "phase2a" / "manual_inputs" / "aicte" / "aicte_course_response.json"

DEFAULT_PROGRAMS_FILE = PROJECT_ROOT / "normalized" / "programs.ndjson"
DEFAULT_ACCREDITATIONS_FILE = PROJECT_ROOT / "normalized" / "accreditations.ndjson"
DEFAULT_PROVENANCE_FILE = PROJECT_ROOT / "evidence" / "program_provenance.ndjson"
DEFAULT_SOURCE_REGISTRY_FILE = PROJECT_ROOT / "normalized" / "source_registry.ndjson"
DEFAULT_LOG_FILE = PROJECT_ROOT / "phase2a" / "aicte_live_ingest.log"

AICTE_SOURCE_URL = "https://facilities.aicte-india.org/dashboard/pages/php/approvedcourse.php"
AICTE_SOURCE_AUTHORITY = "All India Council for Technical Education, Government of India"

# Expected list-row shape from the current AICTE response payloads:
# 0 aicte_id
# 1 institution_name
# 2 state
# 3 program_name
# 4 affiliation
# 5 level
# 6 degree
# 7 specialization
# 8 shift
# 9 mode
# 10 intake
ROW_INDEX = {
    "aicte_id": 0,
    "institution_name": 1,
    "state": 2,
    "program_name": 3,
    "affiliation": 4,
    "level": 5,
    "degree": 6,
    "specialization": 7,
    "shift": 8,
    "mode": 9,
    "intake": 10,
}

# Optional dict-shape support for future-proofing.
ROW_KEYS = {
    "aicte_id": ["aicteid", "aicte_id", "aicteId", "AICTE_ID", "AICTEID", "id"],
    "institution_name": ["institution_name", "institutionName", "name", "college_name", "institute_name"],
    "state": ["state", "institution_state"],
    "program_name": ["program_name", "programName", "course_name", "course", "branch_name"],
    "affiliation": ["affiliation", "university", "affiliateUniversity", "affiliatingUniversity"],
    "level": ["level", "program_level"],
    "degree": ["degree", "program_type"],
    "specialization": ["specialization", "branch", "discipline"],
    "shift": ["shift", "timing", "session"],
    "mode": ["mode", "study_mode"],
    "intake": ["intake", "approved_intake", "intakeApproved", "approvedIntake"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest AICTE live/manual program captures")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DEFAULT_RAW_DIR,
        help="Directory containing AICTE live-capture JSON files",
    )
    parser.add_argument(
        "--manual-file",
        type=Path,
        default=None,
        help="Optional manual AICTE JSON response file",
    )
    parser.add_argument("--state", default="Gujarat", help="Human-friendly state label for this run")
    parser.add_argument("--year", default="2025-2026", help="Academic year label")
    parser.add_argument("--confidence-live", type=float, default=0.82, help="Confidence for live captures")
    parser.add_argument("--confidence-manual", type=float, default=0.85, help="Confidence for manual drops")
    parser.add_argument("--log-file", type=Path, default=DEFAULT_LOG_FILE, help="Log file path")
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
    if not value:
        return "unknown"
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    cleaned = cleaned.strip("-")
    return cleaned or "unknown"


def normalize_state_label(state: str | None) -> str | None:
    if not state:
        return None
    cleaned = state.strip()
    return cleaned or None


def state_output_path(base: Path, state: str | None) -> Path:
    state = normalize_state_label(state)
    if not state:
        return base
    suffix = f"_{slugify(state)}"
    return base.with_name(f"{base.stem}{suffix}{base.suffix}")


def build_stable_key(
    *,
    aicte_id: str,
    institute_name: str,
    program_name: str,
    degree: str,
    level: str,
    shift: str,
    mode: str,
    academic_year: str,
) -> str:
    parts = [
        slugify("aicte-program"),
        slugify(institute_name or aicte_id or "institution"),
        slugify(aicte_id),
        slugify(program_name or degree or "program"),
        slugify(degree),
        slugify(level),
        slugify(shift),
        slugify(mode),
        slugify(academic_year),
    ]
    return "-".join(part for part in parts if part and part != "unknown")


def extract_field(row: Any, field_name: str) -> str:
    if isinstance(row, list):
        idx = ROW_INDEX[field_name]
        if idx < len(row):
            value = row[idx]
            return str(value).strip() if value is not None else ""
        return ""

    if isinstance(row, dict):
        for key in ROW_KEYS[field_name]:
            if key in row and row[key] is not None:
                return str(row[key]).strip()
        return ""

    return ""


def iter_payload_rows(payload: Any) -> Iterable[Any]:
    if isinstance(payload, list):
        for item in payload:
            yield item
        return

    if isinstance(payload, dict):
        for key in ("data", "rows", "results", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                for item in value:
                    yield item
                return


def prepare_entry(
    row: Any,
    *,
    filename: str,
    source_document_type: str,
    fetch_timestamp: str,
    year: str,
    confidence: float,
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    aicte_id = extract_field(row, "aicte_id")
    institution_name = extract_field(row, "institution_name")
    state = extract_field(row, "state")
    program_name = extract_field(row, "program_name")
    affiliation = extract_field(row, "affiliation")
    level = extract_field(row, "level")
    degree = extract_field(row, "degree")
    specialization = extract_field(row, "specialization")
    shift = extract_field(row, "shift")
    mode = extract_field(row, "mode")
    intake = extract_field(row, "intake")

    # Require the core fields needed to trust a row.
    if not aicte_id or not institution_name or not program_name:
        return None

    stable_key = build_stable_key(
        aicte_id=aicte_id,
        institute_name=institution_name,
        program_name=program_name,
        degree=degree,
        level=level,
        shift=shift,
        mode=mode,
        academic_year=year,
    )

    institution_stable_key = f"aicte-institution-{slugify(aicte_id)}"

    entry = {
        "stableKey": stable_key,
        "entityType": "program",
        "institutionStableKey": institution_stable_key,
        "institutionName": institution_name,
        "institutionAicteId": aicte_id,
        "institutionState": state,
        "programName": program_name,
        "degree": degree,
        "specialization": specialization,
        "level": level,
        "shift": shift,
        "mode": mode,
        "intakeApproved": intake,
        "academicYear": year,
        "affiliatingUniversity": affiliation,
        "sourceFamily": "AICTE",
        "sourceAuthority": AICTE_SOURCE_AUTHORITY,
        "sourceUrl": AICTE_SOURCE_URL,
        "sourceDocumentType": source_document_type,
        "documentDate": "",
        "fetchedAt": fetch_timestamp,
        "extractedAt": fetch_timestamp,
        "officialityLevel": "official",
        "confidence": confidence,
        "evidencePointer": f"program_provenance.ndjson#{stable_key}",
        "localFile": filename,
    }

    provenance = {
        "stableKey": stable_key,
        "sourceDocument": filename,
        "sourceFamily": "AICTE",
        "sourceAuthority": AICTE_SOURCE_AUTHORITY,
        "sourceUrl": AICTE_SOURCE_URL,
        "sourceDocumentType": source_document_type,
        "documentDate": "",
        "lineNumber": 0,
        "fields": [
            {"field": "institutionName", "value": institution_name},
            {"field": "institutionAicteId", "value": aicte_id},
            {"field": "programName", "value": program_name},
            {"field": "degree", "value": degree},
            {"field": "specialization", "value": specialization},
            {"field": "level", "value": level},
            {"field": "shift", "value": shift},
            {"field": "mode", "value": mode},
            {"field": "intakeApproved", "value": intake},
            {"field": "affiliatingUniversity", "value": affiliation},
            {"field": "institutionState", "value": state},
            {"field": "academicYear", "value": year},
        ],
    }

    return entry, provenance


def load_sources(raw_dir: Path, manual_file: Path | None, confidence_live: float, confidence_manual: float) -> list[tuple[Path, str, float]]:
    sources: list[tuple[Path, str, float]] = []

    if manual_file is not None and manual_file.exists():
        sources.append((manual_file, "AICTE approved programs (manual drop)", confidence_manual))

    if raw_dir.exists():
        for file_path in sorted(raw_dir.glob("*.json")):
            if "summary" in file_path.stem.lower():
                continue
            sources.append((file_path, "AICTE approved programs (live capture JSON course response)", confidence_live))

    return sources


def update_source_registry(
    *,
    source_registry_file: Path,
    processed_files: list[str],
    timestamp: str,
    state: str | None,
    row_count: int,
    distinct_institutes: int,
) -> None:
    ensure_file(source_registry_file)

    entry_id = f"aicte-programs-{slugify(state)}" if state else "aicte-programs"
    notes = (
        f"AICTE programs/intake ingestion for {state or 'unspecified scope'}; "
        f"{row_count} deduplicated program rows across {distinct_institutes} institutes."
    )

    existing_rows: list[dict[str, Any]] = []
    for line in source_registry_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            existing_rows.append(json.loads(line))
        except json.JSONDecodeError:
            logging.warning("Skipping malformed source registry line")

    updated = False
    for row in existing_rows:
        if row.get("id") != entry_id:
            continue
        current_files = row.get("rawFiles", [])
        if not isinstance(current_files, list):
            current_files = []
        for name in processed_files:
            if name not in current_files:
                current_files.append(name)

        row["rawFiles"] = sorted(current_files)
        row["status"] = "partially_acquired"
        row["fetchedAt"] = timestamp
        row["scope"] = f"{state or 'AICTE'} approved programs and intake"
        row["notes"] = notes
        row["sourceDocumentType"] = "AICTE approved programs (manual drop + live capture)"
        row["rowCount"] = row_count
        row["distinctInstitutes"] = distinct_institutes
        updated = True

    if not updated:
        existing_rows.append(
            {
                "id": entry_id,
                "sourceFamily": "AICTE",
                "sourceAuthority": AICTE_SOURCE_AUTHORITY,
                "sourceUrl": AICTE_SOURCE_URL,
                "sourceDocumentType": "AICTE approved programs (manual drop + live capture)",
                "documentDate": "",
                "fetchedAt": timestamp,
                "status": "partially_acquired",
                "scope": f"{state or 'AICTE'} approved programs and intake",
                "state": state or "",
                "rawFiles": sorted(processed_files),
                "rowCount": row_count,
                "distinctInstitutes": distinct_institutes,
                "notes": notes,
            }
        )

    write_ndjson(source_registry_file, existing_rows)


def main() -> None:
    args = parse_args()
    setup_logging(args.log_file)

    raw_dir = args.input_dir if args.input_dir.is_absolute() else PROJECT_ROOT / args.input_dir
    manual_file = None
    if args.manual_file is not None:
        manual_file = args.manual_file if args.manual_file.is_absolute() else PROJECT_ROOT / args.manual_file
    state_label = normalize_state_label(args.state)

    programs_file = state_output_path(DEFAULT_PROGRAMS_FILE, state_label)
    accreditations_file = state_output_path(DEFAULT_ACCREDITATIONS_FILE, state_label)
    provenance_file = state_output_path(DEFAULT_PROVENANCE_FILE, state_label)

    ensure_file(programs_file)
    ensure_file(accreditations_file)
    ensure_file(provenance_file)
    ensure_file(DEFAULT_SOURCE_REGISTRY_FILE)

    sources = load_sources(
        raw_dir=raw_dir,
        manual_file=manual_file,
        confidence_live=args.confidence_live,
        confidence_manual=args.confidence_manual,
    )

    if not sources:
        manual_label = str(manual_file) if manual_file is not None else "(not provided)"
        raise SystemExit(
            f"No AICTE program inputs available. Checked manual file {manual_label} and raw folder {raw_dir}"
        )

    timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    seen_keys: set[str] = set()
    entries: list[dict[str, Any]] = []
    provenance_rows: list[dict[str, Any]] = []
    processed_files: list[str] = []

    stats = {
        "files": 0,
        "rows": 0,
        "new": 0,
        "duplicates": 0,
        "skipped": 0,
    }

    for file_path, doc_type, confidence in sources:
        processed_files.append(file_path.name)
        stats["files"] += 1

        try:
            payload = json.loads(file_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            logging.warning("Skipping malformed JSON file %s: %s", file_path.name, exc)
            stats["skipped"] += 1
            continue

        row_index = 0
        for row in iter_payload_rows(payload):
            row_index += 1
            stats["rows"] += 1

            prepared = prepare_entry(
                row,
                filename=file_path.name,
                source_document_type=doc_type,
                fetch_timestamp=timestamp,
                year=args.year,
                confidence=confidence,
            )

            if prepared is None:
                stats["skipped"] += 1
                continue

            entry, provenance = prepared
            provenance["lineNumber"] = row_index

            if entry["stableKey"] in seen_keys:
                stats["duplicates"] += 1
                continue

            seen_keys.add(entry["stableKey"])
            entries.append(entry)
            provenance_rows.append(provenance)
            stats["new"] += 1

    # Deterministic output ordering helps audits and diffs.
    entries.sort(
        key=lambda item: (
            item.get("institutionState", ""),
            item.get("institutionName", ""),
            item.get("programName", ""),
            item.get("degree", ""),
            item.get("level", ""),
            item.get("shift", ""),
        )
    )
    provenance_rows.sort(key=lambda item: item.get("stableKey", ""))

    write_ndjson(programs_file, entries)
    write_ndjson(provenance_file, provenance_rows)

    # Explicitly keep accreditations file present even when this source has none.
    accreditations_file.write_text("", encoding="utf-8")

    distinct_institutes = len(
        {
            entry.get("institutionAicteId", "").strip()
            for entry in entries
            if entry.get("institutionAicteId", "").strip()
        }
    )

    update_source_registry(
        source_registry_file=DEFAULT_SOURCE_REGISTRY_FILE,
        processed_files=processed_files,
        timestamp=timestamp,
        state=state_label,
        row_count=len(entries),
        distinct_institutes=distinct_institutes,
    )

    logging.info(
        "AICTE ingestion: files=%s rows=%s new=%s duplicates=%s skipped=%s",
        stats["files"],
        stats["rows"],
        stats["new"],
        stats["duplicates"],
        stats["skipped"],
    )
    print("AICTE ingestion summary:", stats)


if __name__ == "__main__":
    main()