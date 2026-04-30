'use strict';

/**
 * Frontend normalization contract for seat matrix rows.
 * 
 * Objective:
 * - unify official seat matrix data into one clean contract
 * - preserve category-level seat counts
 * - provide display-friendly labels for pools and scopes
 */

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function num(v) {
  if (isBlank(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function boolOrNull(v) {
  if (v === true) return true;
  if (v === false) return false;
  return null;
}

function strOrNull(v) {
  if (isBlank(v)) return null;
  return String(v).trim();
}

function firstNonBlank(...values) {
  for (const v of values) {
    if (!isBlank(v)) return String(v).trim();
  }
  return null;
}

function joinDisplayParts(parts, separator = ' • ') {
  const cleaned = parts.filter((x) => !isBlank(x)).map((x) => String(x).trim());
  return cleaned.length > 0 ? cleaned.join(separator) : null;
}

/**
 * Normalizes a single raw seat matrix row.
 */
function normalizeSeatMatrixRow(doc) {
  if (!doc || typeof doc !== 'object') {
    return {
      id: null,
      authority: null,
      sourceType: null,
      academicYear: null,
      counsellingYear: null,
      instituteName: null,
      programName: null,
      programTitle: null,
      degreeAward: null,
      durationYears: null,
      programParseStatus: null,
      quotaScopeLabel: null,
      quotaScopeCanonical: null,
      seatPoolLabel: null,
      seatPoolCanonical: null,
      isFemaleOnlyPool: null,
      isGenderNeutralPool: null,
      categorySeats: {
        open: null,
        openPwd: null,
        genEws: null,
        genEwsPwd: null,
        obcNcl: null,
        obcNclPwd: null,
        sc: null,
        scPwd: null,
        st: null,
        stPwd: null
      },
      totalSeats: null,
      categorySum: null,
      totalMismatchFlag: false,
      programTotalSeatCapacity: null,
      programTotalFemaleSupernumerary: null,
      sourceGroup: 'ENGINEERING_COUNSELLING',
      rowKind: 'SEAT_MATRIX',
      sourceLabel: 'Seat Matrix',
      displaySeatPoolLabel: null,
      displayQuotaPoolLabel: null,
      sourceUrl: null,
      extractedAt: null,
      provenance: null,
      entityKey: null,
      sourceRowFingerprint: null,
      rawRef: {
        authority: null,
        sourceType: null
      }
    };
  }

  const authority = strOrNull(doc.authority);
  const quotaScopeLabel = firstNonBlank(doc.quota_scope_raw, doc.quota_scope);
  const seatPoolLabel = firstNonBlank(doc.seat_pool_raw, doc.seat_pool);

  // Exact UI Requirements:
  // - displaySeatPoolLabel = seatPoolLabel
  // - displayQuotaPoolLabel = join non-empty [quotaScopeLabel, seatPoolLabel] with ' • '
  const displaySeatPoolLabel = seatPoolLabel;
  const displayQuotaPoolLabel = joinDisplayParts([quotaScopeLabel, seatPoolLabel]);

  // Authority Label logic
  const sourceLabel = authority === 'JOSAA' ? 'JoSAA Seat Matrix' : (authority || 'Official') + ' Seat Matrix';

  return {
    id: firstNonBlank(doc.entity_key, doc.source_row_fingerprint),

    authority,
    sourceType: strOrNull(doc.source_type),
    academicYear: strOrNull(doc.academic_year),
    counsellingYear: num(doc.counselling_year),

    instituteName: firstNonBlank(doc.institute_name_normalized, doc.institute_name_raw),
    programName: strOrNull(doc.program_name_raw),
    programTitle: strOrNull(doc.program_title),
    degreeAward: strOrNull(doc.degree_award),
    durationYears: num(doc.program_duration_years),
    programParseStatus: strOrNull(doc.program_parse_status),

    quotaScopeLabel,
    quotaScopeCanonical: strOrNull(doc.quota_scope_canonical),
    seatPoolLabel,
    seatPoolCanonical: strOrNull(doc.seat_pool_canonical),
    isFemaleOnlyPool: boolOrNull(doc.is_female_only_pool),
    isGenderNeutralPool: boolOrNull(doc.is_gender_neutral_pool),

    categorySeats: {
      open: num(doc.open),
      openPwd: num(doc.open_pwd),
      genEws: num(doc.gen_ews),
      genEwsPwd: num(doc.gen_ews_pwd),
      obcNcl: num(doc.obc_ncl),
      obcNclPwd: num(doc.obc_ncl_pwd),
      sc: num(doc.sc),
      scPwd: num(doc.sc_pwd),
      st: num(doc.st),
      stPwd: num(doc.st_pwd)
    },

    totalSeats: num(doc.total_includes_female_supernumerary),
    intake: num(doc.total_includes_female_supernumerary), // Support for Truth API contract
    seatCapacity: num(doc.total_includes_female_supernumerary), // Support for TruthSeatMatrixSection
    categorySum: num(doc.category_sum_excluding_program_totals),
    totalMismatchFlag: doc.total_mismatch_flag === true,
    programTotalSeatCapacity: num(doc.program_total_seat_capacity),
    programTotalFemaleSupernumerary: num(doc.program_total_female_supernumerary),

    sourceGroup: 'ENGINEERING_COUNSELLING',
    rowKind: 'SEAT_MATRIX',
    sourceLabel,
    displaySeatPoolLabel,
    displayQuotaPoolLabel,

    sourceUrl: strOrNull(doc.source_url),
    extractedAt: strOrNull(doc.extracted_at),
    provenance: doc.provenance || null,
    entityKey: strOrNull(doc.entity_key),
    sourceRowFingerprint: strOrNull(doc.source_row_fingerprint),

    rawRef: {
      authority,
      sourceType: strOrNull(doc.source_type)
    }
  };
}

/**
 * Normalizes an array of seat matrix rows.
 */
function normalizeSeatMatrixRows(docs) {
  if (!Array.isArray(docs)) return [];
  return docs.map(normalizeSeatMatrixRow);
}

module.exports = {
  normalizeSeatMatrixRow,
  normalizeSeatMatrixRows
};
