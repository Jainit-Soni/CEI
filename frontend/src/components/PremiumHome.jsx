"use client";

import { useEffect, useRef, useState } from "react";
import Button from "./Button";
import { Shield, Activity, Globe } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from 'next/dynamic';
const FluidGlassDynamic = dynamic(() => import('./animations/FluidGlass'), { ssr: false });
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

    useEffect(() => {
        setIsMounted(true);
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
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

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (spotlightRef.current) {
                const { clientX, clientY } = e;
                spotlightRef.current.style.background = `radial-gradient(1000px circle at ${clientX}px ${clientY}px, rgba(99, 102, 241, 0.1), transparent 70%)`;
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
        <section ref={sectionRef} className="premium-home-light">
            <div className="premium-home-sticky">
                {/* 1. CHROMATIC PULSE */}
                <div className="chromatic-bands">
                    <div className="chromatic-band-3" />
                    <div className="chromatic-band-4" />
                </div>

                {/* 2. Interactive Background Spotlight */}
                <div ref={spotlightRef} className="premium-spotlight" />

                {/* 3. Subtle Artistic Texture */}
                <div className="premium-overlay" />

                {/* Desktop: The Intelligence Lens (State-Driven) */}
                {isMounted && !isMobile && (
                    <div className="hero-fluidglass" aria-hidden="true" style={{ transformStyle: 'preserve-3d' }}>
                        <FluidGlassDynamic progress={scrollProgress} />
                    </div>
                )}

                {/* The HTML Content */}
                <div ref={containerRef} className="premium-container pointer-events-auto">
                    {/* Brand Signal */}
                    <div className="premium-kicker fadeIn">
                        <div className="kicker-dot" />
                        <span>CEI · PREMIUM INTELLIGENCE</span>
                    </div>

                    {/* The Primary Statement with Typography Pop */}
                    <h1 className="premium-title fadeIn delay-1">
                        High-Fidelity <span className="serif-accent">Clarity</span> for your path.
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
                                SCANNED: 2.8k INSTITUTES · REAL-TIME SYNC
                            </div>
                        </div>

                        <div className="console-grid">
                            <div className="console-item" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}>
                                <span className="item-label">INSTITUTES</span>
                                <h2 className="item-value">2,800+</h2>
                                <span className="item-detail">Verified Data Points</span>
                            </div>

                            <div className="console-item" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}>
                                <span className="item-label">ENGINE STATUS</span>
                                <h2 className="item-value">ACTIVE</h2>
                                <span className="item-detail">Real-Time Cutoffs</span>
                            </div>

                            <div className="console-item" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}>
                                <span className="item-label">CONFIDENCE</span>
                                <h2 className="item-value">99.8%</h2>
                                <span className="item-detail">Data Integrity Level</span>
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
        </section>
    );
}
