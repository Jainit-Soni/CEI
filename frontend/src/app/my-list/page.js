"use client";

import ApplicationBoard from "@/components/ApplicationBoard";
import Container from "@/components/Container";
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import "../colleges/page.css";
import "./mylist.css";

export default function MyListPage() {
    return (
        <div className="list-page">
            <section className="list-hero list-hero--mylist">
                <div className="list-hero-bg" aria-hidden="true">
                    <div className="hero-orb hero-orb--1" />
                    <div className="hero-orb hero-orb--2" />
                </div>

                <Container>
                    <div className="list-hero-content">
                        <RevealOnScroll>
                            <span className="list-hero-kicker">Admission Strategy</span>
                            <h1 className="list-hero-title">Your Priority List</h1>
                            <p className="list-hero-subtitle">
                                Drag to reorder your selections based on priority. Export your final strategic report to guide your admission journey.
                            </p>
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            <section className="list-content-section !mt-[-60px]">
                <Container>
                    <ApplicationBoard />
                </Container>
            </section>

            <style jsx>{`
                .list-hero--mylist {
                    background: linear-gradient(135deg, rgba(79, 70, 229, 0.05), rgba(59, 130, 246, 0.05));
                }
                @media (max-width: 640px) {
                    .list-hero--mylist { padding: 60px 0; }
                }
            `}</style>
        </div>
    );
}
