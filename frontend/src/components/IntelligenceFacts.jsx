"use client";

import { useState, useEffect } from "react";
import {
    Trophy, Map, TrendingUp, Users, Calendar, Building2, Rocket, Award,
    Globe, Briefcase, Clock, Microscope, Library, Shield, BookOpen, Cpu, Zap
} from "lucide-react";
import "./IntelligenceFacts.css";

const AMAZING_FACTS = [
    { id: 1, value: "1 in 150", label: "SELECTIVITY", description: "Getting into an IIT is statistically 10x harder than Harvard.", icon: <Trophy />, accent: "blue" },
    { id: 2, value: "2,100", label: "GIGANTIC SCALE", description: "IIT Kharagpur's campus is larger than the entire country of Monaco.", icon: <Map />, accent: "emerald" },
    { id: 3, value: "PRIVATE", label: "AIRSTRIP", description: "IIT Kanpur is the only college in India with its own private runway.", icon: <Rocket />, accent: "purple" },
    { id: 4, value: "WORLD #1", label: "ANCIENT ORIGIN", description: "Takshashila was the world's first university, teaching 10,000 students in 700 BC.", icon: <Globe />, accent: "slate" },
    { id: 5, value: "BEYOND", label: "SPACE TECH", description: "COEP Pune is one of the few colleges globally to build and launch its own satellite.", icon: <Rocket />, accent: "blue" },
    { id: 6, value: "1847", label: "OLDEST CAMPUS", description: "IIT Roorkee was established years before the Eiffel Tower was built.", icon: <Clock />, accent: "emerald" },
    { id: 7, value: "100%", label: "VALUE RECOVERY", description: "At FMS Delhi, your starting salary can be 50x higher than your total fees.", icon: <TrendingUp />, accent: "purple" },
    { id: 8, value: "1.2M", label: "THE RUN", description: "More people attempt the UPSC exam than the population of many countries.", icon: <Users />, accent: "slate" },
    { id: 9, value: "TOP 1%", label: "BRAIN DRAIN", description: "IIT alumni comprise some of the highest-paid tech CEOs in the world today.", icon: <Award />, accent: "blue" },
    { id: 10, value: "24/7", label: "KNOWLEDGE", description: "IIM Ahmedabad's library is so vast it has its own dedicated heritage ranking.", icon: <Library />, accent: "emerald" },
    { id: 11, value: "MAMMOTH", label: "ENROLLMENT", description: "Delhi University is so large it has more students than the population of Iceland.", icon: <Building2 />, accent: "purple" },
    { id: 12, value: "1st SATELLITE", label: "SRM UNIVERSITY", description: "The first private university in India to put its own hardware into space.", icon: <Rocket />, accent: "slate" },
    { id: 13, value: "UNESCO", label: "NALANDA", description: "Ancient Nalanda was once the world's most sought-after residential university.", icon: <Library />, accent: "blue" },
    { id: 14, value: "3rd OLDEST", label: "COEP", description: "The College of Engineering Pune has been educating since 1854.", icon: <Calendar />, accent: "emerald" },
    { id: 15, value: "CEO FACTORY", label: "IIT DELHI", description: "This single campus has produced the world's highest density of startup unicorns.", icon: <Cpu />, accent: "purple" },
    { id: 16, value: "GLOBAL #1", label: "ISB CAMPUS", description: "Ranked as the fastest growing management campus for global executives.", icon: <TrendingUp />, accent: "slate" },
    { id: 17, value: "DEEP TECH", label: "IIT MADRAS", description: "Home to India's largest research park, housing over 200 deep-tech labs.", icon: <Microscope />, accent: "blue" },
    { id: 18, value: "100% CUTOFF", label: "SRCC PRESTIGE", description: "Entrance to this commerce campus once required a perfect score in board exams.", icon: <Trophy />, accent: "emerald" },
    { id: 19, value: "ROCKET SCIENCE", label: "BIT MESRA", description: "The only Indian college with a department dedicated to rocket propulsion.", icon: <Rocket />, accent: "purple" },
    { id: 20, value: "SILICON VALLEY", label: "BITS PILANI", description: "A top-tier bridge that connects Indian brains to the world's tech capital.", icon: <Globe />, accent: "slate" },
    { id: 21, value: "ELITE MED", label: "AFMC PUNE", description: "The first medical college in Asia to be set up and managed by an Army.", icon: <Shield />, accent: "blue" },
    { id: 22, value: "MASSIVE", label: "IIT BOMBAY", description: "Hosts 'Techfest', which is the largest science festival in all of Asia.", icon: <Zap />, accent: "emerald" },
    { id: 23, value: "ROYAL ROI", label: "IIM CALCUTTA", description: "One of the world's most triple-accredited elite management schools.", icon: <Briefcase />, accent: "purple" },
    { id: 24, value: "TECH HUB", label: "IIIT HYDERABAD", description: "The epicenter of India's competitive coding and AI research culture.", icon: <Cpu />, accent: "slate" },
    { id: 25, value: "150 YRS", label: "LEGACY", description: "Several Indian institutions were functional before modern lightbulbs existed.", icon: <Clock />, accent: "blue" }
];

const AMAZING_BANNERS = [
    { title: "Bigger than Nations", desc: "India's top university campuses cover more land area than entire sovereign countries." },
    { title: "The World's Toughest Race", desc: "The entrance exams for Indian elite institutions are statistically the hardest in human history." },
    { title: "The Ancient Cradle", desc: "India hosted the world's first university when most of the globe was barely literate." },
    { title: "Mission to Mars", desc: "India's record-breaking Mars mission was built by alumni from these institutions for less than the budget of the Hollywood movie 'Gravity'." }
];

export default function IntelligenceFacts() {
    const [randomPoints, setRandomPoints] = useState([]);
    const [randomBanner, setRandomBanner] = useState(AMAZING_BANNERS[0]);

    useEffect(() => {
        // Shuffle and take 4
        const shuffled = [...AMAZING_FACTS].sort(() => 0.5 - Math.random());
        setRandomPoints(shuffled.slice(0, 4));

        const banner = AMAZING_BANNERS[Math.floor(Math.random() * AMAZING_BANNERS.length)];
        setRandomBanner(banner);
    }, []);

    if (randomPoints.length === 0) return null;

    return (
        <section className="intel-facts-section">
            <div className="intel-container">
                <div className="intel-header">
                    <span className="intel-kicker">ACADEMIC_INSIGHTS</span>
                    <h2 className="intel-main-title">Mindblowing <br /><span className="serif-italic">Realities.</span></h2>
                </div>

                <div className="intel-grid">
                    {randomPoints.map((point, index) => (
                        <div key={point.id} className={`intel-card reveal-up delay-${index}`}>
                            <div className={`intel-icon-wrapper ${point.accent}`}>
                                {point.icon}
                            </div>
                            <div className="intel-value">{point.value}</div>
                            <div className="intel-label">{point.label}</div>
                            <p className="intel-desc">{point.description}</p>
                        </div>
                    ))}
                </div>

                {/* Additional Impact Banner */}
                <div className="intel-banner reveal-up delay-4">
                    <div className="banner-content">
                        <BookOpen size={32} className="banner-icon" />
                        <div className="banner-text">
                            <h3>{randomBanner.title}</h3>
                            <p>{randomBanner.desc}</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
