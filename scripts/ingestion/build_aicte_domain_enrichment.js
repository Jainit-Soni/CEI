/**
 * scripts/ingestion/build_aicte_domain_enrichment.js
 * ====================================================
 * Phase 4: Compose AICTE domain data from local authoritative sources.
 *
 * NO web scraping. NO AICTE portal access. NO mutations to Mongo.
 *
 * Sources (in priority order):
 *   1. institution_crosswalk.ndjson — already-resolved rows carry AISHE domain
 *   2. websites_truth.ndjson        — AISHE C-code → verified domain registry
 *
 * Output:
 *   backend/data/mappings/aicte_domains.ndjson
 *   Each row: { aicteId, domain, aisheCode, source, confidence }
 */

const fs   = require('fs');
const path = require('path');

const BACKEND_DIR  = path.join(__dirname, '..', '..', 'backend');
const DATA_DIR     = path.join(BACKEND_DIR, 'data');
const TRUTH_DIR    = path.join(DATA_DIR, 'truth');
const MAPPINGS_DIR = path.join(DATA_DIR, 'mappings');

function extractDomain(url) {
    if (!url) return '';
    try {
        let clean = url.toLowerCase().trim();
        if (!clean.startsWith('http')) clean = 'http://' + clean;
        const u = new URL(clean);
        return u.hostname.replace(/^www\./, '');
    } catch { return ''; }
}

function main() {
    console.log('[DomainEnrich] Building AICTE Domain Enrichment file...');

    // ── Step 1: Build C-code → canonical AICTE ID map from crosswalk ──────────
    const cwPath = path.join(MAPPINGS_DIR, 'institution_crosswalk.ndjson');
    const cwLines = fs.readFileSync(cwPath, 'utf8').split('\n').filter(Boolean);

    const codeToAicte  = new Map(); // aisheCode / stableKey → aicteId
    const cwDomainRows = [];        // crosswalk rows that carry a domain

    cwLines.forEach(line => {
        try {
            const r = JSON.parse(line);
            if (r.stableKey && r.canonicalCatalogId) {
                codeToAicte.set(r.stableKey, r.canonicalCatalogId);
            }
            if (r.officialWebsiteDomain && r.canonicalCatalogId) {
                cwDomainRows.push({
                    aicteId:   r.canonicalCatalogId,
                    domain:    r.officialWebsiteDomain,
                    aisheCode: r.aisheCode || r.stableKey,
                    source:    'crosswalk_aishe_' + (r.mappingMethod || 'matched'),
                    confidence: 'deterministic'
                });
            }
        } catch {}
    });

    console.log(`[DomainEnrich] Crosswalk: ${cwLines.length} rows, ${cwDomainRows.length} with domains, ${codeToAicte.size} code→aicte mappings`);

    // ── Step 2: websites_truth.ndjson → domain → C-code → AICTE ID ──────────
    const websitesPath   = path.join(TRUTH_DIR, 'websites_truth.ndjson');
    const websitesLines  = fs.readFileSync(websitesPath, 'utf8').split('\n').filter(Boolean);
    const websitesDomRows = [];

    websitesLines.forEach(line => {
        try {
            const d = JSON.parse(line);
            const code   = d.id || d.collegeId;
            const domain = extractDomain(d.website);
            if (!code || !domain) return;

            const aicteId = codeToAicte.get(code);
            if (!aicteId) return; // This AISHE code has no AICTE mapping yet

            websitesDomRows.push({
                aicteId,
                domain,
                aisheCode:  code,
                source:     'websites_truth_aishe_registry',
                confidence: 'deterministic'
            });
        } catch {}
    });

    console.log(`[DomainEnrich] websites_truth: ${websitesDomRows.length} new domain→AICTE pairs`);

    // ── Step 3: Merge, deduplicate (one domain per aicteId, crosswalk wins) ──
    const finalMap = new Map(); // aicteId → domainRow (crosswalk wins over websites)

    // websites first (lower priority), then crosswalk overwrites
    [...websitesDomRows, ...cwDomainRows].forEach(row => {
        if (!finalMap.has(row.aicteId)) {
            finalMap.set(row.aicteId, row);
        } else if (row.source.startsWith('crosswalk_')) {
            // Crosswalk source wins
            finalMap.set(row.aicteId, row);
        }
    });

    // Also build domain → aicteId reverse map to detect domain collisions
    const domainToAicte = new Map();
    const domainCollisions = [];
    finalMap.forEach(row => {
        if (domainToAicte.has(row.domain)) {
            domainCollisions.push({ domain: row.domain, ids: [domainToAicte.get(row.domain), row.aicteId] });
        } else {
            domainToAicte.set(row.domain, row.aicteId);
        }
    });

    console.log(`[DomainEnrich] Total unique AICTE→domain entries: ${finalMap.size}`);
    console.log(`[DomainEnrich] Domain collisions (same domain → 2 AICTE IDs): ${domainCollisions.length}`);
    if (domainCollisions.length > 0) {
        console.log('  Sample:', JSON.stringify(domainCollisions.slice(0, 3)));
    }

    // ── Step 4: Write output ─────────────────────────────────────────────────
    const outputLines = Array.from(finalMap.values()).map(r => JSON.stringify(r));
    fs.writeFileSync(path.join(MAPPINGS_DIR, 'aicte_domains.ndjson'), outputLines.join('\n'));

    // Also write the reverse domain→aicte index for fast lookup
    const reverseIndex = {};
    domainToAicte.forEach((aicteId, domain) => { reverseIndex[domain] = aicteId; });
    fs.writeFileSync(path.join(MAPPINGS_DIR, 'domain_to_aicte_index.json'), JSON.stringify(reverseIndex));

    console.log('[DomainEnrich] Done. Files written to backend/data/mappings/');
    console.log(`  aicte_domains.ndjson        → ${finalMap.size} entries`);
    console.log(`  domain_to_aicte_index.json  → ${domainToAicte.size} unique domains`);

    return { domainsEnriched: finalMap.size, uniqueDomains: domainToAicte.size, collisions: domainCollisions.length };
}

module.exports = { main };

if (require.main === module) {
    main();
}
