import React from 'react';
import './TopBanner.css';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function TopBanner() {
    return (
        <div className="top-banner">
            <div className="banner-glow" />
            <a
                href="https://reactbits.dev/pro"
                target="_blank"
                rel="noopener noreferrer"
                className="banner-content"
            >
                <Sparkles size={14} className="banner-icon" />
                <span className="banner-text">
                    React Bits Pro is live — <strong>25% off</strong> launch special (limited time)
                </span>
                <ArrowRight size={14} className="banner-arrow" />
            </a>
        </div>
    );
}
