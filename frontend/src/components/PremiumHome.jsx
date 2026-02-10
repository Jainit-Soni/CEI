"use client";

import { ArrowRight, Shield, Activity, Globe } from "lucide-react";
import Link from "next/link";
import "./PremiumHome.css";

export default function PremiumHome() {
    return (
        <section className="premium-home">
            <div className="premium-container">
                {/* Brand Signal */}
                <div className="premium-kicker fadeIn">
                    <div className="kicker-dot" />
                    <span>COLLEGE EXAM INTELLIGENCE — VERSION 2.0</span>
                </div>

                {/* The Primary Statement */}
                <h1 className="premium-title fadeIn delay-1">
                    The Admission <br />
                    <span className="serif-accent">Verdict.</span>
                </h1>

                {/* The Specific Goal Subtext */}
                <p className="premium-mission fadeIn delay-2">
                    Architecting India’s academic legacies. Track 2000+ elite institutions,
                    compare real-time admissions data, and master the strategy
                    behind every entrance exam with absolute intelligence.
                </p>

                {/* The Single Strategic Goal (CTA) */}
                <div className="premium-actions fadeIn delay-3">
                    <Link href="/colleges" className="btn-premium-goal">
                        ENTER THE STRATEGIC VAULT <ArrowRight size={20} />
                    </Link>
                </div>
            </div>

            {/* Subtle Artistic Texture */}
            <div className="premium-overlay" />
        </section>
    );
}
