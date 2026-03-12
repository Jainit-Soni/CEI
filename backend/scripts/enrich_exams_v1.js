require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const Exam = require('../models/ExamSchema');
const connectDB = require('../config/db');

async function enrichExamsV1() {
    await connectDB();
    
    console.log("--- 🧠 Exam Intelligence Injection (v1) ---");
    
    const examIntel = [
        {
            query: { shortName: /CAT/i },
            update: {
                name: "Common Admission Test",
                conductingBody: "IIM Kozhikode (2025/26 Lead)",
                officialUrl: "https://iimcat.ac.in",
                type: "National",
                category: "Management",
                stats: {
                    applicants: "3.3 Lakh+",
                    fee: "₹2,600 (General) / ₹1,300 (SC/ST/PwD)",
                    duration: "120 Minutes",
                    mode: "Computer Based (CBT)"
                },
                markingScheme: {
                    correct: "3",
                    incorrect: "1"
                },
                safeScore: {
                    min: "90+ Percentile",
                    target: "99+ Percentile"
                },
                pattern: [
                    "Verbal Ability & Reading Comprehension (VARC): 24 Qs",
                    "Data Interpretation & Logical Reasoning (DILR): 20 Qs",
                    "Quantitative Ability (QA): 22 Qs"
                ],
                dates: {
                    registration: "August 1 - September 20, 2026 (Expected)",
                    examWindow: "November 29, 2026 (Sunday)",
                    result: "January 2027 (Tentative)"
                }
            }
        },
        {
            query: { shortName: /XAT/i },
            update: {
                name: "Xavier Aptitude Test",
                conductingBody: "XLRI Jamshedpur",
                officialUrl: "https://xatonline.in",
                type: "National",
                category: "Management",
                stats: {
                    applicants: "1.35 Lakh+",
                    fee: "₹2,200 (+ ₹200 per XLRI program)",
                    duration: "210 Minutes",
                    mode: "Computer Based (CBT)"
                },
                markingScheme: {
                    correct: "1",
                    incorrect: "0.25 (Negative) / 0.10 (Unattempted >8)"
                },
                pattern: [
                    "Verbal & Logical Ability",
                    "Decision Making",
                    "Quantitative Ability & Data Interpretation",
                    "General Knowledge & Essay"
                ],
                dates: {
                    registration: "July 10 - December 11, 2025 (Completed)",
                    examWindow: "January 4, 2026 (Completed)",
                    result: "January 17, 2026 (Declared)"
                }
            }
        },
        {
            query: { shortName: /CMAT/i },
            update: {
                name: "Common Management Admission Test",
                conductingBody: "NTA (National Testing Agency)",
                officialUrl: "https://exams.nta.ac.in/CMAT",
                type: "National",
                category: "Management",
                stats: {
                    applicants: "70,000+",
                    fee: "₹2,500 (Male) / ₹1,250 (Female/Reserved)",
                    duration: "180 Minutes",
                    mode: "Online (CBT)"
                },
                markingScheme: {
                    correct: "4",
                    incorrect: "1"
                },
                pattern: [
                    "Quantitative Techniques & Data Interpretation",
                    "Logical Reasoning",
                    "Language Comprehension",
                    "General Awareness",
                    "Innovation & Entrepreneurship"
                ],
                dates: {
                    registration: "October - November 2025 (Completed)",
                    examWindow: "January 25, 2026 (Completed)",
                    result: "February 2026 (Declared)"
                }
            }
        },
        {
            query: { shortName: /MAH.*CET/i },
            update: {
                name: "MAH MBA CET",
                conductingBody: "State CET Cell, Maharashtra",
                officialUrl: "https://cetcell.mahacet.org",
                type: "State",
                category: "Management",
                stats: {
                    applicants: "1.6 Lakh+",
                    fee: "₹1,200 (Open) / ₹1,000 (Reserved)",
                    duration: "150 Minutes",
                    mode: "Online (CBT)"
                },
                markingScheme: {
                    correct: "1",
                    incorrect: "0 (No Negative Marking)"
                },
                pattern: [
                    "Logical Reasoning: 75 Qs",
                    "Abstract Reasoning: 25 Qs",
                    "Quantitative Aptitude: 50 Qs",
                    "Verbal Ability & Reading Comprehension: 50 Qs"
                ],
                dates: {
                    registration: "January 10 - February 25, 2026 (Completed)",
                    examWindow: "April 6, 7, 8, 2026 (Upcoming)",
                    result: "May 2026 (Expected)"
                }
            }
        }
    ];

    for (const item of examIntel) {
        const result = await Exam.updateOne(item.query, { $set: item.update });
        console.log(`Enriched ${item.query.shortName}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Exam Intelligence v1 Complete ---");
    process.exit(0);
}

enrichExamsV1().catch(err => {
    console.error(err);
    process.exit(1);
});
