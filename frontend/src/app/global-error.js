"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
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
                }}>
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
                        We've been notified and are working on it. Please try again.
                    </p>
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
                </div>
            </body>
        </html>
    );
}
