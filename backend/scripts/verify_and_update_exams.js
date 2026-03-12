require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const Exam = require('../models/ExamSchema');
const connectDB = require('../config/db');

async function verifyAndUpdateExams() {
    await connectDB();
    
    console.log("--- 💎 High-Fidelity Exam Integrity Update ---");
    
    const highFidelityData = [
        {
            query: { shortName: "JEE Main" },
            update: {
                officialUrl: "https://jeemain.nta.nic.in/",
                pastPapers: [
                    { label: "NTA Downloads Center", url: "https://jeemain.nta.nic.in/" },
                ],
                stats: {
                    applicants: "12.3 Lakh+",
                    fee: "₹1,000 (General) / ₹800 (Reserved)",
                    duration: "180 Minutes",
                    mode: "Computer Based Test (CBT)"
                }
            }
        },
        {
            query: { shortName: "CAT" },
            update: {
                officialUrl: "https://iimcat.ac.in",
                pastPapers: [
                    { label: "CAT Official Sample (2024)", url: "https://iimcat.ac.in/per/g01/pub/756/ASM/WebPortal/1/index.html" }
                ]
            }
        },
        {
            query: { shortName: "CMAT" },
            update: {
                officialUrl: "https://cmat.nta.nic.in/",
                pastPapers: [
                    { label: "NTA CMAT Information Bulletin", url: "https://cmat.nta.nic.in/" }
                ]
            }
        },
        {
            query: { shortName: "XAT" },
            update: {
                officialUrl: "https://xatonline.in/",
                pastPapers: [
                    { label: "Official XAT Sample Papers", url: "https://xatonline.in/official-prep" }
                ]
            }
        }
    ];

    for (const item of highFidelityData) {
        const result = await Exam.updateMany(item.query, { $set: item.update });
        console.log(`💎 Updated ${item.query.shortName}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- High-Fidelity Update Complete ---");
    process.exit(0);
}

verifyAndUpdateExams().catch(err => {
    console.error(err);
    process.exit(1);
});
