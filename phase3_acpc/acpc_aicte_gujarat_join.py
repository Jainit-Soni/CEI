from __future__ import annotations

import argparse
import json
import logging
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_AICTE_INPUT = PROJECT_ROOT / "normalized" / "programs_gujarat.ndjson"
DEFAULT_ACPC_SEAT_INPUT = PROJECT_ROOT / "normalized" / "acpc_seat_matrix.ndjson"
DEFAULT_ACPC_CUTOFF_INPUT = PROJECT_ROOT / "normalized" / "acpc_cutoffs.ndjson"
DEFAULT_ALIAS_FILE = PROJECT_ROOT / "phase3_acpc" / "gujarat_institution_aliases.json"

DEFAULT_JOINED_OUTPUT = PROJECT_ROOT / "normalized" / "gujarat_institute_program_truth.ndjson"
DEFAULT_UNMATCHED_AICTE_OUTPUT = PROJECT_ROOT / "normalized" / "unmatched_aicte_gujarat_programs.ndjson"
DEFAULT_UNMATCHED_ACPC_OUTPUT = PROJECT_ROOT / "normalized" / "unmatched_acpc_gujarat_rows.ndjson"
DEFAULT_SUMMARY_OUTPUT = PROJECT_ROOT / "reports" / "gujarat_join_quality_summary.md"
DEFAULT_LOG_FILE = PROJECT_ROOT / "phase3_acpc" / "acpc_aicte_gujarat_join.log"

STATE = "Gujarat"
COURSE_FAMILY = "BE/BTECH"
SESSION = "2025-26"
ROUND = "Round 3"

AICTE_JOIN_PROGRAM = "ENGINEERING AND TECHNOLOGY"
AICTE_JOIN_LEVEL = "UNDER GRADUATE"


@dataclass
class InstitutionCandidate:
    aicte_institution_name: str
    score: float
    name_score: float
    overlap_count: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Join Gujarat AICTE programs with ACPC Round 3 seat matrix and cutoffs")
    parser.add_argument("--aicte-input", type=Path, default=DEFAULT_AICTE_INPUT, help="AICTE Gujarat programs NDJSON")
    parser.add_argument("--acpc-seat-input", type=Path, default=DEFAULT_ACPC_SEAT_INPUT, help="ACPC seat-matrix NDJSON")
    parser.add_argument("--acpc-cutoff-input", type=Path, default=DEFAULT_ACPC_CUTOFF_INPUT, help="ACPC cutoff NDJSON")
    parser.add_argument("--alias-file", type=Path, default=DEFAULT_ALIAS_FILE, help="Institution alias mapping JSON")
    parser.add_argument("--joined-output", type=Path, default=DEFAULT_JOINED_OUTPUT, help="Joined truth NDJSON")
    parser.add_argument(
        "--unmatched-aicte-output",
        type=Path,
        default=DEFAULT_UNMATCHED_AICTE_OUTPUT,
        help="Unmatched AICTE NDJSON",
    )
    parser.add_argument(
        "--unmatched-acpc-output",
        type=Path,
        default=DEFAULT_UNMATCHED_ACPC_OUTPUT,
        help="Unmatched ACPC NDJSON",
    )
    parser.add_argument("--summary-output", type=Path, default=DEFAULT_SUMMARY_OUTPUT, help="Markdown join summary")
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


def read_ndjson(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise SystemExit(f"Missing input file: {path}")
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        rows.append(json.loads(line))
    return rows


def load_alias_rules(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}

    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise SystemExit(f"Alias file must contain a JSON list: {path}")

    rules: dict[str, dict[str, Any]] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        acpc_name = normalize_text(item.get("acpcInstitutionName", ""))
        if not acpc_name:
            continue
        rules[acpc_name] = item
    return rules


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


def count_existing_rows(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.strip())


def count_existing_ambiguous_rows(path: Path) -> int:
    if not path.exists():
        return 0
    count = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("joinStatus") == "ambiguous":
            count += 1
    return count


def load_previous_metrics_from_summary(path: Path) -> dict[str, int] | None:
    if not path.exists():
        return None

    text = path.read_text(encoding="utf-8")
    patterns = {
        "matchedRows": r"Matched rows:\s+(\d+)\s+->\s+\d+",
        "ambiguousAcpcRows": r"Ambiguous ACPC rows:\s+(\d+)\s+->\s+\d+",
        "unmatchedAcpcRows": r"Unmatched ACPC rows:\s+(\d+)\s+->\s+\d+",
        "unmatchedAicteRows": r"Unmatched AICTE rows:\s+(\d+)\s+->\s+\d+",
    }
    metrics: dict[str, int] = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text)
        if not match:
            return None
        metrics[key] = int(match.group(1))
    return metrics


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    return text


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", normalize_text(value).lower())
    cleaned = cleaned.strip("-")
    return cleaned or "unknown"


