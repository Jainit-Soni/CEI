"use client";

import { useEffect, useRef } from "react";
import "./AnimatedHero.css";

/**
 * AnimatedHero - Full-height hero section with multi-layer animated gradient
 * Features floating orbs, glass search panel, and scroll-triggered effects
 */
export default function AnimatedHero({
    badge,
    title,
    subtitle,
    children,
    stats,
    className = "",
}) {
    const heroRef = useRef(null);

    useEffect(() => {
        // Parallax effect on scroll
        const handleScroll = () => {
            if (!heroRef.current) return;
            const scrollY = window.scrollY;
            const heroHeight = heroRef.current.offsetHeight;

            if (scrollY < heroHeight) {
                const parallaxValue = scrollY * 0.3;
                heroRef.current.style.setProperty("--parallax-y", `${parallaxValue}px`);
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <section ref={heroRef} className={`animated-hero ${className}`}>
            {/* Animated gradient background */}
            <div className="hero-gradient-bg" aria-hidden="true">
                <div className="hero-orb hero-orb--1" />
                <div className="hero-orb hero-orb--2" />
                <div className="hero-orb hero-orb--3" />
                <div className="hero-orb hero-orb--4" />
            </div>

            {/* Noise texture overlay */}
            <div className="hero-noise" aria-hidden="true" />

            {/* Content */}
            <div className="hero-container">
                <div className="hero-content">
                    {badge && (
                        <div className="hero-badge badge badge-glow">
                            <span className="badge-dot" aria-hidden="true" />
                            {badge}
                        </div>
                    )}

                    <h1 className="hero-title">{title}</h1>

                    {subtitle && <p className="hero-subtitle">{subtitle}</p>}

                    {/* Stats row */}
                    {stats && stats.length > 0 && (
                        <div className="hero-stats">
                            {stats.map((stat, index) => (
                                <div key={index} className="hero-stat">
                                    <span className="hero-stat-value mono">{stat.value}</span>
                                    <span className="hero-stat-label">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Search panel or custom children */}
                <div className="hero-panel">
                    {children}
                </div>
            </div>

            {/* Scroll indicator */}
            <div className="hero-scroll-indicator" aria-hidden="true">
                <div className="scroll-line" />
            </div>
        </section>
    );
}
