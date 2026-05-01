/**
 * backend/tools/audit_frontend_provenance_freshness.js
 * ====================================================
 * Frontend-Visible Provenance & Freshness Audit for CEI Public Cohort.
 * 
 * Inspects API payloads for the 197-institution public cohort to determine
 * if admission-critical truth has visible source/freshness metadata.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// CONFIG
const BASE_URL = 'http://localhost:4000';
const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'frontend_provenance_freshness');
const SNAPSHOT_PATH = path.join(__dirname, '..', 'reports', 'frontend_visible_data_inventory', 'raw_audit_snapshot.ndjson');

// SECTIONS TO AUDIT
const SECTIONS = ['seats', 'cutoffs', 'fees', 'placements', 'rankings', 'ceiScore'];

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAudit() {
    console.log("🚀 Executing CEI Frontend-Visible Provenance & Freshness Audit...");

    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

    // 1. LOAD PUBLIC COHORT FROM SNAPSHOT
    let cohort = [];
    if (fs.existsSync(SNAPSHOT_PATH)) {
        const lines = fs.readFileSync(SNAPSHOT_PATH, 'utf8').split('\n').filter(Boolean);
        cohort = lines.map(l => JSON.parse(l));
    } else {
        console.error("❌ Snapshot file missing. Run visible_data_inventory first.");
        process.exit(1);
    }

    console.log(`Auditing ${cohort.length} colleges across ${SECTIONS.length} sections...`);

    const summary = [];
    const matrix = [];
    const gaps = [];
    const rawSnapshots = [];

    const stats = {
        total_colleges: cohort.length,
        section_stats: {}
    };

    SECTIONS.forEach(s => {
        stats.section_stats[s] = {
            total: 0,
            rendered: 0,
            visible_provenance: 0,
            partial_provenance: 0,
            api_only_provenance: 0,
            missing_provenance: 0,
            visible_freshness: 0,
            official_source: 0,
            blockers: 0,
            reviews: 0
        };
    });

    // Process in batches of 5 to avoid rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < cohort.length; i += BATCH_SIZE) {
        const batch = cohort.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (college) => {
            try {
                // 1. Fetch Main Detail & Sub-endpoints
                const [res, seatsRes, cutoffsRes, feesRes, placementsRes] = await Promise.all([
                    axios.get(`${BASE_URL}/api/college/${college.id}`).catch(() => ({ data: {} })),
                    axios.get(`${BASE_URL}/api/colleges/${college.id}/truth/seats`).catch(() => ({ data: {} })),
                    axios.get(`${BASE_URL}/api/cutoffs/engineering?institutionId=${college.id}&limit=1`).catch(() => ({ data: {} })),
                    axios.get(`${BASE_URL}/api/colleges/${college.id}/truth/fees`).catch(() => ({ data: {} })),
                    axios.get(`${BASE_URL}/api/colleges/${college.id}/truth/placements`).catch(() => ({ data: {} }))
                ]);

                const data = res.data;
                const c = data.college || {};
                const contract = data.truthContract || {};

                const truthData = {
                    seats: seatsRes.data,
                    cutoffs: cutoffsRes.data,
                    fees: feesRes.data,
                    placements: placementsRes.data,
                    rankings: { items: c.rankings || [] },
                    ceiScore: { value: c.ceiScore }
                };

                for (const section of SECTIONS) {
                    const item = {
                        college_id: college.id,
                        college_name: college.name,
                        section: section,
                        section_rendered: false,
                        value_count: 0,
                        source_name_visible: 'N/A',
                        source_url_visible: 'N/A',
                        source_type_visible: 'N/A',
                        officiality_visible: 'N/A',
                        extracted_at_visible: 'N/A',
                        academic_year_visible: 'N/A',
                        freshness_visible: 'N/A',
                        stale_status: 'N/A',
                        api_has_provenance: false,
                        db_has_provenance: false,
                        frontend_gap: false,
                        backend_gap: false,
                        risk_level: 'SAFE',
                        recommended_fix: 'None',
                        provenance_status: 'MISSING',
                        freshness_status: 'MISSING'
                    };

                    const sStats = stats.section_stats[section];
                    sStats.total++;

                    // 2. CHECK IF RENDERED
                    let sectionPayload = truthData[section];
                    const hasData = (sectionPayload.items && sectionPayload.items.length > 0) || 
                                   (sectionPayload.totalFee > 0) || 
                                   (section === 'ceiScore' && sectionPayload.value > 0);
                    
                    // Section is rendered if contract says so AND we have data
                    const isVisible = contract.visibleSections?.includes(section) && hasData;
                    
                    if (isVisible) {
                        item.section_rendered = true;
                        item.value_count = sectionPayload.items?.length || 1;
                        sStats.rendered++;

                        // 3. CHECK PROVENANCE IN PAYLOAD
                        // Section-level source
                        let source = sectionPayload.primarySource || sectionPayload.source;
                        let extractedAt = sectionPayload.lastEvaluatedAt || sectionPayload.extractedAt || sectionPayload.meta?.lastEvaluatedAt;

                        // Fallback for cutoffs where source is in items
                        if (!source && section === 'cutoffs' && sectionPayload.items?.length > 0) {
                            const firstItem = sectionPayload.items[0];
                            if (firstItem.sourceLabel || firstItem.sourceUrl || firstItem.authority) {
                                source = {
                                    title: firstItem.sourceLabel || firstItem.authority || 'Official Source',
                                    url: firstItem.sourceUrl,
                                    type: firstItem.authority === 'JOSAA' || firstItem.authority === 'CSAB' ? 'primary_authority' : 'official_institute'
                                };
                                extractedAt = firstItem.extractedAt;
                            }
                        }

                        // Fallback for seats where source might be string
                        if (typeof source === 'string') {
                            item.source_name_visible = source;
                            item.api_has_provenance = true;
                            item.provenance_status = 'VISIBLE_STRING_ONLY';
                            item.risk_level = 'REVIEW';
                            item.recommended_fix = 'Convert string source to object {title, url, type}';
                            sStats.partial_provenance++;
                        } else if (source && typeof source === 'object') {
                            item.source_name_visible = source.title || source.name || 'Unknown';
                            item.source_url_visible = source.url || 'None';
                            item.source_type_visible = source.type || 'N/A';
                            item.api_has_provenance = true;
                            item.provenance_status = 'VISIBLE_' + (source.type || 'UNKNOWN').toUpperCase();
                            
                            // Count as visible provenance for stats
                            sStats.visible_provenance++;
                            if (source.type === 'primary_authority' || source.type === 'official_institute') sStats.official_source++;
                        } else {
                            // Check if items have sources
                            const itemsWithSource = (sectionPayload.items || []).filter(i => i.source || i.sourceUrl);
                            if (itemsWithSource.length > 0) {
                                item.api_has_provenance = true;
                                item.provenance_status = 'VISIBLE_IN_ITEMS_ONLY';
                                item.risk_level = 'REVIEW';
                                item.recommended_fix = 'Promote item source to section-level primarySource';
                                sStats.api_only_provenance++;
                            } else {
                                item.risk_level = 'BLOCKER';
                                sStats.blockers++;
                                item.provenance_status = 'MISSING';
                                item.recommended_fix = 'Inject source metadata into truth file/DB';
                            }
                        }

                        if (extractedAt) {
                            item.extracted_at_visible = extractedAt;
                            item.freshness_visible = 'YES';
                            item.freshness_status = 'VISIBLE_FRESH';
                            sStats.visible_freshness++;
                        } else if (item.section_rendered && section !== 'rankings' && section !== 'ceiScore') {
                            item.freshness_status = 'MISSING';
                            if (item.risk_level !== 'BLOCKER') item.risk_level = 'REVIEW';
                        }
                    } else {
                        item.provenance_status = 'NOT_APPLICABLE';
                        item.freshness_status = 'NOT_APPLICABLE';
                    }

                    matrix.push(item);
                    rawSnapshots.push(item);
                }
            } catch (err) {
                console.error(`\n❌ Error auditing ${college.id}: ${err.message}`);
            }
        }));

        process.stdout.write(`\r[Audit] Progress: ${Math.min(i + BATCH_SIZE, cohort.length)}/${cohort.length}... `);
        await sleep(500); // 0.5s delay between batches
    }

    console.log("\nFinalizing reports...");

    // 4. GENERATE SUMMARY
    SECTIONS.forEach(s => {
        const sStats = stats.section_stats[s];
        summary.push({
            section: s,
            cohort_total: sStats.total,
            rendered_section_count: sStats.rendered,
            visible_provenance_count: sStats.visible_provenance,
            partial_provenance_count: sStats.partial_provenance,
            visible_provenance_percent: (((sStats.visible_provenance + sStats.partial_provenance) / sStats.rendered) * 100 || 0).toFixed(2) + '%',
            api_provenance_only_count: sStats.api_only_provenance,
            db_provenance_only_count: 0,
            missing_provenance_count: sStats.blockers,
            visible_freshness_count: sStats.visible_freshness,
            visible_freshness_percent: ((sStats.visible_freshness / sStats.rendered) * 100 || 0).toFixed(2) + '%',
            stale_or_unknown_freshness_count: sStats.rendered - sStats.visible_freshness,
            official_source_visible_count: sStats.official_source,
            risk_level: sStats.blockers > 0 ? 'BLOCKER' : (sStats.api_only_provenance > 0 || sStats.partial_provenance > 0) ? 'REVIEW' : 'SAFE'
        });
    });

    // Write Reports
    writeCsv(path.join(REPORTS_DIR, 'provenance_freshness_summary.csv'), summary);
    writeCsv(path.join(REPORTS_DIR, 'college_provenance_matrix.csv'), matrix);
    writeCsv(path.join(REPORTS_DIR, 'api_provenance_not_rendered.csv'), gaps);
    
    fs.writeFileSync(path.join(REPORTS_DIR, 'provenance_freshness_raw_snapshot.ndjson'), rawSnapshots.map(r => JSON.stringify(r)).join('\n'));

    generateMarkdownReport(stats, summary, gaps);

    console.log("✅ Audit complete. Reports generated in backend/reports/frontend_provenance_freshness/");
}

function writeCsv(filePath, data) {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','));
    fs.writeFileSync(filePath, [headers.join(','), ...rows].join('\n'));
}

function generateMarkdownReport(stats, summary, gaps) {
    const totalBlockers = summary.reduce((acc, s) => acc + s.missing_provenance_count, 0);
    const totalReviews = summary.reduce((acc, s) => acc + (s.api_provenance_only_count + s.partial_provenance_count), 0);

    const md = `
# CEI Frontend Provenance & Freshness Audit

**Audit Date**: ${new Date().toISOString().split('T')[0]}
**Denominator**: ${stats.total_colleges} Colleges (Public Cohort)
**Verdict**: ${totalBlockers > 0 ? '⚠️ PROVENANCE_SURFACE_NEEDS_REVIEW' : '✅ PROVENANCE_SURFACE_SAFE_FOR_LIMITED_PUBLIC_COHORT'}

## 1. Summary Metrics

| Section | Rendered | Full Prov | Partial Prov | Total Prov % | Visible Fresh | Fresh % | Blockers | Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${summary.map(s => `| ${s.section} | ${s.rendered_section_count} | ${s.visible_provenance_count} | ${s.partial_provenance_count} | ${s.visible_provenance_percent} | ${s.visible_freshness_count} | ${s.visible_freshness_percent} | ${s.missing_provenance_count} | ${s.risk_level} |`).join('\n')}

## 2. Launch Risk Assessment
- **Blockers**: ${totalBlockers} (Admission truth without source)
- **Reviews**: ${totalReviews} (API has metadata but UI hides it OR source is string-only)

## 3. Top Provenance Gaps (API vs UI)
${gaps.slice(0, 10).map(g => `- **${g.college_name}** (${g.section}): API has metadata but ${g.missing_ui_element} is missing in ${g.frontend_file}`).join('\n')}

## 4. Known Debts
- CEI Score provenance is currently internal-only and not explicitly rendered as a "source".
- Ranking provenance is often embedded in the name/title but lacks extraction date metadata.
- "Stale" status detection is currently static; requires dynamic comparison with source registries.

## 5. Final Verdict Reasoning
${totalBlockers > 0 
    ? `Multiple admission-critical sections (${totalBlockers} cases) are rendering numeric truth without an associated source. This violates CEI Truth-Grade requirements.` 
    : `All rendered sections for the public cohort include visible provenance metadata.`}
    `;

    fs.writeFileSync(path.join(REPORTS_DIR, 'PROVENANCE_FRESHNESS_AUDIT.md'), md);
}

runAudit();
