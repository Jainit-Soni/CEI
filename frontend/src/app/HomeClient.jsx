"use client";

import PremiumHome from "../components/PremiumHome";
import CorePaths from "../components/CorePaths";
import WhyCei from "../components/WhyCei";
import IntelligenceFacts from "../components/IntelligenceFacts";
import TrustTransparency from "../components/TrustTransparency";
import IntelligencePipeline from "../components/CommunityExtras";

export default function HomeClient() {
    return (
        <div className="home-master-container" style={{ position: 'relative', minHeight: '100vh', width: '100%', background: 'transparent' }}>
            {/* 1. THE SHARED HERO CANVAS (Synced with College Page Layout) */}
            {/* 2. THE PREMIUM CONTENT WRAPPER */}
            <main className="content-scroller" style={{ position: 'relative', zIndex: 1, background: 'transparent' }}>
                <PremiumHome />
                <CorePaths />
                <WhyCei />
                <IntelligenceFacts />
                <TrustTransparency />
                <IntelligencePipeline />
            </main>
        </div>
    );
}
