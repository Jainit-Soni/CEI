const fs = require('fs');
const path = require('path');

const REPORT_DIR = path.join(__dirname, '../reports/frontend_numeric_census');
if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
}

const FRONTEND_DIR = path.join(__dirname, '../../../frontend/src');

const auditData = {
    routes: [],
    formatters: [],
    hardcoded: []
};

function traverseFrontend(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            traverseFrontend(filePath, fileList);
        } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.tsx') || file.endsWith('.ts')) {
            fileList.push(filePath);
        }
    });
    return fileList;
}

const regexFormatters = /(format[A-Za-z0-9_]+|toLocaleString)\b/g;

function analyzeStatic() {
    const files = traverseFrontend(FRONTEND_DIR);
    
    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(FRONTEND_DIR, file).replace(/\\/g, '/'); // Fix Windows paths
        
        // Route detection
        if (relativePath.startsWith('app/') || relativePath.startsWith('pages/')) {
            if (relativePath.endsWith('page.js') || relativePath.endsWith('page.jsx') || relativePath.endsWith('page.tsx')) {
                // Determine route from folder
                let route = relativePath.replace('app/', '/').replace('pages/', '/').replace('/page.js', '').replace('/page.jsx', '').replace('/page.tsx', '');
                if (route === '') route = '/';
                
                // Very basic heuristic for main component (usually default export)
                const compMatch = content.match(/export default function ([A-Za-z0-9_]+)/);
                const component = compMatch ? compMatch[1] : 'Unknown';
                
                auditData.routes.push({
                    route: route,
                    page_file: relativePath,
                    main_component: component,
                    api_dependencies: (content.match(/\/api\/[a-zA-Z0-9_\-/]+/g) || []),
                    has_visible_numbers: /\d/.test(content) // very naive
                });
            }
        }
        
        // Formatters
        let m;
        while ((m = regexFormatters.exec(content)) !== null) {
            auditData.formatters.push({
                function: m[1],
                file: relativePath,
                used_for: "Unknown", // Needs manual inspection or advanced parsing
                unit_assumptions: "Unknown",
                risk: "Needs review"
            });
        }
        
        // Product metrics vs Config limits
        const configLimits = content.match(/pageSize:\s*\d+|limit:\s*\d+|MAX_[A-Z_]+:\s*\d+/g);
        if (configLimits) {
            configLimits.forEach(match => {
                auditData.hardcoded.push({ type: 'CONFIG_LIMIT', value: match, file: relativePath });
            });
        }
        
        // Example values
        const examples = content.match(/e\.g\.?,?\s*[\d₹$]+/gi);
        if (examples) {
            examples.forEach(match => {
                auditData.hardcoded.push({ type: 'EXAMPLE_VALUE', value: match, file: relativePath });
            });
        }
    });
    
    // Deduplicate formatters by function and file
    const uniqueFormatters = [];
    const seenFormatters = new Set();
    auditData.formatters.forEach(f => {
        const key = `${f.function}-${f.file}`;
        if (!seenFormatters.has(key)) {
            seenFormatters.add(key);
            uniqueFormatters.push(f);
        }
    });
    
    fs.writeFileSync(path.join(REPORT_DIR, 'route_inventory.json'), JSON.stringify(auditData.routes, null, 2));
    fs.writeFileSync(path.join(REPORT_DIR, 'formatter_audit.json'), JSON.stringify(uniqueFormatters, null, 2));
    fs.writeFileSync(path.join(REPORT_DIR, 'hardcoded_audit.json'), JSON.stringify(auditData.hardcoded, null, 2));
    
    console.log(`Static analysis complete. Found ${auditData.routes.length} routes.`);
}

analyzeStatic();
