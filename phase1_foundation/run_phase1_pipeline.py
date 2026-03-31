import csv
import html as html_module
from html.parser import HTMLParser
import json
import re
import urllib.error
import urllib.request
from datetime import datetime
from itertools import zip_longest
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from bs4 import BeautifulSoup
    from bs4.element import NavigableString
except ImportError:  # pragma: no cover
    BeautifulSoup = None  # type: ignore
    NavigableString = None  # type: ignore

try:
    import openpyxl
except ImportError:  # pragma: no cover
    openpyxl = None  # type: ignore

try:
    import xlrd
except ImportError:  # pragma: no cover
    xlrd = None  # type: ignore

try:
    from PyPDF2 import PdfReader
except ImportError:
    PdfReader = None

PROJECT_ROOT = Path(__file__).resolve().parents[1]
NORMALIZED_DIR = PROJECT_ROOT / "normalized"
EVIDENCE_DIR = PROJECT_ROOT / "evidence"
REPORTS_DIR = PROJECT_ROOT / "reports"
RAW_DOWNLOAD_DIR = PROJECT_ROOT / "phase1_foundation" / "raw"
MANUAL_NIRF_DIR = PROJECT_ROOT / "phase1_foundation" / "manual_inputs" / "nirf"
MANUAL_NIRF_README = MANUAL_NIRF_DIR / "README.md"

MANUAL_NIRF_README_TEXT = """# Manual NIRF Inputs
1. Download the official 2024 overall ranking page or PDF directly from https://www.nirfindia.org/Rankings/2024/OverallRanking150.html or the equivalent official release on the NIRF portal.
2. Save the HTML, CSV, or PDF exactly as provided by the Ministry of Education. Example file names: `nirf-2024-overall.html`, `nirf-2024-overall.csv`, `nirf-2024-overall.pdf`.
3. Place the downloaded file(s) into this folder (`phase1_foundation/manual_inputs/nirf/`). Do not edit or copy/paste data; keep the original export to preserve provenance.
4. Re-run `phase1_foundation/run_phase1_pipeline.py`. The pipeline will parse the manual drop and normalize the NIRF ranking data into `normalized/rankings.ndjson`. If the official release includes multiple formats, feel free to drop each version here for redundancy.
"""

AISHE_SOURCE_URL = "https://aishe.gov.in/documents/"
AISHE_AUTHORITY = "Department of Higher Education, Ministry of Education, Government of India (AISHE Survey)"
SOURCE_FAMILY = "AISHE"
ACADEMIC_YEAR = "2021-22"
CONFIDENCE_LEVEL = 0.95

NIRF_SOURCE_FAMILY = "NIRF"
NIRF_SOURCE_AUTHORITY = "National Institutional Ranking Framework, Ministry of Education, Government of India"
NIRF_URL = "https://www.nirfindia.org/Rankings/2024/OverallRanking150.html"
NIRF_ACADEMIC_YEAR = "2024"
RANKING_CATEGORY = "Overall"
RANKING_CONFIDENCE = 0.9

PHASE2_MANUAL_DIR = PROJECT_ROOT / "phase2a" / "manual_inputs" / "aicte"
PHASE2_MANUAL_README = PHASE2_MANUAL_DIR / "README.md"
PHASE2_MANUAL_README_TEXT = """# Manual AICTE Inputs
1. Download the official AICTE approved programs/intake list (for example, from https://www.aicte-india.org/education or the portal that publishes the Intake Approval/EoA CSV).
2. Save the file exactly as provided by AICTE (CSV is preferred; if the official export is XLSX, save a copy as CSV without editing values to retain provenance).
3. Place the downloaded file(s) into `phase2a/manual_inputs/aicte/`. Do not modify or re-format the data.
4. Re-run `phase1_foundation/run_phase1_pipeline.py`. The pipeline will normalize programs, approved intake, and any accreditation metadata into `normalized/programs.ndjson`, `normalized/accreditations.ndjson`, and `evidence/program_provenance.ndjson`.
"""

AICTE_SOURCE_FAMILY = "AICTE"
AICTE_SOURCE_AUTHORITY = "All India Council for Technical Education, Government of India"
AICTE_SOURCE_URL = "https://www.aicte-india.org/"
AICTE_CONFIDENCE = 0.85
AICTE_DOCUMENT_TYPE = "AICTE approved programs (manual drop)"

AICTE_ACQUISITION_THRESHOLD = 10  # rows required for full acquisition token

AISHE_SOURCES = [
    {
        "path": PROJECT_ROOT / "backend" / "data" / "aishe_colleges.csv",
        "documentType": "AISHE master list - Colleges (CSV slice from official download)",
        "label": "Colleges",
    },
    {
        "path": PROJECT_ROOT / "backend" / "data" / "aishe_standalone.csv",
        "documentType": "AISHE master list - Standalone institutions (CSV slice)",
        "label": "Standalone institutions",
    },
    {
        "path": PROJECT_ROOT / "backend" / "data" / "aishe_university.csv",
        "documentType": "AISHE master list - Universities (CSV slice)",
        "label": "Universities",
    },
]

def ensure_dirs() -> None:
    for directory in (NORMALIZED_DIR, EVIDENCE_DIR, REPORTS_DIR, RAW_DOWNLOAD_DIR):
        directory.mkdir(parents=True, exist_ok=True)
    MANUAL_NIRF_DIR.mkdir(parents=True, exist_ok=True)
    PHASE2_MANUAL_DIR.mkdir(parents=True, exist_ok=True)
    if not MANUAL_NIRF_README.exists():
        MANUAL_NIRF_README.write_text(MANUAL_NIRF_README_TEXT, encoding="utf-8")
    if not PHASE2_MANUAL_README.exists():
        PHASE2_MANUAL_README.write_text(PHASE2_MANUAL_README_TEXT, encoding="utf-8")


def clean_value(value: Optional[str]) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.upper() in {"", "-", "NA", "N/A"}:
        return ""
    return text


def normalize_column_name(value: Optional[str]) -> str:
    if not value:
        return ""
    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower())
    return normalized.strip("_")


def strip_html_tags(value: str) -> str:
    if not value:
        return ""
    text = re.sub(r"<[^>]+>", "", value)
    return html_module.unescape(text).strip()


def parse_document_date(lines: List[str]) -> Optional[str]:
    for line in lines:
        if "As on Date" in line:
            match = re.search(r"As on Date:\s*(\d{1,2})-(\d{1,2})-(\d{4})", line)
            if match:
                day, month, year = match.groups()
                return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    return None


def normalize_header(header_line: str) -> List[str]:
    cleaned = []
    for column in next(csv.reader([header_line])):
        cleaned.append(normalize_column_name(column))
    return cleaned


def slugify(value: str) -> str:
    if not value:
        return "unknown"
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return slug.strip("-") or "unknown"


def build_ranking_stable_key(rank_value: str, institution_name: str) -> str:
    slug = slugify(institution_name)
    rank_token = re.sub(r"[^\w]+", "-", (rank_value or "unnumbered").strip().lower())
    rank_token = rank_token.strip("-") or "unnumbered"
    return f"nirf-2024-overall-{rank_token}-{slug}"


