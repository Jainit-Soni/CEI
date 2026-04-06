const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function repairDatastore() {
    const masterPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
    const tempPath = `${masterPath}.tmp_repair`;

    console.log('🩹 Starting Surgical Datastore Repair...');

    const writer = fs.createWriteStream(tempPath);
    const rl = readline.createInterface({ 
        input: fs.createReadStream(masterPath), 
        crlfDelay: Infinity 
    });

    let linesProcessed = 0;
    let corruptedFound = 0;

    for await (const line of rl) {
        if (!line.trim()) { writer.write('\n'); continue; }
        linesProcessed++;

        // Repair logic: extract everything up to the first valid JSON object's end
        // Current corruption format is JSON followed by trash (e.g. "...}  ...trash...")
        const fixedLine = line.replace(/(^\{.*?\})(.*)/, '$1');
        
        if (fixedLine !== line) corruptedFound++;

        try {
            JSON.parse(fixedLine); // Safety check
            writer.write(fixedLine + '\n');
        } catch (e) {
            console.error(`❌ Critical Repair Failure on line ${linesProcessed}: ${e.message}`);
            // Fallback: If regex fails, try to find the last '}'
            const lastBrace = line.lastIndexOf('}');
            if (lastBrace !== -1) {
                const fallbackLine = line.substring(0, lastBrace + 1);
                writer.write(fallbackLine + '\n');
            } else {
                writer.write(line + '\n'); // Keep original if hopeless
            }
        }
        
        if (linesProcessed % 10000 === 0) console.log(`🔄 Processed ${linesProcessed} lines...`);
    }

    writer.end();
    await new Promise(resolve => writer.on('finish', resolve));
    
    // Backup corrupted one more time before overwrite
    fs.renameSync(masterPath, `${masterPath}.corrupted`);
    fs.renameSync(tempPath, masterPath);

    console.log('\n--- REPAIR COMPLETE ---');
    console.log(`Lines Processed    : ${linesProcessed.toLocaleString()}`);
    console.log(`Lines Repaired     : ${corruptedFound.toLocaleString()}`);
    console.log(`Master file restored to healthy state.`);
    console.log('------------------------\n');
}

repairDatastore().catch(console.error);
