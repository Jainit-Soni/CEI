"use client";

import PremiumHome from "../components/PremiumHome";
import IntelligenceFacts from "../components/IntelligenceFacts";

export default function HomeClient() {
    return (
        <div className="home-master-container" style={{ position: 'relative', minHeight: '100vh', width: '100%', background: 'transparent' }}>
            {/* 1. THE SHARED HERO CANVAS (Synced with College Page Layout) */}
            <div className="cinematic-backdrop" aria-hidden="true" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 0, // Above layout's bands but behind content
                background: 'transparent', // Allow global bands to show through
                overflow: 'hidden',
                pointerEvents: 'none'
            }}>
                {/* Indigo Orb 1 - Top Left (Exact College Sync) */}
                <div style={{
                    position: 'absolute',
                    width: '600px',
                    height: '600px',
                    background: 'radial-gradient(circle, rgba(79, 70, 229, 0.15) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                    top: '-15%',
                    left: '-10%',
                    animation: 'orbFloat1 20s ease-in-out infinite'
                }} />

                {/* Indigo Orb 2 - Middle Right (Exact College Sync) */}
                <div style={{
                    position: 'absolute',
                    width: '500px',
                    height: '500px',
                    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
                    bottom: '20%',
                    right: '-5%',
                    filter: 'blur(70px)',
                    animation: 'orbFloat2 25s ease-in-out infinite'
                }} />

                {/* Sky Orb 3 - Soft Bottom Left (Extra Depth) */}
                <div style={{
                    position: 'absolute',
                    width: '400px',
                    height: '400px',
                    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%)',
                    bottom: '-10%',
                    left: '15%',
                    filter: 'blur(60px)',
                    animation: 'orbFloat3 22s ease-in-out infinite'
                }} />
            </div>

            {/* Shared Animations (Synced with College Page) */}
            <style jsx global>{`
                @keyframes orbFloat1 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(30px, -20px) scale(1.05); }
                }
                @keyframes orbFloat2 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(-30px, 30px) scale(0.95); }
                }
                @keyframes orbFloat3 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(20px, 20px) scale(1.1); }
                }
            `}</style>

            {/* 2. THE PREMIUM CONTENT WRAPPER */}
            <main className="content-scroller" style={{ position: 'relative', zIndex: 1, background: 'transparent' }}>
                <PremiumHome />
                <IntelligenceFacts />
            </main>
        </div>
    );
}
