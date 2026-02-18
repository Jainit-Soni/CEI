import Link from "next/link";
import "./global.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";
import ClientProviders from "../components/ClientProviders";
import CompareFloatingBar from "../components/CompareFloatingBar";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  preload: false,
});

export const metadata = {
  title: {
    default: "CEI — College Exam Intelligence",
    template: "%s | CEI"
  },
  description: "Discover 2000+ colleges across India, compare entrance exams, and track official updates. Your complete guide to higher education in India.",
  keywords: ["colleges in India", "entrance exams", "CMAT", "college comparison", "higher education", "MBA colleges", "engineering colleges"],
  authors: [{ name: "CEI Team" }],
  creator: "CEI",
  publisher: "CEI",
  metadataBase: new URL('https://frontend-blond-nu-51.vercel.app'),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://frontend-blond-nu-51.vercel.app',
    title: 'CEI — College Exam Intelligence',
    description: 'Discover 2000+ colleges across India, compare entrance exams, and track official updates.',
    siteName: 'CEI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CEI — College Exam Intelligence',
    description: 'Discover 2000+ colleges across India, compare entrance exams, and track official updates.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>
        <ClientProviders>
          <ErrorBoundary>
            <div className="flex flex-col min-h-screen">
              {/* Universal Background */}
              <div className="chromatic-bands">
                <div className="chromatic-band-3"></div>
                <div className="chromatic-band-4"></div>
              </div>

              {/* Universal Premium Orbs (Moved from HomeClient) */}
              <div className="cinematic-backdrop" aria-hidden="true" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: -1, // Behind content, but on top of bands if needed (bands are -1 too, so let's check stacking context)
                pointerEvents: 'none',
                overflow: 'hidden'
              }}>
                {/* Indigo Orb 1 - Top Left */}
                <div style={{
                  position: 'absolute',
                  width: '600px',
                  height: '600px',
                  background: 'radial-gradient(circle, rgba(79, 70, 229, 0.15) 0%, transparent 70%)',
                  filter: 'blur(80px)',
                  top: '-15%',
                  left: '-10%',
                  animation: 'orbFloat1 20s ease-in-out infinite'
                }} />

                {/* Indigo Orb 2 - Middle Right */}
                <div style={{
                  position: 'absolute',
                  width: '500px',
                  height: '500px',
                  background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
                  bottom: '20%',
                  right: '-5%',
                  filter: 'blur(70px)',
                  animation: 'orbFloat2 25s ease-in-out infinite'
                }} />

                {/* Sky Orb 3 - Soft Bottom Left */}
                <div style={{
                  position: 'absolute',
                  width: '400px',
                  height: '400px',
                  background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%)',
                  bottom: '-10%',
                  left: '15%',
                  filter: 'blur(60px)',
                  animation: 'orbFloat1 22s ease-in-out infinite reverse'
                }} />
              </div>

              {/* Universal Header */}
              <Header />

              <main className="flex-grow pt-20">
                {children}
              </main>

              {/* Universal Footer */}
              <Footer />
            </div>
          </ErrorBoundary>
        </ClientProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
