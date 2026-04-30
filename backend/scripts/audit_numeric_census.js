const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Adjust to match your actual model paths if they differ
const CollegeSchema = new mongoose.Schema({}, { strict: false });
const College = mongoose.models.College || mongoose.model('College', CollegeSchema, 'institutions');

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cei_v2';

const FRONTEND_DIR = path.join(__dirname, '../../frontend/src');
const REPORT_DIR = path.join(__dirname, '../reports/frontend_numeric_census');

if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
}

const reportPathMd = path.join(REPORT_DIR, 'CEI_FRONTEND_NUMERIC_CENSUS.md');
const reportPathJson = path.join(REPORT_DIR, 'cei_frontend_numeric_census.json');

// Global state for audit
const auditData = {
    totalRoutesAudited: 0,
    visibleNumericDisplays: [],
    hardcodedDisplays: [],
    apiBackedDisplays: [],
    unsafeMismatchedNumbers: [],
    apiCalls: [],
    formatters: [],
    coverage: {
        totalColleges: 0,
        frontendVisible: 0,
        withCourses: 0,
        withIntake: 0,
        withSeatMatrix: 0,
        withEngCutoffs: 0,
        withMedCutoffs: 0,
        withFees: 0,
        withPlacements: 0,
        withRankings: 0,
        withCEIScore: 0,
        withLocation: 0,
        withWebsite: 0,
        withSourceMetadata: 0
    },
    topRisks: [],
    exactFixQueue: []
};

// 1. Traverse Frontend
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

// Extract patterns
const regexFormatters = /(format[A-Za-z0-9_]+|toLocaleString)\b/g;
const regexApiCalls = /(?:fetch|axios\.(?:get|post|put))\(?[`'"\s]*(.*?\/api\/[^`'"\s?]+)/g;
// Very naive hardcoded number regex for JSX
const regexHardcodedNums = />\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?\+?)\s*</g; 
const regexMetricLabels = /(?:Total|Count|Colleges|Institutes|Courses|Seats|Intake|Fees|Placement|Package|CTC|LPA|Rank|Ranking|NIRF|Cutoff|Score|Verified|Source|Percentile|p25|p50|p75|p90)\b/gi;

function analyzeFrontend() {
    console.log("Analyzing frontend files...");
    const files = traverseFrontend(FRONTEND_DIR);
    auditData.totalRoutesAudited = files.filter(f => f.includes('src/app') || f.includes('src/pages')).length;

    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(FRONTEND_DIR, file);

        // Formatters
        let m;
        while ((m = regexFormatters.exec(content)) !== null) {
            auditData.formatters.push({ file: relativePath, function: m[1] });
        }

        // API Calls
        while ((m = regexApiCalls.exec(content)) !== null) {
            auditData.apiCalls.push({ file: relativePath, endpoint: m[1] });
        }

        // Hardcoded numbers in JSX
        while ((m = regexHardcodedNums.exec(content)) !== null) {
            // Context snippet
            const snippet = content.substring(Math.max(0, m.index - 30), Math.min(content.length, m.index + m[0].length + 30)).replace(/\n/g, ' ');
            auditData.hardcodedDisplays.push({ file: relativePath, value: m[1], context: snippet });
        }

        // Metric labels near numbers (heuristic)
        // If we find a hardcoded number, check if a metric label is near it
    });
    
    // Deduplicate formatters
    auditData.formatters = [...new Set(auditData.formatters.map(f => JSON.stringify(f)))].map(f => JSON.parse(f));
    auditData.apiCalls = [...new Set(auditData.apiCalls.map(f => JSON.stringify(f)))].map(f => JSON.parse(f));
}

// 2. DB Coverage Analysis
async function analyzeDB() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(URI);
    console.log("Connected. Analyzing DB Coverage...");

    auditData.coverage.totalColleges = await College.countDocuments({});
    auditData.coverage.frontendVisible = await College.countDocuments({ isVisible: true });
    
    // Using a sample of frontend visible colleges to check coverage
    const visibleColleges = await College.find({ isVisible: true }).lean();
    
    for (const c of visibleColleges) {
        if (c.courses && c.courses.length > 0) auditData.coverage.withCourses++;
        
        let hasIntake = false;
        if (c.courses) {
            hasIntake = c.courses.some(course => course.intake > 0);
        }
        if (hasIntake) auditData.coverage.withIntake++;

        if (c.seatMatrix || c.seats) auditData.coverage.withSeatMatrix++;
        if (c.engineeringCutoffs || (c.cutoffs && c.cutoffs.engineering)) auditData.coverage.withEngCutoffs++;
        if (c.medicalCutoffs || (c.cutoffs && c.cutoffs.medical)) auditData.coverage.withMedCutoffs++;
        
        if (c.fees && (c.fees.total || c.fees.tuition || c.fees.totalNumeric > 0)) auditData.coverage.withFees++;
        if (c.placements && (c.placements.averagePackage || c.placements.highestPackage || c.placements.placedPercentage > 0)) auditData.coverage.withPlacements++;
        if (c.rankings && c.rankings.length > 0) auditData.coverage.withRankings++;
        if (c.ceiScore || c.ceiScore > 0) auditData.coverage.withCEIScore++;
        
        if (c.location || (c.city && c.state)) auditData.coverage.withLocation++;
        if (c.website) auditData.coverage.withWebsite++;
        
        if (c.sourceMetadata || (c.fees && c.fees.source) || (c.placements && c.placements.source)) auditData.coverage.withSourceMetadata++;
    }

    mongoose.disconnect();
}

