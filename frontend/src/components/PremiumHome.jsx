"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAggregateStats } from "@/lib/api";
import Button from "./Button";
import { Shield, Activity, Globe } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from 'next/dynamic';
const FluidGlassDynamic = dynamic(() => import('./animations/FluidGlass'), { ssr: false });
import LiveboardTicker from "./home/LiveboardTicker";
import "./PremiumHome.css";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

export default function PremiumHome() {
    const spotlightRef = useRef(null);
    const sectionRef = useRef(null);
    const containerRef = useRef(null);

    const [isMounted, setIsMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [stats, setStats] = useState({
        scannedInstitutes: "12.2k",
        totalColleges: "12,000+",
        integrityPoints: "1.4M+"
    });

    useEffect(() => {
        setIsMounted(true);
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();

        // Fetch real stats
        fetchAggregateStats()
            .then(data => {
                if (data.totalColleges) {
                    setStats({
                        scannedInstitutes: `${(data.totalColleges / 1000).toFixed(1)}k`,
                        totalColleges: data.totalColleges.toLocaleString() + "+",
                        integrityPoints: data.integrityPoints ? `${(data.integrityPoints / 1000000).toFixed(1)}M+` : "1.4M+"
                    });
                }
            })
            .catch(err => console.error("Stats fetch failed:", err));

        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    useEffect(() => {
        if (!isMounted || isMobile) return;

        // Cinematic Perspective Parallax & Hero Pinning
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: sectionRef.current,
                start: "top top",
                end: "+=60%", // Drive through the extended height
                scrub: 1,
                onUpdate: (self) => setScrollProgress(self.progress),
            }
        });

        // Anti-Gravity Layering: Moving different elements at different rates
        tl.to(".premium-container", {
            y: -100,
            z: 50,
            opacity: 0,
            ease: "none"
        }, 0);

        tl.to(".hero-fluidglass", {
            scale: 1.2,
            z: 100,
            ease: "none"
        }, 0);

        return () => {
            if (ScrollTrigger.getById("heroTrigger")) {
                ScrollTrigger.getById("heroTrigger").kill();
            }
        };
    }, [isMounted, isMobile]);

    return (
        <section ref={sectionRef} className="premium-home-light">
            <div className="premium-home-sticky">
                {/* Desktop: The Intelligence Lens (State-Driven) */}
                {isMounted && !isMobile && (
                    <div className="hero-fluidglass" aria-hidden="true" style={{ transformStyle: 'preserve-3d' }}>
                        <FluidGlassDynamic progress={scrollProgress} />
                    </div>
                )}

                {/* The HTML Content - Absolute Centering for High-Fidelity restoration */}
                <div ref={containerRef} className="premium-container">
                    <div className="text-center">
                        {/* Brand Signal */}
                        <div className="premium-kicker fadeIn">
                            <div className="kicker-dot" />
                            <span>CEI · PREMIUM INTELLIGENCE</span>
                        </div>

                        {/* The Primary Statement with Typography Pop */}
                        <h1 className="premium-title fadeIn delay-1">
                            High-Fidelity <span className="serif-accent">Integrity</span> for your 2026 path.
                        </h1>

                        <p className="premium-subtitle fadeIn delay-1">
                            CEI synthesizes thousands of data points into a single, structured intelligence layer.
                            No noise. No bias. Just the facts for your final decision.
                        </p>

                        {/* Intelligence Console - Immersive Data Layer */}
                        <div className="intelligence-console fadeIn delay-2 anti-gravity-card" style={{ padding: '32px' }}>
                            <div className="console-header">
                                <div className="console-status">
                                    <span className="status-dot pulse" />
                                    <span className="status-text">INTELLIGENCE ENGINE ACTIVE</span>
                                </div>
                                <div className="console-metadata">
                                    SCANNED: {stats.scannedInstitutes} INSTITUTES · REAL-TIME SYNC
                                </div>
                            </div>

                            <div className="console-grid">
                                <div className="console-item" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <span className="item-label text-emerald-400">INSTITUTES</span>
                                    <h2 className="item-value">{stats.totalColleges}</h2>
                                    <span className="item-detail">Indexed for 2026</span>
                                </div>

                                <div className="console-item" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <span className="item-label text-blue-400">ENGINE STATUS</span>
                                    <h2 className="item-value">ACTIVE</h2>
                                    <span className="item-detail">Real-Time Core</span>
                                </div>

                                <div className="console-item" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <span className="item-label text-indigo-400">INTEGRITY</span>
                                    <h2 className="item-value">{stats.integrityPoints}</h2>
                                    <span className="item-detail">Verified Data Points</span>
                                </div>
                            </div>

                            <div className="console-footer">
                                <div className="footer-tag">AI VALIDATED</div>
                                <div className="footer-tag">PLACEMENT INTEL</div>
                                <div className="footer-tag">ROI OPTIMIZED</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
