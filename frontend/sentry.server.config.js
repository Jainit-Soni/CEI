import * as Sentry from "@sentry/nextjs";

// Only initialize Sentry if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

        // Set tracesSampleRate to 1.0 to capture 100%
        // of transactions for performance monitoring.
        tracesSampleRate: 1.0,
    });
}
