// lib/firebase.js
'use client';

/**
 * Client-only Firebase init for Next.js App Router.
 * - Defaults to YOUR hardcoded config (fill HARDCODED once).
 * - Falls back to NEXT_PUBLIC_* env vars only if a field is left blank.
 * - Uses the new Firestore cache API (no enableIndexedDbPersistence warning).
 * - Safe on Vercel: never initializes on the server.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const isBrowser = typeof window !== 'undefined';

/** 🔐 Fill these with YOUR actual Firebase web app values */
const HARDCODED = {
  apiKey: 'YOUR_API_KEY_HERE',
  authDomain: 'YOUR_AUTH_DOMAIN_HERE',          // e.g. myproj.firebaseapp.com
  projectId: 'YOUR_PROJECT_ID_HERE',             // e.g. myproj
  storageBucket: 'YOUR_STORAGE_BUCKET_HERE',     // e.g. myproj.appspot.com
  messagingSenderId: 'YOUR_SENDER_ID_HERE',
  appId: 'YOUR_APP_ID_HERE',
};

// Optional fallback to env (only used if the HARDCODED field is left blank)
const ENV = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

const pick = (k) => HARDCODED[k] || ENV[k] || '';

const firebaseConfig = {
  apiKey: pick('apiKey'),
  authDomain: pick('authDomain'),
  projectId: pick('projectId'),
  storageBucket: pick('storageBucket'),
  messagingSenderId: pick('messagingSenderId'),
  appId: pick('appId'),
};

let _app = null;
let _db = null;

/** Get (or create) the Firebase app — client only */
export function getFirebaseApp() {
  if (!isBrowser) return null; // never init on the server
  if (_app) return _app;

  if (!firebaseConfig.projectId) {
    console.error(
      '[firebase] Missing config. Fill HARDCODED in lib/firebase.js or set NEXT_PUBLIC_* envs.'
    );
    return null;
  }
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

/** Firestore instance with persistent local cache (multi-tab) */
export const db = (() => {
  if (!isBrowser) {
    // Guard accidental server usage
    return new Proxy(
      {},
      {
        get() {
          throw new Error(
            'Firestore is client-only. Import and use lib/firebase.js from client components.'
          );
        },
      }
    );
  }

  const app = getFirebaseApp();
  if (!app) {
    return new Proxy(
      {},
      {
        get() {
          throw new Error(
            'Firebase not configured. Fill HARDCODED values in lib/firebase.js or set NEXT_PUBLIC_* envs.'
          );
        },
      }
    );
  }

  if (_db) return _db;

  try {
    _db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (e) {
    console.warn('[firebase] persistent cache unavailable, falling back to getFirestore():', e);
    _db = getFirestore(app);
  }
  return _db;
})();

export default db;
