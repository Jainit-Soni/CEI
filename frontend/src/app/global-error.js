"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

export default function GlobalError({ error, reset }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="en">
            <body>
                <div style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    padding: "2rem",
                    textAlign: "center",
                    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                    fontFamily: "system-ui, sans-serif"
                }}>
                    <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>🛠️</div>
                    <h2 style={{
                        fontSize: "2rem",
                        fontWeight: "700",
                        marginBottom: "1rem",
                        color: "#1e293b",
                    }}>
                        Something went wrong!
                    </h2>
                    <p style={{
                        color: "#64748b",
                        marginBottom: "2rem",
                        maxWidth: "500px",
                    }}>
                        We've been notified and are working on it. You can try refreshing the page or head back to safety.
                    </p>

                    <div style={{ display: "flex", gap: "12px" }}>
                        <button
                            onClick={() => reset()}
                            style={{
                                padding: "0.75rem 2rem",
                                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                                color: "white",
                                border: "none",
                                borderRadius: "12px",
                                fontSize: "1rem",
                                fontWeight: "600",
                                cursor: "pointer",
                            }}
                        >
                            Try again
                        </button>

                        <Link
                            href="/"
                            style={{
                                padding: "0.75rem 2rem",
                                background: "white",
                                color: "#1e293b",
                                border: "1px solid #e2e8f0",
                                borderRadius: "12px",
                                fontSize: "1rem",
                                fontWeight: "600",
                                textDecoration: "none"
                            }}
                        >
                            Back Home
                        </Link>
                    </div>
                </div>
            </body>
        </html>
    );
}
