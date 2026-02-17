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
        <ErrorBoundary>
          <div className="flex flex-col min-h-screen">
            {/* Universal Header */}
            <Header />

            <main className="flex-grow pt-20">
              {children}
            </main>

            {/* Universal Footer */}
            <Footer />
          </div>
        </ErrorBoundary>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