def parse_int(value: Any) -> int:
    cleaned = normalize_text("" if value is None else str(value))
    if not cleaned:
        return 0
    return int(float(cleaned))


def normalize_institution_name(value: str) -> str:
    text = normalize_text(value).upper()
    text = text.replace("&", " AND ")
    replacements = {
        "ENGG.": " ENGINEERING ",
        "ENGG": " ENGINEERING ",
        "TECH.": " TECHNOLOGY ",
        "TECH,": " TECHNOLOGY ",
        "TECH ": " TECHNOLOGY ",
        "INST.": " INSTITUTE ",
        "INST ": " INSTITUTE ",
        "UNIV.": " UNIVERSITY ",
        "UNIV ": " UNIVERSITY ",
        "COLL.": " COLLEGE ",
        "COLL ": " COLLEGE ",
        "GOVT": " GOVERNMENT ",
    }
    for needle, replacement in replacements.items():
        text = text.replace(needle, replacement)
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_program_name(value: str, *, keep_tfws: bool) -> str:
    text = normalize_text(value).upper()
    text = text.replace("&", " AND ")
    text = text.replace("ENGGINEERING", "ENGINEERING")
    text = text.replace("ENGG.", "ENGINEERING")
    text = re.sub(r"\bENGG\b", "ENGINEERING", text)
    text = text.replace("COMMUNICATIONS", "COMMUNICATION")
    text = text.replace("AERO SPACE", "AEROSPACE")
    text = text.replace("ARTIFICIAL INTELLIGENCE(AI)", "ARTIFICIAL INTELLIGENCE")
    text = re.sub(r"\bAI\b", " ", text)
    text = re.sub(r"\bMECHATRONICS ENGINEERING\b", "MECHATRONICS", text)
    text = re.sub(r"\bINSTRUMENTATION AND CONTROL\b", "INSTRUMENTATION AND CONTROL ENGINEERING", text)
    if keep_tfws:
        text = re.sub(r"\bTFW\b", "TFWS", text)
    else:
        text = re.sub(r"\bTFWS\b|\bTFW\b", " ", text)
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def is_tfws_variant(program_name: str) -> bool:
    upper = normalize_text(program_name).upper()
    return "TFWS" in upper or re.search(r"\bTFW\b", upper) is not None


def build_candidate_score(name_score: float, overlap_count: int) -> float:
    overlap_component = min(overlap_count, 6) / 6
    return round((name_score * 0.75) + (overlap_component * 0.25), 4)


def classify_institution_candidate(
    *,
    best: InstitutionCandidate,
    second_best: InstitutionCandidate | None,
) -> tuple[str | None, str]:
    margin = best.score - (second_best.score if second_best else 0.0)

    if best.name_score >= 0.96 and best.overlap_count >= 1 and margin >= 0.02:
        return "high", "auto_exact_or_near_exact"

    if best.score >= 0.80 and best.name_score >= 0.84 and best.overlap_count >= 2 and margin >= 0.05:
        return "medium", "auto_fuzzy_with_program_overlap"

    if best.name_score >= 0.75 or best.overlap_count >= 1:
        return None, "institution_ambiguous"

    return None, "institution_not_found_in_aicte_scope"


