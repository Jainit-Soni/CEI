import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const aisheCode = searchParams.get('aisheCode');

    if (!aisheCode) {
        return NextResponse.json({ error: "aisheCode is required" }, { status: 400 });
    }

    try {
        // Resolve absolute path (handles local dev and Vercel build output structure differences)
        const dbPath = path.resolve(process.cwd(), '../backend/data/cutoffs_index.ndjson');
        
        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: "Shadow Registry unavailable", cutoffs: [] }, { status: 200 });
        }

        const results = [];
        const fileStream = fs.createReadStream(dbPath);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        for await (const line of rl) {
            try {
                const row = JSON.parse(line);
                if (row.aisheCode === aisheCode) {
                    results.push(row);
                }
            } catch (e) {
                // Ignore parse errors on single lines
            }
        }

        return NextResponse.json({ cutoffs: results }, { status: 200 });

    } catch (error) {
        console.error("Cutoffs API Error:", error);
        return NextResponse.json({ error: "Failed to fetch cutoffs" }, { status: 500 });
    }
}
