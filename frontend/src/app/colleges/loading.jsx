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
                    <div className="list-hero-content flex flex-col items-center">
                        <div className="h-4 w-32 bg-indigo-500/20 rounded-full mb-6 relative z-10 animate-pulse" />
                        <div className="h-10 md:h-14 w-full max-w-2xl bg-indigo-500/20 rounded-lg mb-6 relative z-10 animate-pulse" />
                        <div className="h-4 w-3/4 max-w-xl bg-indigo-500/20 rounded-full relative z-10 animate-pulse mb-12" />
                        <div className="list-stats relative z-10">
                            <div className="list-stat flex flex-col items-center">
                                <div className="h-10 w-24 bg-indigo-500/20 rounded-lg animate-pulse mb-2" />
                                <div className="h-4 w-16 bg-indigo-500/10 rounded-full animate-pulse" />
                            </div>
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
