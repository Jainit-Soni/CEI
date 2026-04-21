const express = require('express');
const router = express.Router();
const dataStore = require('../services/dataStore');
const identityResolver = require('../lib/identityResolver');

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

    // 1. Process Placements
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
            auditMetadata: { 
                matchBasis: tr._matchBasis, 
                rawIdentity: tr._rawIdentity,
                sourceFamily: tr._sourceFamily 
            }
        });
    });

    // 2. Process Fees
    (truthIndex.fees || []).forEach(tr => {
        const rawFee = tr.totalFee || tr.tuition;
        items.push({
            displayLabel: 'Fee Structure (Verified)',
            value: `${formatValue(rawFee, 'currency')} (${tr.session || '2024-25'})`,
            rawValue: rawFee,
            confidence: 0.95,
            source: { title: tr.source, type: 'official_fee_structure' },
            auditMetadata: { 
                matchBasis: tr._matchBasis, 
                rawIdentity: tr._rawIdentity,
                sourceFamily: tr._sourceFamily
            }
        });
    });

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
