'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { 
  getEngineeringCutoffs, 
  getEngineeringCutoffFilterMeta 
} = require('../services/engineeringCutoffReadService');

const router = express.Router();

/**
 * GET /api/cutoffs/engineering
 * Fetches filtered and paginated engineering cutoffs.
 */
router.get('/engineering', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(503).json({ 
        error: 'Database connection not ready. Please try again in a moment.' 
      });
    }

    const filters = {
      institutionId: req.query.institutionId || req.query.institution_id,
      authority: req.query.authority,
      counsellingVariant: req.query.counsellingVariant,
      academicYear: req.query.academicYear,
      counsellingYear: req.query.counsellingYear,
      roundNumber: req.query.roundNumber,
      instituteName: req.query.instituteName,
      programName: req.query.programName,
      quotaCanonical: req.query.quotaCanonical,
      quotaLabel: req.query.quotaLabel,
      categoryCanonical: req.query.categoryCanonical,
      categoryLabel: req.query.categoryLabel,
      genderCanonical: req.query.genderCanonical,
      genderLabel: req.query.genderLabel,
      openingRankMin: req.query.openingRankMin,
      openingRankMax: req.query.openingRankMax,
      closingRankMin: req.query.closingRankMin,
      closingRankMax: req.query.closingRankMax
    };

    const result = await getEngineeringCutoffs({
      db,
      filters,
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cutoffs/engineering/meta
 * Fetches filter metadata for engineering cutoffs.
 */
router.get('/engineering/meta', async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(503).json({ 
        error: 'Database connection not ready. Please try again in a moment.' 
      });
    }

    const filters = {
      authority: req.query.authority
    };

    const result = await getEngineeringCutoffFilterMeta({ db, filters });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;