def aggregate_aicte_scope(rows: list[dict[str, Any]]) -> tuple[dict[tuple[str, str], dict[str, Any]], dict[str, set[str]]]:
    aggregates: dict[tuple[str, str], dict[str, Any]] = {}
    programs_by_institution: dict[str, set[str]] = defaultdict(set)

    for row in rows:
        if normalize_text(row.get("institutionState", "")).upper() != STATE.upper():
            continue
        if normalize_text(row.get("level", "")).upper() != AICTE_JOIN_LEVEL:
            continue
        if normalize_text(row.get("programName", "")).upper() != AICTE_JOIN_PROGRAM:
            continue

        institution_name = normalize_text(row.get("institutionName", ""))
        program_base = normalize_program_name(row.get("degree", ""), keep_tfws=False)
        if not institution_name or not program_base:
            continue

        key = (institution_name, program_base)
        aggregate = aggregates.get(key)
        if aggregate is None:
            aggregate = {
                "stableKey": f"gujarat-aicte-agg-{slugify(institution_name)}-{slugify(program_base)}",
                "entityType": "aicteProgramAggregate",
                "state": STATE,
                "courseFamily": COURSE_FAMILY,
                "aicteJoinScope": {
                    "programName": AICTE_JOIN_PROGRAM,
                    "level": AICTE_JOIN_LEVEL,
                    "academicYear": normalize_text(row.get("academicYear", "")),
                },
                "institutionName": institution_name,
                "institutionAicteId": normalize_text(row.get("institutionAicteId", "")),
                "programNameBase": program_base,
                "aicteProgramNames": sorted({normalize_text(row.get("degree", ""))}),
                "aicteApprovedIntake": 0,
                "aicteStableKeys": [],
                "aicteEvidencePointers": [],
            }
            aggregates[key] = aggregate

        aggregate["aicteApprovedIntake"] += parse_int(row.get("intakeApproved", 0))
        if row.get("stableKey") and row["stableKey"] not in aggregate["aicteStableKeys"]:
            aggregate["aicteStableKeys"].append(row["stableKey"])
        if row.get("evidencePointer") and row["evidencePointer"] not in aggregate["aicteEvidencePointers"]:
            aggregate["aicteEvidencePointers"].append(row["evidencePointer"])
        raw_degree = normalize_text(row.get("degree", ""))
        if raw_degree and raw_degree not in aggregate["aicteProgramNames"]:
            aggregate["aicteProgramNames"].append(raw_degree)

        programs_by_institution[institution_name].add(program_base)

    for aggregate in aggregates.values():
        aggregate["aicteProgramNames"] = sorted(aggregate["aicteProgramNames"])
        aggregate["aicteStableKeys"] = sorted(aggregate["aicteStableKeys"])
        aggregate["aicteEvidencePointers"] = sorted(aggregate["aicteEvidencePointers"])

    return aggregates, programs_by_institution


def build_institution_match_map(
    *,
    acpc_seat_rows: list[dict[str, Any]],
    aicte_programs_by_institution: dict[str, set[str]],
    alias_rules: dict[str, dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], Counter]:
    acpc_programs_by_institution: dict[str, set[str]] = defaultdict(set)
    for row in acpc_seat_rows:
        institution_name = normalize_text(row.get("institutionName", ""))
        program_base = normalize_program_name(row.get("programName", ""), keep_tfws=False)
        if institution_name and program_base:
            acpc_programs_by_institution[institution_name].add(program_base)

    matches: dict[str, dict[str, Any]] = {}
    stats = Counter()

    for acpc_institution_name, acpc_programs in sorted(acpc_programs_by_institution.items()):
        alias_rule = alias_rules.get(acpc_institution_name)
        if alias_rule is not None:
            resolution = normalize_text(alias_rule.get("resolution", ""))
            rule_id = normalize_text(alias_rule.get("ruleId", ""))
            if resolution == "map_to_aicte":
                confidence = normalize_text(alias_rule.get("confidence", "manual")).lower() or "manual"
                matches[acpc_institution_name] = {
                    "matchStatus": "matched",
                    "matchConfidence": confidence,
                    "matchMethod": "alias_file_map_to_aicte",
                    "aicteInstitutionName": normalize_text(alias_rule.get("aicteInstitutionName", "")),
                    "candidateInstitutions": [],
                    "aliasRuleId": rule_id,
                }
                stats[confidence] += 1
                continue

            if resolution == "ambiguity_bucket":
                bucket_id = normalize_text(alias_rule.get("bucketId", ""))
                matches[acpc_institution_name] = {
                    "matchStatus": "unmatched",
                    "unmatchedReason": "institution_alias_bucket",
                    "candidateInstitutions": [],
                    "ambiguityBucket": bucket_id,
                    "aliasRuleId": rule_id,
                }
                stats[f"bucket:{bucket_id}"] += 1
                continue

        best: InstitutionCandidate | None = None
        second_best: InstitutionCandidate | None = None
        for aicte_institution_name, aicte_programs in aicte_programs_by_institution.items():
            name_score = SequenceMatcher(
                None,
                normalize_institution_name(acpc_institution_name),
                normalize_institution_name(aicte_institution_name),
            ).ratio()
            overlap_count = len(acpc_programs & aicte_programs)
            candidate = InstitutionCandidate(
                aicte_institution_name=aicte_institution_name,
                score=build_candidate_score(name_score, overlap_count),
                name_score=round(name_score, 4),
                overlap_count=overlap_count,
            )
            if best is None or candidate.score > best.score:
                second_best = best
                best = candidate
            elif second_best is None or candidate.score > second_best.score:
                second_best = candidate

        if best is None:
            matches[acpc_institution_name] = {
                "matchStatus": "unmatched",
                "unmatchedReason": "institution_not_found_in_aicte_scope",
                "candidateInstitutions": [],
                "ambiguityBucket": "",
                "aliasRuleId": "",
            }
            stats["institution_not_found_in_aicte_scope"] += 1
            continue

        confidence, method = classify_institution_candidate(best=best, second_best=second_best)
        candidate_payload = [
            {
                "aicteInstitutionName": best.aicte_institution_name,
                "score": best.score,
                "nameScore": best.name_score,
                "programOverlapCount": best.overlap_count,
            }
        ]
        if second_best is not None:
            candidate_payload.append(
                {
                    "aicteInstitutionName": second_best.aicte_institution_name,
                    "score": second_best.score,
                    "nameScore": second_best.name_score,
                    "programOverlapCount": second_best.overlap_count,
                }
            )

        if confidence is None:
            matches[acpc_institution_name] = {
                "matchStatus": "unmatched",
                "unmatchedReason": method,
                "candidateInstitutions": candidate_payload,
                "ambiguityBucket": "",
                "aliasRuleId": "",
            }
            stats[method] += 1
            continue

        matches[acpc_institution_name] = {
            "matchStatus": "matched",
            "matchConfidence": confidence,
            "matchMethod": method,
            "aicteInstitutionName": best.aicte_institution_name,
            "candidateInstitutions": candidate_payload,
            "aliasRuleId": "",
        }
        stats[confidence] += 1

    return matches, stats


