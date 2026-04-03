const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_NDJSON = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const CORE_INSTITUTES = path.join(__dirname, '..', 'data', 'core', 'core_institutes.ndjson');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'colleges_temp.ndjson');

// Super High-Fidelity Data Matrix for the 60 Core Colleges
const CORE_DATA_MATRIX = {
  // --- IITs ---
  "Indian Institute of Technology Madras": {
    rankings: [{ source: "NIRF", rank: 1, category: "Engineering" }],
    placements: { averagePackage: "21.48 Lakh", highestPackage: "2.5 Crore" },
    fees: { tuition: 850000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 60000, campusArea: "617 acres" }
  },
  "Indian Institute of Technology Delhi": {
    rankings: [{ source: "NIRF", rank: 2, category: "Engineering" }],
    placements: { averagePackage: "22.50 Lakh", highestPackage: "4.0 Crore" },
    fees: { tuition: 850000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 58000, campusArea: "320 acres" }
  },
  "Indian Institute of Technology Bombay": {
    rankings: [{ source: "NIRF", rank: 3, category: "Engineering" }],
    placements: { averagePackage: "23.50 Lakh", highestPackage: "3.67 Crore" },
    fees: { tuition: 860000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 55000, campusArea: "550 acres" }
  },
  "Indian Institute of Technology Kanpur": {
    rankings: [{ source: "NIRF", rank: 4, category: "Engineering" }],
    placements: { averagePackage: "22.07 Lakh", highestPackage: "1.9 Crore" },
    fees: { tuition: 850000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 52000, campusArea: "1055 acres" }
  },
  "Indian Institute of Technology Roorkee": {
    rankings: [{ source: "NIRF", rank: 5, category: "Engineering" }],
    placements: { averagePackage: "18.34 Lakh", highestPackage: "2.1 Crore" },
    fees: { tuition: 850000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 48000, campusArea: "365 acres" }
  },
  "Indian Institute of Technology Kharagpur": {
    rankings: [{ source: "NIRF", rank: 6, category: "Engineering" }],
    placements: { averagePackage: "19.36 Lakh", highestPackage: "2.6 Crore" },
    fees: { tuition: 860000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 45000, campusArea: "2100 acres" }
  },
  "Indian Institute of Technology Guwahati": {
    rankings: [{ source: "NIRF", rank: 7, category: "Engineering" }],
    placements: { averagePackage: "21.60 Lakh", highestPackage: "2.4 Crore" },
    fees: { tuition: 850000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 42000, campusArea: "700 acres" }
  },
  "Indian Institute of Technology Hyderabad": {
    rankings: [{ source: "NIRF", rank: 8, category: "Engineering" }],
    placements: { averagePackage: "20.07 Lakh", highestPackage: "63.7 Lakh" },
    fees: { tuition: 840000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 60000, campusArea: "576 acres" }
  },
  "Indian Institute of Technology Indore": {
    rankings: [{ source: "NIRF", rank: 14, category: "Engineering" }],
    placements: { averagePackage: "25.45 Lakh", highestPackage: "68.0 Lakh" },
    fees: { tuition: 840000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 52000, campusArea: "501 acres" }
  },
  "Indian Institute of Technology BHU": {
    rankings: [{ source: "NIRF", rank: 15, category: "Engineering" }],
    placements: { averagePackage: "18.96 Lakh", highestPackage: "1.2 Crore" },
    fees: { tuition: 850000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 43000, campusArea: "1350 acres" }
  },
  "Indian Institute of Technology Ropar": {
    rankings: [{ source: "NIRF", rank: 22, category: "Engineering" }],
    placements: { averagePackage: "17.00 Lakh", highestPackage: "48.0 Lakh" },
    fees: { tuition: 840000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 40000 }
  },
  "Indian Institute of Technology Patna": {
    rankings: [{ source: "NIRF", rank: 41, category: "Engineering" }],
    placements: { averagePackage: "20.50 Lakh", highestPackage: "82.0 Lakh" },
    fees: { tuition: 840000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 45000 }
  },
  "Indian Institute of Technology Gandhinagar": {
    rankings: [{ source: "NIRF", rank: 18, category: "Engineering" }],
    placements: { averagePackage: "15.35 Lakh", highestPackage: "50.0 Lakh" },
    fees: { tuition: 850000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 55000, campusArea: "400 acres" }
  },
  "Indian Institute of Technology Bhubaneswar": {
    rankings: [{ source: "NIRF", rank: 47, category: "Engineering" }],
    placements: { averagePackage: "17.50 Lakh", highestPackage: "55.7 Lakh" },
    fees: { tuition: 850000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 40000 }
  },
  "Indian Institute of Technology Jodhpur": {
    rankings: [{ source: "NIRF", rank: 30, category: "Engineering" }],
    placements: { averagePackage: "17.00 Lakh", highestPackage: "53.0 Lakh" },
    fees: { tuition: 850000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 45000, campusArea: "852 acres" }
  },
  "Indian Institute of Technology Mandi": {
    rankings: [{ source: "NIRF", rank: 33, category: "Engineering" }],
    placements: { averagePackage: "25.23 Lakh", highestPackage: "60.0 Lakh" },
    fees: { tuition: 850000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 42000, campusArea: "538 acres" }
  },

  // --- IIMs ---
  "Indian Institute of Management Ahmedabad": {
    rankings: [{ source: "NIRF", rank: 1, category: "Management" }],
    placements: { averagePackage: "34.36 Lakh", highestPackage: "1.15 Crore" },
    fees: { tuition: 3150000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 150000, campusArea: "102 acres" }
  },
  "Indian Institute of Management Bangalore": {
    rankings: [{ source: "NIRF", rank: 2, category: "Management" }],
    placements: { averagePackage: "35.31 Lakh", highestPackage: "1.15 Crore" },
    fees: { tuition: 2450000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 150000, campusArea: "100 acres" }
  },
  "Indian Institute of Management Kozhikode": {
    rankings: [{ source: "NIRF", rank: 3, category: "Management" }],
    placements: { averagePackage: "28.05 Lakh", highestPackage: "72.0 Lakh" },
    fees: { tuition: 2050000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 140000, campusArea: "111 acres" }
  },
  "Indian Institute of Management Calcutta": {
    rankings: [{ source: "NIRF", rank: 4, category: "Management" }],
    placements: { averagePackage: "35.07 Lakh", highestPackage: "1.2 Crore" },
    fees: { tuition: 3100000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 155000, campusArea: "135 acres" }
  },
  "Indian Institute of Management Lucknow": {
    rankings: [{ source: "NIRF", rank: 6, category: "Management" }],
    placements: { averagePackage: "32.20 Lakh", highestPackage: "1.0 Crore" },
    fees: { tuition: 2050000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 145000, campusArea: "200 acres" }
  },
  "Indian Institute of Management Indore": {
    rankings: [{ source: "NIRF", rank: 8, category: "Management" }],
    placements: { averagePackage: "25.68 Lakh", highestPackage: "1.0 Crore" },
    fees: { tuition: 2117000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 125000, campusArea: "193 acres" }
  },
  "Indian Institute of Management Raipur": {
    rankings: [{ source: "NIRF", rank: 11, category: "Management" }],
    placements: { averagePackage: "21.04 Lakh", highestPackage: "43.4 Lakh" },
    fees: { tuition: 1550000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 110000, campusArea: "200 acres" }
  },
  "Indian Institute of Management Rohtak": {
    rankings: [{ source: "NIRF", rank: 12, category: "Management" }],
    placements: { averagePackage: "19.27 Lakh", highestPackage: "48.25 Lakh" },
    fees: { tuition: 1790000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 120000, campusArea: "200 acres" }
  },
  "Indian Institute of Management Udaipur": {
    rankings: [{ source: "NIRF", rank: 16, category: "Management" }],
    placements: { averagePackage: "20.02 Lakh", highestPackage: "47.0 Lakh" },
    fees: { tuition: 2150000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 120000 }
  },
  "Indian Institute of Management Kashipur": {
    rankings: [{ source: "NIRF", rank: 19, category: "Management" }],
    placements: { averagePackage: "18.11 Lakh", highestPackage: "37.0 Lakh" },
    fees: { tuition: 1730000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 100000 }
  },
  "Indian Institute of Management Tiruchirappalli": {
    rankings: [{ source: "NIRF", rank: 22, category: "Management" }],
    placements: { averagePackage: "20.55 Lakh", highestPackage: "41.6 Lakh" },
    fees: { tuition: 1950000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 100000 }
  },
  "Indian Institute of Management Ranchi": {
    rankings: [{ source: "NIRF", rank: 24, category: "Management" }],
    placements: { averagePackage: "18.69 Lakh", highestPackage: "37.8 Lakh" },
    fees: { tuition: 1720000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 100000 }
  },
  "Indian Institute of Management Shillong": {
    rankings: [{ source: "NIRF", rank: 26, category: "Management" }],
    placements: { averagePackage: "26.10 Lakh", highestPackage: "71.3 Lakh" },
    fees: { tuition: 1540000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 110000 }
  },
  "Indian Institute of Management Nagpur": {
    rankings: [{ source: "NIRF", rank: 43, category: "Management" }],
    placements: { averagePackage: "16.74 Lakh", highestPackage: "64.0 Lakh" },
    fees: { tuition: 1890000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 120000 }
  },

  // --- BITS ---
  "BITS Pilani": {
    rankings: [{ source: "NIRF", rank: 25, category: "Engineering" }],
    placements: { averagePackage: "30.37 Lakh", highestPackage: "60.75 Lakh" },
    fees: { tuition: 1950000 },
    meta: { naacGrade: "A", ownership: "Private", hostelFees: 120000, campusArea: "328 acres" }
  },
  "BITS Pilani Goa": {
    rankings: [{ source: "NIRF", rank: 26, category: "Engineering" }],
    placements: { averagePackage: "28.5L Lakh", highestPackage: "60.7 Lakh" },
    fees: { tuition: 1950000 },
    meta: { naacGrade: "A", ownership: "Private", hostelFees: 130000, campusArea: "180 acres" }
  },
  "BITS Pilani Hyderabad": {
    rankings: [{ source: "NIRF", rank: 27, category: "Engineering" }],
    placements: { averagePackage: "25.0 Lakh", highestPackage: "60 Lakh" },
    fees: { tuition: 1950000 },
    meta: { naacGrade: "A", ownership: "Private", hostelFees: 120000, campusArea: "200 acres" }
  },

  // --- NITs ---
  "NIT Trichy": {
    rankings: [{ source: "NIRF", rank: 9, category: "Engineering" }],
    placements: { averagePackage: "12.00 Lakh", highestPackage: "52.8 Lakh" },
    fees: { tuition: 630000 },
    meta: { naacGrade: "A+", ownership: "Public/Government", hostelFees: 45000, campusArea: "800 acres" }
  },
  "NIT Surathkal": {
    rankings: [{ source: "NIRF", rank: 12, category: "Engineering" }],
    placements: { averagePackage: "15.00 Lakh", highestPackage: "54.7 Lakh" },
    fees: { tuition: 635000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 40000, campusArea: "295 acres" }
  },
  "NIT Rourkela": {
    rankings: [{ source: "NIRF", rank: 16, category: "Engineering" }],
    placements: { averagePackage: "13.89 Lakh", highestPackage: "83.6 Lakh" },
    fees: { tuition: 635000 },
    meta: { naacGrade: "A+", ownership: "Public/Government", hostelFees: 42000, campusArea: "1200 acres" }
  },
  "NIT Warangal": {
    rankings: [{ source: "NIRF", rank: 21, category: "Engineering" }],
    placements: { averagePackage: "17.29 Lakh", highestPackage: "88.0 Lakh" },
    fees: { tuition: 650000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 45000, campusArea: "248 acres" }
  },
  "NIT Calicut": {
    rankings: [{ source: "NIRF", rank: 23, category: "Engineering" }],
    placements: { averagePackage: "13.77 Lakh", highestPackage: "50.0 Lakh" },
    fees: { tuition: 630000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 40000, campusArea: "296 acres" }
  },

  // --- IIITs ---
  "Indian Institute of Information Technology Allahabad": {
    rankings: [{ source: "NIRF", rank: 89, category: "Engineering" }],
    placements: { averagePackage: "34.66 Lakh", highestPackage: "82.5 Lakh" },
    fees: { tuition: 650000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 50000, campusArea: "100 acres" }
  },
  "Indian Institute of Information Technology Gwalior": {
    rankings: [{ source: "NIRF", rank: 88, category: "Engineering" }],
    placements: { averagePackage: "24.31 Lakh", highestPackage: "1.95 Crore" },
    fees: { tuition: 600000 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 45000 }
  },

  // --- AIIMS ---
  "All India Institute of Medical Sciences Delhi": {
    rankings: [{ source: "NIRF", rank: 1, category: "Medical" }],
    placements: { averagePackage: "24.0 Lakh", highestPackage: "35.0 Lakh" },
    fees: { tuition: 6865 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 5000, campusArea: "115 acres" }
  },
  "All India Institute of Medical Sciences Jodhpur": {
    rankings: [{ source: "NIRF", rank: 13, category: "Medical" }],
    placements: { averagePackage: "18.0 Lakh", highestPackage: "24.0 Lakh" },
    fees: { tuition: 5856 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 5000 }
  },
  "All India Institute of Medical Sciences Rishikesh": {
    rankings: [{ source: "NIRF", rank: 22, category: "Medical" }],
    placements: { averagePackage: "16.0 Lakh", highestPackage: "20.0 Lakh" },
    fees: { tuition: 5856 },
    meta: { naacGrade: "A", ownership: "Public/Government", hostelFees: 5000 }
  },

  // --- Top Private B-Schools ---
  "FMS Delhi": {
    rankings: [{ source: "NIRF", rank: 4, category: "Management" }],
    placements: { averagePackage: "34.1 Lakh", highestPackage: "1.23 Crore" },
    fees: { tuition: 200000 },
    meta: { naacGrade: "A++", ownership: "Public/Government", hostelFees: 30000 }
  },
  "XLRI Jamshedpur": {
    rankings: [{ source: "NIRF", rank: 9, category: "Management" }],
    placements: { averagePackage: "32.7 Lakh", highestPackage: "1.1 Crore" },
    fees: { tuition: 2740000 },
    meta: { naacGrade: "A+", ownership: "Private", hostelFees: 120000 }
  },
  "SPJIMR Mumbai": {
    rankings: [{ source: "NIRF", rank: 20, category: "Management" }],
    placements: { averagePackage: "33.0 Lakh", highestPackage: "81.0 Lakh" },
    fees: { tuition: 2400000 },
    meta: { naacGrade: "A", ownership: "Private", hostelFees: 100000 }
  },
  "MDI Gurgaon": {
    rankings: [{ source: "NIRF", rank: 13, category: "Management" }],
    placements: { averagePackage: "27.67 Lakh", highestPackage: "60.0 Lakh" },
    fees: { tuition: 2416000 },
    meta: { naacGrade: "A", ownership: "Private", hostelFees: 110000 }
  },
  "TISS Mumbai": {
    rankings: [{ source: "NIRF", rank: 98, category: "University" }],
    placements: { averagePackage: "27.22 Lakh", highestPackage: "49.0 Lakh" },
    fees: { tuition: 130000 },
    meta: { naacGrade: "A+", ownership: "Public/Government", hostelFees: 45000 }
  }
};

