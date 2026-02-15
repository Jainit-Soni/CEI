"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Button from "./Button";
import AuthModal from "./AuthModal";
import UserDropdown from "./UserDropdown";
import ScoreInputModal from "./ScoreInputModal"; // New
import { useAuth } from "@/lib/AuthContext";
import { useScores } from "@/lib/ScoreContext"; // New
import { Heart, Menu, ArrowLeft, Trophy } from "lucide-react";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false); // New
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { scores, saveScores } = useScores(); // New
  const [choiceCount, setChoiceCount] = useState(0);

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const updateCount = () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("choice-filling-cart");
        setChoiceCount(stored ? JSON.parse(stored).length : 0);
      }
    };

    updateCount();
    window.addEventListener("storage", updateCount);
    // Custom event for same-window updates
    window.addEventListener("local-storage-update", updateCount);

    return () => {
      window.removeEventListener("storage", updateCount);
      window.removeEventListener("local-storage-update", updateCount);
    };
  }, []);

  // Close menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  const hasScores = Object.values(scores || {}).some(v => v > 0);

  return (
    <>
      <header className={`header ${scrolled ? "scrolled" : ""}`}>
        <div className="header-inner">
          {/* Logo & Back Button */}
          <div className="logo-group">
            {pathname !== "/" && (
              <button
                className="back-button"
                onClick={() => router.back()}
                aria-label="Go Back"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <Link href="/" className="logo">CEI</Link>
          </div>

          {/* Desktop Nav */}
          <nav className="nav desktop-nav">
            <Link href="/" className={isActive("/") ? "active" : ""}>Home</Link>
            <Link href="/colleges" className={isActive("/colleges") ? "active" : ""}>Colleges</Link>
            <Link href="/exams" className={isActive("/exams") ? "active" : ""}>Exams</Link>
            <Link href="/map" className={isActive("/map") ? "active" : ""}>Map</Link>
            <Link href="/roi-calculator" className={isActive("/roi-calculator") ? "active" : ""}>ROI Tool</Link>
            <Link href="/my-list" className={`nav-link icon-link ${isActive("/my-list") ? "active" : ""}`} data-count={choiceCount}>
              <span>My List</span>
              {choiceCount > 0 && <span className="nav-badge">{choiceCount}</span>}
            </Link>
          </nav>

          {/* Actions */}
          <div className="header-actions">

            {/* Score Trigger */}
            <button
              onClick={() => setShowScoreModal(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${hasScores
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              <Trophy size={16} />
              <span className="hidden sm:inline">{hasScores ? "Scores Active" : "Add Scores"}</span>
            </button>

            {!loading && (
              user ? (
                <div className="user-area">
                  <Link href="/dashboard" className={`dashboard-link-nav ${isActive("/dashboard") ? "active" : ""}`}>
                    Dashboard
                  </Link>
                  <UserDropdown />
                </div>
              ) : (
                <Button variant="primary" size="sm" onClick={() => setShowAuthModal(true)}>Login</Button>
              )
            )}

            {/* Mobile Menu Toggle */}
            <button
              className="menu-toggle"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle Menu"
            >
              {open ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              ) : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Overlay */}
        <div className={`mobile-nav-overlay ${open ? "open" : ""}`}>
          <div className="mobile-nav-header">
            <button
              className="mobile-back-button"
              onClick={() => setOpen(false)}
              aria-label="Close Menu"
            >
              <ArrowLeft size={24} />
              <span>Back</span>
            </button>
          </div>
          <nav className="mobile-nav-links">
            <Link href="/" className={isActive("/") ? "active" : ""} onClick={() => setOpen(false)}>Home</Link>
            <Link href="/colleges" className={isActive("/colleges") ? "active" : ""} onClick={() => setOpen(false)}>Colleges</Link>
            <Link href="/exams" className={isActive("/exams") ? "active" : ""} onClick={() => setOpen(false)}>Exams</Link>
            <Link href="/map" className={isActive("/map") ? "active" : ""} onClick={() => setOpen(false)}>Map</Link>
            <Link href="/roi-calculator" className={isActive("/roi-calculator") ? "active" : ""} onClick={() => setOpen(false)}>ROI Tool</Link>
            <Link href="/my-list" className={isActive("/my-list") ? "active" : ""} onClick={() => setOpen(false)}>
              My List {choiceCount > 0 && <span className="mobile-badge">({choiceCount})</span>}
            </Link>
            <button
              onClick={() => { setShowScoreModal(true); setOpen(false); }}
              className="flex items-center gap-3 px-4 py-3 text-lg font-medium text-slate-600 hover:text-blue-600"
            >
              <Trophy size={20} />
              {hasScores ? "Update Scores" : "Predict Chances"}
            </button>
          </nav>
        </div>
      </header>

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
