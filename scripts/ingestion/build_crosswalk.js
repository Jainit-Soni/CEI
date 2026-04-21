const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'backend/.env.local' });

const BACKEND_DIR = path.join(__dirname, '..', '..', 'backend');
const DATA_DIR = path.join(BACKEND_DIR, 'data');
const TRUTH_DIR = path.join(DATA_DIR, 'truth');
const MAPPINGS_DIR = path.join(DATA_DIR, 'mappings');

if (!fs.existsSync(MAPPINGS_DIR)) fs.mkdirSync(MAPPINGS_DIR, { recursive: true });

function normStr(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractDomain(url) {
    if (!url) return '';
    try {
        let clean = url.toLowerCase().trim();
        if (!clean.startsWith('http')) clean = 'http://' + clean;
        const u = new URL(clean);
        return u.hostname.replace(/^www\./, '');
    } catch {
       return '';
    }
}

function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i=0; i<line.length; i++) {
        const c = line[i];
        if (c === '"') { inQuotes = !inQuotes; }
        else if (c === ',' && !inQuotes) { result.push(cur); cur=''; }
        else { cur += c; }
    }
    result.push(cur);
    return result;
}

// Try to resolve ambiguous name matches using a domain corroborator
// Returns matched cId or null
function resolveByDomainCorroboration(nameCands, sDomain) {
    if (!sDomain || sDomain.length < 5) return null;
    const domainMatches = nameCands.filter(c => c.domain && c.domain === sDomain);
    if (domainMatches.length === 1) return domainMatches[0].cId;
    return null;
}

// Try to resolve ambiguous name matches using geographic match alone
// Only safe if exactly ONE candidate matches the state+city pair
function resolveByGeoAmongCandidates(nameCands, sState, sCity) {
    if (!sState && !sCity) return null;
    const geoMatches = nameCands.filter(c => {
        const stMatch = sState && c.state && sState === c.state;
        const cityMatch = sCity && c.city && sCity === c.city;
        return stMatch && cityMatch; // REQUIRE BOTH to be safe with ambiguous names
    });
    if (geoMatches.length === 1) return geoMatches[0].cId;
    return null;
}

