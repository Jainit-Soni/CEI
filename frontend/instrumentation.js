import * as Sentry from "@sentry/nextjs";

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
            Sentry.init({
                dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
                tracesSampleRate: 1.0,
            });
        }
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
            Sentry.init({
                dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
                tracesSampleRate: 1.0,
            });
        }
    }
}
