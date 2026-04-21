'use strict';

/**
 * Frontend normalization contract for engineering cutoff rows.
 *
 * Goal:
 * - unify JoSAA + CSAB rows into one frontend-safe shape
 * - preserve provenance and source nuance
 * - avoid mutating official core storage
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

function deriveRoundNumber(doc, authority) {
  if (authority === 'CSAB') {
    return num(doc?.special_round);
  }
  return num(doc?.round ?? doc?.round_number);
}

function deriveRoundLabel(authority, roundNumber) {
  if (roundNumber == null) return null;
  if (authority === 'CSAB') return `Special Round ${roundNumber}`;
  if (authority === 'JOSAA') return `Round ${roundNumber}`;
  return `Round ${roundNumber}`;
}

function deriveQuotaLabel(doc) {
  return firstNonBlank(
    doc?.quota_raw,
    doc?.quota_scope_raw
  );
}

function deriveQuotaCanonical(doc) {
  return firstNonBlank(
    doc?.quota_canonical,
    doc?.quota_scope_canonical
  );
}

function deriveCategoryLabel(doc) {
  return firstNonBlank(
    doc?.seat_type_raw,
    doc?.category_raw,
    doc?.local_category_label
  );
}

function deriveCategoryCanonical(doc) {
  return firstNonBlank(
    doc?.seat_type_canonical,
    doc?.category_canonical,
    doc?.canonical_category_label
  );
}

function deriveGenderLabel(doc) {
  return firstNonBlank(
    doc?.gender_raw,
    doc?.gender_pool_raw
  );
}

function deriveGenderCanonical(doc) {
  return firstNonBlank(
    doc?.gender_canonical,
    doc?.gender_pool_canonical
  );
}

function deriveInstituteName(doc) {
  return firstNonBlank(
    doc?.institute_name_normalized,
    doc?.institute_name_raw
  );
}

function deriveProgramName(doc) {
  return firstNonBlank(
    doc?.program_name_raw,
    doc?.academic_program_name_raw
  );
}

function deriveSourceLabel(authority, roundLabel) {
  if (authority === 'CSAB') {
    return ['CSAB', roundLabel].filter(Boolean).join(' ');
  }
  if (authority === 'JOSAA') {
    return ['JoSAA', roundLabel].filter(Boolean).join(' ');
  }
  return firstNonBlank(authority, 'Unknown');
}

function joinDisplayParts(parts) {
  const cleaned = parts.filter((x) => !isBlank(x)).map((x) => String(x).trim());
  return cleaned.length > 0 ? cleaned.join(' • ') : null;
}

function deriveRankRangeLabel(openingRank, closingRank) {
  if (openingRank == null || closingRank == null) return null;
  return `${openingRank} - ${closingRank}`;
}

function normalizeEngineeringCutoffRow(doc) {
  if (!doc || typeof doc !== 'object') {
    return {
      id: null,

      authority: null,
      counsellingVariant: null,
      academicYear: null,
      counsellingYear: null,
      roundNumber: null,
      roundLabel: null,

      instituteName: null,
      programName: null,
      programTitle: null,
      degreeAward: null,
      durationYears: null,
      programParseStatus: null,

      quotaLabel: null,
      quotaCanonical: null,
      categoryLabel: null,
      categoryCanonical: null,
      genderLabel: null,
      genderCanonical: null,

      rankBasis: null,
      openingRank: null,
      closingRank: null,
      openingRankRaw: null,
      closingRankRaw: null,
      isPreparatoryOpening: null,
      isPreparatoryClosing: null,
      hasRankInversion: false,

      sourceGroup: 'ENGINEERING_COUNSELLING',
      examFamily: 'JEE_MAIN_ADVANCED',
      rowKind: 'CUTOFF',
      sourceLabel: 'Unknown',
      displayCategoryLabel: null,
      displayQuotaCategoryGender: null,
      rankRangeLabel: null,

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
  const roundNumber = deriveRoundNumber(doc, authority);
  const roundLabel = deriveRoundLabel(authority, roundNumber);

  const instituteName = deriveInstituteName(doc);
  const programName = deriveProgramName(doc);
  const programTitle = strOrNull(doc.program_title);
  const degreeAward = strOrNull(doc.degree_award);
  const durationYears = num(doc.program_duration_years);
  const programParseStatus = strOrNull(doc.program_parse_status);

  const quotaLabel = deriveQuotaLabel(doc);
  const quotaCanonical = deriveQuotaCanonical(doc);
  const categoryLabel = deriveCategoryLabel(doc);
  const categoryCanonical = deriveCategoryCanonical(doc);
  const genderLabel = deriveGenderLabel(doc);
  const genderCanonical = deriveGenderCanonical(doc);

  const openingRank = num(doc.opening_rank);
  const closingRank = num(doc.closing_rank);

  const openingRankRaw = firstNonBlank(
    doc.opening_rank_raw,
    openingRank == null ? null : String(openingRank)
  );

  const closingRankRaw = firstNonBlank(
    doc.closing_rank_raw,
    closingRank == null ? null : String(closingRank)
  );

  const sourceLabel = deriveSourceLabel(authority, roundLabel);

  return {
    id: firstNonBlank(doc.entity_key, doc.source_row_fingerprint),

    authority,
    counsellingVariant: strOrNull(doc.counselling_variant),
    academicYear: strOrNull(doc.academic_year),
    counsellingYear: num(doc.counselling_year),
    roundNumber,
    roundLabel,

    instituteName,
    programName,
    programTitle,
    degreeAward,
    durationYears,
    programParseStatus,

    quotaLabel,
    quotaCanonical,
    categoryLabel,
    categoryCanonical,
    genderLabel,
    genderCanonical,

    rankBasis: strOrNull(doc.rank_basis),
    openingRank,
    closingRank,
    openingRankRaw,
    closingRankRaw,
    isPreparatoryOpening: boolOrNull(doc.opening_rank_preparatory),
    isPreparatoryClosing: boolOrNull(doc.closing_rank_preparatory),
    hasRankInversion: doc.opening_closing_inversion_flag === true,

    sourceGroup: 'ENGINEERING_COUNSELLING',
    examFamily: 'JEE_MAIN_ADVANCED',
    rowKind: 'CUTOFF',
    sourceLabel,
    displayCategoryLabel: joinDisplayParts([categoryLabel, genderLabel]),
    displayQuotaCategoryGender: joinDisplayParts([quotaLabel, categoryLabel, genderLabel]),
    rankRangeLabel: deriveRankRangeLabel(openingRank, closingRank),

    sourceUrl: strOrNull(doc.source_url),
    extractedAt: strOrNull(doc.extracted_at),
    provenance: doc.provenance ?? null,
    entityKey: strOrNull(doc.entity_key),
    sourceRowFingerprint: strOrNull(doc.source_row_fingerprint),

    rawRef: {
      authority: strOrNull(doc.authority),
      sourceType: strOrNull(doc.source_type)
    }
  };
}

function normalizeEngineeringCutoffRows(docs) {
  if (!Array.isArray(docs)) return [];
  return docs.map(normalizeEngineeringCutoffRow);
}

module.exports = {
  normalizeEngineeringCutoffRow,
  normalizeEngineeringCutoffRows
};