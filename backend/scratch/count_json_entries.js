const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '..', 'models');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.json'));

const stats = {};

files.forEach(file => {
    try {
        let raw = fs.readFileSync(path.join(modelsDir, file), 'utf-8');
        // Strip BOM
        if (raw.charCodeAt(0) === 0xFEFF) {
            raw = raw.slice(1);
        }
        const content = JSON.parse(raw);
        if (Array.isArray(content)) {
            stats[file] = content.length;
        } else if (typeof content === 'object' && content !== null) {
            // Check if it's a "wrapper" object like { add: [], update: [] }
            if (content.add && Array.isArray(content.add)) {
                stats[file] = content.add.length;
            } else {
                stats[file] = Object.keys(content).length;
            }
        }
    } catch (e) {
        stats[file] = 'Error: ' + e.message;
    }
});

console.log(JSON.stringify(stats, null, 2));
