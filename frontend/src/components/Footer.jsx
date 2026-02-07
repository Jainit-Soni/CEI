import Link from "next/link";
import "./Footer.css";
import Button from "./Button";

const quickLinks = [
  { label: "Colleges", href: "/colleges" },
  { label: "Exams", href: "/exams" },
  { label: "Compare", href: "/compare" },
  { label: "Dashboard", href: "/dashboard" },
];

const resourceLinks = [
  { label: "How it Works", href: "/" },
  { label: "Admission Calendar", href: "/" },
  { label: "Career Guidance", href: "/" },
  { label: "FAQs", href: "/" },
];

const stateLinks = [
  { label: "Andhra Pradesh", href: "/colleges?state=andhra-pradesh" },
  { label: "Telangana", href: "/colleges?state=telangana" },
  { label: "Karnataka", href: "/colleges?state=karnataka" },
  { label: "Tamil Nadu", href: "/colleges?state=tamil-nadu" },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* Brand Column */}
        <div className="footer-brand">
          <div className="footer-logo">
            <span className="logo-text">CEI</span>
            <span className="logo-badge">Beta</span>
          </div>
          <p className="footer-tagline">
            College & Exam Intelligence — helping students make confident admission decisions with verified data.
          </p>
          <div className="social-links">
            <a href="#" aria-label="Twitter" className="social-link">𝕏</a>
            <a href="#" aria-label="LinkedIn" className="social-link">in</a>
            <a href="#" aria-label="Instagram" className="social-link">📷</a>
          </div>
        </div>

        {/* Quick Links */}
        <div className="footer-column">
          <h4>Quick Links</h4>
          <ul>
            {quickLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Resources */}
        <div className="footer-column">
          <h4>Resources</h4>
          <ul>
            {resourceLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* States */}
        <div className="footer-column">
          <h4>By State</h4>
          <ul>
            {stateLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Newsletter */}
        <div className="footer-newsletter">
          <h4>Stay Updated</h4>
          <p>Get exam dates, cutoffs & admission alerts.</p>
          <div className="newsletter-form">
            <input
              type="email"
              placeholder="Your email address"
              suppressHydrationWarning={true}
            />
            <Button size="sm">Subscribe</Button>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <p>© 2026 College Exam Intelligence. All rights reserved.</p>
          <div className="footer-legal">
            <Link href="/">Privacy Policy</Link>
            <Link href="/">Terms of Service</Link>
            <Link href="/">Contact Us</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
