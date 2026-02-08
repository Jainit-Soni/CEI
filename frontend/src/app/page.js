"use client";

import "./page.css";
import "../components/DecisionEngine.css"; // Ensure styles are loaded
import DecisionEngine from "../components/DecisionEngine";
import AdmissionProbability from "../components/AdmissionProbability";
import Container from "../components/Container";
import GlassPanel from "../components/GlassPanel";
import Card from "../components/Card";
import Button from "../components/Button";
import { RevealOnScroll } from "../lib/useIntersectionObserver";
import { useEffect, useMemo, useState } from "react";
import { fetchColleges, fetchExams } from "../lib/api";

// Dynamic student tips - changes on each refresh
const studentTips = [
  { icon: "💡", title: "Pro Tip", text: "Compare at least 3 colleges before finalizing your choice. Use the compare feature!" },
  { icon: "📅", title: "Deadline Alert", text: "Most entrance exams open registrations 3-4 months before exam dates. Plan ahead!" },
  { icon: "🎯", title: "Smart Strategy", text: "Focus on your strengths. Check which exams test subjects you're good at." },
  { icon: "📊", title: "Did you know?", text: "Average placement packages vary 3x between Tier 1 and Tier 2 colleges." },
  { icon: "🏆", title: "Success Tip", text: "Students who apply to 5+ colleges have 80% higher admission success rates." },
  { icon: "📚", title: "Prep Insight", text: "Most toppers recommend starting exam prep 6 months before the test date." },
  { icon: "💰", title: "Fee Insight", text: "Government colleges cost 10x less than private ones for similar quality education." },
  { icon: "🌟", title: "Career Fact", text: "BTech graduates from top 50 colleges earn 40% more in their first job." },
];

const quickStats = [
  { value: "999+", label: "Colleges", icon: "🏛️" },
  { value: "30+", label: "Exams", icon: "📝" },
  { value: "All", label: "States & UTs", icon: "🗺️" },
  { value: "500+", label: "Programs", icon: "🎓" },
];

const features = [
  { icon: "✓", title: "Verified Data", desc: "Official sources, verified placements. No rumors or outdated info." },
  { icon: "⚡", title: "Instant Compare", desc: "Side-by-side comparison of up to 4 colleges in seconds." },
  { icon: "🎯", title: "Smart Filters", desc: "Find colleges by state, exam, tier, fees, and more." },
];

// Shuffle array helper
const shuffleArray = (arr) => [...arr].sort(() => Math.random() - 0.5);

