/**
 * scripts/testAuth.js — CEI Auth Pipeline Verification (Phase XV)
 * ==============================================================
 * Test script to verify JWT signing and verification using the
 * production-ready JWT_SECRET.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const jwt = require('jsonwebtoken');

console.log('Testing CEI Auth Pipeline...');

if (!process.env.JWT_SECRET) {
    console.error('❌ FAIL: JWT_SECRET is not set in environment.');
    process.exit(1);
}

try {
    const payload = {
        sub: 'test_admin',
        role: 'super_admin',
        jti: 'test-jti-' + Date.now()
    };

    console.log('1. Signing test token...');
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('   Token generated successfully.');

    console.log('2. Verifying test token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.sub === payload.sub && decoded.role === payload.role) {
        console.log('✅ PASS: Token signing and verification are correct.');
        console.log('   Decoded Payload:', decoded);
    } else {
        throw new Error('Payload mismatch after verification.');
    }

} catch (err) {
    console.error('❌ FAIL: Auth pipeline test failed:', err.message);
    process.exit(1);
}
