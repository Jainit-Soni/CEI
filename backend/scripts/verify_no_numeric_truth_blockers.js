const fs = require('fs');
const path = require('path');

const FORBIDDEN_STRINGS = [
    "94%",
    "150+",
    "4% drop",
    "42 institutes",
    "10,000+",
    "1.4M+",
    "800000",
    "800,000",
    "1200000",
    "1,200,000"
];

const SEARCH_DIR = path.join(__dirname, '../../frontend/src');
const IGNORE_EXTENSIONS = ['.css', '.scss', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico'];

let violations = [];

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== 'reports' && file !== '.next') {
                scanDirectory(fullPath);
            }
        } else {
            if (!IGNORE_EXTENSIONS.some(ext => file.endsWith(ext))) {
                const content = fs.readFileSync(fullPath, 'utf8');
                
                FORBIDDEN_STRINGS.forEach(str => {
                    // Check for exact string in content
                    // We only care if it's in a JS/JSX/TS/TSX file and looks like it's rendered text
                    if (content.includes(str)) {
                        // Simple heuristic to ignore CSS-like values or SVG paths if they were somehow caught
                        // But since we ignore .css files, we just check if it's a factual match
                        const lines = content.split('\n');
                        lines.forEach((line, index) => {
                            if (line.includes(str)) {
                                violations.push({
                                    file: path.relative(process.cwd(), fullPath),
                                    line: index + 1,
                                    string: str,
                                    context: line.trim()
                                });
                            }
                        });
                    }
                });
            }
        }
    }
}

console.log('--- CEI REGRESSION GUARD: NUMERIC TRUTH BLOCKERS ---');
console.log(`Scanning: ${SEARCH_DIR}`);

try {
    scanDirectory(SEARCH_DIR);
} catch (err) {
    console.error(`Scan failed: ${err.message}`);
    process.exit(1);
}

if (violations.length > 0) {
    console.error(`\n🚩 FAIL: Found ${violations.length} forbidden hardcoded numeric claims:\n`);
    violations.forEach(v => {
        console.error(`[${v.string}] at ${v.file}:${v.line}`);
        console.error(`   Context: ${v.context}\n`);
    });
    process.exit(1);
} else {
    console.log('\n✅ PASS: No hardcoded numeric truth blockers found in frontend source.');
    process.exit(0);
}