export default function Home() {
  const [colleges, setColleges] = useState([]);
  const [exams, setExams] = useState([]);
  const [dailyTip, setDailyTip] = useState(null);

  useEffect(() => {
    // Pick a random tip on mount
    setDailyTip(studentTips[Math.floor(Math.random() * studentTips.length)]);

    const load = async () => {
      try {
        const [collegeResponse, examData] = await Promise.all([
          fetchColleges({ limit: 20 }),
          fetchExams(),
        ]);
        const collegeData = collegeResponse.data || collegeResponse;
        setColleges(Array.isArray(collegeData) ? collegeData : []);
        setExams(Array.isArray(examData) ? examData : []);
      } catch (err) {
        console.error("Failed to load home data", err);
      }
    };
    load();
  }, []);

  // Randomize featured colleges on each load
  const featuredColleges = useMemo(() => {
    if (colleges.length === 0) return [];
    const tierScore = (tier) => {
      const t = (tier || "").toString().toLowerCase();
      if (t.includes("tier 1")) return 3;
      if (t.includes("tier 2")) return 2;
      if (t.includes("tier 3")) return 1;
      return 0;
    };
    // Get top colleges then shuffle to randomize order
    const sorted = [...colleges].sort((a, b) => {
      const scoreA = tierScore(a.rankingTier || a.ranking) * 10 + (a.acceptedExams || []).length;
      const scoreB = tierScore(b.rankingTier || b.ranking) * 10 + (b.acceptedExams || []).length;
      return scoreB - scoreA;
    });
    return shuffleArray(sorted.slice(0, 12)).slice(0, 4);
  }, [colleges]);

  // Randomize featured exams on each load
  const featuredExams = useMemo(() => {
    if (exams.length === 0) return [];
    const sorted = [...exams].sort((a, b) => {
      const countA = a.acceptedCount ?? (a.acceptedColleges || a.collegesAccepting || []).length;
      const countB = b.acceptedCount ?? (b.acceptedColleges || b.collegesAccepting || []).length;
      return countB - countA;
    });
    return shuffleArray(sorted.slice(0, 10)).slice(0, 3);
  }, [exams]);

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-bg" aria-hidden="true">
          <div className="hero-orb hero-orb--1" />
          <div className="hero-orb hero-orb--2" />
          <div className="hero-orb hero-orb--3" />
        </div>
        <Container>
          <div className="home-hero-content minimal-hero fadeIn">
            <span className="hero-kicker">Admission matching made simple</span>
            <h1>Your Future, <span className="text-gradient">Verified.</span></h1>
            <p>Smart, verified college matching for the next generation of students. No generic results, just plain data.</p>
            <div className="hero-actions">
              <Button href="#mentor" icon="🎯">Match My Score</Button>
              <Button href="/colleges" variant="secondary">Browse 999+ Colleges</Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Interactive Tools Section */}
      <section id="tools" className="tools-section">
        <Container>
          <div className="tools-grid">
            <div id="mentor" className="tool-block">
              <div className="tool-info">
                <h2>College Matcher 🎯</h2>
                <p>Tell me your background, and I'll find your perfect college matches.</p>
              </div>
              <DecisionEngine />
            </div>

            <div id="probability" className="tool-block">
              <div className="tool-info">
                <h2>Admission Probability 🛡️</h2>
                <p>Check your admission chances based on historical trends.</p>
              </div>
              <AdmissionProbability />
            </div>
          </div>
        </Container>
      </section>

      {/* Dynamic Tip Section */}
      {dailyTip && (
        <section className="tip-section">
          <Container>
            <RevealOnScroll>
              <div className="tip-card">
                <span className="tip-icon">{dailyTip.icon}</span>
                <div className="tip-content">
                  <span className="tip-title">{dailyTip.title}</span>
                  <p className="tip-text">{dailyTip.text}</p>
                </div>
              </div>
            </RevealOnScroll>
          </Container>
        </section>
      )}

      {/* Featured Discovery */}
      <section className="home-section discovery-section">
        <Container>
          <RevealOnScroll>
            <div className="section-heading centered">
              <span className="badge">Verified Data</span>
              <h2>Discovery Dashboard</h2>
              <p>Real-time data from 999+ verified institutions across India.</p>
            </div>
          </RevealOnScroll>
        </Container>
      </section>

      {/* Trending Colleges - Dynamic on refresh */}
      <section className="home-section">
        <Container>
          <RevealOnScroll>
            <div className="section-heading">
              <div className="section-heading-row">
                <div>
                  <h2>🔥 Trending Colleges</h2>
                  <p>Popular picks refreshed just for you.</p>
                </div>
                <Button href="/colleges" variant="secondary" size="sm">View All →</Button>
              </div>
            </div>
          </RevealOnScroll>
          <div className="card-grid card-grid-4">
            {featuredColleges.map((college) => (
              <RevealOnScroll key={college.id || college.name}>
                <Card
                  type="college"
                  title={college.shortName || college.name}
                  subtitle={college.location}
                  tags={(college.acceptedExams || []).slice(0, 2).map((e) => e.toUpperCase())}
                  meta={college.rankingTier || college.ranking}
                  href={`/colleges/${college.id}`}
                />
              </RevealOnScroll>
            ))}
          </div>
        </Container>
      </section>

      {/* Popular Exams - Dynamic on refresh */}
      <section className="home-section">
        <Container>
          <RevealOnScroll>
            <div className="section-heading">
              <div className="section-heading-row">
                <div>
                  <h2>📝 Popular Exams</h2>
                  <p>Key exams that unlock top college admissions.</p>
                </div>
                <Button href="/exams" variant="secondary" size="sm">View All →</Button>
              </div>
            </div>
          </RevealOnScroll>
          <div className="card-grid">
            {featuredExams.map((exam) => (
              <RevealOnScroll key={exam.id || exam.name}>
                <Card
                  type="exam"
                  title={exam.name}
                  subtitle={exam.type || exam.conductedBy}
                  tags={(exam.syllabus || exam.pattern || []).slice(0, 3)}
                  meta={`Accepted by ${exam.acceptedCount ?? (exam.acceptedColleges || exam.collegesAccepting || []).length}+ colleges`}
                  href={`/exams/${exam.id}`}
                />
              </RevealOnScroll>
            ))}
          </div>
        </Container>
      </section>


      {/* CTA Section */}
      <section className="home-section">
        <Container>
          <GlassPanel className="cta-panel" variant="strong" glow>
            <div className="cta-content">
              <h2>Ready to start your college journey?</h2>
              <p>Join thousands of students who made smarter admission decisions with CEI.</p>
            </div>
            <div className="cta-actions">
              <Button href="/colleges">Start Exploring</Button>
              <Button href="/dashboard" variant="secondary">My Dashboard</Button>
            </div>
          </GlassPanel>
        </Container>
      </section>
    </div>
  );
}
