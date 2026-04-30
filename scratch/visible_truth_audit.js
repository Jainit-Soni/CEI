const fs = require('fs');
const content = fs.readFileSync('backend/data/colleges_new.ndjson', 'utf8');
const lines = content.split('\n').filter(Boolean);

let total = lines.length;
let withPlacements = 0;
let withFees = 0;
let withCourses = 0;
let withSeats = 0; // Measured from verifiedFields mock
let withCutoffs = 0; // Measured from verifiedFields mock

lines.forEach(l => {
    const c = JSON.parse(l);
    if (c.placements && c.placements.isVerified) withPlacements++;
    if (c.fees && c.fees.isVerified) withFees++;
    if (c.courses && c.courses.length > 0) withCourses++;
});

// Load verified fields for seats/cutoffs
const verifiedFields = fs.readFileSync('backend/data/verified/verified_fields.ndjson', 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const seatIds = new Set(verifiedFields.filter(f => f.fieldName === 'student_intake').map(f => f.collegeId));
const cutoffIds = new Set(verifiedFields.filter(f => f.fieldName === 'closingRank').map(f => f.collegeId));

withSeats = seatIds.size;
withCutoffs = cutoffIds.size;

console.log('--- FRONTEND VISIBLE TRUTH AUDIT ---');
console.log(`Total Institutions: ${total}`);
console.log(`Visible Placements: ${withPlacements}`);
console.log(`Visible Fees: ${withFees}`);
console.log(`Visible Courses: ${withCourses}`);
console.log(`Visible Seats: ${withSeats}`);
console.log(`Visible Cutoffs: ${withCutoffs}`);
