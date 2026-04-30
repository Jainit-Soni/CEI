const express = require('express');
const router = express.Router();
const dataStore = require('../services/dataStore');
const identityResolver = require('../lib/identityResolver');
const seatCutoffBridge = require('../services/seatCutoffBridge');


// --- E2E Identity Hardened Routes (V12 Fix) ---

router.get("/colleges/:id/truth/compliance", async (req, res) => {
  try {
    const { id } = req.params;
    const resolvedId = identityResolver.resolveId(id);
    let college = resolvedId ? await dataStore.getCollegeById(resolvedId) : null;
    
    if (!college) return res.status(404).json({ error: "Institution not found" });

    // Canonical Truth Lookup (V12.1 Structured)
    const truthIndex = (global.truthByCid || new Map()).get(resolvedId) || {};
    const items = [];
    
    // Scaling Helper (INR to LPA)
    const formatValue = (val, type) => {
        const n = parseFloat(val);
        if (isNaN(n)) return 'Data Unavailable';
        if (type === 'lpa') {
            const lpa = n > 1000 ? (n / 100000) : n;
            return `${lpa.toFixed(2)} LPA`;
        }
        if (type === 'currency') {
            return `₹${n.toLocaleString('en-IN')}`;
        }
        return val;
    };


    // 1. Process Placements (from truthIndex first, then institution doc fallback)
    (truthIndex.placements || []).forEach(tr => {
        const rawAvg = tr.averagePackage || tr.avgPackage || tr.medianSalary;
        const avg = formatValue(rawAvg, 'lpa');
        const high = formatValue(tr.highestPackage, 'lpa');
        items.push({
            displayLabel: 'Placement Data (Verified)',
            value: `${avg} (Avg) / ${high} (High)`,
            rawValue: rawAvg,
            confidence: 0.95,
            source: { title: tr.source, type: 'institutional_audit' },
            auditMetadata: { matchBasis: tr._matchBasis, rawIdentity: tr._rawIdentity, sourceFamily: tr._sourceFamily }
        });
    });

    // Fallback: college document placements (EXISTS_IN_DB_NOT_SURFACED recovery)
    if (items.filter(i => i.displayLabel === 'Placement Data (Verified)').length === 0 && college.placements) {
        const p = college.placements;
        const rawAvg = p.averagePackageNumeric || p.medianSalary || (typeof p.averagePackage === 'number' ? p.averagePackage : null);
        const rawHigh = p.highestPackageNumeric || (typeof p.highestPackage === 'number' ? p.highestPackage : null);
        const avgStr = p.averagePackage || (rawAvg ? formatValue(rawAvg, 'lpa') : null);
        const highStr = p.highestPackage || (rawHigh ? formatValue(rawHigh, 'lpa') : null);
        if (avgStr || highStr) {
            items.push({
                displayLabel: 'Placement Data (Verified)',
                value: `${avgStr || 'Data Unavailable'} (Avg) / ${highStr || 'Data Unavailable'} (High)`,
                confidence: 0.90,
                source: { title: 'Institution Record (CEI Core)', type: 'institutional_record' },
                auditMetadata: { matchBasis: 'institution_document', sourceFamily: 'db_institution' }
            });
        }
    }

    // 2. Process Fees (from truthIndex first, then institution doc fallback)
    (truthIndex.fees || []).forEach(tr => {
        const rawFee = tr.totalFee || tr.tuition;
        items.push({
            displayLabel: 'Fee Structure (Verified)',
            value: `${formatValue(rawFee, 'currency')} (${tr.session || '2024-25'})`,
            rawValue: rawFee,
            confidence: 0.95,
            source: { title: tr.source, type: 'official_fee_structure' },
            auditMetadata: { matchBasis: tr._matchBasis, rawIdentity: tr._rawIdentity, sourceFamily: tr._sourceFamily }
        });
    });

    // Fallback: college document fees (EXISTS_IN_DB_NOT_SURFACED recovery)
    if (items.filter(i => i.displayLabel === 'Fee Structure (Verified)').length === 0 && college.fees) {
        const rawFee = college.fees.total
            ? null  // already formatted — skip, handled by truthIndex
            : (college.fees.totalNumeric || college.fees.tuition || college.fees.total);
        if (rawFee) {
            items.push({
                displayLabel: 'Fee Structure (Verified)',
                value: `${formatValue(rawFee, 'currency')} (${'2024-25'})`,
                rawValue: rawFee,
                confidence: 0.90,
                source: { title: 'Institution Record (CEI Core)', type: 'official_fee_structure' },
                auditMetadata: { matchBasis: 'institution_document', sourceFamily: 'db_institution' }
            });
        }
    }

    // 2b. Rankings from institution doc (fallback for institutions with embedded rankings but no separate NIRF binding)
    const rankingsInItems = items.filter(i => i.displayLabel && i.displayLabel.includes('Ranking'));
    if (rankingsInItems.length === 0 && college.rankings && college.rankings.length > 0) {
        college.rankings.forEach(r => {
            items.push({
                displayLabel: `Rankings (${r.source || 'NIRF'})`,
                value: `Rank ${r.rank} — ${r.category || 'Engineering'} (${r.year || 'Latest'})`,
                confidence: 0.90,
                source: { title: `${r.source || 'NIRF'} Rankings`, type: 'official_ranking' },
                auditMetadata: { matchBasis: 'institution_document', sourceFamily: 'db_institution' }
            });
        });
    }

    // Check benchmarks
    const stateKey = college.state ? college.state.toLowerCase() : null;
    const benchmark = stateKey ? (global.stateBenchmarks || new Map()).get(stateKey) : null;
    if (benchmark) {
      items.push({
        displayLabel: 'Regional Pupil-Teacher Ratio (Benchmark)',
        value: `1:${Math.round(benchmark.ptr)}`,
        confidence: 0.85,
        source: { title: benchmark.source, type: 'government_aggregate' }
      });
    }
    
    // 3. Process Seats & Cutoffs (V12.2 Bridge)
    const bridgeData = await seatCutoffBridge.getSeatsAndCutoffsForCollege(resolvedId);
    if (bridgeData) {
        const bridgeItems = seatCutoffBridge.normalizeComplianceItems(bridgeData);
        items.push(...bridgeItems);
    }

    res.json({
      canonicalId: resolvedId,
      sectionStatus: items.length > 0 ? 'available' : 'official_data_unavailable',
      freshnessStatus: 'official_report',
      items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/college/:id/benchmarks", async (req, res) => {
    try {
        const { id } = req.params;
        const resolvedId = identityResolver.resolveId(id);
        let college = resolvedId ? await dataStore.getCollegeById(resolvedId) : null;
        
        if (!college) return res.status(404).json({ error: "College intelligence not found" });

        const state = college.state;
        const band = college.competitivenessBand || college.rankingTier || "Standard";

        const stateColleges = (global.colleges || []).filter(c => c.state === state && c.ceiScore);
        const stateAvg = stateColleges.length > 0 ? stateColleges.reduce((acc, c) => acc + (c.ceiScore || 0), 0) / stateColleges.length : 60;
        
        const bandColleges = (global.colleges || []).filter(c => (c.competitivenessBand === band || c.rankingTier === band) && c.ceiScore);
        const bandAvg = bandColleges.length > 0 ? bandColleges.reduce((acc, c) => acc + (c.ceiScore || 0), 0) / bandColleges.length : 70;

        res.json({
            success: true,
            metadata: { state: state || "National", band: band },
            stateBenchmarks: { ceiScore: Math.round(stateAvg) },
            tierBenchmarks: { ceiScore: Math.round(bandAvg) }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
