import Link from "next/link";
import "./global.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";
import ClientProviders from "../components/ClientProviders";
import ComparisonDrawer from "../components/college/ComparisonDrawer";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Outfit, Playfair_Display, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import PageLoading from "@/components/PageLoading";
import GlobalLinkHandler from "@/components/GlobalLinkHandler";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
  adjustFontFallback: false,
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  adjustFontFallback: false,
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  adjustFontFallback: false,
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  preload: true,
  adjustFontFallback: false,
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
    <html lang="en" className={`${outfit.variable} ${playfair.variable} ${inter.variable} ${jetbrains.variable}`}>
      <head />
      <body>
        <ClientProviders>
          <ErrorBoundary>
            <div className="flex flex-col min-h-screen">
              
              {/* GLOBAL CHROMATIC BACKGROUND — Fixed for entire Home scroll */}
              <div className="chromatic-bands">
                  <div className="chromatic-band-3" />
                  <div className="chromatic-band-4" />
              </div>
              
              {/* Interactive Background Spotlight (Global Slot) */}
              <div className="premium-spotlight" />

              {/* Subtle Artistic Texture (Global Slot) */}
              <div className="premium-overlay" />

              {/* Universal Top-Level Loader (Light Theme) */}
              <PageLoading />

              {/* Universal Top-Level Loader (Light Theme) */}
              <PageLoading />

              {/* Strict External Link Enforcement */}
              <GlobalLinkHandler />

              {/* Universal Header */}
              <Header />

              <main className="flex-grow pt-20">
                {children}
              </main>

              {/* Universal Footer */}
              <Footer />

              {/* Comparison Drawer */}
              <ComparisonDrawer />
            </div>
          </ErrorBoundary>
        </ClientProviders>
        <Analytics />
        <SpeedInsights />
        {/* Google Analytics - Moved to body to resolve preload warnings */}
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=G-22DDHMQFTY`}
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-22DDHMQFTY');
          `}
        </Script>
      </body>
    </html>
  );
}
