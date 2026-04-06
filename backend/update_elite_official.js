const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const College = require('./models/CollegeSchema');

async function updateElite() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB });
        console.log("🚀 FINAL ELITE ENRICHMENT: NIRF 2024 / JoSAA 2024...");

        const eliteData = [
            {
                pattern: /IIT Madras|Indian Institute of Technology Madras/i,
                update: {
                    rank: "1",
                    placements: { averagePackage: "21.48 LPA", averagePackageNumeric: 21.48, source: "NIRF 2024", placedPercentage: 92, academicYear: "2023-24", isVerified: true },
                    engineeringCutoffs: [{ courseName: "Computer Science and Engineering", closingRank: 171, round: "6", year: "2024", quota: "All India", category: "OPEN", seatType: "Gender-Neutral", source: "JoSAA 2024" }]
                }
            },
            {
                pattern: /IIT Delhi|Indian Institute of Technology.*Delhi/i,
                update: {
                    rank: "2",
                    placements: { averagePackage: "18.5 LPA", averagePackageNumeric: 18.5, source: "NIRF 2024", placedPercentage: 90, academicYear: "2023-24", isVerified: true },
                    engineeringCutoffs: [{ courseName: "Computer Science and Engineering", closingRank: 126, round: "6", year: "2024", quota: "All India", category: "OPEN", seatType: "Gender-Neutral", source: "JoSAA 2024" }]
                }
            },
            {
                pattern: /IIT Bombay|Indian Institute of Technology.*Bombay/i,
                update: {
                    rank: "3",
                    placements: { averagePackage: "21.82 LPA", averagePackageNumeric: 21.82, source: "NIRF 2024", placedPercentage: 89, academicYear: "2023-24", isVerified: true },
                    engineeringCutoffs: [{ courseName: "Computer Science and Engineering", closingRank: 66, round: "6", year: "2024", quota: "All India", category: "OPEN", seatType: "Gender-Neutral", source: "JoSAA 2024" }]
                }
            },
            {
                pattern: /IIT Kanpur|Indian Institute of Technology.*Kanpur/i,
                update: {
                    rank: "4",
                    placements: { averagePackage: "19.4 LPA", averagePackageNumeric: 19.4, source: "NIRF 2024", placedPercentage: 91, academicYear: "2023-24", isVerified: true },
                    engineeringCutoffs: [{ courseName: "Computer Science and Engineering", closingRank: 271, round: "6", year: "2024", quota: "All India", category: "OPEN", seatType: "Gender-Neutral", source: "JoSAA 2024" }]
                }
            },
            {
                pattern: /NIT Trichy|NIT Tiruchirappalli|National Institute of Technology.*Tiruchirappalli/i,
                update: {
                    rank: "9",
                    placements: { averagePackage: "15.8 LPA", averagePackageNumeric: 15.8, source: "NIRF 2024", placedPercentage: 95, academicYear: "2023-24", isVerified: true },
                    engineeringCutoffs: [{ courseName: "Computer Science and Engineering", closingRank: 1501, round: "6", year: "2024", quota: "Other State", category: "OPEN", seatType: "Gender-Neutral", source: "JoSAA 2024" }]
                }
            },
            {
                pattern: /IIM Ahmedabad|Indian Institute of Management.*Ahmedabad/i,
                update: {
                    rank: "1",
                    placements: { averagePackage: "32.79 LPA", averagePackageNumeric: 32.79, source: "Official Placement Report 2024", placedPercentage: 100, academicYear: "2023-24", isVerified: true }
                }
            },
            {
                pattern: /IIM Bangalore|Indian Institute of Management.*Bangalore/i,
                update: {
                    rank: "2",
                    placements: { averagePackage: "35.31 LPA", averagePackageNumeric: 35.31, source: "Official Placement Report 2024", placedPercentage: 100, academicYear: "2023-24", isVerified: true }
                }
            },
            {
                pattern: /BITS Pilani/i,
                update: {
                    rank: "20",
                    placements: { averagePackage: "30.37 LPA", averagePackageNumeric: 30.37, source: "Industry Report 2024", placedPercentage: 98, academicYear: "2023-24", isVerified: true }
                }
            }
        ];

        for (const item of eliteData) {
            const result = await College.updateMany(
                { name: { $regex: item.pattern } },
                { $set: { ...item.update, isCore: true } }
            );
            console.log(`✅ Updated matches for ${item.pattern}: ${result.modifiedCount}.`);
        }

    } catch (err) {
        console.error("❌ Update failed:", err);
    } finally {
        mongoose.connection.close();
    }
}

updateElite();
