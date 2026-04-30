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
    console.log("Analyzing static frontend files...");
    const files = traverseFrontend(FRONTEND_DIR);
    
    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(FRONTEND_DIR, file).replace(/\\/g, '/'); // Normalize path
        
        // 1. Route detection
        if (relativePath.startsWith('app/') || relativePath.startsWith('pages/')) {
            if (relativePath.endsWith('page.js') || relativePath.endsWith('page.jsx') || relativePath.endsWith('page.tsx')) {
                let route = relativePath.replace('app/', '/').replace('pages/', '/').replace(/\/page\.(js|jsx|tsx)$/, '');
                if (route === '' || route === '/') route = '/';
                else if (!route.startsWith('/')) route = '/' + route;
                
                const compMatch = content.match(/export default function ([A-Za-z0-9_]+)/);
                const component = compMatch ? compMatch[1] : 'Unknown';
                
                auditData.routes.push({
                    route: route,
                    page_file: relativePath,
                    main_component: component,
                    api_dependencies: [...new Set(content.match(/\/api\/[a-zA-Z0-9_\-/]+/g) || [])],
                    has_visible_numbers: /\d/.test(content) // naive check
                });
            }
        }
        
        // 2. Formatters
        let m;
        while ((m = regexFormatters.exec(content)) !== null) {
            auditData.formatters.push({
                function: m[1],
                file: relativePath,
                used_for: "Static Source mapping",
                unit_assumptions: "Unknown",
                sample_inputs: [],
                risk: "STATIC_POSSIBLE"
            });
        }
        
        // 3. Hardcoded Numbers
        const configLimits = content.match(/(pageSize|limit|MAX_[A-Z_]+):\s*\d+/g);
        if (configLimits) {
            configLimits.forEach(match => {
                auditData.hardcoded.push({ type: 'CONFIG_LIMIT', value: match, file: relativePath });
            });
        }
        
        const examples = content.match(/e\.g\.?,?\s*[\d₹$]+|example:?\s*[\d₹$]+/gi);
        if (examples) {
            examples.forEach(match => {
                auditData.hardcoded.push({ type: 'EXAMPLE_VALUE', value: match, file: relativePath });
            });
        }
        
        // Product metrics hardcoded in JSX text nodes
        const jsxNumbers = content.match(/>\s*([₹$]?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?[kM+LPA\s]*)\s*</gi);
        if (jsxNumbers) {
            jsxNumbers.forEach(match => {
                const val = match.replace(/[><]/g, '').trim();
                if (val && !isNaN(parseInt(val))) {
                    auditData.hardcoded.push({ type: 'PRODUCT_METRIC_HARDCODED', value: val, file: relativePath });
                }
            });
        }
    });
    
    // Deduplicate formatters
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
    fs.writeFileSync(path.join(REPORT_DIR, 'STATIC_MAP_hardcoded.json'), JSON.stringify(auditData.hardcoded, null, 2));
    
    console.log(`Static analysis complete. Found ${auditData.routes.length} routes.`);
}

analyzeStatic();
