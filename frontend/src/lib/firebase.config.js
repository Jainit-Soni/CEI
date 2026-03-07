/**
 * lib/firebase.config.js — CEI Firebase Client SDK
 * ==================================================
 * Exports a ready-to-use Firebase app, Auth instance, and GoogleAuthProvider.
 * Used by the admin panel for Google Sign-In and ID token retrieval.
 *
 * All config values come from NEXT_PUBLIC_ env vars (set in Vercel dashboard).
 */

import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Prevent duplicate initialization in Next.js hot-reload
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Force account picker every time (prevents auto-signing wrong account)
googleProvider.setCustomParameters({ prompt: "select_account" });

export default app;