async function ingestCoreTruth() {
    console.log("[CoreIngest] Starting precision merge of Core Truth Data...");

    // 1. Map existing NDJSON
    const colleges = [];
    if (!fs.existsSync(COLLEGES_NDJSON)) {
        console.error("Colleges NDJSON not found!");
        return;
    }

    const rl = readline.createInterface({
        input: fs.createReadStream(COLLEGES_NDJSON),
        crlfDelay: Infinity
    });

    let modifiedCount = 0;
    
    const EXACT_ALIASES = {
        "Indian Institute of Technology Kanpur": ["Indian Institute of Technology, Kanpur"],
        "Indian Institute of Technology Kharagpur": ["Indian Institute of Technology, Kharagpur"],
        "Indian Institute of Technology Roorkee": ["Indian Institute of Technology, Roorkee"],
        "Indian Institute of Technology Hyderabad": ["Indian Institute of Technology, Hyderabad"],
        "Indian Institute of Technology Indore": ["Indian Institute of Technology, Indore"],
        "Indian Institute of Technology Delhi": ["Indian Institute of Technology, Delhi"],
        "Indian Institute of Technology Patna": ["Indian Institute of Technology, Patna"],
        "Indian Institute of Technology Gandhinagar": ["Indian Institute of Technology, Gandhinagar"],
        "Indian Institute of Technology Jodhpur": ["Indian Institute of Technology, Jodhpur"],
        "Indian Institute of Technology Mandi": ["Indian Institute of Technology, Mandi"],
        "Indian Institute of Technology Ropar": ["Indian Institute of Technology, Ropar"],
        "Indian Institute of Management Ahmedabad": ["INDIAN INSTITUTE OF MANAGEMENT AHMEDABAD"],
        "Indian Institute of Management Lucknow": ["INDIAN INSTITUTE OF MANAGEMENT LUCKNOW"],
        "Indian Institute of Management Kozhikode": ["INDIAN INSTITUTE OF MANAGEMENT KOZHIKODE"],
        "Indian Institute of Management Indore": ["INDIAN INSTITUTE OF MANAGEMENT INDORE"],
        "Indian Institute of Management Shillong": ["INDIAN INSTITUTE OF MANAGEMENT, SHILLONG"],
        "Indian Institute of Management Rohtak": ["INDIAN INSTITUTE OF MANAGEMENT ROHTAK"],
        "Indian Institute of Management Ranchi": ["INDIAN INSTITUTE OF MANAGEMENT RANCHI"],
        "Indian Institute of Management Raipur": ["INDIAN INSTITUTE OF MANAGEMENT RAIPUR"],
        "Indian Institute of Management Kashipur": ["INDIAN INSTITUTE OF MANAGEMENT KASHIPUR"],
        "Indian Institute of Management Udaipur": ["INDIAN INSTITUTE OF MANAGEMENT UDAIPUR"],
        "Indian Institute of Management Nagpur": ["INDIAN INSTITUTE OF MANAGEMENT, NAGPUR"],
        "Indian Institute of Management Amritsar": ["INDIAN INSTITUTE OF MANAGEMENT AMRITSAR"],
        "Indian Institute of Management Bodh Gaya": ["INDIAN INSTITUTE OF MANAGEMENT BODH GAYA"],
        "Indian Institute of Management Sirmaur": ["INDIAN INSTITUTE OF MANAGEMENT SIRMAUR"],
        "Indian Institute of Management Sambalpur": ["INDIAN INSTITUTE OF MANAGEMENT SAMBALPUR"],
        "Indian Institute of Management Visakhapatnam": ["INDIAN INSTITUTE OF MANAGEMENT VISAKHAPATNAM"],
        "Indian Institute of Management Jammu": ["INDIAN INSTITUTE OF MANAGEMENT, JAMMU", "INDIAN INSTITUTE OF MANAGEMENT, JAMMU AND KASHMIR"],
        "Indian Institute of Information Technology Allahabad": ["Indian Institute of Information Technology, Allahabad"],
        "Indian Institute of Information Technology Gwalior": ["Atal Bihari Vajpayee Indian Institute of Information Technology and Management, Gwalior"],
        "All India Institute of Medical Sciences Delhi": ["All India Institute of Medical Sciences, New Delhi", "All India Institute of Medical Sciences Delhi"],
        "All India Institute of Medical Sciences Jodhpur": ["ALL INDIA INSTITUTE OF MEDICAL SCIENCES, JODHPUR"],
        "All India Institute of Medical Sciences Rishikesh": ["ALL INDIA INSTITUTE OF MEDICAL SCIENCES, RISHIKESH"],
        "All India Institute of Medical Sciences Bhopal": ["ALL INDIA INSTITUTE OF MEDICAL SCIENCES, BHOPAL"],
        "All India Institute of Medical Sciences Raipur": ["ALL INDIA INSTITUTE OF MEDICAL SCIENCES, RAIPUR"],
        "All India Institute of Medical Sciences Patna": ["ALL INDIA INSTITUTE OF MEDICAL SCIENCES, PATNA"],
        "All India Institute of Medical Sciences Bhubaneswar": ["ALL INDIA INSTITUTE OF MEDICAL SCIENCES, BHUBANESWAR"]
    };

    const isMatch = (cName, canonName) => {
        if (!cName) return false;
        cName = cName.trim().toLowerCase();
        if (cName === canonName.toLowerCase()) return true;
        const aliases = EXACT_ALIASES[canonName];
        if (aliases && aliases.some(a => a.toLowerCase() === cName)) return true;
        return false;
    };

    const matrixEntries = Object.entries(CORE_DATA_MATRIX);

    // Keep track of what we matched to avoid double-counting
    const matchedSet = new Set();
    const hitLog = [];

    for await (const line of rl) {
        if (!line.trim()) continue;
        const c = JSON.parse(line);
        
        let matchData = null;
        let matchedName = "";

        // Find the best match from our matrix
        for (const [canonName, data] of matrixEntries) {
            if (matchedSet.has(canonName)) continue;
            
            const n1 = c.canonical?.canonicalCollegeName || "";
            const n2 = c.name || "";
            
            if (isMatch(n1, canonName) || isMatch(n2, canonName)) {
                matchData = data;
                matchedName = canonName;
                matchedSet.add(canonName);
                break;
            }
        }

        if (matchData) {
            console.log(` ✅ Matched Core Institute: ${c.name} -> Merging ${matchedName}`);
            
            // Deep Merge Precision Data
            c.placements = { ...(c.placements || {}), ...matchData.placements };
            c.fees = { ...(c.fees || {}), ...matchData.fees };
            c.meta = { ...(c.meta || {}), ...matchData.meta };
            
            // Rank override (replace specific NIRF category rank or prepend)
            if (matchData.rankings && c.rankings) {
                // Ensure array
                if (!Array.isArray(c.rankings)) c.rankings = [];
                matchData.rankings.forEach(newR => {
                    const existingIdx = c.rankings.findIndex(r => r.source === newR.source);
                    if (existingIdx >= 0) {
                        c.rankings[existingIdx] = newR;
                    } else {
                        c.rankings.unshift(newR); // Priority placement
                    }
                });
            } else if (matchData.rankings) {
                c.rankings = matchData.rankings;
            }
            
            // Bump the search score permanently for these
            c.searchBoost = (c.searchBoost || 1.0) + 0.5;
            c.isCore = true;
            c.dataConfidenceScore = 10.0; // Overwrite data confidence with absolute truth score
            
            modifiedCount++;
        }

        colleges.push(c);
    }

    console.log(`\n[CoreIngest] Finished memory merge. Writing back ${colleges.length} total records...`);
    
    const outputStream = fs.createWriteStream(OUTPUT_FILE);
    for (const c of colleges) {
        outputStream.write(JSON.stringify(c) + '\n');
    }
    outputStream.end();

    outputStream.on('finish', () => {
        // Swap file safely
        fs.renameSync(OUTPUT_FILE, COLLEGES_NDJSON);
        console.log(`🔥 SUCCESS: Ingested pristine high-fidelity data into ${modifiedCount} Core Universities!`);
    });
}

ingestCoreTruth();