async function buildCrosswalk() {
    console.log("[Crosswalk] Booting Identity Crosswalk Engine v3 (Phase 4)...");
    
    // 1. Fetch AICTE Cohort from MongoDB
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('cei_v2');
    const aicteDocs = await db.collection('institutions').find({}).toArray();
    await client.close();

    console.log(`[Crosswalk] Loaded ${aicteDocs.length} AICTE Base Catalog Records.`);

    // Build multi-index for fast deterministic matching
    const aicteByName   = new Map(); // normName → [{cId, name, state, city, domain}]
    const aicteByDomain = new Map(); // domain → [{cId, name}]

    aicteDocs.forEach(c => {
        const cId = c.institution_id || c.id || String(c._id);
        const nm = normStr(c.institution_name);
        if (nm) {
            if (!aicteByName.has(nm)) aicteByName.set(nm, []);
            aicteByName.get(nm).push({
                cId,
                name: c.institution_name,
                state: normStr(c.state_name || c.state),
                city: normStr(c.district || c.city),
                domain: extractDomain(c.website || c.source_page_url)
            });
        }
        const dom = extractDomain(c.website || c.source_page_url);
        if (dom && dom.length > 4) {
            if (!aicteByDomain.has(dom)) aicteByDomain.set(dom, []);
            aicteByDomain.get(dom).push({ cId, name: c.institution_name });
        }
    });

    // Phase 4: Load aicte_domains enrichment to populate aicteByDomain
    const domainsPath = path.join(MAPPINGS_DIR, 'aicte_domains.ndjson');
    if (fs.existsSync(domainsPath)) {
        fs.readFileSync(domainsPath, 'utf8').split('\n').filter(Boolean).forEach(line => {
            try {
                const d = JSON.parse(line);
                if (d.domain && d.aicteId) {
                    if (!aicteByDomain.has(d.domain)) aicteByDomain.set(d.domain, []);
                    // Only add if not already present
                    const existing = aicteByDomain.get(d.domain);
                    if (!existing.find(e => e.cId === d.aicteId)) {
                        existing.push({ cId: d.aicteId, name: '', fromEnrichment: true });
                    }
                }
            } catch {}
        });
        console.log(`[Crosswalk] Domain index size after enrichment: ${aicteByDomain.size}`);
    }

    // Phase 4: Build websites_truth domain→C-code index for ambiguous tiebreaking
    const websitesDomainToCode = new Map(); // domain → aisheCode
    const websitesPath = path.join(TRUTH_DIR, 'websites_truth.ndjson');
    if (fs.existsSync(websitesPath)) {
        fs.readFileSync(websitesPath, 'utf8').split('\n').filter(Boolean).forEach(line => {
            try {
                const d = JSON.parse(line);
                const dom = extractDomain(d.website);
                const code = d.id || d.collegeId;
                if (dom && code) websitesDomainToCode.set(dom, code);
            } catch {}
        });
        console.log(`[Crosswalk] websites_truth domain→code index: ${websitesDomainToCode.size} entries`);
    }

    // 2. Load Identity-Rich Sources (Phase 3 Source Policy)
    const identitySources = [];
    
    // A. AISHE CSV Masters (colleges + universities + standalone)
    const aisheFiles = ['aishe_colleges.csv', 'aishe_university.csv', 'aishe_standalone.csv'];
    for (const file of aisheFiles) {
        const aishePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(aishePath)) continue;
        const lines = fs.readFileSync(aishePath, 'utf8').split('\n');
        // Header is on line index 2 (rows 0-1 are title/subtitle)
        for (let i = 3; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = parseCSVLine(lines[i]);
            if (cols.length >= 5 && cols[0] && cols[0].match(/^[CU]-\d+/)) {
                identitySources.push({
                    id: cols[0].trim(),
                    name: cols[1].trim(),
                    state: cols[2].trim(),
                    city: cols[3].trim(),
                    domain: extractDomain(cols[4].trim()),
                    source: file,
                    priority: 1 // AISHE master is highest priority
                });
            }
        }
    }

    // B. Websites Truth NDJSON (enriched domain data keyed by AISHE code)
    const websitesPath = path.join(TRUTH_DIR, 'websites_truth.ndjson');
    if (fs.existsSync(websitesPath)) {
        const lines = fs.readFileSync(websitesPath, 'utf8').split('\n');
        lines.forEach(line => {
            if (!line.trim()) return;
            try {
                const d = JSON.parse(line);
                const id = d.id || d.collegeId;
                if (!id) return;
                // Only use as an identity source if it has a verified domain
                if (!d.website) return;
                identitySources.push({
                    id,
                    name: d.name,
                    domain: extractDomain(d.website),
                    state: d.state || '',
                    city: d.city || '',
                    source: 'websites_truth.ndjson',
                    priority: 2 // Websites truth is secondary
                });
            } catch {}
        });
    }

    // Sort so that higher priority (lower number) sources are processed first
    identitySources.sort((a, b) => (a.priority || 9) - (b.priority || 9));

    console.log(`[Crosswalk] Loaded ${identitySources.length} Identity Signals from ${aisheFiles.length + 1} sources.`);

    // 3. Resolve Mappings (Strict Deterministic Only)
    const resolvedCrosswalk = new Map(); // sourceId → canonicalCrosswalkRow
    const manualReviewQueue  = [];
    const unresolvedLog      = [];
    
    const stats = {
        mappedDomain:    0,
        mappedNameGeog:   0,
        mappedAmbigDom:   0, // Ambiguous name resolved by domain in aicteByDomain
        mappedAmbigWebDom: 0, // Ambiguous name resolved by websites_truth domain tiebreaker
        mappedAmbigGeo:   0, // Ambiguous name resolved by strict city+state
        ambiguous:        0,
        unresolved:       0
    };

    identitySources.forEach(s => {
        if (!s.id) return;
        if (resolvedCrosswalk.has(s.id)) return; // Earlier source already resolved this

        let mappedCid    = null;
        let mappingMethod = '';

        // ─── Strategy A: Exact Domain Match (strongest non-name signal) ───────────
        if (!mappedCid && s.domain && s.domain.length > 4) {
            const domCands = aicteByDomain.get(s.domain);
            if (domCands && domCands.length === 1) {
                mappedCid     = domCands[0].cId;
                mappingMethod = 'exact_domain';
            }
        }

        // ─── Strategy B: Exact Name + Geography ───────────────────────────────────
        if (!mappedCid && s.name) {
            const nm       = normStr(s.name);
            const nameCands = aicteByName.get(nm);

            if (nameCands) {
                const sState = normStr(s.state);
                const sCity  = normStr(s.city);

                if (nameCands.length === 1) {
                    // Unique name — require at least state OR city corroboration
                    const c = nameCands[0];
                    if (sState && sState === c.state) {
                        mappedCid     = c.cId;
                        mappingMethod = 'exact_name_state';
                    } else if (sCity && sCity === c.city) {
                        mappedCid     = c.cId;
                        mappingMethod = 'exact_name_city';
                    } else if (!sState && !sCity) {
                        // Sparse row — cannot corroborate
                        unresolvedLog.push({ id: s.id, name: s.name, reason: 'unique_name_no_geography' });
                        stats.unresolved++;
                        return;
                    }
                    // If geography doesn't match at all → fall to unresolved
                    if (!mappedCid) {
                        unresolvedLog.push({ id: s.id, name: s.name, reason: 'unique_name_geography_mismatch' });
                        stats.unresolved++;
                        return;
                    }

                    } else {
                        // ── Sub-strategy 1: Try domain corroboration in aicteByDomain ──
                        const domResolved = resolveByDomainCorroboration(nameCands, s.domain);
                        if (domResolved) {
                            mappedCid     = domResolved;
                            mappingMethod = 'ambiguous_name_domain_corroborated';
                            stats.mappedAmbigDom++;
                        } else {
                            // ── Sub-strategy 2: websites_truth domain → C-code → identity confirm ──
                            // The AISHE source has a domain. If websites_truth maps that domain to the 
                            // SAME C-code as the source entry, we know which institution this is.
                            // That C-code IS the institution — the AICTE candidates are the wrong set.
                            // BUT: if we haven't mapped that C-code yet (it's in the ambiguous queue),
                            // check if the C-code from websites_truth (by domain) IS the source ID itself.
                            // If yes → this source's ambiguous name problem is a naming collision in AICTE
                            // that does not affect this institution's identity (it IS C-XXXXX).
                            // We resolve by domain: find which AICTE candidate shares this domain via enrichment.
                            if (s.domain && websitesDomainToCode.has(s.domain)) {
                                const wtCode = websitesDomainToCode.get(s.domain);
                                if (wtCode === s.id) {
                                    // websites_truth confirms this domain belongs to THIS C-code (same as source)
                                    // Now find an AICTE candidate that also has THIS domain in aicteByDomain
                                    const enrichedDomCands = aicteByDomain.get(s.domain);
                                    if (enrichedDomCands && enrichedDomCands.length === 1) {
                                        mappedCid     = enrichedDomCands[0].cId;
                                        mappingMethod = 'ambiguous_name_websites_truth_domain';
                                    }
                                }
                            }

                            if (!mappedCid) {
                                // ── Sub-strategy 3: Try strict city+state ──
                                const geoResolved = resolveByGeoAmongCandidates(nameCands, sState, sCity);
                                if (geoResolved) {
                                    mappedCid     = geoResolved;
                                    mappingMethod = 'ambiguous_name_city_state_corroborated';
                                    stats.mappedAmbigGeo++;
                                } else {
                                    // Genuinely ambiguous — queue for human review
                                    stats.ambiguous++;
                                    manualReviewQueue.push({
                                        cause: 'ambiguous_name',
                                        sourceObj: s,
                                        candidates: nameCands.map(c => ({ cId: c.cId, name: c.name, state: c.state, city: c.city }))
                                    });
                                    return;
                                }
                            }
                        }
                    }
            }
        }

        if (mappedCid) {
            if (mappingMethod === 'exact_domain')                              stats.mappedDomain++;
            else if (mappingMethod.startsWith('exact_name'))                   stats.mappedNameGeog++;
            else if (mappingMethod === 'ambiguous_name_websites_truth_domain') stats.mappedAmbigWebDom++;
            else if (mappingMethod === 'ambiguous_name_domain_corroborated')   stats.mappedAmbigDom++;
            
            resolvedCrosswalk.set(s.id, {
                canonicalCatalogId: mappedCid,
                aisheCode:          s.id.match(/^[CU]-\d+/) ? s.id : null,
                stableKey:          s.id,
                normalizedName:     normStr(s.name),
                city:               s.city,
                state:              s.state,
                officialWebsiteDomain: s.domain,
                mappingMethod,
                mappingConfidence:  'deterministic',
                reviewed:           false,
                evidence:           [s.source]
            });
        } else {
            unresolvedLog.push({ id: s.id, name: s.name, reason: 'no_strategy_matched' });
            stats.unresolved++;
        }
    });

    const totalMapped = stats.mappedDomain + stats.mappedNameGeog + stats.mappedAmbigDom + stats.mappedAmbigWebDom + stats.mappedAmbigGeo;
    console.log('[Crosswalk] Resolution Complete.');
    console.log(`  Exact Domain:                ${stats.mappedDomain}`);
    console.log(`  Exact Name+Geography:        ${stats.mappedNameGeog}`);
    console.log(`  Ambig→Domain (enriched):     ${stats.mappedAmbigDom}`);
    console.log(`  Ambig→websites_truth domain: ${stats.mappedAmbigWebDom}`);
    console.log(`  Ambig→City+State:            ${stats.mappedAmbigGeo}`);
    console.log(`  Total Safely Mapped:         ${totalMapped}`);
    console.log(`  Ambiguous (queued):          ${stats.ambiguous}`);
    console.log(`  Unresolved:                  ${stats.unresolved}`);

    // 4. Write outputs
    const crosswalkOutput = Array.from(resolvedCrosswalk.values()).map(r => JSON.stringify(r)).join('\n');
    fs.writeFileSync(path.join(MAPPINGS_DIR, 'institution_crosswalk.ndjson'), crosswalkOutput);
    fs.writeFileSync(path.join(MAPPINGS_DIR, 'manual_review_queue.json'),     JSON.stringify(manualReviewQueue, null, 2));
    fs.writeFileSync(path.join(MAPPINGS_DIR, 'unresolved_log.json'),          JSON.stringify(unresolvedLog.slice(0, 500), null, 2));
    fs.writeFileSync(path.join(MAPPINGS_DIR, 'phase4_crosswalk_stats.json'),  JSON.stringify({ ...stats, totalMapped }));

    console.log("[Crosswalk] Artifacts written to backend/data/mappings/");
    return { totalMapped, stats };
}

buildCrosswalk().catch(console.error);
