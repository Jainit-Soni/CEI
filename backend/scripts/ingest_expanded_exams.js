const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const connectDB = require('../config/db');
const Exam = require('../models/ExamSchema');

const ingestExpanded = async () => {
    await connectDB();
    console.log('Starting ingestion of Expanded Exams...');

    try {
        const filePath = path.join(__dirname, '../models/expanded_exams.json');
        let data = fs.readFileSync(filePath, 'utf-8');
        data = data.replace(/^\uFEFF/, ''); // Strip BOM
        const exams = JSON.parse(data);

        let count = 0;
        for (const examData of exams) {
            await Exam.findOneAndUpdate(
                { id: examData.id },
                { $set: examData },
                { upsert: true, new: true }
            );
            count++;
        }
        console.log(`✅ Successfully upserted ${count} new exams into the database.`);

    } catch (error) {
        console.error('❌ Error during insertion:', error);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
};

ingestExpanded();
