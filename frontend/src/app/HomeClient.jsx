"use client";

import dynamic from 'next/dynamic';
import PremiumHome from "../components/PremiumHome";

// Lazy load below-the-fold components with glass skeletons
const CorePaths = dynamic(() => import("../components/CorePaths"), { 
    loading: () => <div className="h-[400px] w-full animate-pulse bg-white/5 rounded-3xl" />
});
const WhyCei = dynamic(() => import("../components/WhyCei"), { 
    loading: () => <div className="h-[500px] w-full animate-pulse bg-white/5 rounded-3xl" />
});
const IntelligenceFacts = dynamic(() => import("../components/IntelligenceFacts"), { 
    loading: () => <div className="h-[400px] w-full animate-pulse bg-white/5 rounded-3xl" />
});
const TrustTransparency = dynamic(() => import("../components/TrustTransparency"), { 
    loading: () => <div className="h-[300px] w-full animate-pulse bg-white/5 rounded-3xl" />
});
const IntelligencePipeline = dynamic(() => import("../components/CommunityExtras"), { 
    loading: () => <div className="h-[400px] w-full animate-pulse bg-white/5 rounded-3xl" />
});

export default function HomeClient() {
    return (
        <div className="home-master-container" style={{ position: 'relative', width: '100%', background: 'transparent', overflowX: 'hidden' }}>
            {/* The PREMIUM CONTENT WRAPPER */}
            <main className="content-scroller" style={{ position: 'relative', zIndex: 1, background: 'transparent' }}>
                <PremiumHome />
                
                <div style={{ position: 'relative', zIndex: 5 }}>
                    <CorePaths />
                    <WhyCei />
                    <IntelligenceFacts />
                    <TrustTransparency />
                    <IntelligencePipeline />
                </div>
            </main>
        </div>
    );
}
