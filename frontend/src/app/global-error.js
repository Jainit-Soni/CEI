"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({ error, reset }) {
    useEffect(() => {
        if (error) Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="en">
            <body style={{ margin: 0 }}>
                <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden" style={{ background: 'var(--color-bg)', fontFamily: 'var(--font-body)' }}>
                    {/* Background Spectral Bands */}
                    <div className="chromatic-bands">
                        <div className="chromatic-band-3"></div>
                        <div className="chromatic-band-4"></div>
                    </div>

                    <div className="relative z-10 max-w-xl w-full">
                        {/* Glass Card */}
                        <div
                            className="glass p-10 md:p-14 rounded-3xl text-center flex flex-col items-center"
                            style={{
                                background: 'rgba(255, 255, 255, 0.7)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255, 255, 255, 0.5)',
                                boxShadow: 'var(--shadow-xl)'
                            }}
                        >
                            <div
                                className="mb-8 p-6 rounded-2xl"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(244, 63, 94, 0.05))',
                                    animation: 'floatSlow 4s ease-in-out infinite'
                                }}
                            >
                                <AlertTriangle size={64} className="text-red-500" strokeWidth={1.5} />
                            </div>

                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
                                Critical Anomaly
                            </h1>

                            <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed" style={{ maxWidth: '400px' }}>
                                A fundamental error has disrupted the application kernel. We have been notified.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                                <button
                                    onClick={() => reset()}
                                    className="bg-accent hover:bg-accent-hover text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg active:scale-95"
                                    style={{ background: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}
                                >
                                    <RefreshCw size={20} className="mr-3" /> ATTEMPT RECOVERY
                                </button>

                                <Link
                                    href="/"
                                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-4 rounded-xl font-bold flex items-center justify-center transition-all"
                                    style={{ fontFamily: 'var(--font-mono)' }}
                                >
                                    RETURN HOME
                                </Link>
                            </div>

                            {/* Dev Only Details */}
                            {process.env.NODE_ENV === 'development' && (
                                <div className="mt-12 w-full text-left">
                                    <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 font-bold px-4">Diagnostic Trace</div>
                                    <div className="p-4 bg-slate-950/5 rounded-xl border border-slate-200/50 max-h-40 overflow-auto text-xs text-red-600 font-mono leading-relaxed">
                                        {error && error.toString()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
