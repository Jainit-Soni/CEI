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
import { Menu, X, ArrowLeft, Trophy, Heart } from "lucide-react";
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
              <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Close Menu">
                <X size={24} />
              </button>
            </div>

            <nav className="mobile-nav">
              {navLinks.map((link) => (
                <Link key={link.path} href={link.path} className="mobile-link">
                  {link.name}
                </Link>
              ))}
              <Link href="/my-list" className="mobile-link">
                My List {choiceCount > 0 && `(${choiceCount})`}
              </Link>

              <hr className="mobile-divider" />

              <button onClick={() => setShowScoreModal(true)} className="mobile-link">
                <Trophy size={18} />
                {hasScores ? "Update Scores" : "Predict Chances"}
              </button>

              {user && (
                <Link href="/dashboard" className="mobile-link highlight">
                  Dashboard
                </Link>
              )}
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
