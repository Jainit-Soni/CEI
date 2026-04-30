const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const REGISTRY_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_registry.json');
const HISTORY_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_registry_history.json');
const CODES_PATH = path.join(__dirname, '..', 'data', 'truth', 'official_code_registry.json');

const IS_TEST = process.argv.includes('--test-fixture');
const IS_STRICT = process.argv.includes('--strict');

function normalize(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(.)\1+/g, '$1');
}

async function validateAndMerge() {
    try {
        let db;
        if (!IS_TEST) {
            console.log('Connecting to MongoDB...');
            await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
            db = mongoose.connection.db;
        }

        console.log(IS_TEST ? '🛠️  Running TEST FIXTURE mode...' : 'Loading Identity Registry...');
        let registry;
        if (IS_TEST) {
            registry = {
                // CASE 1: SAFE (Same name, same state, matching code)
                "CORE-SAFE-1": { canonical_name: "Safe University", state: "Delhi" },
                "CORE-SAFE-2": { canonical_name: "Safe University", state: "Delhi" },
                // CASE 2: BLOCK (Different state)
                "CORE-BLOCK-GEOG-1": { canonical_name: "Block Univ Geog", state: "Delhi" },
                "CORE-BLOCK-GEOG-2": { canonical_name: "Block Univ Geog", state: "Mumbai" },
                // CASE 3: BLOCK (Squashed match only)
                "CORE-BLOCK-SQUASH-1": { canonical_name: "Squash Uni", state: "Delhi" },
                "CORE-BLOCK-SQUASH-2": { canonical_name: "Squashh Uni", state: "Delhi" },
                // CASE 4: NAME VARIANT (Needs code match for HIGH)
                "CORE-NAME-VAR-1": { canonical_name: "IIT Delhi", state: "Delhi", aliases: ["Indian Institute of Technology Delhi"] },
                "CORE-NAME-VAR-2": { canonical_name: "Indian Institute of Technology Delhi", state: "Delhi" },
                // CASE 5: SAME CITY, NO CODE (Collides via identical name)
                "CORE-SAME-CITY-1": { canonical_name: "Ahmedabad University", state: "Gujarat" },
                "CORE-SAME-CITY-2": { canonical_name: "Ahmedabad University", state: "Gujarat" },
                // CASE 6: IIIT vs IIT confusion (Forced collision via identical name)
                "CORE-IIIT-1": { canonical_name: "IIT Dharwad", state: "Karnataka" },
                "CORE-IIT-1": { canonical_name: "IIT Dharwad", state: "Karnataka" }
            };
        } else {
            registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        }

        let codeRegistry = {};
        if (!IS_TEST) {
            console.log('Loading Official Code Registry...');
            codeRegistry = JSON.parse(fs.readFileSync(CODES_PATH, 'utf8'));
        }
        
        const normToIds = {};
        const collisions = [];

        console.log('Scanning for duplicates (Canonical + Aliases)...');
        for (const [id, meta] of Object.entries(registry)) {
            const names = [meta.canonical_name, ...(meta.aliases || [])];
            for (const name of names) {
                const norm = normalize(name);
                if (!normToIds[norm]) normToIds[norm] = new Set();
                normToIds[norm].add(id);
            }
        }

        for (const [norm, ids] of Object.entries(normToIds)) {
            if (ids.size > 1) {
                collisions.push({ norm, ids: Array.from(ids) });
            }
        }

        if (collisions.length === 0 && !IS_TEST) {
            console.log('✅ No duplicate institutions found. Registry is clean.');
            process.exit(0);
        }

        console.log(`🚨 Found ${collisions.length} collision groups.`);

        const safeMerges = [];
        const mergeConflicts = [];
        let mergesCount = 0;
        let aliasesCreated = 0;
        const historyEntries = [];

        const processed = new Set();
        for (const group of collisions) {
            const ids = group.ids.sort((a, b) => a.length - b.length);
            const winnerId = ids[0];
            const loserIds = ids.slice(1);

            if (processed.has(winnerId)) continue;

            const winnerMeta = registry[winnerId];
            
            // Mock DB lookup for Test Mode
            const getMockDoc = (id) => {
                if (id === "CORE-SAFE-1" || id === "CORE-SAFE-2") return { id, state: "Delhi", aishe_code: "S-123" };
                if (id === "CORE-BLOCK-GEOG-1") return { id, state: "Delhi", aicte_id: "A-1" };
                if (id === "CORE-BLOCK-GEOG-2") return { id, state: "Mumbai", aicte_id: "A-2" };
                if (id === "CORE-BLOCK-SQUASH-1") return { id, state: "Delhi" };
                if (id === "CORE-BLOCK-SQUASH-2") return { id, state: "Delhi" };
                if (id === "CORE-NAME-VAR-1") return { id, state: "Delhi", josaa_code: "104" };
                if (id === "CORE-NAME-VAR-2") return { id, state: "Delhi", josaa_code: "104" };
                if (id === "CORE-SAME-CITY-1") return { id, city: "Ahmedabad", state: "Gujarat" };
                if (id === "CORE-SAME-CITY-2") return { id, city: "Ahmedabad", state: "Gujarat" };
                if (id === "CORE-IIIT-1") return { id, state: "Karnataka", josaa_code: "326" };
                if (id === "CORE-IIT-1") return { id, state: "Karnataka", josaa_code: "123" };
                return null;
            };

            const winnerDoc = IS_TEST ? getMockDoc(winnerId) : await db.collection('institutions').findOne({ id: winnerId });

            for (const loserId of loserIds) {
                if (!registry[loserId]) continue;
                
                const loserMeta = registry[loserId];
                const loserDoc = IS_TEST ? getMockDoc(loserId) : await db.collection('institutions').findOne({ id: loserId });

                // --- ELITE MERGE FREEZE (Production Hardening) ---
                const isElite = (winnerId.startsWith('CORE-IIT-') || winnerId.startsWith('CORE-NIT-') || winnerId.startsWith('CORE-IIIT-'));
                
                // --- 3-LAYER CONFIDENCE MODEL ---
                let confidence = 'low';
                let isSafe = false;
                const reasons = [];

                const sameState = (winnerMeta.state && loserMeta.state && winnerMeta.state === loserMeta.state) ||
                                  (winnerDoc?.state && loserDoc?.state && winnerDoc.state === loserDoc.state);
                const sameCity = (winnerDoc?.city && loserDoc?.city && winnerDoc.city.toLowerCase() === loserDoc.city.toLowerCase());

                if (sameState) {
                    const codes = ['josaa_code', 'aishe_code', 'aicte_id'];
                    let codeMatch = false;

                    for (const codeField of codes) {
                        const winnerCode = winnerDoc?.[codeField];
                        const loserCode = loserDoc?.[codeField];
                        if (winnerCode && loserCode && winnerCode === loserCode) {
                            codeMatch = true;
                            reasons.push(`Matching ${codeField}: ${winnerCode}`);
                            break;
                        }
                    }

                    if (codeMatch) {
                        confidence = 'high';
                        isSafe = true;
                    } else if (isElite) {
                        // ELITE FREEZE: IIT/NIT/IIIT MUST have code match even for same city
                        isSafe = false;
                        reasons.push("ELITE_FREEZE: Elite institutions require JoSAA/Official code match");
                    } else if (sameCity) {
                        confidence = 'medium';
                        reasons.push("Geography Match (City + State)");
                        if (!IS_STRICT) isSafe = true;
                        else reasons.push("STRICT_MODE_BLOCKED: Requires Official Code");
                    } else {
                        reasons.push("Geography Partial (State Only), No matching official codes");
                    }
                } else {
                    reasons.push("Different State and Different City");
                }

                if (isSafe) {
                    console.log(`✅ [${confidence.toUpperCase()}] Merge: ${loserId} -> ${winnerId} (${reasons.join(', ')})`);
                    
                    // --- SOURCE-WEIGHTED ALIAS SYSTEM ---
                    if (!winnerMeta.aliases) winnerMeta.aliases = [];
                    
                    const aliasScores = new Map();
                    const registerAlias = (alias, source) => {
                        if (!alias || winnerMeta.canonical_name === alias) return;
                        
                        const weights = { 'josaa': 3, 'aicte': 2, 'nirf': 2, 'manual': 1 };
                        const score = weights[source] || 1;
                        
                        aliasScores.set(alias, (aliasScores.get(alias) || 0) + score);
                    };

                    // Score existing winner aliases
                    winnerMeta.aliases.forEach(a => registerAlias(a, 'manual')); // Default existing to manual weight
                    
                    // Score incoming loser aliases
                    if (winnerMeta.canonical_name !== loserMeta.canonical_name) {
                        registerAlias(loserMeta.canonical_name, 'manual');
                    }
                    if (loserMeta.aliases) {
                        loserMeta.aliases.forEach(a => registerAlias(a, 'manual'));
                    }

                    // Sort by score and keep top 5
                    const sortedAliases = Array.from(aliasScores.entries())
                        .sort((a, b) => b[1] - a[1]);
                    
                    const kept = sortedAliases.slice(0, 5).map(a => a[0]);
                    const pruned = sortedAliases.slice(5).map(a => a[0]);

                    if (pruned.length > 0) {
                        console.warn(`⚠️  ALIAS_PRUNED: Pruned ${pruned.length} low-weight aliases for ${winnerId}`);
                        // Log to violations in a real system (simulated here)
                    }

                    winnerMeta.aliases = kept;
                    aliasesCreated += kept.length;

                    delete registry[loserId];
                    mergesCount++;
                    safeMerges.push({ winnerId, loserId, reasons, confidence });

                    historyEntries.push({
                        institution_id: winnerId,
                        action: "SAFE_MERGE",
                        loser_id: loserId,
                        reasons,
                        confidence,
                        timestamp: new Date()
                    });
                } else {
                    console.warn(`❌ [${confidence.toUpperCase()}] Conflict: ${loserId} vs ${winnerId} (${reasons.join(', ')})`);
                    mergeConflicts.push({ winnerId, loserId, reasons, norm: group.norm, confidence });
                    
                    if (!IS_TEST) {
                        await db.collection('identity_violations').insertOne({
                            type: "merge_conflict",
                            ids: [winnerId, loserId],
                            reasons,
                            confidence,
                            norm: group.norm,
                            timestamp: new Date()
                        });
                    }
                }
            }
            processed.add(winnerId);
        }

        if (mergesCount > 0 && !IS_TEST) {
            console.log(`\nWriting ${mergesCount} merges to registry...`);
            fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
            
            let history = [];
            if (fs.existsSync(HISTORY_PATH)) history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
            history.push(...historyEntries);
            fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
        }

        // Write reports
        const safePath = IS_TEST ? path.join(__dirname, '..', 'data', 'truth', 'test_safe_merges.json') : path.join(__dirname, '..', 'data', 'truth', 'safe_merges.json');
        const conflictPath = IS_TEST ? path.join(__dirname, '..', 'data', 'truth', 'test_merge_conflicts.json') : path.join(__dirname, '..', 'data', 'truth', 'merge_conflicts.json');

        fs.writeFileSync(safePath, JSON.stringify(safeMerges, null, 2));
        fs.writeFileSync(conflictPath, JSON.stringify(mergeConflicts, null, 2));

        if (IS_TEST) {
            console.log(`\n--- TEST RESULTS (STRICT: ${IS_STRICT}) ---`);
            const passCase1 = safeMerges.some(m => m.winnerId === "CORE-SAFE-1" && m.loserId === "CORE-SAFE-2" && m.confidence === 'high');
            const passCase2 = mergeConflicts.some(m => m.winnerId === "CORE-BLOCK-GEOG-1" && m.loserId === "CORE-BLOCK-GEOG-2" && m.reasons.some(r => r.includes("Different State")));
            const passCase3 = mergeConflicts.some(m => m.winnerId === "CORE-BLOCK-SQUASH-1" && m.loserId === "CORE-BLOCK-SQUASH-2" && m.reasons.some(r => r.includes("No matching official codes")));
            const passCase4 = safeMerges.some(m => m.winnerId === "CORE-NAME-VAR-1" && m.loserId === "CORE-NAME-VAR-2" && m.confidence === 'high');
            
            // Case 5 behavior depends on STRICT mode
            let passCase5;
            if (IS_STRICT) {
                passCase5 = mergeConflicts.some(m => m.winnerId === "CORE-SAME-CITY-1" && m.loserId === "CORE-SAME-CITY-2" && m.reasons.some(r => r.includes("STRICT_MODE_BLOCKED")));
            } else {
                passCase5 = safeMerges.some(m => m.winnerId === "CORE-SAME-CITY-1" && m.loserId === "CORE-SAME-CITY-2" && m.confidence === 'medium');
            }

            // Case 6: IIT vs IIIT confusion (They share state, but no city or code)
            const passCase6 = mergeConflicts.some(m => m.winnerId === "CORE-IIT-1" && m.loserId === "CORE-IIIT-1" && m.reasons.some(r => r.includes("Geography Partial")));

            console.log(`CASE 1 (SAFE HIGH):    ${passCase1 ? 'PASS ✅' : 'FAIL ❌'}`);
            console.log(`CASE 2 (GEOG BLOCK):   ${passCase2 ? 'PASS ✅' : 'FAIL ❌'}`);
            console.log(`CASE 3 (SQUASH BLOCK): ${passCase3 ? 'PASS ✅' : 'FAIL ❌'}`);
            console.log(`CASE 4 (NAME VAR):     ${passCase4 ? 'PASS ✅' : 'FAIL ❌'}`);
            console.log(`CASE 5 (SAME CITY):    ${passCase5 ? 'PASS ✅' : 'FAIL ❌'}`);
            console.log(`CASE 6 (IIIT vs IIT):  ${passCase6 ? 'PASS ✅' : 'FAIL ❌'}`);

            const allPass = passCase1 && passCase2 && passCase3 && passCase4 && passCase5 && passCase6;
            process.exit(allPass ? 0 : 1);
        }

        console.log(`\n--- Execution Complete ---`);
        console.log(`Merges Applied:   ${mergesCount}`);
        console.log(`Conflicts Logged: ${mergeConflicts.length}`);
        console.log(`Aliases Created:  ${aliasesCreated}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

validateAndMerge();
