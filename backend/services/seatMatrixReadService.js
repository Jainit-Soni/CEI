'use strict';

const { normalizeSeatMatrixRows } = require('../mappers/normalizeSeatMatrixRow');
const { getEngineeringNamesForId } = require('./seatCutoffBridge');
const identityResolver = require('../lib/identityResolver');
const surfaceTierRegistry = require('../lib/surfaceTierRegistry');

const COLLECTION_NAME = 'seat_matrix';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

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

function boolOrNull(v) {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return null;
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

function buildSeatMatrixQuery(filters = {}) {
  const andClauses = [];

  // Authority & Academic
  const authority = strOrNull(filters.authority);
  if (authority) andClauses.push({ authority: authority.toUpperCase() });

  const academicYear = strOrNull(filters.academicYear);
  if (academicYear) andClauses.push({ academic_year: academicYear });

  const counsellingYear = numOrNull(filters.counsellingYear);
  if (counsellingYear != null) andClauses.push({ counselling_year: counsellingYear });

  // --- DETERMINISTIC PRIMARY: Institution ID ---
  const institutionId = strOrNull(filters.institutionId);
  if (institutionId) {
    const dataKeys = identityResolver.getInstitutionDataKeys(institutionId);
    if (dataKeys && dataKeys.length > 0) {
      andClauses.push({ institution_id: { $in: dataKeys } });
    } else {
      andClauses.push({ institution_id: institutionId });
    }
  } else {
    // --- FALLBACK: Name-based fuzzy search ---
    const instRegex = buildRegexContains(filters.instituteName);
    if (instRegex) {
      andClauses.push({
        $or: [
          { institute_name_normalized: instRegex },
          { institute_name_raw: instRegex }
        ]
      });
    }

    // Global filter: only allow rows belonging to CERTIFIED/LIMITED institutions
    const allowedKeys = identityResolver.getAllAllowedDataKeys();
    if (allowedKeys && allowedKeys.length > 0) {
      andClauses.push({ institution_id: { $in: allowedKeys } });
    }
  }

  // Program name matching
  const progRegex = buildRegexContains(filters.programName);
  if (progRegex) {
    andClauses.push({
      $or: [
        { program_title: progRegex },
        { program_name_raw: progRegex }
      ]
    });
  }

  // Quota Scope
  const quotaScopeCanonical = strOrNull(filters.quotaScopeCanonical);
  if (quotaScopeCanonical) andClauses.push({ quota_scope_canonical: quotaScopeCanonical.toUpperCase() });

  const quotaScopeLabel = strOrNull(filters.quotaScopeLabel);
  if (quotaScopeLabel) andClauses.push({ quota_scope_raw: buildRegexContains(quotaScopeLabel) });

  // Seat Pool
  const seatPoolCanonical = strOrNull(filters.seatPoolCanonical);
  if (seatPoolCanonical) andClauses.push({ seat_pool_canonical: seatPoolCanonical.toUpperCase() });

  const seatPoolLabel = strOrNull(filters.seatPoolLabel);
  if (seatPoolLabel) andClauses.push({ seat_pool_raw: buildRegexContains(seatPoolLabel) });

  // Boolean Filters (Robust)
  const isFemaleOnlyPool = boolOrNull(filters.isFemaleOnlyPool);
  if (isFemaleOnlyPool !== null) andClauses.push({ is_female_only_pool: isFemaleOnlyPool });

  const isGenderNeutralPool = boolOrNull(filters.isGenderNeutralPool);
  if (isGenderNeutralPool !== null) andClauses.push({ is_gender_neutral_pool: isGenderNeutralPool });

  if (andClauses.length === 0) return {};
  if (andClauses.length === 1) return andClauses[0];

  return { $and: andClauses };
}

function buildSort(sortBy = 'totalSeats', sortOrder = 'desc') {
  const direction = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;

  const sortMap = {
    instituteName: { institute_name_normalized: direction, institute_name_raw: direction, entity_key: 1 },
    programName: { program_title: direction, program_name_raw: direction, entity_key: 1 },
    totalSeats: { total_includes_female_supernumerary: direction, program_total_seat_capacity: direction, entity_key: 1 },
    quotaScope: { quota_scope_canonical: direction, quota_scope_raw: direction, entity_key: 1 },
    seatPool: { seat_pool_canonical: direction, seat_pool_raw: direction, entity_key: 1 }
  };

  return sortMap[sortBy] || sortMap.totalSeats;
}

/**
 * Main service to fetch normalized seat matrix rows.
 */
async function getEngineeringSeatMatrix({
  db,
  filters = {},
  page = DEFAULT_PAGE,
  limit = DEFAULT_LIMIT,
  sortBy = 'totalSeats',
  sortOrder = 'desc',
  projection = null
}) {
  if (!db) {
    throw new Error('getEngineeringSeatMatrix requires a Mongo db instance');
  }

  const institutionId = strOrNull(filters.institutionId);
  if (institutionId) {
    const canonicalId = identityResolver.resolveId(institutionId) || institutionId;
    const tier = surfaceTierRegistry.getTierMetadata(canonicalId)?.surface_tier;
    if (tier === 'SEARCH_ONLY' || tier === 'HIDE_UNTIL_HYDRATED') {
      return {
        items: [],
        meta: { total: 0, page: 1, limit: clampLimit(limit), totalPages: 0, hasNextPage: false, hasPrevPage: false, sortBy, sortOrder: directionToString(sortOrder), filtersApplied: filters, normalizedContract: 'seat_matrix_v1' }
      };
    }
  }

  const collection = db.collection(COLLECTION_NAME);
  const query = buildSeatMatrixQuery(filters);
  console.log(`[DEBUG][Seats] Query: ${JSON.stringify(query)}`);
  const safePage = normalizePage(page);
  const safeLimit = clampLimit(limit);
  const skip = (safePage - 1) * safeLimit;
  const sort = buildSort(sortBy, sortOrder);

  const cursor = collection.find(query, projection ? { projection } : {}).sort(sort).skip(skip).limit(safeLimit);

  const [rawDocs, total] = await Promise.all([
    cursor.toArray(),
    collection.countDocuments(query)
  ]);

  const items = normalizeSeatMatrixRows(rawDocs);

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
      sortOrder: directionToString(sortOrder),
      filtersApplied: {
        authority: strOrNull(filters.authority),
        academicYear: strOrNull(filters.academicYear),
        counsellingYear: numOrNull(filters.counsellingYear),
        instituteName: strOrNull(filters.instituteName),
        programName: strOrNull(filters.programName),
        quotaScopeCanonical: strOrNull(filters.quotaScopeCanonical),
        quotaScopeLabel: strOrNull(filters.quotaScopeLabel),
        seatPoolCanonical: strOrNull(filters.seatPoolCanonical),
        seatPoolLabel: strOrNull(filters.seatPoolLabel),
        isFemaleOnlyPool: boolOrNull(filters.isFemaleOnlyPool),
        isGenderNeutralPool: boolOrNull(filters.isGenderNeutralPool)
      },
      normalizedContract: 'seat_matrix_v1'
    }
  };
}

