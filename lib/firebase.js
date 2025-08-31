// lib/firebase.js

// Client SDKs
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

/**
 * Your existing config (kept intact).
 * If you later want to use env vars, replace the literals below.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyCLqoJOePWrtmZOjQ5K6yQIVOBQdF8Xl-o',
  authDomain: 'overshare-239ef.firebaseapp.com',
  projectId: 'overshare-239ef',
  storageBucket: 'overshare-239ef.firebasestorage.app',
  messagingSenderId: '414367584189',
  appId: '1:414367584189:web:cb21f18f9ff2caa89bccd4',
  measurementId: 'G-XELQH72Y2J',
};

// Initialize once (important for Next.js hot reload)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firestore
export const db = getFirestore(app);

// Auth (client-only usage recommended)
export const auth = getAuth(app);

/**
 * Enable persistence (best-effort, client only).
 * Multiple tabs can cause an error; we ignore it gracefully.
 */
if (typeof window !== 'undefined') {
  // Keep auth session in local storage
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  // Cache Firestore data for offline/refresh resilience
  enableIndexedDbPersistence(db).catch(() => {});
}

/**
 * Ensure the user is signed in (anonymous).
 * Await this before any Firestore reads/writes when rules require auth.
 *
 * Usage:
 *   const user = await ensureSignedIn();
 *   const uid = user?.uid;
 */
export async function ensureSignedIn() {
  if (typeof window === 'undefined') {
    // Don’t attempt auth during SSR
    return null;
  }
  if (auth.currentUser) return auth.currentUser;

  // Start anonymous sign-in if needed
  try {
    await signInAnonymously(auth);
  } catch {
    // If another tab just signed in, we’ll catch it via the listener below.
  }

  // Wait for the user object to be available
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      resolve(auth.currentUser || null);
    }, 10000);

    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        clearTimeout(timeout);
        unsub();
        resolve(user || null);
      },
      (err) => {
        clearTimeout(timeout);
        unsub();
        reject(err);
      }
    );
  });
}

export default app;
