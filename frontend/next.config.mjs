const nextConfig = {
    webpack: (config, { isServer }) => {
        config.ignoreWarnings = [
            { module: /node_modules\/@opentelemetry\/instrumentation/ },
            { module: /node_modules\/@prisma\/instrumentation/ }
        ];
        return config;
    },
    images: {
        domains: ['localhost'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
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
                        value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://*.sentry.io https://apis.google.com https://www.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.sentry.io https://vitals.vercel-insights.com https://frontend-blond-nu-51.vercel.app http://localhost:4000 https://ce-intelligence-backend.vercel.app https://www.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://*.googleapis.com; frame-src 'self' https://accounts.google.com https://content.googleapis.com https://*.firebaseapp.com https://*.firebasejs.com;"
                    },
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin-allow-popups'
                    }
                ]
            }
        ]
    },
    // Rewrites only for local development if needed, but we use direct URL now
    // async rewrites() {
    //     return [
    //         {
    //             source: '/api/:path*',
    //             destination: 'http://localhost:4000/api/:path*',
    //         },
    //     ];
    // },
};
export default nextConfig;
