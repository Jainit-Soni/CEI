"use client";

import { ArrowRight, Shield, Activity, Globe } from "lucide-react";
import Link from "next/link";
import ScrollReveal from "./animations/ScrollReveal";
import FluidGlass from "./animations/FluidGlass";
import "./PremiumHome.css";

export default function PremiumHome() {
    return (
        <section className="premium-home">
            {/* The Intelligence Lens Overlay */}
            <FluidGlass title="Discover. Rank. Hype." />

            <div className="premium-container">
                {/* Brand Signal */}
                <div className="premium-kicker fadeIn">
                    <div className="kicker-dot" />
                    <span>CEI — INDIA'S ULTIMATE COLLEGE PLATFORM</span>
                </div>

                {/* The Primary Statement */}
                <ScrollReveal as="h1" containerClassName="premium-title" baseRotation={2} blurStrength={6}>
                    Discover. Rank. Hype.
                </ScrollReveal>

                {/* The Specific Goal Subtext */}
                <ScrollReveal as="p" containerClassName="premium-mission" baseOpacity={0.2} blurStrength={3}>
                    The undisputed platform for Indian students to compare real-time admissions data, track 2000+ elite institutions, secure scholarships, and push their campuses to the top of the Fan Wars.
                </ScrollReveal>

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
