require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const Exam = require('../models/ExamSchema');

const IGNORED_EXAMS = [
    'none', 'merit based', '12th marks', 'class 12th', 'direct admission', 'not applicable',
    'n/a', 'na', 'no entrance', 'based on merit', 'merit-based', 'counselling', '10+2 marks',
    '10+2', '12th standard', 'qualifying exam', 'graduation marks', 'management quota',
    'upsc', 'ssc', 'bank', 'ibps', 'sbi', 'rrb', 'defence', 'nda', 'cds', 'afcat', 'ca', 'cs', 'cma',
    'icai', 'icsi', 'post graduation', 'b.ed', 'm.ed', 'ugc net', 'csir net', 'tet', 'ctet', 'diploma'
];

function smartTitleCase(str) {
    if (!str) return '';
    // Known acronyms to always keep uppercase
    const keepUpper = ['PG', 'UG', 'CUET', 'CET', 'JEE', 'PAT', 'PET', 'PMT', 'UET', 'TNEA', 'COMEDK', 'REAP', 'UPSEE', 'GUJCET', 'JAM', 'ICAR', 'AIEEA', 'INI', 'CLAT', 'ICET'];

    return str.replace(/-/g, ' ').split(' ').map(word => {
        const upperWord = word.toUpperCase();
        if (keepUpper.includes(upperWord)) return upperWord;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

async function run() {
    try {
        console.log("Connecting to Database...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected successfully.\n");

        console.log("Fetching all existing exams...");
        const existingExams = await Exam.find({}).lean();

        // Build a massive Set of all known exam identifiers (names, shortNames, ids)
        const knownIdentifiers = new Set();
        existingExams.forEach(ex => {
            if (ex.id) knownIdentifiers.add(ex.id.toLowerCase());
            if (ex.name) knownIdentifiers.add(ex.name.toLowerCase());
            if (ex.shortName) knownIdentifiers.add(ex.shortName.toLowerCase());

            // Allow for variations like "jee main", "jee-main", "jeemain"
            if (ex.shortName) {
                knownIdentifiers.add(ex.shortName.toLowerCase().replace(/[^a-z0-9]/g, ''));
            }
            if (ex.name) {
                knownIdentifiers.add(ex.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
            }
        });

        console.log(`Loaded ${existingExams.length} existing exams (extracted ${knownIdentifiers.size} unique matchable keys).\n`);

        console.log("Scanning 68,000+ Colleges for unmapped entrance exams...");
        const colleges = await College.find({ acceptedExams: { $exists: true, $not: { $size: 0 } } }, 'acceptedExams meta rankingTier location courses').lean();

        const candidateExams = new Map();

        colleges.forEach(college => {
            if (!college.acceptedExams) return;

            college.acceptedExams.forEach(examStr => {
                if (!examStr || typeof examStr !== 'string') return;

                const rawExam = examStr.trim();
                const normalizedExam = rawExam.toLowerCase();
                const strippedExam = normalizedExam.replace(/[^a-z0-9]/g, '');

                if (strippedExam.length < 2) return;

                // Exclude generic and professional terms
                // Match exact word for short terms like 'ca', 'cs' to avoid blocking 'mca' or 'bcs'
                const words = normalizedExam.split(/[\s-]+/);
                if (words.some(w => ['ca', 'cs', 'cma', 'upsc', 'ssc'].includes(w))) return;
                if (IGNORED_EXAMS.some(ignore => normalizedExam.includes(ignore) || words.includes(ignore))) return;

                // If it matches a known exam, skip
                if (knownIdentifiers.has(normalizedExam) || knownIdentifiers.has(strippedExam)) return;

                // Common sub-string matches for massive national exams (often written weirdly in raw data)
                if (normalizedExam.includes('jee') || normalizedExam.includes('neet') || normalizedExam.includes('gate') || normalizedExam.includes('cat')) {
                    // It's likely a mispelled variant of an existing top tier exam, skip to be safe
                    return;
                }

                // If we get here, it's a completely new, unmapped entrance exam!
                if (!candidateExams.has(normalizedExam)) {
                    // Try to guess a short name
                    const isAcronym = rawExam === rawExam.toUpperCase() && rawExam.length <= 8;

                    // Smart Title Case for full name
                    const titleCase = smartTitleCase(rawExam);

                    let shortName = isAcronym ? rawExam : titleCase;

                    // If it's a long string and not an acronym, just display the titleCase,
                    // don't force it to a 1 letter initial.
                    if (titleCase.length > 20 && titleCase.includes(' ')) {
                        const wordTokens = titleCase.split(' ');
                        // Only make acronym if 2+ words to avoid single letter
                        if (wordTokens.length > 1) {
                            shortName = wordTokens.map(w => w[0]).join('').toUpperCase();
                        }
                    }

                    // Derive a standard ID
                    let cleanId = rawExam.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    if (cleanId.length > 50) cleanId = cleanId.substring(0, 50);

                    candidateExams.set(normalizedExam, {
                        id: cleanId,
                        name: titleCase, // Store readable Title Case name instead of lowercase raw
                        shortName: isAcronym ? rawExam : (rawExam.length < 15 ? titleCase : shortName),
                        type: rawExam.toLowerCase().includes('state') ? 'State Level' : 'University / Private',
                        category: 'General',
                        conductingBody: 'Independent / University',
                        meta_detected_count: 1,
                        collegesAccepting: [college.id]
                    });
                } else {
                    const existing = candidateExams.get(normalizedExam);
                    existing.meta_detected_count++;
                    existing.collegesAccepting.push(college.id);
                }
            });
        });

        // Filter out highly anomalous 1-off data errors (must be accepted by at least 2 colleges OR be a distinct recognizable acronym)
        const validNewExams = Array.from(candidateExams.values()).filter(ex =>
            ex.meta_detected_count > 1 || ex.name === ex.name.toUpperCase()
        ).map(ex => {
            // Remove the tracking properties before DB insertion
            delete ex.meta_detected_count;
            return ex;
        });

        // Sort by frequency (most colleges accepting it first)
        validNewExams.sort((a, b) => b.collegesAccepting.length - a.collegesAccepting.length);

        console.log(`\nDiscovered ${validNewExams.length} authentic, unmapped institutional/state exams!`);
        console.log(`Examples: ${validNewExams.slice(0, 5).map(e => e.name).join(', ')} ...`);

        if (validNewExams.length === 0) {
            console.log("Integration complete. No new exams found.");
            process.exit(0);
        }

        console.log(`\nInjecting ${validNewExams.length} new Exam entities into the database...`);

        // Use unordered insertion so duplicates (if collision happens) just fail silently while the rest succeed
        const result = await Exam.insertMany(validNewExams, { ordered: false }).catch(err => {
            // Log inserted count even if there were duplicate key errors
            console.log(`Handled expected duplicate collisions. Inserted ${err.insertedDocs?.length || 0} unique records.`);
            return err.insertedDocs;
        });

        const numInserted = Array.isArray(result) ? result.length : (result ? result.insertedCount : 0);
        console.log(`\nSUCCESS: Automatically generated and integrated ${numInserted || validNewExams.length} new Target Exams into the platform.`);

    } catch (err) {
        console.error("Fatal Script Error:", err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();
