import { withSentryConfig } from "@sentry/nextjs";

const nextConfig = {
    experimental: {
        optimizePackageImports: ['lucide-react'],
    },
    webpack: (config, { isServer }) => {
        config.ignoreWarnings = [
            { module: /node_modules\/@opentelemetry\/instrumentation/ },
            { module: /node_modules\/@prisma\/instrumentation/ }
        ];
        return config;
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            { protocol: 'https', hostname: '*.googleusercontent.com' },
            { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
            { protocol: 'https', hostname: '*.amazonaws.com' },
            { protocol: 'https', hostname: 'res.cloudinary.com' },
            { protocol: 'https', hostname: 'upload.wikimedia.org' },
            { protocol: 'https', hostname: 'images.unsplash.com' },
            { protocol: 'http', hostname: 'localhost' },
        ],
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on'
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN'
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin'
                    },
                    {
                        key: 'Content-Security-Policy',
                        // 'unsafe-eval' is required for Next.js Fast Refresh (Development) 
                        // and some analytics/tracking scripts (GTM, Sentry) to function.
                        value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://va.vercel-scripts.com https://*.sentry.io https://apis.google.com https://www.googleapis.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https:; font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com; connect-src 'self' blob: data: https: https://fonts.gstatic.com https://fonts.googleapis.com http://localhost:4000 http://127.0.0.1:4000; frame-src 'self' https://accounts.google.com https://content.googleapis.com https://*.firebaseapp.com https://*.firebasejs.com; worker-src 'self' blob:;"
                    },
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin-allow-popups'
                    }
                ]
            }
        ]
    },
};

export default withSentryConfig(nextConfig, {
    // Suppresses source map uploading logs during build
    silent: true,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Only enable Sentry webpack plugin when DSN is configured
    disableServerWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,
    disableClientWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers
    tunnelRoute: "/monitoring",
});
