"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Button from "./Button";
import AuthModal from "./AuthModal";
import UserDropdown from "./UserDropdown";
import ScoreInputModal from "./ScoreInputModal";
import { useAuth } from "@/lib/AuthContext";
import { useScores } from "@/lib/ScoreContext";
import { Menu, X, ArrowLeft, Trophy, Heart, User, Sparkles, MapPin, TrendingUp } from "lucide-react";
import "./Header.css";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [choiceCount, setChoiceCount] = useState(0);

  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { scores, saveScores } = useScores();

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Cart count
  useEffect(() => {
    const updateCount = () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("choice-filling-cart");
        setChoiceCount(stored ? JSON.parse(stored).length : 0);
      }
    };
    updateCount();
    window.addEventListener("storage", updateCount);
    window.addEventListener("local-storage-update", updateCount);
    return () => {
      window.removeEventListener("storage", updateCount);
      window.removeEventListener("local-storage-update", updateCount);
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (path) => pathname === path || (path !== "/" && pathname?.startsWith(path));
  const hasScores = Object.values(scores || {}).some(v => v > 0);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Colleges", path: "/colleges" },
    { name: "Exams", path: "/exams" },
    { name: "Scholarships", path: "/scholarships" },
    { name: "News", path: "/news" },
    { name: "Fan Wars", path: "/hype" },
    { name: "Map", path: "/map" },
    { name: "ROI Tool", path: "/roi-calculator" },
  ];

  return (
    <>
      <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
        <div className="header-container">

          {/* LEFT: Logo */}
          <div className="header-left">
            <Link href="/" className="brand-logo">CEI</Link>
          </div>

          {/* CENTER: Desktop Navigation */}
          <nav className="header-nav desktop-only">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={`nav-item ${isActive(link.path) ? "active" : ""}`}
              >
                {link.name}
              </Link>
            ))}
            <Link
              href="/my-list"
              className={`nav-item ${isActive("/my-list") ? "active" : ""}`}
            >
              My List
              {choiceCount > 0 && <span className="badge-count">{choiceCount}</span>}
            </Link>
          </nav>

          {/* RIGHT: Actions */}
          <div className="header-right">

            {/* Score Button (Desktop) */}
            <button
              onClick={() => setShowScoreModal(true)}
              className={`score-btn desktop-only ${hasScores ? "has-scores" : ""}`}
            >
              <Trophy size={16} />
              <span>{hasScores ? "Scores Active" : "Add Scores"}</span>
            </button>

            {/* User Auth */}
            {!loading && (
              user ? (
                <div className="user-menu">
                  <Link href="/dashboard" className="dashboard-btn desktop-only">
                    Dashboard
                  </Link>
                  <UserDropdown />
                </div>
              ) : (
                <Button variant="primary" size="sm" onClick={() => setShowAuthModal(true)}>
                  Login
                </Button>
              )
            )}

            {/* Mobile Toggle */}
            <button
              className="mobile-toggle"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open Menu"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-menu-content">
            <div className="mobile-header">
              <span className="brand-logo">CEI</span>
              <button className="mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close Menu">
                <X size={24} />
              </button>
            </div>

            {/* Mobile User Profile Summary */}
            {user ? (
              <div className="mobile-user-card">
                <div className="mobile-user-avatar">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" />
                  ) : (
                    <User size={28} className="text-blue-500" />
                  )}
                  {/* Decorative Ring */}
                  <svg className="mobile-avatar-ring" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(14, 165, 233, 0.2)" strokeWidth="4" />
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#0ea5e9" strokeWidth="4" strokeDasharray="289" strokeDashoffset={289 - (85 / 100) * 289} strokeLinecap="round" transform="rotate(-90 50 50)" />
                  </svg>
                  <div className="mobile-score-badge">85%</div>
                </div>
                <div className="mobile-user-info">
                  <h3>{user.displayName || "Student Pioneer"}</h3>
                  <p>{user.email}</p>
                  <Link href="/dashboard" className="mobile-view-dash" onClick={() => setIsMobileMenuOpen(false)}>
                    Go to Dashboard <span>→</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mobile-guest-card">
                <div className="mobile-guest-icon">
                  <Sparkles size={24} className="text-indigo-500" />
                </div>
                <div className="mobile-guest-text">
                  <h3>Unlock Your Potential</h3>
                  <p>Save colleges, track exams, and predict your chances.</p>
                </div>
                <Button variant="primary" className="w-full justify-center mt-3" onClick={() => { setIsMobileMenuOpen(false); setShowAuthModal(true); }}>
                  Login or Sign Up
                </Button>
              </div>
            )}

            {/* Quick Actions Grid */}
            <div className="mobile-quick-actions">
              <button onClick={() => { setIsMobileMenuOpen(false); setShowScoreModal(true); }} className="mq-action-btn">
                <div className="mq-icon-box" style={{ background: hasScores ? '#d1fae5' : '#e0e7ff', color: hasScores ? '#059669' : '#4f46e5' }}>
                  <Trophy size={20} />
                </div>
                <span>{hasScores ? "Update Score" : "Predict"}</span>
              </button>

              <Link href="/my-list" className="mq-action-btn" onClick={() => setIsMobileMenuOpen(false)}>
                <div className="mq-icon-box" style={{ background: '#fce7f3', color: '#db2777' }}>
                  <Heart size={20} />
                  {choiceCount > 0 && <span className="mq-badge">{choiceCount}</span>}
                </div>
                <span>My List</span>
              </Link>

              <Link href="/map" className="mq-action-btn" onClick={() => setIsMobileMenuOpen(false)}>
                <div className="mq-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
                  <MapPin size={20} />
                </div>
                <span>Map Explore</span>
              </Link>

              <Link href="/roi-calculator" className="mq-action-btn" onClick={() => setIsMobileMenuOpen(false)}>
                <div className="mq-icon-box" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                  <TrendingUp size={20} />
                </div>
                <span>ROI Check</span>
              </Link>
            </div>

            <hr className="mobile-divider" />

            <nav className="mobile-nav-list">
              <span className="mobile-nav-label">Main Domains</span>
              {navLinks.filter(l => !['Map', 'ROI Tool', 'Home'].includes(l.name)).map((link) => (
                <Link key={link.path} href={link.path} className="mobile-list-link" onClick={() => setIsMobileMenuOpen(false)}>
                  {link.name}
                  <ArrowLeft size={16} className="rotate-180 opacity-40" />
                </Link>
              ))}
            </nav>

          </div>
        </div>
      )}

      {/* Modals */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <ScoreInputModal
        isOpen={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        currentScores={scores}
        onSave={saveScores}
      />
    </>
  );
}
