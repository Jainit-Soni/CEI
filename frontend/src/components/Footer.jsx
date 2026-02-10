import Link from "next/link";
import "./Footer.css";
import { Twitter, Linkedin, Instagram, ArrowRight, Heart, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer-premium">
      <div className="footer-container">
        <div className="footer-grid">
          {/* Column 1: Brand & Kicker */}
          <div className="footer-col brand-col">
            <h2 className="footer-logo-text">CEI</h2>
            <p className="footer-tagline">
              The intelligence layer for your academic future. Verified data, zero noise.
            </p>
            <div className="footer-social-links">
              <a href="#" className="social-icon" aria-label="Twitter"><Twitter size={18} /></a>
              <a href="#" className="social-icon" aria-label="LinkedIn"><Linkedin size={18} /></a>
              <a href="#" className="social-icon" aria-label="Instagram"><Instagram size={18} /></a>
            </div>
          </div>

          {/* Column 2: Explore */}
          <div className="footer-col">
            <h3 className="footer-heading">Explore</h3>
            <ul className="footer-links">
              <li><Link href="/colleges">Colleges</Link></li>
              <li><Link href="/exams">Entrance Exams</Link></li>
              <li><Link href="/map">Interactive Map</Link></li>
              <li><Link href="/roi-calculator">ROI Simulator</Link></li>
            </ul>
          </div>

          {/* Column 3: Tools */}
          <div className="footer-col">
            <h3 className="footer-heading">Student Tools</h3>
            <ul className="footer-links">
              <li><Link href="/my-list">Strategic Priority List</Link></li>
              <li><Link href="/dashboard">Analytics Dashboard</Link></li>
              <li><Link href="/compare">College Matcher</Link></li>
              <li><Link href="/guide">Admission Guide</Link></li>
            </ul>
          </div>

          {/* Column 4: Newsletter/Waitlist */}
          <div className="footer-col newsletter-col">
            <h3 className="footer-heading">Stay Updated</h3>
            <p className="newsletter-text">Get the latest on cutoffs and deadlines.</p>
            <div className="footer-input-group">
              <input type="email" placeholder="Your email address" className="footer-input" />
              <button className="footer-btn" aria-label="Subscribe">
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="system-status">
              <span className="status-dot"></span>
              System Operational
            </div>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div className="footer-copyright">
            © {new Date().getFullYear()} CEI Intelligence. All rights reserved.
          </div>
          <div className="footer-love">
            Made with <Heart size={14} className="heart-icon" /> for the future of Indian students.
          </div>
          <div className="footer-legal-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
