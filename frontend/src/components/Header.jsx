"use client";
import "./Header.css";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "./Button";
import AuthModal from "./AuthModal";
import UserDropdown from "./UserDropdown";
import { useAuth } from "@/lib/AuthContext";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Close menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">CEI</Link>
          <nav className={`nav ${open ? "open" : ""}`}>
            <Link href="/" className={isActive("/") ? "active" : ""} onClick={() => setOpen(false)}>Home</Link>
            <Link href="/colleges" className={isActive("/colleges") ? "active" : ""} onClick={() => setOpen(false)}>Colleges</Link>
            <Link href="/exams" className={isActive("/exams") ? "active" : ""} onClick={() => setOpen(false)}>Exams</Link>
            <Link href="/map" className={isActive("/map") ? "active" : ""} onClick={() => setOpen(false)}>Map</Link>
          </nav>
          <div className="header-actions">
            {!loading && (
              user ? (
                <UserDropdown />
              ) : (
                <Button onClick={() => setShowAuthModal(true)}>Login</Button>
              )
            )}
            <button
              className={`menu ${open ? "menu-open" : ""}`}
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle Menu"
              aria-expanded={open}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>
      {open && <div className="nav-overlay" onClick={() => setOpen(false)} />}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