def parse_aishe_file(
    src: Dict[str, str],
    run_timestamp: str,
    seen_keys: set,
) -> Dict[str, object]:
    file_path: Path = src["path"]
    if not file_path.exists():
        raise FileNotFoundError(f"{file_path} is missing")

    lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    document_date = parse_document_date(lines)
    header_idx = None
    header_fields = []
    for idx, line in enumerate(lines):
        if "Aishe Code" in line:
            header_idx = idx
            header_fields = normalize_header(line)
            break
    if header_idx is None:
        raise ValueError(f"Could not find header row in {file_path.name}")

    records: List[Dict[str, object]] = []
    provenance: List[Dict[str, object]] = []
    duplicates = 0
    rows_processed = 0
    for idx in range(header_idx + 1, len(lines)):
        raw_line = lines[idx]
        if not raw_line.strip():
            continue
        rows_processed += 1
        values = next(csv.reader([raw_line]))
        row_data = {
            key: clean_value(value)
            for key, value in zip_longest(header_fields, values, fillvalue="")
        }

        stable_key = row_data.get("aishe_code", "")
        if not stable_key:
            continue
        if stable_key in seen_keys:
            duplicates += 1
            continue
        seen_keys.add(stable_key)

        record = {
            "stableKey": stable_key,
            "entityType": "institution",
            "name": row_data.get("name") or stable_key,
            "sourceFamily": SOURCE_FAMILY,
            "sourceUrl": AISHE_SOURCE_URL,
            "sourceAuthority": AISHE_AUTHORITY,
            "sourceDocumentType": src["documentType"],
            "documentDate": document_date or "",
            "fetchedAt": run_timestamp,
            "extractedAt": run_timestamp,
            "academicYear": ACADEMIC_YEAR,
            "officialityLevel": "official",
            "confidence": CONFIDENCE_LEVEL,
            "evidencePointer": f"field_provenance.ndjson#{stable_key}",
            "aisheCode": stable_key,
        }

        supplemental = {
            "state": row_data.get("state"),
            "district": row_data.get("district"),
            "location": row_data.get("location"),
            "website": row_data.get("website"),
            "yearOfEstablishment": row_data.get("year_of_establishment"),
            "institutionType": (
                row_data.get("college_type")
                or row_data.get("standalone_type")
                or row_data.get("institution_type")
            ),
            "management": row_data.get("manegement") or row_data.get("management"),
            "universityName": row_data.get("university_name"),
            "universityType": row_data.get("university_type"),
            "standaloneType": row_data.get("standalone_type"),
        }
        for key, value in supplemental.items():
            if value:
                record[key] = value

        provenance_entry = {
            "stableKey": stable_key,
            "sourceDocument": file_path.name,
            "sourceFamily": SOURCE_FAMILY,
            "sourceUrl": AISHE_SOURCE_URL,
            "sourceDocumentType": src["documentType"],
            "documentDate": document_date or "",
            "lineNumber": idx + 1,
            "fields": [
                {"field": "aisheCode", "value": stable_key},
                {"field": "name", "value": record["name"]},
                {"field": "state", "value": record.get("state", "")},
                {"field": "district", "value": record.get("district", "")},
                {"field": "location", "value": record.get("location", "")},
                {
                    "field": "yearOfEstablishment",
                    "value": record.get("yearOfEstablishment", ""),
                },
            ],
        }

        records.append(record)
        provenance.append(provenance_entry)

    stats = {
        "file": file_path.name,
        "label": src["label"],
        "entries": len(records),
        "duplicates": duplicates,
        "rows": rows_processed,
        "documentDate": document_date or "",
    }
    return {
        "records": records,
        "provenance": provenance,
        "stats": stats,
        "documentDate": document_date,
    }


def build_ranking_record(
    row_data: Dict[str, str],
    run_timestamp: str,
    file_path: Path,
    doc_type: str,
    document_date: str,
    line_number: int,
) -> Optional[Tuple[Dict[str, object], Dict[str, object]]]:
    institution_name = (
        row_data.get("institution")
        or row_data.get("institution_name")
        or row_data.get("college_name")
        or row_data.get("name")
    )
    if not institution_name:
        return None
    rank_value = (
        row_data.get("rank")
        or row_data.get("overall_rank")
        or row_data.get("nirf_rank")
        or row_data.get("rank_band")
        or ""
    )
    score = row_data.get("score") or row_data.get("nirf_score") or ""
    state = row_data.get("state") or row_data.get("state_ut") or ""
    city = row_data.get("city") or row_data.get("location") or ""
    category = row_data.get("category") or RANKING_CATEGORY
    rank_band = row_data.get("rank_band") or row_data.get("rank_band_range") or ""
    stable_key = build_ranking_stable_key(rank_value, institution_name)
    record: Dict[str, object] = {
        "stableKey": stable_key,
        "entityType": "ranking",
        "name": institution_name,
        "category": category,
        "sourceFamily": NIRF_SOURCE_FAMILY,
        "sourceAuthority": NIRF_SOURCE_AUTHORITY,
        "sourceUrl": NIRF_URL,
        "sourceDocumentType": doc_type,
        "documentDate": document_date or "",
        "fetchedAt": run_timestamp,
        "extractedAt": run_timestamp,
        "academicYear": NIRF_ACADEMIC_YEAR,
        "officialityLevel": "official",
        "confidence": RANKING_CONFIDENCE,
        "evidencePointer": f"field_provenance.ndjson#{stable_key}",
        "localFile": file_path.name,
        "officialReference": NIRF_URL,
    }
    if rank_value:
        record["rank"] = rank_value
    if rank_band:
        record["rankBand"] = rank_band
    if score:
        record["score"] = score
    if state:
        record["state"] = state
    if city:
        record["city"] = city
    fields = [{"field": "name", "value": institution_name}]
    if rank_value:
        fields.append({"field": "rank", "value": rank_value})
    if score:
        fields.append({"field": "score", "value": score})
    if state:
        fields.append({"field": "state", "value": state})
    if city:
        fields.append({"field": "city", "value": city})
    provenance_entry = {
        "stableKey": stable_key,
        "sourceDocument": file_path.name,
        "sourceFamily": NIRF_SOURCE_FAMILY,
        "sourceUrl": NIRF_URL,
        "sourceDocumentType": doc_type,
        "documentDate": document_date or "",
        "lineNumber": line_number,
        "fields": fields,
    }
    return record, provenance_entry


def parse_nirf_csv_file(file_path: Path, run_timestamp: str) -> Dict[str, object]:
    doc_type = "NIRF 2024 overall ranking (CSV manual drop)"
    records: List[Dict[str, object]] = []
    provenance: List[Dict[str, object]] = []
    document_dates = set()
    error = ""
    try:
        with file_path.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                row_data = {
                    normalize_column_name(k): clean_value(v)
                    for k, v in row.items()
                    if k
                }
                doc_date = row_data.get("document_date") or row_data.get("release_date") or ""
                result = build_ranking_record(
                    row_data,
                    run_timestamp,
                    file_path,
                    doc_type,
                    doc_date,
                    reader.line_num,
                )
                if result:
                    record, prov = result
                    records.append(record)
                    provenance.append(prov)
                    if doc_date:
                        document_dates.add(doc_date)
    except Exception as exc:
        error = str(exc)
    return {
        "records": records,
        "provenance": provenance,
        "documentDates": document_dates,
        "error": error,
    }




