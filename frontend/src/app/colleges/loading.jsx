import Container from "@/components/Container";
import { CardSkeleton } from "@/components/Skeleton";

export default function Loading() {
    return (
        <div className="list-page">
            <section className="list-hero list-hero--colleges">
                <div className="list-hero-bg" aria-hidden="true">
                    <div className="hero-orb hero-orb--1" />
                    <div className="hero-orb hero-orb--2" />
                </div>
                <Container>
                    <div className="list-hero-content flex flex-col items-center detail-skeleton-hero skeleton" style={{ background: 'transparent', boxShadow: 'none', border: 'none', padding: '20px 0' }}>
                        <div className="skeleton-line skeleton-kicker mx-auto mb-6" style={{ width: '120px' }} />
                        <div className="skeleton-line skeleton-heading mx-auto mb-6" style={{ width: '80%', height: '64px' }} />
                        <div className="skeleton-line skeleton-subheading mx-auto mb-12" style={{ width: '60%' }} />
                        <div className="list-stats relative z-10 flex justify-center">
                            <div className="skeleton-stat" style={{ width: '120px', height: '80px' }} />
                        </div>
                    </div>
                </Container>
            </section>
            <section className="list-results pt-12">
                <Container>
                    <div className="results-grid">
                        <CardSkeleton count={12} />
                    </div>
                </Container>
            </section>
        </div>
    );
}
