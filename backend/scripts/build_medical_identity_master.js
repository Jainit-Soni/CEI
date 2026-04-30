const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '../data/truth/medical_identity_registry.json');
const OUTPUT_PATH = path.join(__dirname, '../data/truth/medical_identity_master_index.json');

async function buildMedicalMasterIndex() {
    console.log("🛠️ Building Medical Identity Master Index...");
    
    if (!fs.existsSync(REGISTRY_PATH)) {
        console.error("❌ Registry not found:", REGISTRY_PATH);
        process.exit(1);
    }

    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    const masterIndex = new Map();

    registry.forEach(entry => {
        // Handle cases where mccId is missing
        const rawMccId = entry.mccId || 'UNKNOWN_' + Buffer.from(entry.rawName).toString('base64').substring(0, 8);
        
        // Extract quota semantics from rawName
        let quotaType = 'ALL INDIA QUOTA';
        let cleanName = entry.rawName;
        
        const quotaMatches = [
            'Deemed/Paid Seats Quota',
            'Non-Resident Indian',
            'Employees State Insurance Scheme(ESI)',
            'Muslim Minority Quota',
            'Jain Minority Quota',
            'Delhi University Quota',
            'Aligarh Muslim University (AMU) Quota',
            'Jamia Millia Islamia (JMI) Quota',
            'IP University Quota',
            'Internal Quota'
        ];

        for (const q of quotaMatches) {
            if (cleanName.startsWith(q)) {
                quotaType = q;
                cleanName = cleanName.replace(q, '').trim();
                if (cleanName.startsWith('- ') || cleanName.startsWith(' ')) {
                    cleanName = cleanName.substring(1).trim();
                }
                break;
            }
        }

        // Generate a deterministic Medical Entity ID
        // Format: MCC-{Institution_ID}-{Program_Type}
        const isDental = cleanName.toLowerCase().includes('dental') || cleanName.toLowerCase().includes('dentistry');
        const programType = isDental ? 'BDS' : 'MBBS';
        const medicalEntityId = `MCC-${rawMccId}-${programType}`;

        if (!masterIndex.has(medicalEntityId)) {
            masterIndex.set(medicalEntityId, {
                medical_entity_id: medicalEntityId,
                mcc_institute_code: entry.mccId,
                canonical_name: cleanName.split(',')[0].trim(),
                program_type: programType,
                parent_core_id: entry.targetId, // Nullable, maps to core CEI collection
                is_linked_to_core: entry.linkStatus === 'LINKED',
                source_provenance: entry.targetSource || 'mcc_raw',
                raw_names: new Set(),
                quotas: new Set(),
                legacy_mappings: []
            });
        }

        const entity = masterIndex.get(medicalEntityId);
        entity.raw_names.add(entry.rawName);
        entity.quotas.add(quotaType);
        entity.legacy_mappings.push({
            raw_name: entry.rawName,
            original_target: entry.targetId,
            link_status: entry.linkStatus,
            link_reason: entry.linkReason
        });
    });

    const finalOutput = Array.from(masterIndex.values()).map(entity => ({
        ...entity,
        raw_names: Array.from(entity.raw_names),
        quotas: Array.from(entity.quotas)
    }));

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalOutput, null, 2));

    console.log(`✅ Medical Identity Master Index Built: ${finalOutput.length} unique medical entities.`);
    console.log(`📂 Saved to: ${OUTPUT_PATH}`);
}

buildMedicalMasterIndex().catch(console.error);