def parse_nirf_html_file(file_path: Path, run_timestamp: str) -> Dict[str, object]:
    doc_type = "NIRF 2024 overall ranking (HTML manual drop)"
    records: List[Dict[str, object]] = []
    provenance: List[Dict[str, object]] = []
    document_dates = set()
    error = ""
    if not BeautifulSoup:
        return {
            "records": records,
            "provenance": provenance,
            "documentDates": document_dates,
            "error": "BeautifulSoup (bs4) is required to parse HTML ranking files.",
        }
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        document_date = parse_document_date(content.splitlines()) or ""
        soup = BeautifulSoup(content, "html.parser")
        table = soup.find("table", id="tbl_overall")
        if not table:
            return {
                "records": records,
                "provenance": provenance,
                "documentDates": document_dates,
                "error": "Table with id tbl_overall not found.",
            }
        tbody = table.find("tbody")
        if not tbody:
            return {
                "records": records,
                "provenance": provenance,
                "documentDates": document_dates,
                "error": "No tbody section inside tbl_overall.",
            }

        def extract_cell_text(cell: "bs4.element.Tag") -> str:  # type: ignore
            text_value = ""
            if NavigableString:
                for child in cell.children:
                    if isinstance(child, NavigableString):
                        trimmed = child.strip()
                        if trimmed:
                            text_value = trimmed
                            break
            if not text_value:
                text_value = cell.get_text(" ", strip=True)
            return strip_html_tags(text_value)

        rows = []
        for tr in tbody.find_all("tr", recursive=False):
            cells = [extract_cell_text(td) for td in tr.find_all("td", recursive=False)]
            if len(cells) < 6:
                continue
            if "institute id" in cells[0].lower():
                continue
            rows.append(cells)

        if not rows:
            return {
                "records": records,
                "provenance": provenance,
                "documentDates": document_dates,
                "error": "No ranking rows found in tbl_overall.",
            }

        for idx, cells in enumerate(rows, start=1):
            row_data = {
                "institution": cells[1],
                "city": cells[2],
                "state": cells[3],
                "score": cells[4],
                "rank": cells[5],
            }
            result = build_ranking_record(
                row_data,
                run_timestamp,
                file_path,
                doc_type,
                document_date,
                idx,
            )
            if result:
                record, prov = result
                records.append(record)
                provenance.append(prov)
                if document_date:
                    document_dates.add(document_date)
    except Exception as exc:
        error = str(exc)
    return {
        "records": records,
        "provenance": provenance,
        "documentDates": document_dates,
        "error": error,
    }

def parse_nirf_pdf_file(file_path: Path, run_timestamp: str) -> Dict[str, object]:
    doc_type = "NIRF 2024 overall ranking (PDF manual drop)"
    records: List[Dict[str, object]] = []
    provenance: List[Dict[str, object]] = []
    document_dates = set()
    if not PdfReader:
        return {
            "records": records,
            "provenance": provenance,
            "documentDates": document_dates,
            "error": "PyPDF2 is not installed; PDF parsing skipped.",
        }
    error = ""
    try:
        reader = PdfReader(str(file_path))
        line_counter = 0
        for page in reader.pages:
            text = page.extract_text()
            if not text:
                continue
            for raw_line in text.splitlines():
                line = strip_html_tags(raw_line)
                if not line:
                    continue
                line_counter += 1
                parts = re.split(r"\s{2,}", line)
                parts = [part.strip() for part in parts if part.strip()]
                if len(parts) < 2:
                    continue
                row_data = {"rank": parts[0], "institution": parts[1]}
                if len(parts) >= 3 and re.match(r"^\d+(\.\d+)?$", parts[-1]):
                    row_data["score"] = parts[-1]
                if len(parts) >= 3:
                    row_data["state"] = parts[2]
                result = build_ranking_record(
                    row_data,
                    run_timestamp,
                    file_path,
                    doc_type,
                    "",
                    line_counter,
                )
                if result:
                    record, prov = result
                    records.append(record)
                    provenance.append(prov)
    except Exception as exc:
        error = str(exc)
    return {
        "records": records,
        "provenance": provenance,
        "documentDates": document_dates,
        "error": error,
    }


def _parse_aicte_academic_year_from_header(header: str) -> str:
    match = re.search(r"(20\\d{2})[_-]?(\\d{2,4})", header)
    if not match:
        return ""
    start, end = match.group(1), match.group(2)
    if len(end) == 2:
        return f"{start}-{end}"
    return f"{start}-{end}"

def _collect_aicte_row_fields(row: Dict[str, str]) -> Dict[str, object]:
    data: Dict[str, object] = {
        "institution": "",
        "program": "",
        "level": "",
        "degree": "",
        "specialization": "",
        "academicYear": "",
        "documentDate": "",
        "intakeCandidates": [],
        "intakeApproved": "",
        "approvalStatus": "",
        "approvalType": "",
        "approvalDocument": "",
    }
    for header, raw_value in row.items():
        if header is None:
            continue
        normalized = normalize_column_name(header)
        value = clean_value(raw_value)
        if not normalized or not value:
            continue
        if "intake" in normalized or "seat" in normalized or "sanctioned" in normalized:
            data["intakeCandidates"].append((normalized, value))
            continue
        if any(keyword in normalized for keyword in ("institute", "institution", "college", "name")):
            if not data["institution"]:
                data["institution"] = value
            continue
        if any(keyword in normalized for keyword in ("program", "course", "programme")):
            if not data["program"]:
                data["program"] = value
            continue
        if any(keyword in normalized for keyword in ("level", "program_level", "course_level")):
            if not data["level"]:
                data["level"] = value
            continue
        if any(keyword in normalized for keyword in ("degree", "qualification")):
            if not data["degree"]:
                data["degree"] = value
            continue
        if any(keyword in normalized for keyword in ("specialization", "branch", "discipline", "stream")):
            if not data["specialization"]:
                data["specialization"] = value
            continue
        if any(keyword in normalized for keyword in ("academic_year", "academicyear", "ay", "year", "session")):
            if not data["academicYear"]:
                data["academicYear"] = value
            continue
        if any(keyword in normalized for keyword in ("document_date", "approval_date", "letter_date", "issued_date", "date_published")):
            if not data["documentDate"]:
                data["documentDate"] = value
            continue
        if "approval_status" in normalized or normalized == "status":
            if not data["approvalStatus"]:
                data["approvalStatus"] = value
            continue
        if "approval_type" in normalized or "accreditation_type" in normalized or "approval_category" in normalized:
            if not data["approvalType"]:
                data["approvalType"] = value
            continue
        if "approval_document" in normalized or "document_number" in normalized or "letter_number" in normalized:
            if not data["approvalDocument"]:
                data["approvalDocument"] = value
            continue
    intake_value = ""
    intake_year = ""
    for normalized_header, candidate in data["intakeCandidates"]:
        if not intake_value:
            intake_value = candidate
        if not intake_year:
            intake_year = _parse_aicte_academic_year_from_header(normalized_header)
    if intake_value:
        data["intakeApproved"] = intake_value
        if not data["academicYear"] and intake_year:
            data["academicYear"] = intake_year
    return data

def build_aicte_program_stable_key(
    institution: str,
    program: str,
    academic_year: str,
) -> str:
    parts = []
    if academic_year:
        parts.append(slugify(academic_year))
    parts.append(slugify(institution))
    parts.append(slugify(program))
    return "aicte-program-" + "-".join(part for part in parts if part)

