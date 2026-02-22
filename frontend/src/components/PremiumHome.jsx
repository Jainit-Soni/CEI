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
                    <span>CEI — INDIA'S ULTIMATE COLLEGE PLATFORM</span>
                </div>

                {/* The Primary Statement */}
                <h1 className="premium-title fadeIn delay-1">
                    Discover. Rank. <br />
                    <span className="serif-accent">Hype.</span>
                </h1>

                {/* The Specific Goal Subtext */}
                <p className="premium-mission fadeIn delay-2">
                    The undisputed platform for Indian students to compare real-time admissions data,
                    track 2000+ elite institutions, secure scholarships, and push their campuses
                    to the top of the Fan Wars.
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
