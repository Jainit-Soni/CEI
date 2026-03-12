const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function verify() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Exam = mongoose.connection.collection('exams');
        const exams = await Exam.find({ shortName: { $in: ['JEE Main', 'CAT', 'CMAT', 'XAT'] } }).toArray();
        
        console.log("--- SQL-STYLE DATA AUDIT ---");
        exams.forEach(e => {
            console.log(`[${e.shortName}] -> ${e.officialUrl}`);
        });
        console.log("----------------------------");
        
        mongoose.connection.close();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

verify();