def build_aicte_program_record(
    row_data: Dict[str, str],
    run_timestamp: str,
    file_path: Path,
    doc_type: str,
    line_number: int,
) -> Optional[Tuple[Dict[str, object], Dict[str, object]]]:
    institution = row_data.get("institution", "")
    program = row_data.get("program", "")
    if not institution or not program:
        return None
    academic_year = row_data.get("academicYear", "") or ""
    stable_key = build_aicte_program_stable_key(institution, program, academic_year)
    record = {
        "stableKey": stable_key,
        "entityType": "program",
        "institutionStableKey": f"aicte-institution-{slugify(institution)}",
        "institutionName": institution,
        "institutionAicteId": row_data.get("aicteId", ""),
        "programName": program,
        "degree": row_data.get("degree", ""),
        "specialization": row_data.get("specialization", ""),
        "level": row_data.get("level", ""),
        "intakeApproved": row_data.get("intakeApproved", ""),
        "academicYear": academic_year,
        "sourceFamily": AICTE_SOURCE_FAMILY,
        "sourceAuthority": AICTE_SOURCE_AUTHORITY,
        "sourceUrl": AICTE_SOURCE_URL,
        "sourceDocumentType": doc_type,
        "documentDate": row_data.get("documentDate", ""),
        "fetchedAt": run_timestamp,
        "extractedAt": run_timestamp,
        "officialityLevel": "official",
        "confidence": AICTE_CONFIDENCE,
        "evidencePointer": f"program_provenance.ndjson#{stable_key}",
        "localFile": file_path.name,
    }
    fields = [
        {"field": "institutionName", "value": institution},
        {"field": "programName", "value": program},
    ]
    if record["degree"]:
        fields.append({"field": "degree", "value": record["degree"]})
    if record["specialization"]:
        fields.append({"field": "specialization", "value": record["specialization"]})
    if record["level"]:
        fields.append({"field": "level", "value": record["level"]})
    if record["intakeApproved"]:
        fields.append({"field": "intakeApproved", "value": record["intakeApproved"]})
    if row_data.get("aicteId"):
        fields.append({"field": "aicteId", "value": row_data["aicteId"]})
    if row_data.get("state"):
        fields.append({"field": "state", "value": row_data["state"]})
    if row_data.get("affiliation"):
        fields.append({"field": "affiliation", "value": row_data["affiliation"]})
    if row_data.get("shift"):
        fields.append({"field": "shift", "value": row_data["shift"]})
    if row_data.get("mode"):
        fields.append({"field": "mode", "value": row_data["mode"]})
    if row_data.get("enrollment"):
        fields.append({"field": "enrollment", "value": row_data["enrollment"]})
    if row_data.get("placement"):
        fields.append({"field": "placement", "value": row_data["placement"]})
    return record, {
        "stableKey": stable_key,
        "sourceDocument": file_path.name,
        "sourceFamily": AICTE_SOURCE_FAMILY,
        "sourceUrl": AICTE_SOURCE_URL,
        "sourceDocumentType": doc_type,
        "documentDate": record["documentDate"],
        "lineNumber": line_number,
        "fields": fields,
    }

def build_aicte_accreditation_record(
    row_data: Dict[str, str],
    run_timestamp: str,
    file_path: Path,
    doc_type: str,
    line_number: int,
) -> Optional[Tuple[Dict[str, object], Dict[str, object]]]:
    institution = row_data.get("institution", "")
    approval_status = row_data.get("approvalStatus", "")
    if not institution or not approval_status:
        return None
    academic_year = row_data.get("academicYear", "")
    year_segment = slugify(academic_year) if academic_year else "latest"
    stable_key = f"aicte-accreditation-{year_segment}-{slugify(institution)}"
    record = {
        "stableKey": stable_key,
        "entityType": "accreditation",
        "institutionStableKey": f"aicte-institution-{slugify(institution)}",
        "institutionName": institution,
        "approvalStatus": approval_status,
        "approvalType": row_data.get("approvalType", ""),
        "approvalDocument": row_data.get("approvalDocument", ""),
        "academicYear": academic_year,
        "sourceFamily": AICTE_SOURCE_FAMILY,
        "sourceAuthority": AICTE_SOURCE_AUTHORITY,
        "sourceUrl": AICTE_SOURCE_URL,
        "sourceDocumentType": doc_type,
        "documentDate": row_data.get("documentDate", ""),
        "fetchedAt": run_timestamp,
        "extractedAt": run_timestamp,
        "officialityLevel": "official",
        "confidence": 0.8,
        "evidencePointer": f"program_provenance.ndjson#{stable_key}",
        "localFile": file_path.name,
    }
    fields = [
        {"field": "institutionName", "value": institution},
        {"field": "approvalStatus", "value": approval_status},
    ]
    if record["approvalType"]:
        fields.append({"field": "approvalType", "value": record["approvalType"]})
    if record["approvalDocument"]:
        fields.append({"field": "approvalDocument", "value": record["approvalDocument"]})
    return record, {
        "stableKey": stable_key,
        "sourceDocument": file_path.name,
        "sourceFamily": AICTE_SOURCE_FAMILY,
        "sourceUrl": AICTE_SOURCE_URL,
        "sourceDocumentType": doc_type,
        "documentDate": record["documentDate"],
        "lineNumber": line_number,
        "fields": fields,
    }


def _process_aicte_row(
    row_fields: Dict[str, str],
    run_timestamp: str,
    file_path: Path,
    doc_type: str,
    line_number: int,
    records: List[Dict[str, object]],
    provenance: List[Dict[str, object]],
    accreditation_records: Dict[str, Dict[str, object]],
    accreditation_provenance: List[Dict[str, object]],
    document_dates: set,
) -> None:
    program_result = build_aicte_program_record(
        row_fields,
        run_timestamp,
        file_path,
        doc_type,
        line_number,
    )
    if not program_result:
        return
    record, prov = program_result
    records.append(record)
    provenance.append(prov)
    doc_date = row_fields.get("documentDate")
    if doc_date:
        document_dates.add(doc_date)
    accreditation_result = build_aicte_accreditation_record(
        row_fields,
        run_timestamp,
        file_path,
        doc_type,
        line_number,
    )
    if accreditation_result:
        accr, accr_prov = accreditation_result
        if accr["stableKey"] not in accreditation_records:
            accreditation_records[accr["stableKey"]] = accr
            accreditation_provenance.append(accr_prov)

