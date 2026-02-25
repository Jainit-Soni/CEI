const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const connectDB = require('../config/db');
const Exam = require('../models/ExamSchema');

const migrateExamsToMongo = async () => {
    await connectDB();
    console.log('Starting Exams JSON to MongoDB migration...');

    try {
        const filePath = path.join(__dirname, '../models/exams.json');
        if (!fs.existsSync(filePath)) {
            console.log('No exams.json found.');
            process.exit(0);
        }

        let data = fs.readFileSync(filePath, 'utf-8');
        data = data.replace(/^\uFEFF/, ''); // Strip BOM
        const exams = JSON.parse(data);

        await Exam.deleteMany({}); // Clear existing to prevent duplicates during testing/migration
        console.log('Cleared existing exams collection.');

        const result = await Exam.insertMany(exams);
        console.log(`✅ Successfully inserted ${result.length} exams from exams.json.`);

    } catch (error) {
        console.error('❌ Error during migration:', error);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
};

migrateExamsToMongo();
