const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

const MASTER_FILE = 'e:/CMAT-PROBLEM/backend/data/colleges.ndjson';
const ELITE_DATA = [
    {"name": "Hindu College", "rank": 1, "median_salary": 8.4, "city": "Delhi"},
    {"name": "Miranda House", "rank": 2, "median_salary": 6.0, "city": "Delhi"},
    {"name": "St. Stephen's College", "rank": 3, "median_salary": 9.0, "city": "Delhi"},
    {"name": "Rama Krishna Mission Vivekananda Centenary College", "rank": 3, "median_salary": 3.0, "city": "Kolkata"},
    {"name": "Atma Ram Sanatan Dharm College", "rank": 5, "median_salary": 5.8, "city": "Delhi"},
    {"name": "St. Xavier's College", "rank": 6, "median_salary": 6.0, "city": "Kolkata"},
    {"name": "PSGR Krishnammal College for Women", "rank": 7, "median_salary": 3.2, "city": "Coimbatore"},
    {"name": "Loyola College", "rank": 8, "median_salary": 4.8, "city": "Chennai"},
    {"name": "Kirori Mal College", "rank": 9, "median_salary": 6.5, "city": "Delhi"},
    {"name": "Lady Shri Ram College for Women", "rank": 10, "median_salary": 8.0, "city": "Delhi"},
    {"name": "PSG College of Arts and Science", "rank": 11, "median_salary": 3.5, "city": "Coimbatore"},
    {"name": "Hansraj College", "rank": 12, "median_salary": 7.0, "city": "Delhi"},
    {"name": "Presidency College", "rank": 13, "median_salary": 3.5, "city": "Chennai"},
    {"name": "Madras Christian College", "rank": 14, "median_salary": 3.2, "city": "Chennai"},
    {"name": "Shri Ram College of Commerce (SRCC)", "rank": 15, "median_salary": 10.1, "city": "Delhi"},
    {"name": "Deshbandhu College", "rank": 16, "median_salary": 5.0, "city": "Delhi"},
    {"name": "Ramakrishna Mission Vidyamandira", "rank": 17, "median_salary": 2.8, "city": "Howrah"},
    {"name": "Acharya Narendra Dev College", "rank": 18, "median_salary": 3.5, "city": "Delhi"},
    {"name": "Lady Irwin College", "rank": 19, "median_salary": 4.5, "city": "Delhi"},
    {"name": "Rajagiri College of Social Sciences", "rank": 20, "median_salary": 4.0, "city": "Kochi"},
    {"name": "St. Joseph's College", "rank": 21, "median_salary": 5.0, "city": "Bangalore"},
    {"name": "Christ University", "rank": 22, "median_salary": 6.0, "city": "Bangalore"},
    {"name": "Mount Carmel College", "rank": 23, "median_salary": 4.5, "city": "Bangalore"},
    {"name": "Fergusson College", "rank": 24, "median_salary": 4.5, "city": "Pune"},
    {"name": "St. Xavier's College", "rank": 25, "median_salary": 6.0, "city": "Mumbai"},
    {"name": "Shaheed Sukhdev College of Business Studies (SSCBS)", "rank": 26, "median_salary": 11.0, "city": "Delhi"},
    {"name": "Daulat Ram College", "rank": 27, "median_salary": 5.0, "city": "Delhi"},
    {"name": "Sri Venkateswara College", "rank": 28, "median_salary": 5.5, "city": "Delhi"},
    {"name": "Gargi College", "rank": 29, "median_salary": 5.0, "city": "Delhi"},
    {"name": "Maitreyi College", "rank": 30, "median_salary": 4.0, "city": "Delhi"},
    {"name": "Kamala Nehru College", "rank": 31, "median_salary": 4.5, "city": "Delhi"},
    {"name": "Indraprastha College for Women", "rank": 32, "median_salary": 5.2, "city": "Delhi"},
    {"name": "Shaheed Rajguru College of Applied Sciences for Women", "rank": 33, "median_salary": 4.2, "city": "Delhi"},
    {"name": "Deen Dayal Upadhyaya College", "rank": 34, "median_salary": 4.5, "city": "Delhi"},
    {"name": "Ramjas College", "rank": 35, "median_salary": 6.0, "city": "Delhi"},
    {"name": "Stella Maris College", "rank": 37, "median_salary": 4.0, "city": "Chennai"},
    {"name": "Ethiraj College for Women", "rank": 38, "median_salary": 3.8, "city": "Chennai"},
    {"name": "Women's Christian College", "rank": 39, "median_salary": 3.5, "city": "Chennai"},
    {"name": "Meenakshi College for Women", "rank": 40, "median_salary": 3.0, "city": "Chennai"},
    {"name": "Justice Basheer Ahmed Sayeed College for Women", "rank": 41, "median_salary": 2.8, "city": "Chennai"},
    {"name": "Queen Mary's College", "rank": 42, "median_salary": 2.5, "city": "Chennai"},
    {"name": "Presidency College", "rank": 43, "median_salary": 4.0, "city": "Kolkata"},
    {"name": "Bethune College", "rank": 44, "median_salary": 2.8, "city": "Kolkata"},
    {"name": "Scottish Church College", "rank": 45, "median_salary": 3.0, "city": "Kolkata"},
    {"name": "Patna Women's College", "rank": 46, "median_salary": 3.5, "city": "Patna"},
    {"name": "Sophia College for Women", "rank": 47, "median_salary": 5.0, "city": "Mumbai"},
    {"name": "Elphinstone College", "rank": 48, "median_salary": 4.0, "city": "Mumbai"},
    {"name": "Mithibai College", "rank": 49, "median_salary": 5.5, "city": "Mumbai"},
    {"name": "N.M. College of Commerce and Economics", "rank": 50, "median_salary": 6.5, "city": "Mumbai"}
];

async function generateElite() {
    console.log("🚀 Loading Master Data for Elite Mapping...");
    const masterColleges = fs.readFileSync(MASTER_FILE, 'utf8')
        .split('\n')
        .filter(l => l.trim())
        .map(JSON.parse);

    const fuse = new Fuse(masterColleges, {
        keys: ['name', 'district', 'state'],
        threshold: 0.3,
        includeScore: true
    });

    const results = [];
    let matched = 0;

    for (const elite of ELITE_DATA) {
        const searchResults = fuse.search(elite.name);
        if (searchResults.length > 0) {
            const best = searchResults[0].item;
            const score = searchResults[0].score;

            if (score < 0.3) {
                matched++;
                results.push({
                    stableKey: best.stableKey,
                    name: best.name,
                    entityType: 'placement',
                    medianSalary: elite.median_salary * 100000,
                    averagePackage: elite.median_salary.toFixed(1) + " Lakh",
                    academicYear: '2023-24',
                    source: 'NIRF 2024 (Elite Arts/Science)',
                    isVerified: true
                });
                
                // Also add Ranking truth
                results.push({
                    stableKey: best.stableKey,
                    name: best.name,
                    entityType: 'ranking',
                    rank: elite.rank,
                    category: 'Colleges (Arts/Science)',
                    source: 'NIRF 2024',
                    year: 2024
                });
            }
        }
    }

    console.log(`✅ Matched ${matched}/${ELITE_DATA.length} Elite Colleges.`);
    fs.writeFileSync('e:/CMAT-PROBLEM/backend/data/truth/elite_arts_science_bulk.ndjson', results.map(r => JSON.stringify(r)).join('\n'));
    console.log(`💎 Elite bulk records saved.`);
}

generateElite();