def parse_aicte_csv_file(file_path: Path, run_timestamp: str) -> Dict[str, object]:
    doc_type = f"{AICTE_DOCUMENT_TYPE} (CSV manual drop)"
    records: List[Dict[str, object]] = []
    provenance: List[Dict[str, object]] = []
    document_dates = set()
    accreditation_records: Dict[str, Dict[str, object]] = {}
    accreditation_provenance: List[Dict[str, object]] = []
    rows = 0
    errors: List[str] = []
    try:
        with file_path.open("r", encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            if not reader.fieldnames:
                errors.append("CSV header not detected.")
            else:
                for row in reader:
                    rows += 1
                    row_fields = _collect_aicte_row_fields(row)
                    _process_aicte_row(
                        row_fields,
                        run_timestamp,
                        file_path,
                        doc_type,
                        reader.line_num,
                        records,
                        provenance,
                        accreditation_records,
                        accreditation_provenance,
                        document_dates,
                    )
    except Exception as exc:
        errors.append(str(exc))
    return {
        "records": records,
        "provenance": provenance + accreditation_provenance,
        "documentDates": document_dates,
        "accreditations": list(accreditation_records.values()),
        "accreditationProvenance": accreditation_provenance,
        "errors": errors,
        "rows": rows,
        "fileType": "csv",
    }

def _stringify_excel_cell(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return str(value)
    return str(value).strip()

def _process_excel_rows(
    rows_iter,
    run_timestamp: str,
    file_path: Path,
    doc_type: str,
    records: List[Dict[str, object]],
    provenance: List[Dict[str, object]],
    accreditation_records: Dict[str, Dict[str, object]],
    accreditation_provenance: List[Dict[str, object]],
    document_dates: set,
) -> int:
    header: List[str] = []
    rows_processed = 0
    for idx, row in enumerate(rows_iter, start=1):
        cells = [_stringify_excel_cell(cell) for cell in row]
        if not header:
            if any(cells):
                header = [clean_value(cell) for cell in cells]
            continue
        if not any(cells):
            continue
        row_dict = {
            header[i] if i < len(header) and header[i] else f"column_{i}": cells[i]
            for i in range(len(cells))
        }
        rows_processed += 1
        _process_aicte_row(
            row_dict,
            run_timestamp,
            file_path,
            doc_type,
            idx,
            records,
            provenance,
            accreditation_records,
            accreditation_provenance,
            document_dates,
        )
    return rows_processed

def parse_aicte_excel_file(file_path: Path, run_timestamp: str) -> Dict[str, object]:
    doc_type = f"{AICTE_DOCUMENT_TYPE} (Excel manual drop)"
    records: List[Dict[str, object]] = []
    provenance: List[Dict[str, object]] = []
    document_dates = set()
    accreditation_records: Dict[str, Dict[str, object]] = {}
    accreditation_provenance: List[Dict[str, object]] = []
    rows = 0
    errors: List[str] = []
    suffix = file_path.suffix.lower()
    if suffix == ".xlsx":
        if openpyxl is None:
            errors.append("openpyxl is required to parse .xlsx files.")
        else:
            try:
                workbook = openpyxl.load_workbook(
                    file_path, read_only=True, data_only=True
                )
                sheet = workbook.active
                rows = _process_excel_rows(
                    sheet.iter_rows(values_only=True),
                    run_timestamp,
                    file_path,
                    doc_type,
                    records,
                    provenance,
                    accreditation_records,
                    accreditation_provenance,
                    document_dates,
                )
            except Exception as exc:
                errors.append(str(exc))
    elif suffix == ".xls":
        if xlrd is None:
            errors.append("xlrd is required to parse .xls files.")
        else:
            try:
                workbook = xlrd.open_workbook(str(file_path))
                sheet = workbook.sheet_by_index(0)
                header = []
                header_row = 0
                for row_idx in range(sheet.nrows):
                    entries = [_stringify_excel_cell(sheet.cell_value(row_idx, col)) for col in range(sheet.ncols)]
                    if not header and any(entries):
                        header = [clean_value(entry) for entry in entries]
                        header_row = row_idx
                        continue
                    if not header:
                        continue
                    if not any(entries):
                        continue
                    row_dict = {
                        header[i] if i < len(header) and header[i] else f"column_{i}": entries[i]
                        for i in range(len(entries))
                    }
                    rows += 1
                    _process_aicte_row(
                        row_dict,
                        run_timestamp,
                        file_path,
                        doc_type,
                        row_idx + 1,
                        records,
                        provenance,
                        accreditation_records,
                        accreditation_provenance,
                        document_dates,
                    )
            except Exception as exc:
                errors.append(str(exc))
    else:
        errors.append(f"Unsupported Excel suffix {suffix}.")
    return {
        "records": records,
        "provenance": provenance + accreditation_provenance,
        "documentDates": document_dates,
        "accreditations": list(accreditation_records.values()),
        "accreditationProvenance": accreditation_provenance,
        "errors": errors,
        "rows": rows,
        "fileType": suffix.lstrip("."),
    }

def parse_aicte_html_file(file_path: Path, run_timestamp: str) -> Dict[str, object]:
    doc_type = f"{AICTE_DOCUMENT_TYPE} (HTML manual drop)"
    records: List[Dict[str, object]] = []
    provenance: List[Dict[str, object]] = []
    document_dates = set()
    accreditation_records: Dict[str, Dict[str, object]] = {}
    accreditation_provenance: List[Dict[str, object]] = []
    rows = 0
    errors: List[str] = []
    if not BeautifulSoup:
        errors.append("BeautifulSoup (bs4) is required to parse HTML inputs.")
        return {
            "records": records,
            "provenance": provenance,
            "documentDates": document_dates,
            "accreditations": [],
            "accreditationProvenance": [],
            "errors": errors,
            "rows": rows,
            "fileType": "html",
        }
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        soup = BeautifulSoup(content, "html.parser")
        tables = soup.find_all("table")
        if not tables:
            errors.append("No HTML tables found.")
            return {
                "records": records,
                "provenance": provenance,
                "documentDates": document_dates,
                "accreditations": [],
                "accreditationProvenance": [],
                "errors": errors,
                "rows": rows,
                "fileType": "html",
            }
        for table in tables:
            header_cells = table.find("tr")
            if not header_cells:
                continue
            headers = [
                strip_html_tags(cell.get_text(" ", strip=True))
                for cell in header_cells.find_all(["th", "td"])
                if strip_html_tags(cell.get_text(" ", strip=True))
            ]
            if len(headers) < 2:
                continue
            for line_idx, tr in enumerate(table.find_all("tr")[1:], start=2):
                row_cells = [
                    strip_html_tags(cell.get_text(" ", strip=True))
                    for cell in tr.find_all(["td", "th"])
                ]
                if not any(row_cells):
                    continue
                row_dict = {
                    headers[i] if i < len(headers) else f"column_{i}": row_cells[i]
                    for i in range(len(row_cells))
                }
                rows += 1
                _process_aicte_row(
                    row_dict,
                    run_timestamp,
                    file_path,
                    doc_type,
                    line_idx,
                    records,
                    provenance,
                    accreditation_records,
                    accreditation_provenance,
                    document_dates,
                )
    except Exception as exc:
        errors.append(str(exc))
    return {
        "records": records,
        "provenance": provenance + accreditation_provenance,
        "documentDates": document_dates,
        "accreditations": list(accreditation_records.values()),
        "accreditationProvenance": accreditation_provenance,
        "errors": errors,
        "rows": rows,
        "fileType": "html",
    }

def _safe_json_value(row: List[object], idx: int) -> str:
    if idx < len(row):
        return clean_value(row[idx])
    return ""


def _collect_aicte_json_course_fields(
    row: List[object], institute_lookup: Dict[str, Dict[str, str]]
) -> Dict[str, str]:
    aicte_id = _safe_json_value(row, 0)
    institute_name = (
        institute_lookup.get(aicte_id, {}).get("name") or _safe_json_value(row, 1)
    )
    return {
        "aicteId": aicte_id,
        "institution": institute_name,
        "state": _safe_json_value(row, 2),
        "program": _safe_json_value(row, 3),
        "affiliation": _safe_json_value(row, 4),
        "level": _safe_json_value(row, 5),
        "degree": _safe_json_value(row, 6),
        "specialization": _safe_json_value(row, 7),
        "shift": _safe_json_value(row, 8),
        "mode": _safe_json_value(row, 9),
        "intakeApproved": _safe_json_value(row, 10),
        "enrollment": _safe_json_value(row, 11),
        "placement": _safe_json_value(row, 12),
    }


def parse_aicte_course_json(
    file_path: Path,
    run_timestamp: str,
    institute_lookup: Dict[str, Dict[str, str]],
) -> Dict[str, object]:
    doc_type = f"{AICTE_DOCUMENT_TYPE} (JSON manual drop - course response)"
    records: List[Dict[str, object]] = []
    provenance: List[Dict[str, object]] = []
    document_dates = set()
    accreditation_records: Dict[str, Dict[str, object]] = {}
    accreditation_provenance: List[Dict[str, object]] = []
    rows = 0
    errors: List[str] = []
    try:
        payload = json.loads(file_path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            errors.append("JSON top-level payload is not a list.")
        else:
            for idx, row in enumerate(payload, start=1):
                if not isinstance(row, list):
                    errors.append(f"Row {idx} is not a list.")
                    continue
                rows += 1
                row_fields = _collect_aicte_json_course_fields(row, institute_lookup)
                _process_aicte_row(
                    row_fields,
                    run_timestamp,
                    file_path,
                    doc_type,
                    idx,
                    records,
                    provenance,
                    accreditation_records,
                    accreditation_provenance,
                    document_dates,
                )
    except Exception as exc:
        errors.append(str(exc))
    return {
        "records": records,
        "provenance": provenance + accreditation_provenance,
        "documentDates": document_dates,
        "accreditations": list(accreditation_records.values()),
        "accreditationProvenance": accreditation_provenance,
        "errors": errors,
        "rows": rows,
        "fileType": "json-course",
    }


def parse_aicte_institute_list_json(
    file_path: Path, run_timestamp: str
) -> Dict[str, object]:
    rows = 0
    errors: List[str] = []
    lookup: Dict[str, Dict[str, str]] = {}
    try:
        payload = json.loads(file_path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            errors.append("JSON top-level payload is not a list.")
        else:
            for idx, row in enumerate(payload, start=1):
                if not isinstance(row, list):
                    errors.append(f"Row {idx} is not a list.")
                    continue
                rows += 1
                aicte_id = _safe_json_value(row, 0)
                if not aicte_id:
                    errors.append(f"Row {idx} missing AICTE ID.")
                    continue
                lookup[aicte_id] = {
                    "aicteId": aicte_id,
                    "name": _safe_json_value(row, 1),
                    "address": _safe_json_value(row, 2),
                    "district": _safe_json_value(row, 3),
                    "institutionType": _safe_json_value(row, 4),
                    "women": _safe_json_value(row, 5),
                    "minority": _safe_json_value(row, 6),
                    "externalId": _safe_json_value(row, 7),
                }
    except Exception as exc:
        errors.append(str(exc))
    return {
        "rows": rows,
        "errors": errors,
        "lookup": lookup,
        "fileType": "json-institutes",
    }



def _detect_aicte_json_type(file_path: Path) -> str:
    name = file_path.name.lower()
    if "course" in name:
        return "course"
    if "college" in name or "institute" in name:
        return "institutes"
    return "unknown"





def ingest_manual_aicte(run_timestamp: str) -> Dict[str, object]:
    manual_files = sorted(
        [
            p
            for p in PHASE2_MANUAL_DIR.iterdir()
            if p.is_file() and not p.name.lower().startswith("readme")
        ]
    )
    records_by_key: Dict[str, Dict[str, object]] = {}
    provenance_map: Dict[str, List[Dict[str, object]]] = {}
    document_dates = set()
    accreditation_records: Dict[str, Dict[str, object]] = {}
    accreditation_provenance: List[Dict[str, object]] = []
    stats: List[Dict[str, object]] = []
    files_used: List[str] = []
    manual_errors: List[str] = []
    institution_lookup: Dict[str, Dict[str, str]] = {}
    linkage_stats: List[Dict[str, object]] = []
    parser_map = {
        ".csv": parse_aicte_csv_file,
        ".xlsx": parse_aicte_excel_file,
        ".xls": parse_aicte_excel_file,
        ".html": parse_aicte_html_file,
        ".htm": parse_aicte_html_file,
    }
    for file_path in manual_files:
        suffix = file_path.suffix.lower()
        parsed: Optional[Dict[str, object]] = None
        if suffix == ".json":
            json_type = _detect_aicte_json_type(file_path)
            if json_type == "institutes":
                parsed = parse_aicte_institute_list_json(file_path, run_timestamp)
                linkage_stats.append(
                    {
                        "file": file_path.name,
                        "rows": parsed["rows"],
                        "errors": parsed["errors"],
                    }
                )
                institution_lookup.update(parsed["lookup"])
                if parsed["errors"]:
                    manual_errors.extend(
                        [f"{file_path.name}: {err}" for err in parsed["errors"]]
                    )
                continue
            if json_type == "course":
                parsed = parse_aicte_course_json(file_path, run_timestamp, institution_lookup)
            else:
                manual_errors.append(
                    f"Skipped {file_path.name}: unrecognized JSON structure."
                )
                continue
        else:
            parser = parser_map.get(suffix)
            if not parser:
                manual_errors.append(
                    f"Skipped {file_path.name}: unsupported extension."
                )
                continue
            parsed = parser(file_path, run_timestamp)
        if parsed is None:
            continue
        stats.append(
            {
                "file": file_path.name,
                "entries": len(parsed.get("records", [])),
                "rows": parsed.get("rows", 0),
                "documentDate": (
                    min(parsed.get("documentDates", []))
                    if parsed.get("documentDates")
                    else ""
                ),
                "type": parsed.get("fileType", "unknown"),
            }
        )
        if parsed.get("records"):
            document_dates.update(parsed.get("documentDates", set()))
            files_used.append(file_path.name)
            per_file_program_prov: Dict[str, List[Dict[str, object]]] = {}
            for prov in parsed.get("provenance", []):
                key = prov.get("stableKey", "")
                if key.startswith("aicte-program-"):
                    per_file_program_prov.setdefault(key, []).append(prov)
            for record in parsed["records"]:
                key = record["stableKey"]
                if key not in records_by_key:
                    records_by_key[key] = record
                    provenance_map[key] = per_file_program_prov.get(key, [])
            for accr, accr_prov in zip(
                parsed.get("accreditations", []),
                parsed.get("accreditationProvenance", []),
            ):
                if accr["stableKey"] not in accreditation_records:
                    accreditation_records[accr["stableKey"]] = accr
                    accreditation_provenance.append(accr_prov)
        if parsed.get("errors"):
            manual_errors.extend(
                [f"{file_path.name}: {err}" for err in parsed["errors"]]
            )
        elif not parsed.get("records") and suffix != ".json":
            manual_errors.append(f"{file_path.name}: no rows parsed.")
    program_records = list(records_by_key.values())
    program_provenance = [
        prov for prov_list in provenance_map.values() for prov in prov_list
    ]
    record_count = len(program_records)
    if record_count == 0:
        status = "blocked"
    elif record_count < AICTE_ACQUISITION_THRESHOLD:
        status = "partially_acquired"
    else:
        status = "acquired"
    return {
        "status": status,
        "records": program_records,
        "provenance": program_provenance,
        "documentDates": document_dates,
        "files": files_used,
        "manualErrors": manual_errors,
        "linkageStats": linkage_stats,
        "linkageFiles": [stat["file"] for stat in linkage_stats],
        "accreditations": list(accreditation_records.values()),
        "accreditationProvenance": accreditation_provenance,
        "stats": stats,
    }
def ingest_manual_nirf(run_timestamp: str) -> Dict[str, object]:
    parser_map = {
        ".csv": parse_nirf_csv_file,
        ".html": parse_nirf_html_file,
        ".htm": parse_nirf_html_file,
        ".pdf": parse_nirf_pdf_file,
    }
    manual_files = sorted(
        [
            p
            for p in MANUAL_NIRF_DIR.iterdir()
            if p.is_file() and not p.name.lower().startswith("readme")
        ]
    )
    records: List[Dict[str, object]] = []
    provenance: List[Dict[str, object]] = []
    document_dates = set()
    files_used: List[str] = []
    errors: List[str] = []
    for file_path in manual_files:
        parser = parser_map.get(file_path.suffix.lower())
        if not parser:
            errors.append(f"Skipped {file_path.name}: unsupported extension.")
            continue
        parsed = parser(file_path, run_timestamp)
        if parsed["records"]:
            records.extend(parsed["records"])
            provenance.extend(parsed["provenance"])
            document_dates.update(parsed["documentDates"])
            files_used.append(file_path.name)
        if parsed.get("error"):
            errors.append(f"{file_path.name}: {parsed['error']}")
        elif not parsed["records"]:
            errors.append(f"{file_path.name}: no rows parsed.")
    status = "acquired" if records else "blocked"
    return {
        "status": status,
        "records": records,
        "provenance": provenance,
        "files": files_used,
        "documentDates": list(document_dates),
        "error": "" if records else "Manual NIRF inputs are missing or could not be parsed.",
        "manualErrors": errors,
    }


def attempt_nirf_download() -> Dict[str, str]:
    RAW_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    output_file = RAW_DOWNLOAD_DIR / "nirf_overall_2024.html"
    try:
        with urllib.request.urlopen(NIRF_URL, timeout=10) as response:
            html = response.read()
        output_file.write_bytes(html)
        return {"status": "downloaded", "path": str(output_file), "error": ""}
    except urllib.error.URLError as exc:
        return {"status": "blocked", "path": str(output_file), "error": str(exc)}
    except Exception as exc:
        return {"status": "blocked", "path": str(output_file), "error": str(exc)}


def write_ndjson(file_path: Path, records: List[Dict[str, object]]) -> None:
    with file_path.open("w", encoding="utf-8") as fh:
        for entry in records:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def write_markdown(file_path: Path, lines: List[str]) -> None:
    with file_path.open("w", encoding="utf-8") as fh:
        fh.write("\n".join(lines).rstrip() + "\n")


def build_coverage_report(
    run_timestamp: str,
    stats: List[Dict[str, object]],
    total_records: int,
    ranking_result: Dict[str, object],
    aicte_result: Dict[str, object],
) -> None:
    lines = [
        "# Phase 1 Foundation Data Coverage",
        f"Generated: {run_timestamp}",
        "",
        "## Institution Master (AISHE)",
        f"- Total unique institutions normalized: {total_records}",
    ]
    for stat in stats:
        lines.append(
            f"- {stat['label']} ({stat['file']}): {stat['entries']} records, {stat['duplicates']} duplicates ignored"
        )
    lines.append("")
    lines.append("## Rankings")
    if ranking_result["status"] == "acquired":
        files = ", ".join(ranking_result.get("files", [])) or "manual input"
        lines.append(
            f"- Rankings normalized from manual official file(s): {files}. Total records: {len(ranking_result['records'])}."
        )
    else:
        lines.append("- Rankings blocked: no manual official NIRF input found.")
        for err in ranking_result.get("manualErrors", []):
            lines.append(f"  - {err}")
        remote_attempt = ranking_result.get("remoteAttempt")
        if remote_attempt:
            lines.append(
                f"- Remote fetch attempt status: {remote_attempt['status']} (error: {remote_attempt.get('error','none')}); raw HTML stored at `{remote_attempt['path']}`."
            )
    lines.append("")
    lines.append("## Programs & Intake (AICTE)")
    status = aicte_result["status"]
    if status in {"acquired", "partially_acquired"}:
        files = ", ".join(aicte_result.get("files", [])) or "manual input"
        lines.append(
            f"- Programs normalized from manual official file(s): {files}. Total records: {len(aicte_result['records'])}."
        )
        acc_count = len(aicte_result.get("accreditations", []))
        if acc_count:
            lines.append(
                f"- Accreditations normalized from the same export: {acc_count} records."
            )
        lines.append(f"- AICTE acquisition status: {status}.")
        if status == "partially_acquired":
            lines.append(
                "- Coverage is limited; additional course-response JSON exports are needed."
            )
        for stat in aicte_result.get("stats", []):
            file_type = stat.get("type", "unknown").upper()
            lines.append(
                f"  - {stat['file']} ({file_type}): {stat['entries']} program entries processed from {stat['rows']} rows."
            )
    else:
        lines.append("- Programs & intake blocked: no manual official AICTE input found.")
        for err in aicte_result.get("manualErrors", []):
            lines.append(f"  - {err}")
    if aicte_result.get("linkageStats"):
        linkage_files = ", ".join(
            stat["file"] for stat in aicte_result["linkageStats"] if stat.get("file")
        ) or "manual official file(s)"
        linkage_rows = sum(stat.get("rows", 0) for stat in aicte_result["linkageStats"])
        lines.append(
            f"- AICTE institute linkage data parsed from manual official file(s): {linkage_files}. Total rows: {linkage_rows}."
        )

    coverage_path = REPORTS_DIR / "coverage_report.md"
    write_markdown(coverage_path, lines)



def build_qa_report(
    run_timestamp: str,
    stats: List[Dict[str, object]],
    ranking_result: Dict[str, object],
    aicte_result: Dict[str, object],
) -> None:
    lines = [
        "# Phase 1 Foundation Data QA",
        f"Generated: {run_timestamp}",
        "",
        "## Completed Sections",
        f"- Institution master (AISHE) records from official exports ({len(stats)} source files, total {sum(stat['entries'] for stat in stats)} institutions).",
    ]
    if ranking_result["status"] == "acquired":
        files = ", ".join(ranking_result.get("files", [])) or "manual input"
        lines.append(
            f"- Rankings (NIRF 2024 overall) normalized from {files} and ready for downstream processing."
        )
    if aicte_result["status"] in {"acquired", "partially_acquired"}:
        files = ", ".join(aicte_result.get("files", [])) or "manual input"
        lines.append(
            f"- Programs & intake (AICTE) normalized from {files} and ready for downstream processing."
        )
        acc_count = len(aicte_result.get("accreditations", []))
        if acc_count:
            lines.append(
                f"- Accreditations (AICTE) normalized from the same export ({acc_count} records) and ready for downstream processing."
            )
        if aicte_result["status"] == "partially_acquired":
            lines.append(
                "- AICTE acquisition is partial; additional course-response JSON exports are still required."
            )
    if aicte_result.get("linkageStats"):
        linkage_files = ", ".join(
            stat["file"] for stat in aicte_result["linkageStats"] if stat.get("file")
        ) or "manual official file(s)"
        linkage_rows = sum(stat.get("rows", 0) for stat in aicte_result["linkageStats"])
        lines.append(
            f"- AICTE institute linkage data parsed from {linkage_files} ({linkage_rows} rows)."
        )

    lines.append("")
    lines.append("## Blocked Sections")
    blocked_lines: List[str] = []
    if ranking_result["status"] == "blocked":
        blocked_lines.append(
            "- NIRF 2024 overall ranking ingestion blocked: drop an official HTML/CSV/PDF into `phase1_foundation/manual_inputs/nirf/`."
        )
        for err in ranking_result.get("manualErrors", []):
            blocked_lines.append(f"  - {err}")
        remote_attempt = ranking_result.get("remoteAttempt")
        if remote_attempt:
            blocked_lines.append(
                f"- Remote fetch attempt status: {remote_attempt['status']} (error: {remote_attempt.get('error','none')})."
            )
    if aicte_result["status"] == "blocked":
        blocked_lines.append(
            "- Programs & intake (AICTE) blocked: drop an official CSV, Excel, or HTML export into `phase2a/manual_inputs/aicte/`."
        )
        for err in aicte_result.get("manualErrors", []):
            blocked_lines.append(f"  - {err}")
        blocked_lines.append("- Accreditations (AICTE) blocked until the manual AICTE export is supplied.")
    if blocked_lines:
        lines.extend(blocked_lines)
    else:
        lines.append("- None.")
    lines.append("")
    lines.append("## Empty Sections")
    empty_lines: List[str] = []
    if ranking_result["status"] == "blocked":
        empty_lines.append(
            "- Rankings (NIRF 2024 overall) remains empty until an official file is supplied."
        )
    if aicte_result["status"] == "blocked":
        empty_lines.append(
            "- Programs & intake (AICTE) remains empty until the official file is supplied."
        )
        empty_lines.append(
            "- Accreditations (AICTE) remains empty until the manual AICTE file is available."
        )
    if empty_lines:
        lines.extend(empty_lines)
    else:
        lines.append("- None.")
    qa_path = REPORTS_DIR / "qa_report.md"
    write_markdown(qa_path, lines)



def build_source_registry(
    run_timestamp: str,
    stats: List[Dict[str, object]],
    ranking_result: Dict[str, object],
    aicte_result: Dict[str, object],
) -> None:
    source_records: List[Dict[str, object]] = []
    document_dates = [stat["documentDate"] for stat in stats if stat["documentDate"]]
    earliest_doc = min(document_dates) if document_dates else ""
    source_records.append(
        {
            "id": "aishe-institution-master-2021-22",
            "sourceFamily": SOURCE_FAMILY,
            "sourceAuthority": AISHE_AUTHORITY,
            "sourceUrl": AISHE_SOURCE_URL,
            "sourceDocumentType": "AISHE master list (colleges, standalone, universities)",
            "documentDate": earliest_doc,
            "fetchedAt": run_timestamp,
            "status": "acquired",
            "scope": "Institution master data for Phase 1",
            "notes": "Downloaded from AISHE; raw CSV copies live in backend/data.",
            "rawFiles": [stat["file"] for stat in stats],
        }
    )
    ranking_doc_dates = [d for d in ranking_result.get("documentDates", []) if d]
    ranking_doc_date = min(ranking_doc_dates) if ranking_doc_dates else ""
    ranking_entry: Dict[str, object] = {
        "id": "nirf-ranking-2024-overall",
        "sourceFamily": NIRF_SOURCE_FAMILY,
        "sourceAuthority": NIRF_SOURCE_AUTHORITY,
        "sourceUrl": NIRF_URL,
        "sourceDocumentType": "NIRF 2024 overall ranking (manual drop)",
        "documentDate": ranking_doc_date,
        "fetchedAt": run_timestamp,
        "status": ranking_result["status"],
        "scope": "NIRF 2024 overall ranking",
        "rawFiles": ranking_result.get("files", []),
    }
    if ranking_result["status"] == "acquired":
        ranking_entry["notes"] = "Normalized from manual official file(s)."
    else:
        notes = ranking_result.get("error", "Manual input pending.")
        notes += " Manual input directory: phase1_foundation/manual_inputs/nirf/."
        ranking_entry["notes"] = notes
    remote_attempt = ranking_result.get("remoteAttempt")
    if remote_attempt:
        ranking_entry["notes"] += (
            f" Remote attempt status: {remote_attempt['status']} (error: {remote_attempt.get('error','none')})."
        )
    source_records.append(ranking_entry)
    aicte_doc_dates = [d for d in aicte_result.get("documentDates", []) if d]
    aicte_doc_date = min(aicte_doc_dates) if aicte_doc_dates else ""
    linkage_files = aicte_result.get("linkageFiles", []) or []
    raw_files = aicte_result.get("files", []) + linkage_files
    aicte_entry: Dict[str, object] = {
        "id": "aicte-programs",
        "sourceFamily": AICTE_SOURCE_FAMILY,
        "sourceAuthority": AICTE_SOURCE_AUTHORITY,
        "sourceUrl": AICTE_SOURCE_URL,
        "sourceDocumentType": AICTE_DOCUMENT_TYPE,
        "documentDate": aicte_doc_date,
        "fetchedAt": run_timestamp,
        "status": aicte_result["status"],
        "scope": "AICTE approved programs and intake",
        "rawFiles": raw_files,
    }
    if aicte_result["status"] == "acquired":
        notes = "Normalized from manual official AICTE export."
        if aicte_result.get("accreditations"):
            notes += f" Includes {len(aicte_result['accreditations'])} accreditation records."
        if linkage_files:
            notes += f" Includes institute linkage data from {', '.join(linkage_files)}."
        aicte_entry["notes"] = notes
    elif aicte_result["status"] == "partially_acquired":
        notes = "Partially acquired from manual official AICTE exports."
        if aicte_result.get("accreditations"):
            notes += f" Includes {len(aicte_result['accreditations'])} accreditation records."
        if linkage_files:
            notes += f" Includes institute linkage data from {', '.join(linkage_files)}."
        notes += " Coverage remains limited."
        aicte_entry["notes"] = notes
    else:
        notes = aicte_result.get("manualErrors", [])
        note_text = "Manual AICTE input pending."
        if notes:
            note_text += " Issues: " + "; ".join(notes)
        if linkage_files:
            note_text += f" Institute linkage data parsed from {', '.join(linkage_files)}."
        note_text += " Manual input directory: phase2a/manual_inputs/aicte/."
        aicte_entry["notes"] = note_text
    source_records.append(aicte_entry)
    write_ndjson(NORMALIZED_DIR / "source_registry.ndjson", source_records)


def main() -> None:
    ensure_dirs()
    run_timestamp = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    seen_keys = set()
    all_records: List[Dict[str, object]] = []
    all_provenance: List[Dict[str, object]] = []
    stats_list: List[Dict[str, object]] = []

    for source in AISHE_SOURCES:
        result = parse_aishe_file(source, run_timestamp, seen_keys)
        all_records.extend(result["records"])
        all_provenance.extend(result["provenance"])
        stats_list.append(result["stats"])

    ranking_result = ingest_manual_nirf(run_timestamp)
    if ranking_result["status"] == "blocked":
        ranking_result["remoteAttempt"] = attempt_nirf_download()
    else:
        ranking_result["remoteAttempt"] = None
    all_provenance.extend(ranking_result["provenance"])

    aicte_result = ingest_manual_aicte(run_timestamp)

    write_ndjson(NORMALIZED_DIR / "institutions.ndjson", all_records)
    write_ndjson(EVIDENCE_DIR / "field_provenance.ndjson", all_provenance)

    write_ndjson(NORMALIZED_DIR / "programs.ndjson", aicte_result["records"])
    write_ndjson(NORMALIZED_DIR / "accreditations.ndjson", aicte_result["accreditations"])
    write_ndjson(EVIDENCE_DIR / "program_provenance.ndjson", aicte_result["provenance"])

    rankings_path = NORMALIZED_DIR / "rankings.ndjson"
    if ranking_result["records"]:
        write_ndjson(rankings_path, ranking_result["records"])
    else:
        rankings_path.write_text("", encoding="utf-8")

    build_source_registry(run_timestamp, stats_list, ranking_result, aicte_result)
    build_coverage_report(run_timestamp, stats_list, len(all_records), ranking_result, aicte_result)
    build_qa_report(run_timestamp, stats_list, ranking_result, aicte_result)

    ranking_status = "populated" if ranking_result["records"] else "blocked"
    aicte_status = "populated" if aicte_result["records"] else "blocked"
    print(
        f"Phase 1 pipeline complete: {len(all_records)} AISHE institutions normalized and parsed, ranking status = {ranking_status}, AICTE programs status = {aicte_status}."
    )


if __name__ == "__main__":
    main()
