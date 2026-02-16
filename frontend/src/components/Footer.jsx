import Link from "next/link";
import "./Footer.css";
import { Twitter, Linkedin, Instagram, ArrowRight, Heart, Mail } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="footer-premium">
      <div className="footer-container">
        <div className="footer-grid">
          {/* Brand Column */}
          <div className="footer-col brand-col">
            <h2 className="footer-logo-text">CEI</h2>
            <p className="footer-tagline">
              The intelligence layer for your academic future. Verified data, zero noise.
            </p>
            <div className="footer-social-links">
              <a href="#" className="social-icon" aria-label="Twitter"><Twitter size={20} /></a>
              <a href="#" className="social-icon" aria-label="LinkedIn"><Linkedin size={20} /></a>
              <a href="#" className="social-icon" aria-label="Instagram"><Instagram size={20} /></a>
            </div>
          </div>

          {/* Links Column */}
          <div className="footer-col links-col">
            <h3 className="footer-heading">Platform</h3>
            <ul className="footer-links">
              <li><Link href="/colleges">Colleges</Link></li>
              <li><Link href="/exams">Exams</Link></li>
              <li><Link href="/compare">Compare</Link></li>
              <li><Link href="/roi-calculator">ROI Tool</Link></li>
            </ul>
          </div>

          {/* Tools Column */}
          <div className="footer-col tools-col">
            <h3 className="footer-heading">Account</h3>
            <ul className="footer-links">
              <li><Link href="/dashboard">Dashboard</Link></li>
              <li><Link href="/my-list">My Priority List</Link></li>
              <li><Link href="/guide">Admission Guide</Link></li>
            </ul>
          </div>

          {/* Status Column */}
          <div className="footer-col status-col">
            <h3 className="footer-heading">Status</h3>
            <div className="system-status">
              <span className="status-dot"></span>
              <span>Online</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p className="copyright">
            &copy; {currentYear} College Essentials of India. All rights reserved.
          </p>
          <div className="footer-legal-links">
            <Link href="/terms-and-conditions">Terms & Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

