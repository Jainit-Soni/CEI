import { NextResponse } from 'next/server';

// This is a Server-Side Route Handler
// It hides the ADMIN_SECRET from the client.

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());

export async function POST(req) {
    try {
        const body = await req.json();
        const { action, endpoint, data, userEmail } = body;

        // 1. Double Check Whitelist (Defense in Depth)
        if (!userEmail || !ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
            return NextResponse.json({ error: "Unauthorized Proxy Access" }, { status: 403 });
        }

        if (!ADMIN_SECRET) {
            return NextResponse.json({ error: "Server Configuration Error: Secret Missing" }, { status: 500 });
        }

        // 2. Forward to Real Backend with Secret
        const res = await fetch(`${BACKEND_URL}/api${endpoint}`, {
            method: action, // GET, POST, DELETE
            headers: {
                "Content-Type": "application/json",
                "x-admin-secret": ADMIN_SECRET
            },
            body: action !== 'GET' ? JSON.stringify(data) : undefined
        });

        const result = await res.json();
        return NextResponse.json(result, { status: res.status });

    } catch (err) {
        console.error("Admin Proxy Error:", err);
        return NextResponse.json({ error: "Proxy Failed" }, { status: 500 });
    }
}
