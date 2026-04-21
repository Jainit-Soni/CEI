'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { 
  getEngineeringSeatMatrix, 
  getEngineeringSeatMatrixFilterMeta 
} = require('../services/seatMatrixReadService');

const router = express.Router();

/**
 * GET /api/seats/engineering
 * Fetches filtered and paginated engineering seat matrix rows.
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
      institutionId: req.query.institutionId,
      authority: req.query.authority,
      academicYear: req.query.academicYear,
      counsellingYear: req.query.counsellingYear,
      instituteName: req.query.instituteName,
      programName: req.query.programName,
      quotaScopeCanonical: req.query.quotaScopeCanonical,
      quotaScopeLabel: req.query.quotaScopeLabel,
      seatPoolCanonical: req.query.seatPoolCanonical,
      seatPoolLabel: req.query.seatPoolLabel,
      isFemaleOnlyPool: req.query.isFemaleOnlyPool,
      isGenderNeutralPool: req.query.isGenderNeutralPool
    };

    const result = await getEngineeringSeatMatrix({
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
 * GET /api/seats/engineering/meta
 * Fetches filter metadata for the engineering seat matrix.
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

    const result = await getEngineeringSeatMatrixFilterMeta({ db, filters });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
