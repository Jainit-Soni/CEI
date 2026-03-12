"use client";

import Link from "next/link";
import ScrollReveal from "./animations/ScrollReveal";
import GlassPanel from "./GlassPanel";
import Button from "./Button";
import "./HomeSections.css";

export default function CorePaths() {
  const cards = [
    {
      id: "browse-colleges",
      title: "Browse Colleges",
      description:
        "See structured CEI views of campuses, placements, cutoffs, and context in one grid.",
      href: "/colleges",
      action: "Enter colleges map",
    },
    {
      id: "explore-exams",
      title: "Explore Exams",
      description:
        "Understand how 100+ entrance exams connect to real seats, not just scores.",
      href: "/exams",
      action: "See exam layer",
    },
    {
      id: "compare",
      title: "Compare Options",
      description:
        "Put colleges side‑by‑side with CEI scores and ROI so trade‑offs become visible.",
      href: "/colleges",
      action: "Compare from listing",
    },
    {
      id: "build-list",
      title: "Build My List",
      description:
        "Collect safe, match, and reach options into a single shortlist you can revisit.",
      href: "/colleges",
      action: "Start building",
    },
  ];

  return (
    <section className="nexus-home-section core-paths-section">
      <div className="home-section-inner">
        <header className="nexus-section-header">
          <span className="nexus-kicker fadeIn">PATHS_INTO_CEI</span>
          <ScrollReveal as="h2" containerClassName="fadeIn delay-1" baseRotation={-1} blurStrength={8}>
            Choose your way into the <span className="serif-accent">decision</span>.
          </ScrollReveal>
          <p className="fadeIn delay-1">
            CEI turns scattered information into a few calm, navigable doors. Pick the
            one that fits how you think.
          </p>
        </header>

        <div className="nexus-core-paths-grid">
          {cards.map((card, index) => (
            <GlassPanel
              key={card.id}
              variant="default"
              className={`nexus-glass-card nexus-core-path-card anti-gravity-card fadeIn delay-${index + 2}`}
            >
              <div className="core-path-body">
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
              <div className="nexus-card-footer">
                <Button
                  href={card.href}
                  size="sm"
                  variant="secondary"
                  className="core-path-cta"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {card.action}
                </Button>
              </div>
            </GlassPanel>
          ))}
        </div>
      </div>
    </section>
  );
}

