"use client";

import { useEffect, useRef, useState } from "react";
import { Shield, Activity, Globe } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import FluidGlass from "./animations/FluidGlass";
// Lazy load the heavy 3D element so it doesn't block mobile PageSpeed Execution
import dynamic from 'next/dynamic';
const FluidGlassDynamic = dynamic(() => import('./animations/FluidGlass'), { ssr: false });
import "./PremiumHome.css";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

export default function PremiumHome() {
    const spotlightRef = useRef(null);
    const sectionRef = useRef(null);

    // Strict Device Detection to completely unmount WebGL on mobile
    const [isMounted, setIsMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

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
        const handleMouseMove = (e) => {
            if (spotlightRef.current) {
                const { clientX, clientY } = e;
                spotlightRef.current.style.background = `radial-gradient(1000px circle at ${clientX}px ${clientY}px, rgba(79, 70, 229, 0.12), transparent 40%)`;
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
        <section ref={sectionRef} className="premium-home-drilldown" data-vercel-cache-bust="v16">
            {/* The sticky container holds everything that stays on screen while pinning */}
            <div className="premium-home-sticky">

                {/* Interactive Background Spotlight */}
                <div ref={spotlightRef} className="premium-spotlight" />

                {/* Subtle Artistic Texture */}
                <div className="premium-overlay" />

                {/* Desktop: The Heavy 3D Intelligence Lens Overlay (No Scroll Dependency) */}
                {isMounted && !isMobile && <FluidGlassDynamic />}

                {/* The HTML Content */}
                <div className="premium-container pointer-events-auto">
                    {/* Brand Signal */}
                    <div className="premium-kicker fadeIn">
                        <div className="kicker-dot" />
                        <span>CEI — INDIA'S ULTIMATE COLLEGE PLATFORM</span>
                    </div>

                    {/* The Primary Statement with Typography Pop (Fixed ScrollReveal issue) */}
                    <h1 className="premium-title fadeIn delay-1">
                        Discover. Rank. <span className="serif-accent">Hype.</span>
                    </h1>

                    {/* PPT-Style Concise Feature List */}
                    <div className="premium-features-list fadeIn delay-2">
                        <div className="feature-bullet">
                            <Activity className="feature-icon" size={24} />
                            <div>
                                <h3>Real-Time Analytics</h3>
                                <p>Live cutoffs & predictive admission tracking.</p>
                            </div>
                        </div>
                        <div className="feature-bullet">
                            <Globe className="feature-icon" size={24} />
                            <div>
                                <h3>Elite Campuses</h3>
                                <p>Deep-dive data on India's top institutions.</p>
                            </div>
                        </div>
                        <div className="feature-bullet">
                            <Shield className="feature-icon" size={24} />
                            <div>
                                <h3>Verified Fan Wars</h3>
                                <p>Champion your college on the national leaderboard.</p>
                            </div>
                        </div>
                    </div>

                    {/* Static Intelligence Dashboard */}
                    <div className="intelligence-dashboard-static fadeIn delay-2">
                        <div className="hq-circle-panel hq-circle-static">
                            <span className="hq-kicker">INSTITUTES</span>
                            <h2 className="hq-value">1,200+</h2>
                            <span className="hq-detail">Validated Colleges</span>
                        </div>

                        <div className="hq-circle-panel hq-circle-static">
                            <span className="hq-kicker">LIVE ENGINE</span>
                            <h2 className="hq-value">Predict</h2>
                            <span className="hq-detail">Real-Time Cutoffs</span>
                        </div>

                        <div className="hq-circle-panel hq-circle-static">
                            <span className="hq-kicker">COMMUNITY</span>
                            <h2 className="hq-value">Wars</h2>
                            <span className="hq-detail">College Leaderboards</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