/**
 * Fetches distinct filter values for the UI.
 */
async function getEngineeringSeatMatrixFilterMeta({ db, filters = {} }) {
  if (!db) {
    throw new Error('getEngineeringSeatMatrixFilterMeta requires a Mongo db instance');
  }

  const collection = db.collection(COLLECTION_NAME);
  const query = buildSeatMatrixQuery(filters);

  const [authorities, academicYears, counsellingYears, quotaScopeCanonicals, seatPoolCanonicals] = await Promise.all([
    collection.distinct('authority', query),
    collection.distinct('academic_year', query),
    collection.distinct('counselling_year', query),
    collection.distinct('quota_scope_canonical', query),
    collection.distinct('seat_pool_canonical', query)
  ]);

  return {
    authorities: authorities.filter((x) => !isBlank(x)).sort(),
    academicYears: academicYears.filter((x) => !isBlank(x)).sort(),
    counsellingYears: counsellingYears.filter((x) => !isBlank(x)).sort((a, b) => b - a),
    quotaScopeCanonicals: quotaScopeCanonicals.filter((x) => !isBlank(x)).sort(),
    seatPoolCanonicals: seatPoolCanonicals.filter((x) => !isBlank(x)).sort(),
    normalizedContract: 'seat_matrix_v1'
  };
}

function directionToString(sortOrder) {
  return String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';
}

module.exports = {
  COLLECTION_NAME,
  buildSeatMatrixQuery,
  getEngineeringSeatMatrix,
  getEngineeringSeatMatrixFilterMeta
};