def group_cutoffs(rows: list[dict[str, Any]]) -> dict[tuple[str, str], list[dict[str, Any]]]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        key = (
            normalize_text(row.get("institutionName", "")),
            normalize_program_name(row.get("programName", ""), keep_tfws=True),
        )
        grouped[key].append(row)

    for values in grouped.values():
        values.sort(key=lambda item: (normalize_text(item.get("board", "")), normalize_text(item.get("category", ""))))
    return grouped


def build_join_outputs(
    *,
    aicte_aggregates: dict[tuple[str, str], dict[str, Any]],
    institution_matches: dict[str, dict[str, Any]],
    acpc_seat_rows: list[dict[str, Any]],
    acpc_cutoff_groups: dict[tuple[str, str], list[dict[str, Any]]],
    extracted_at: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    joined_rows: list[dict[str, Any]] = []
    unmatched_acpc_rows: list[dict[str, Any]] = []
    matched_aicte_keys: set[tuple[str, str]] = set()
    matched_cutoff_keys: set[tuple[str, str]] = set()
    stats = {
        "matchedRows": 0,
        "unmatchedAcpcRows": 0,
        "ambiguousAcpcRows": 0,
        "confidenceBuckets": Counter(),
        "unmatchedAcpcReasons": Counter(),
        "ambiguityBuckets": Counter(),
    }

    for seat_row in acpc_seat_rows:
        acpc_institution_name = normalize_text(seat_row.get("institutionName", ""))
        acpc_program_name = normalize_text(seat_row.get("programName", ""))
        program_base = normalize_program_name(acpc_program_name, keep_tfws=False)
        program_variant = normalize_program_name(acpc_program_name, keep_tfws=True)
        tfws_variant = is_tfws_variant(acpc_program_name)

        institution_match = institution_matches.get(acpc_institution_name)
        cutoff_key = (acpc_institution_name, program_variant)
        cutoff_rows = acpc_cutoff_groups.get(cutoff_key, [])
        if cutoff_rows:
            matched_cutoff_keys.add(cutoff_key)

        if institution_match is None or institution_match.get("matchStatus") != "matched":
            reason = "institution_not_found_in_aicte_scope"
            candidates: list[dict[str, Any]] = []
            ambiguity_bucket = ""
            alias_rule_id = ""
            if institution_match is not None:
                reason = institution_match.get("unmatchedReason", reason)
                candidates = institution_match.get("candidateInstitutions", [])
                ambiguity_bucket = institution_match.get("ambiguityBucket", "")
                alias_rule_id = institution_match.get("aliasRuleId", "")

            unmatched_row = {
                "stableKey": f"gujarat-acpc-unmatched-{slugify(acpc_institution_name)}-{slugify(acpc_program_name)}",
                "entityType": "unmatchedAcpcProgram",
                "sourceEntityType": "counsellingSeatMatrix",
                "state": STATE,
                "courseFamily": COURSE_FAMILY,
                "session": SESSION,
                "round": ROUND,
                "joinStatus": "ambiguous" if ("ambiguous" in reason or reason == "institution_alias_bucket") else "unmatched",
                "unmatchedReason": reason,
                "institutionName": acpc_institution_name,
                "programName": acpc_program_name,
                "programNameBase": program_base,
                "tfwsVariant": tfws_variant,
                "acpcInstituteType": seat_row.get("instituteType"),
                "acpcInstituteTypeRaw": seat_row.get("instituteTypeRaw"),
                "acpcCounsellingIntake": seat_row.get("acpcIntake"),
                "acpcAllottedCount": seat_row.get("allottedCount"),
                "acpcVacantCount": seat_row.get("vacantCount"),
                "acpcSeatStableKey": seat_row.get("stableKey"),
                "acpcSeatEvidencePointer": seat_row.get("evidencePointer"),
                "acpcCutoffCount": len(cutoff_rows),
                "acpcCutoffStableKeys": [row.get("stableKey") for row in cutoff_rows],
                "acpcCutoffEvidencePointers": [row.get("evidencePointer") for row in cutoff_rows],
                "candidateAicteInstitutions": candidates,
                "ambiguityBucket": ambiguity_bucket,
                "institutionAliasRuleId": alias_rule_id,
                "extractedAt": extracted_at,
            }
            unmatched_acpc_rows.append(unmatched_row)
            stats["unmatchedAcpcRows"] += 1
            if "ambiguous" in reason or reason == "institution_alias_bucket":
                stats["ambiguousAcpcRows"] += 1
            if ambiguity_bucket:
                stats["ambiguityBuckets"][ambiguity_bucket] += 1
            stats["unmatchedAcpcReasons"][reason] += 1
            continue

        aicte_institution_name = institution_match["aicteInstitutionName"]
        aicte_key = (aicte_institution_name, program_base)
        aicte_aggregate = aicte_aggregates.get(aicte_key)
        if aicte_aggregate is None:
            reason = "program_base_not_found_in_matched_institution"
            unmatched_row = {
                "stableKey": f"gujarat-acpc-unmatched-{slugify(acpc_institution_name)}-{slugify(acpc_program_name)}",
                "entityType": "unmatchedAcpcProgram",
                "sourceEntityType": "counsellingSeatMatrix",
                "state": STATE,
                "courseFamily": COURSE_FAMILY,
                "session": SESSION,
                "round": ROUND,
                "joinStatus": "unmatched",
                "unmatchedReason": reason,
                "institutionName": acpc_institution_name,
                "programName": acpc_program_name,
                "programNameBase": program_base,
                "tfwsVariant": tfws_variant,
                "acpcInstituteType": seat_row.get("instituteType"),
                "acpcInstituteTypeRaw": seat_row.get("instituteTypeRaw"),
                "acpcCounsellingIntake": seat_row.get("acpcIntake"),
                "acpcAllottedCount": seat_row.get("allottedCount"),
                "acpcVacantCount": seat_row.get("vacantCount"),
                "acpcSeatStableKey": seat_row.get("stableKey"),
                "acpcSeatEvidencePointer": seat_row.get("evidencePointer"),
                "aicteInstitutionNameCandidate": aicte_institution_name,
                "institutionAliasRuleId": institution_match.get("aliasRuleId", ""),
                "acpcCutoffCount": len(cutoff_rows),
                "acpcCutoffStableKeys": [row.get("stableKey") for row in cutoff_rows],
                "acpcCutoffEvidencePointers": [row.get("evidencePointer") for row in cutoff_rows],
                "extractedAt": extracted_at,
            }
            unmatched_acpc_rows.append(unmatched_row)
            stats["unmatchedAcpcRows"] += 1
            stats["unmatchedAcpcReasons"][reason] += 1
            continue

        matched_aicte_keys.add(aicte_key)

        match_confidence = institution_match["matchConfidence"]
        if tfws_variant and match_confidence != "manual":
            match_confidence = "medium"

        program_match_type = "tfws_variant_to_base_program" if tfws_variant else "direct_base_program_match"
        stable_key = f"gujarat-truth-{slugify(acpc_institution_name)}-{slugify(acpc_program_name)}"
        joined_rows.append(
            {
                "stableKey": stable_key,
                "entityType": "joinedInstitutionProgramTruth",
                "state": STATE,
                "courseFamily": COURSE_FAMILY,
                "session": SESSION,
                "round": ROUND,
                "joinStatus": "matched",
                "matchConfidence": match_confidence,
                "institutionMatchMethod": institution_match["matchMethod"],
                "programMatchType": program_match_type,
                "institutionName": acpc_institution_name,
                "institutionNameAcpc": acpc_institution_name,
                "institutionNameAicte": aicte_institution_name,
                "institutionAicteId": aicte_aggregate.get("institutionAicteId", ""),
                "programName": acpc_program_name,
                "programNameBase": program_base,
                "tfwsVariant": tfws_variant,
                "acpcInstituteType": seat_row.get("instituteType"),
                "acpcInstituteTypeRaw": seat_row.get("instituteTypeRaw"),
                "aicteProgramNames": aicte_aggregate.get("aicteProgramNames", []),
                "aicteApprovedIntake": aicte_aggregate.get("aicteApprovedIntake", 0),
                "acpcCounsellingIntake": seat_row.get("acpcIntake"),
                "acpcAllottedCount": seat_row.get("allottedCount"),
                "acpcVacantCount": seat_row.get("vacantCount"),
                "acpcCutoffCount": len(cutoff_rows),
                "acpcClosingRanks": [
                    {
                        "category": row.get("category"),
                        "board": row.get("board"),
                        "closingRank": row.get("closingRank"),
                        "stableKey": row.get("stableKey"),
                        "evidencePointer": row.get("evidencePointer"),
                    }
                    for row in cutoff_rows
                ],
                "aicteStableKeys": aicte_aggregate.get("aicteStableKeys", []),
                "aicteEvidencePointers": aicte_aggregate.get("aicteEvidencePointers", []),
                "acpcSeatStableKey": seat_row.get("stableKey"),
                "acpcSeatEvidencePointer": seat_row.get("evidencePointer"),
                "acpcCutoffStableKeys": [row.get("stableKey") for row in cutoff_rows],
                "acpcCutoffEvidencePointers": [row.get("evidencePointer") for row in cutoff_rows],
                "institutionAliasRuleId": institution_match.get("aliasRuleId", ""),
                "sourceFamilies": ["AICTE", "ACPC"],
                "extractedAt": extracted_at,
            }
        )
        stats["matchedRows"] += 1
        stats["confidenceBuckets"][match_confidence] += 1

    for cutoff_key, cutoff_rows in acpc_cutoff_groups.items():
        if cutoff_key in matched_cutoff_keys:
            continue
        acpc_institution_name, program_variant = cutoff_key
        unmatched_acpc_rows.append(
            {
                "stableKey": f"gujarat-acpc-cutoff-only-{slugify(acpc_institution_name)}-{slugify(program_variant)}",
                "entityType": "unmatchedAcpcProgram",
                "sourceEntityType": "counsellingCutoff",
                "state": STATE,
                "courseFamily": COURSE_FAMILY,
                "session": SESSION,
                "round": ROUND,
                "joinStatus": "unmatched",
                "unmatchedReason": "cutoff_without_seat_matrix_row",
                "institutionName": acpc_institution_name,
                "programName": program_variant,
                "acpcCutoffCount": len(cutoff_rows),
                "acpcCutoffStableKeys": [row.get("stableKey") for row in cutoff_rows],
                "acpcCutoffEvidencePointers": [row.get("evidencePointer") for row in cutoff_rows],
                "extractedAt": extracted_at,
            }
        )
        stats["unmatchedAcpcRows"] += 1
        stats["unmatchedAcpcReasons"]["cutoff_without_seat_matrix_row"] += 1

    joined_rows.sort(key=lambda item: (item["institutionName"], item["programName"]))
    unmatched_acpc_rows.sort(key=lambda item: (item["unmatchedReason"], item["institutionName"], item["programName"]))

    unmatched_aicte_rows: list[dict[str, Any]] = []
    stats["unmatchedAicteRows"] = 0
    stats["unmatchedAicteReasons"] = Counter()

    matched_aicte_institutions = {key[0] for key in matched_aicte_keys}
    for key, aggregate in sorted(aicte_aggregates.items()):
        institution_name, program_base = key
        if key in matched_aicte_keys:
            continue

        if institution_name in matched_aicte_institutions:
            reason = "program_base_not_found_in_acpc_round3"
        else:
            reason = "institution_not_matched_to_acpc_round3"

        unmatched_aicte_rows.append(
            {
                "stableKey": aggregate["stableKey"],
                "entityType": "unmatchedAicteProgramAggregate",
                "state": STATE,
                "courseFamily": COURSE_FAMILY,
                "joinStatus": "unmatched",
                "unmatchedReason": reason,
                "institutionName": institution_name,
                "institutionAicteId": aggregate.get("institutionAicteId", ""),
                "programNameBase": program_base,
                "aicteProgramNames": aggregate.get("aicteProgramNames", []),
                "aicteApprovedIntake": aggregate.get("aicteApprovedIntake", 0),
                "aicteStableKeys": aggregate.get("aicteStableKeys", []),
                "aicteEvidencePointers": aggregate.get("aicteEvidencePointers", []),
                "extractedAt": extracted_at,
            }
        )
        stats["unmatchedAicteRows"] += 1
        stats["unmatchedAicteReasons"][reason] += 1

    unmatched_aicte_rows.sort(key=lambda item: (item["unmatchedReason"], item["institutionName"], item["programNameBase"]))

    return joined_rows, unmatched_aicte_rows, unmatched_acpc_rows, stats


def write_summary(
    *,
    summary_output: Path,
    total_aicte_scope_rows: int,
    total_acpc_seat_rows: int,
    total_acpc_cutoff_rows: int,
    institution_match_stats: Counter,
    stats: dict[str, Any],
    previous_metrics: dict[str, int],
) -> None:
    matched_rows = stats["matchedRows"]
    unmatched_acpc_rows = stats["unmatchedAcpcRows"]
    unmatched_aicte_rows = stats["unmatchedAicteRows"]
    ambiguous_acpc_rows = stats["ambiguousAcpcRows"]

    acpc_join_coverage = (matched_rows / total_acpc_seat_rows * 100) if total_acpc_seat_rows else 0.0
    aicte_join_coverage = (
        ((total_aicte_scope_rows - unmatched_aicte_rows) / total_aicte_scope_rows * 100) if total_aicte_scope_rows else 0.0
    )

    lines = [
        "# Gujarat AICTE-ACPC Join Quality Summary",
        "",
        "## Scope",
        "",
        f"- AICTE scope: Gujarat, `{AICTE_JOIN_LEVEL}`, `{AICTE_JOIN_PROGRAM}` only",
        f"- ACPC scope: Gujarat ACPC {COURSE_FAMILY} {SESSION} {ROUND}",
        "",
        "## Totals",
        "",
        f"- AICTE aggregated program groups in join scope: {total_aicte_scope_rows}",
        f"- ACPC seat-matrix rows: {total_acpc_seat_rows}",
        f"- ACPC cutoff rows: {total_acpc_cutoff_rows}",
        f"- Matched joined rows: {matched_rows}",
        f"- Unmatched AICTE rows: {unmatched_aicte_rows}",
        f"- Unmatched ACPC rows: {unmatched_acpc_rows}",
        f"- Ambiguous ACPC rows: {ambiguous_acpc_rows}",
        "",
        "## Comparison Vs Previous Run",
        "",
        f"- Matched rows: {previous_metrics.get('matchedRows', 0)} -> {matched_rows}",
        f"- Ambiguous ACPC rows: {previous_metrics.get('ambiguousAcpcRows', 0)} -> {ambiguous_acpc_rows}",
        f"- Unmatched ACPC rows: {previous_metrics.get('unmatchedAcpcRows', 0)} -> {unmatched_acpc_rows}",
        f"- Unmatched AICTE rows: {previous_metrics.get('unmatchedAicteRows', 0)} -> {unmatched_aicte_rows}",
        "",
        "## Coverage",
        "",
        f"- ACPC seat-row join coverage: {acpc_join_coverage:.2f}%",
        f"- AICTE join-scope coverage: {aicte_join_coverage:.2f}%",
        "",
        "## Confidence Buckets",
        "",
    ]

    for bucket, count in sorted(stats["confidenceBuckets"].items()):
        lines.append(f"- {bucket}: {count}")

    lines.extend(["", "## Institution Match Buckets", ""])
    for bucket, count in sorted(institution_match_stats.items()):
        lines.append(f"- {bucket}: {count}")

    lines.extend(["", "## Controlled Ambiguity Buckets", ""])
    if stats["ambiguityBuckets"]:
        for bucket, count in stats["ambiguityBuckets"].most_common():
            lines.append(f"- {bucket}: {count}")
    else:
        lines.append("- none")

    lines.extend(["", "## Unmatched ACPC Reasons", ""])
    for reason, count in stats["unmatchedAcpcReasons"].most_common():
        lines.append(f"- {reason}: {count}")

    lines.extend(["", "## Unmatched AICTE Reasons", ""])
    for reason, count in stats["unmatchedAicteReasons"].most_common():
        lines.append(f"- {reason}: {count}")

    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- TFWS/TFW ACPC rows are linked to the base AICTE undergraduate engineering branch only when the institution match is accepted and the base branch name aligns.",
            "- ACPC counselling intake/allotted/vacant values stay separate from AICTE approved intake; they are linked side-by-side rather than merged.",
            "- Conservative institution matching leaves university/faculty splits and unclear naming variants unmatched instead of forcing a join.",
        ]
    )

    summary_output.parent.mkdir(parents=True, exist_ok=True)
    summary_output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    setup_logging(args.log_file)

    aicte_input = args.aicte_input if args.aicte_input.is_absolute() else PROJECT_ROOT / args.aicte_input
    acpc_seat_input = args.acpc_seat_input if args.acpc_seat_input.is_absolute() else PROJECT_ROOT / args.acpc_seat_input
    acpc_cutoff_input = (
        args.acpc_cutoff_input if args.acpc_cutoff_input.is_absolute() else PROJECT_ROOT / args.acpc_cutoff_input
    )
    alias_file = args.alias_file if args.alias_file.is_absolute() else PROJECT_ROOT / args.alias_file
    joined_output = args.joined_output if args.joined_output.is_absolute() else PROJECT_ROOT / args.joined_output
    unmatched_aicte_output = (
        args.unmatched_aicte_output
        if args.unmatched_aicte_output.is_absolute()
        else PROJECT_ROOT / args.unmatched_aicte_output
    )
    unmatched_acpc_output = (
        args.unmatched_acpc_output
        if args.unmatched_acpc_output.is_absolute()
        else PROJECT_ROOT / args.unmatched_acpc_output
    )
    summary_output = args.summary_output if args.summary_output.is_absolute() else PROJECT_ROOT / args.summary_output

    previous_metrics = load_previous_metrics_from_summary(summary_output) or {
        "matchedRows": count_existing_rows(joined_output),
        "unmatchedAicteRows": count_existing_rows(unmatched_aicte_output),
        "unmatchedAcpcRows": count_existing_rows(unmatched_acpc_output),
        "ambiguousAcpcRows": count_existing_ambiguous_rows(unmatched_acpc_output),
    }

    aicte_rows = read_ndjson(aicte_input)
    acpc_seat_rows = read_ndjson(acpc_seat_input)
    acpc_cutoff_rows = read_ndjson(acpc_cutoff_input)
    alias_rules = load_alias_rules(alias_file)
    extracted_at = now_utc()

    aicte_aggregates, aicte_programs_by_institution = aggregate_aicte_scope(aicte_rows)
    institution_matches, institution_match_stats = build_institution_match_map(
        acpc_seat_rows=acpc_seat_rows,
        aicte_programs_by_institution=aicte_programs_by_institution,
        alias_rules=alias_rules,
    )
    acpc_cutoff_groups = group_cutoffs(acpc_cutoff_rows)

    joined_rows, unmatched_aicte_rows, unmatched_acpc_rows, stats = build_join_outputs(
        aicte_aggregates=aicte_aggregates,
        institution_matches=institution_matches,
        acpc_seat_rows=acpc_seat_rows,
        acpc_cutoff_groups=acpc_cutoff_groups,
        extracted_at=extracted_at,
    )

    write_ndjson(joined_output, joined_rows)
    write_ndjson(unmatched_aicte_output, unmatched_aicte_rows)
    write_ndjson(unmatched_acpc_output, unmatched_acpc_rows)
    write_summary(
        summary_output=summary_output,
        total_aicte_scope_rows=len(aicte_aggregates),
        total_acpc_seat_rows=len(acpc_seat_rows),
        total_acpc_cutoff_rows=len(acpc_cutoff_rows),
        institution_match_stats=institution_match_stats,
        stats=stats,
        previous_metrics=previous_metrics,
    )

    logging.info(
        "Gujarat join summary: matched=%s unmatched_acpc=%s unmatched_aicte=%s ambiguous_acpc=%s",
        stats["matchedRows"],
        stats["unmatchedAcpcRows"],
        stats["unmatchedAicteRows"],
        stats["ambiguousAcpcRows"],
    )
    print(
        "Gujarat join summary:",
        {
            "matched_rows": stats["matchedRows"],
            "unmatched_acpc_rows": stats["unmatchedAcpcRows"],
            "unmatched_aicte_rows": stats["unmatchedAicteRows"],
            "ambiguous_acpc_rows": stats["ambiguousAcpcRows"],
            "confidence_buckets": dict(stats["confidenceBuckets"]),
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
