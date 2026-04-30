#!/usr/bin/env node
const { MongoClient } = require('mongodb');
async function test() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');
    const corruptedDbSeats = await db.collection('medical_seat_matrix').find({
        $or: [{ seat_count: { $gt: 500 } }, { seat_count: null }, { seat_count: { $type: 'string' } }]
    }).toArray();
    console.log('Remaining Corrupted Rows:', corruptedDbSeats.length);
    await client.close();
}
test();
