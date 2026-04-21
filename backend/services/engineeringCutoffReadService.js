'use strict';

const { normalizeEngineeringCutoffRows } = require('../mappers/normalizeEngineeringCutoffRow');

const COLLECTION_NAME = 'engineering_cutoffs';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function strOrNull(v) {
  if (isBlank(v)) return null;
  return String(v).trim();
}

function numOrNull(v) {
  if (isBlank(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clampLimit(limit) {
  const n = numOrNull(limit);
  if (n == null || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function normalizePage(page) {
  const n = numOrNull(page);
  if (n == null || n <= 0) return DEFAULT_PAGE;
  return Math.floor(n);
}

function buildRegexContains(value) {
  const s = strOrNull(value);
  if (!s) return null;
  return new RegExp(escapeRegex(s), 'i');
}

function buildAuthorityFilter(filters) {
  const authority = strOrNull(filters.authority);
  if (!authority) return null;
  return authority.toUpperCase();
}

function buildCounsellingVariantFilter(filters) {
  const variant = strOrNull(filters.counsellingVariant);
  if (!variant) return null;
  return variant.toUpperCase();
}

function buildRoundFilter(filters) {
  const roundNumber = numOrNull(filters.roundNumber);
  if (roundNumber == null) return null;

  const authority = buildAuthorityFilter(filters);

  if (authority === 'CSAB') {
    return { special_round: roundNumber };
  }

  if (authority === 'JOSAA') {
    return {
      $or: [
        { round: roundNumber },
        { round_number: roundNumber }
      ]
    };
  }

  return {
    $or: [
      { special_round: roundNumber },
      { round: roundNumber },
      { round_number: roundNumber }
    ]
  };
}

function buildInstituteFilter(filters) {
  const regex = buildRegexContains(filters.instituteName);
  if (!regex) return null;

  return {
    $or: [
      { institute_name_normalized: regex },
      { institute_name_raw: regex }
    ]
  };
}

function buildProgramFilter(filters) {
  const regex = buildRegexContains(filters.programName);
  if (!regex) return null;

  return {
    $or: [
      { program_title: regex },
      { program_name_raw: regex },
      { academic_program_name_raw: regex }
    ]
  };
}

function buildQuotaFilter(filters) {
  const quotaCanonical = strOrNull(filters.quotaCanonical);
  const quotaLabel = strOrNull(filters.quotaLabel);

  if (quotaCanonical) {
    return {
      $or: [
        { quota_canonical: quotaCanonical.toUpperCase() },
        { quota_scope_canonical: quotaCanonical.toUpperCase() }
      ]
    };
  }

  if (quotaLabel) {
    const regex = buildRegexContains(quotaLabel);
    return {
      $or: [
        { quota_raw: regex },
        { quota_scope_raw: regex }
      ]
    };
  }

  return null;
}

function buildCategoryFilter(filters) {
  const categoryCanonical = strOrNull(filters.categoryCanonical);
  const categoryLabel = strOrNull(filters.categoryLabel);

  if (categoryCanonical) {
    return {
      $or: [
        { seat_type_canonical: categoryCanonical.toUpperCase() },
        { category_canonical: categoryCanonical.toUpperCase() },
        { canonical_category_label: categoryCanonical.toUpperCase() }
      ]
    };
  }

  if (categoryLabel) {
    const regex = buildRegexContains(categoryLabel);
    return {
      $or: [
        { seat_type_raw: regex },
        { category_raw: regex },
        { local_category_label: regex }
      ]
    };
  }

  return null;
}

function buildGenderFilter(filters) {
  const genderCanonical = strOrNull(filters.genderCanonical);
  const genderLabel = strOrNull(filters.genderLabel);

  if (genderCanonical) {
    return {
      $or: [
        { gender_canonical: genderCanonical.toUpperCase() },
        { gender_pool_canonical: genderCanonical.toUpperCase() }
      ]
    };
  }

  if (genderLabel) {
    const regex = buildRegexContains(genderLabel);
    return {
      $or: [
        { gender_raw: regex },
        { gender_pool_raw: regex }
      ]
    };
  }

  return null;
}

function buildAcademicYearFilter(filters) {
  const academicYear = strOrNull(filters.academicYear);
  if (!academicYear) return null;
  return { academic_year: academicYear };
}

function buildCounsellingYearFilter(filters) {
  const counsellingYear = numOrNull(filters.counsellingYear);
  if (counsellingYear == null) return null;
  return { counselling_year: counsellingYear };
}

function buildRankRangeFilter(filters) {
  const openingRankMin = numOrNull(filters.openingRankMin);
  const openingRankMax = numOrNull(filters.openingRankMax);
  const closingRankMin = numOrNull(filters.closingRankMin);
  const closingRankMax = numOrNull(filters.closingRankMax);

  const clauses = [];

  if (openingRankMin != null || openingRankMax != null) {
    const range = {};
    if (openingRankMin != null) range.$gte = openingRankMin;
    if (openingRankMax != null) range.$lte = openingRankMax;
    clauses.push({ opening_rank: range });
  }

  if (closingRankMin != null || closingRankMax != null) {
    const range = {};
    if (closingRankMin != null) range.$gte = closingRankMin;
    if (closingRankMax != null) range.$lte = closingRankMax;
    clauses.push({ closing_rank: range });
  }

  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];

  return { $and: clauses };
}

function buildEngineeringCutoffQuery(filters = {}) {
  const query = {};
  const andClauses = [];

  // --- DETERMINISTIC PRIMARY: Institution ID ---
  const institutionId = strOrNull(filters.institutionId);
  if (institutionId) {
    andClauses.push({ institution_id: institutionId });
  } else {
    // --- FALLBACK: Name-based fuzzy search ---
    const instFilter = buildInstituteFilter(filters);
    if (instFilter) andClauses.push(instFilter);
  }

  const authority = buildAuthorityFilter(filters);
  if (authority) {
    andClauses.push({ authority });
  }

  const counsellingVariant = buildCounsellingVariantFilter(filters);
  if (counsellingVariant) {
    andClauses.push({ counselling_variant: counsellingVariant });
  }

  const academicYearFilter = buildAcademicYearFilter(filters);
  if (academicYearFilter) andClauses.push(academicYearFilter);

  const counsellingYearFilter = buildCounsellingYearFilter(filters);
  if (counsellingYearFilter) andClauses.push(counsellingYearFilter);

  const roundFilter = buildRoundFilter(filters);
  if (roundFilter) andClauses.push(roundFilter);

  const instituteFilter = buildInstituteFilter(filters);
  if (instituteFilter) andClauses.push(instituteFilter);

  const programFilter = buildProgramFilter(filters);
  if (programFilter) andClauses.push(programFilter);

  const quotaFilter = buildQuotaFilter(filters);
  if (quotaFilter) andClauses.push(quotaFilter);

  const categoryFilter = buildCategoryFilter(filters);
  if (categoryFilter) andClauses.push(categoryFilter);

  const genderFilter = buildGenderFilter(filters);
  if (genderFilter) andClauses.push(genderFilter);

  const rankRangeFilter = buildRankRangeFilter(filters);
  if (rankRangeFilter) andClauses.push(rankRangeFilter);

  if (andClauses.length === 0) return {};
  if (andClauses.length === 1) return andClauses[0];

  return { $and: andClauses };
}

function buildSort(sortBy = 'closingRank', sortOrder = 'asc') {
  const direction = String(sortOrder).toLowerCase() === 'desc' ? -1 : 1;

  const sortMap = {
    openingRank: { opening_rank: direction, closing_rank: direction, entity_key: 1 },
    closingRank: { closing_rank: direction, opening_rank: direction, entity_key: 1 },
    instituteName: { institute_name_normalized: direction, institute_name_raw: direction, entity_key: 1 },
    programName: { program_title: direction, program_name_raw: direction, academic_program_name_raw: direction, entity_key: 1 },
    roundNumber: { special_round: direction, round: direction, round_number: direction, entity_key: 1 },
    authority: { authority: direction, counselling_variant: direction, entity_key: 1 }
  };

  return sortMap[sortBy] || sortMap.closingRank;
}

async function getEngineeringCutoffs({
  db,
  filters = {},
  page = DEFAULT_PAGE,
  limit = DEFAULT_LIMIT,
  sortBy = 'closingRank',
  sortOrder = 'asc',
  projection = null
}) {
  if (!db) {
    throw new Error('getEngineeringCutoffs requires a Mongo db instance');
  }

  const collection = db.collection(COLLECTION_NAME);
  const query = buildEngineeringCutoffQuery(filters);
  console.log(`[DEBUG][Cutoffs] Query: ${JSON.stringify(query)}`);
  const safePage = normalizePage(page);
  const safeLimit = clampLimit(limit);
  const skip = (safePage - 1) * safeLimit;
  const sort = buildSort(sortBy, sortOrder);

  const cursor = collection.find(query, projection ? { projection } : {}).sort(sort).skip(skip).limit(safeLimit);

  const [rawDocs, total] = await Promise.all([
    cursor.toArray(),
    collection.countDocuments(query)
  ]);

  const items = normalizeEngineeringCutoffRows(rawDocs);

  return {
    items,
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      hasNextPage: skip + rawDocs.length < total,
      hasPrevPage: safePage > 1,
      sortBy,
      sortOrder: String(sortOrder).toLowerCase() === 'desc' ? 'desc' : 'asc',
      filtersApplied: {
        authority: strOrNull(filters.authority),
        counsellingVariant: strOrNull(filters.counsellingVariant),
        academicYear: strOrNull(filters.academicYear),
        counsellingYear: numOrNull(filters.counsellingYear),
        roundNumber: numOrNull(filters.roundNumber),
        instituteName: strOrNull(filters.instituteName),
        programName: strOrNull(filters.programName),
        quotaCanonical: strOrNull(filters.quotaCanonical),
        quotaLabel: strOrNull(filters.quotaLabel),
        categoryCanonical: strOrNull(filters.categoryCanonical),
        categoryLabel: strOrNull(filters.categoryLabel),
        genderCanonical: strOrNull(filters.genderCanonical),
        genderLabel: strOrNull(filters.genderLabel),
        openingRankMin: numOrNull(filters.openingRankMin),
        openingRankMax: numOrNull(filters.openingRankMax),
        closingRankMin: numOrNull(filters.closingRankMin),
        closingRankMax: numOrNull(filters.closingRankMax)
      },
      normalizedContract: 'engineering_cutoffs_v1'
    }
  };
}

async function getEngineeringCutoffFilterMeta({ db, filters = {} }) {
  if (!db) {
    throw new Error('getEngineeringCutoffFilterMeta requires a Mongo db instance');
  }

  const collection = db.collection(COLLECTION_NAME);
  const query = buildEngineeringCutoffQuery(filters);

  const [authorities, counsellingVariants, josaaRounds, csabRounds] = await Promise.all([
    collection.distinct('authority', query),
    collection.distinct('counselling_variant', query),
    collection.distinct('round', query),
    collection.distinct('special_round', query)
  ]);

  const rounds = [...new Set(
    [...josaaRounds, ...csabRounds]
      .map((v) => numOrNull(v))
      .filter((v) => v != null)
  )].sort((a, b) => a - b);

  return {
    authorities: authorities.filter((x) => !isBlank(x)).sort(),
    counsellingVariants: counsellingVariants.filter((x) => !isBlank(x)).sort(),
    rounds,
    normalizedContract: 'engineering_cutoffs_v1'
  };
}

module.exports = {
  COLLECTION_NAME,
  buildEngineeringCutoffQuery,
  getEngineeringCutoffs,
  getEngineeringCutoffFilterMeta
};