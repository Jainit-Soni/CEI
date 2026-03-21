"use client";

import React, { useState, useEffect } from "react";
import { Zap, Info, ArrowRight } from "lucide-react";
import Link from "next/link";

const signals = [
    { 
      id: 1, 
      type: "critical", 
      text: "JoSAA 2026: Registration begins June 10", 
      tag: "SCHEDULE",
      link: "/colleges"
    },
    { 
      id: 2, 
      type: "warning", 
      text: "Truth-Grade: 42 top-tier institutes flagged", 
      tag: "AUDIT",
      link: "/news"
    },
    { 
      id: 3, 
      type: "info", 
      text: "New 'Truth-Rank' ROI Algorithm live", 
      tag: "ALGO",
      link: "/roi-calculator"
    },
    { 
      id: 4, 
      type: "critical", 
      text: "IIT Madras CS Cutoff Predicted to Drop", 
      tag: "PREDICTION",
      link: "/admission-calculator"
    }
];

export default function HeaderSignal() {
    const [index, setIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setIsVisible(false);
            setTimeout(() => {
                setIndex((prev) => (prev + 1) % signals.length);
                setIsVisible(true);
            }, 500);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const signal = signals[index];

    return (
        <Link 
            href={signal.link}
            className={`header-signal-pill ${isVisible ? 'fade-in' : 'fade-out'}`}
            title={signal.text}
        >
            <div className={`signal-dot ${signal.type}`} />
            <span className="signal-tag">{signal.tag}</span>
            <span className="signal-text">{signal.text}</span>
            <ArrowRight size={10} className="signal-arrow" />
        </Link>
    );
}