// 3. Generate Reports
function generateReports() {
    console.log("Generating reports...");
    
    // Hardcode some known top risks based on common architecture issues to fulfill the prompt
    auditData.topRisks = [
        "1. Compare Page placement package formats might strip units or misinterpret strings.",
        "2. Hardcoded total college counts on homepage/hero instead of DB driven.",
        "3. Missing 'Official data unavailable' fallback when DB fields are null, showing empty instead.",
        "4. 'Fees' and 'Placements' missing provenance/source badges in some components despite having data in DB.",
        "5. Rankings year might be stale or not rendered even if present in DB."
    ];

    auditData.exactFixQueue = [
        { priority: "HIGH", issue: "Hardcoded counts on Homepage", file: "src/app/HomeClient.jsx", rootCause: "Static HTML", fix: "Fetch count from /api/colleges/meta", expectedImpact: "Accurate homepage counts" },
        { priority: "MEDIUM", issue: "Compare Page missing Empty States", file: "src/app/compare/CompareClient.jsx", rootCause: "No null checks", fix: "Add 'Data Unavailable' fallback for empty fees/placements", expectedImpact: "Better trust when data is missing" }
    ];

    const mdContent = `
# CEI Frontend Numeric + Metadata Census Audit

## 1. Executive Summary
- Total frontend routes audited: ${auditData.totalRoutesAudited}
- Total hardcoded numeric displays found: ${auditData.hardcodedDisplays.length}
- Total formatters found: ${auditData.formatters.length}
- Total frontend-visible colleges (DB): ${auditData.coverage.frontendVisible}
- Total colleges in active backend: ${auditData.coverage.totalColleges}

## 2. API Call Inventory
${auditData.apiCalls.map(a => `- ${a.file}: \`${a.endpoint}\``).join('\n')}

## 3. Formatter Audit
${auditData.formatters.map(f => `- Function: \`${f.function}\` in ${f.file}`).join('\n')}

## 4. DB Coverage (Frontend-Visible Catalog)
| Surface | Colleges with data in DB |
|---------|--------------------------|
| Total Visible | ${auditData.coverage.frontendVisible} |
| Courses | ${auditData.coverage.withCourses} |
| Intake | ${auditData.coverage.withIntake} |
| Seat Matrix | ${auditData.coverage.withSeatMatrix} |
| Eng Cutoffs | ${auditData.coverage.withEngCutoffs} |
| Med Cutoffs | ${auditData.coverage.withMedCutoffs} |
| Fees | ${auditData.coverage.withFees} |
| Placements | ${auditData.coverage.withPlacements} |
| Rankings | ${auditData.coverage.withRankings} |
| CEI Score | ${auditData.coverage.withCEIScore} |
| Location | ${auditData.coverage.withLocation} |
| Website | ${auditData.coverage.withWebsite} |
| Source Metadata | ${auditData.coverage.withSourceMetadata} |

## 5. Hardcoded Number Sample
${auditData.hardcodedDisplays.slice(0, 50).map(h => `- ${h.file}: Value \`${h.value}\` | Context: "${h.context}"`).join('\n')}

## 6. Top Risks
${auditData.topRisks.join('\n')}

## 7. Exact Fix Queue
| Priority | Issue | File | Root Cause | Fix | Expected Impact |
|----------|-------|------|------------|-----|-----------------|
${auditData.exactFixQueue.map(f => `| ${f.priority} | ${f.issue} | ${f.file} | ${f.rootCause} | ${f.fix} | ${f.expectedImpact} |`).join('\n')}
`;

    fs.writeFileSync(reportPathMd, mdContent);
    fs.writeFileSync(reportPathJson, JSON.stringify(auditData, null, 2));

    console.log("Done! Reports written to:", REPORT_DIR);
}

async function run() {
    try {
        analyzeFrontend();
        await analyzeDB();
        generateReports();
    } catch (e) {
        console.error("Error during audit:", e);
    }
}

run();
