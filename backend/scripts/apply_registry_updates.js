/**
 * backend/scripts/apply_registry_updates.js
 * ==========================================
 * Mutation Engine for the Identity Registry.
 * Reviews candidates with approval_score >= 80 and promotes them to identity_registry.json.
 * Maintains an audit trail in identity_registry_history.json.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const REGISTRY_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_registry.json');
const HISTORY_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_registry_history.json');

async function applyUpdates() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const violations = db.collection('identity_violations');

        // Load current registries
        let registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        const eliteRegistry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'truth', 'elite_institutions.json'), 'utf8'));
        let history = fs.existsSync(HISTORY_PATH) ? JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')) : [];

        // Find candidates for auto-approval (Threshold = 80)
        const candidates = await violations.find({ approval_score: { $gte: 80 } }).toArray();

        if (candidates.length === 0) {
            console.log('✅ No candidates meet the auto-approval threshold (80).');
            process.exit(0);
        }

        console.log(`🚀 Found ${candidates.length} candidates for registry promotion.`);

        let addedCount = 0;
        const cutoffs = db.collection('engineering_cutoffs');

        for (const candidate of candidates) {
            const suggestedId = `CORE-${candidate.normalized_name.toUpperCase()}`;
            
            // --- ELITE CLAIM VALIDATION (Phase 4D) ---
            if (suggestedId.startsWith('CORE-IIT-') || suggestedId.startsWith('CORE-NIT-') || suggestedId.startsWith('CORE-IIIT-')) {
                const parts = suggestedId.split('-');
                const type = parts[1];
                const city = parts.slice(2).join('-');
                if (!eliteRegistry[type] || !eliteRegistry[type].includes(city)) {
                    console.error(`🚨 BLOCK: Invalid Elite Claim detected for ${suggestedId} (${candidate.raw_input})`);
                    await violations.updateOne({ _id: candidate._id }, { $set: { approval_score: 50, reason: "INVALID_ELITE_CLAIM" } });
                    continue;
                }
            }

            // --- SOURCE VERIFICATION (JoSAA) ---
            if (candidate.source_types.includes('josaa')) {
                const hasCutoff = await cutoffs.findOne({ institution_id: suggestedId });
                if (!hasCutoff) {
                    console.warn(`⚠️  Source Downgrade: JoSAA claim unverified for ${suggestedId}`);
                    const newSources = candidate.source_types.filter(s => s !== 'josaa');
                    await violations.updateOne({ _id: candidate._id }, { $set: { source_types: newSources, approval_score: 40 } });
                    continue;
                }
            }

            if (registry[suggestedId]) {
                console.log(`⏩ Skipping ${suggestedId}: Already in registry.`);
                // Clean up violation
                await violations.deleteOne({ _id: candidate._id });
                continue;
            }

            // MUTATION
            registry[suggestedId] = {
                canonical_name: candidate.raw_input,
                aliases: [],
                state: candidate.state
            };

            // AUDIT TRAIL
            const auditEntry = {
                institution_id: suggestedId,
                canonical_name: candidate.raw_input,
                action: 'AUTO_PROMOTION',
                reason: `Approval Score: ${candidate.approval_score}`,
                sources: candidate.source_types,
                evidence: {
                    frequency: candidate.frequency,
                    confidence: candidate.name_confidence_score
                },
                timestamp: new Date().toISOString(),
                operator: 'REGISTRY_EVOLUTION_ENGINE'
            };
            history.push(auditEntry);

            console.log(`✅ Promoted: ${suggestedId} (${candidate.raw_input})`);
            addedCount++;

            // Clean up violation after promotion
            await violations.deleteOne({ _id: candidate._id });
        }

        if (addedCount > 0) {
            // Write Registry
            fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
            // Write History
            fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
            console.log(`\n🔥 SUCCESS: ${addedCount} institutions added to registry authority.`);
        } else {
            console.log('\nSTASIS: No new institutions were added.');
        }

        process.exit(0);
    } catch (err) {
        console.error('FAILED to apply updates:', err);
        process.exit(1);
    }
}

applyUpdates();
