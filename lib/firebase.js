// lib/firebase.js
<<<<<<< HEAD
// Client-side Firebase singleton + cross-device alerts helpers.

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  CACHE_SIZE_UNLIMITED,
  enableIndexedDbPersistence, // fallback only
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Your production web config (from Firebase console).
 * (Same values you pasted earlier.)
 */
=======
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

// keep your working config
>>>>>>> main
const firebaseConfig = {
  apiKey: 'AIzaSyCLqoJOePWrtmZOjQ5K6yQIVOBQdF8Xl-o',
  authDomain: 'overshare-239ef.firebaseapp.com',
  projectId: 'overshare-239ef',
  storageBucket: 'overshare-239ef.firebasestorage.app',
  messagingSenderId: '414367584189',
  appId: '1:414367584189:web:cb21f18f9ff2caa89bccd4',
  measurementId: 'G-XELQH72Y2J',
};

<<<<<<< HEAD
// ---- Singleton app ----
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ---- Firestore with modern local cache (no deprecation warning) ----
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager(),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    }),
  });
} catch {
  // Fallback path for older environments
  db = getFirestore(app);
  try { enableIndexedDbPersistence(db).catch(() => {}); } catch {}
}

export { app, db };

/* ============================================================================
   Alerts (sessions/{code}/alerts)
   - pushAlert(sessionCode, { type, message, meta? })
   - listenToAlerts(sessionCode, cb) => unsubscribe()
   Drives “They picked your answer”, “X guessed you right”, etc., toasts.
============================================================================ */

export async function pushAlert(sessionCode, alert) {
  if (!sessionCode) return;
  try {
    const ref = collection(db, 'sessions', sessionCode, 'alerts');
    await addDoc(ref, { ...(alert || {}), ts: serverTimestamp() });
  } catch (e) {
    console.warn('[firebase] pushAlert failed:', e);
  }
}

export function listenToAlerts(sessionCode, cb) {
  if (!sessionCode || typeof cb !== 'function') return () => {};
  try {
    const qRef = query(
      collection(db, 'sessions', sessionCode, 'alerts'),
      orderBy('ts', 'desc'),
      limit(1)
    );
    return onSnapshot(qRef, (snap) => {
      snap
        .docChanges()
        .filter((c) => c.type === 'added')
        .forEach((c) => cb({ id: c.doc.id, ...(c.doc.data() || {}) }));
    });
  } catch (e) {
    console.warn('[firebase] listenToAlerts failed:', e);
    return () => {};
  }
=======
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// client-only niceties
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  enableIndexedDbPersistence(db).catch(() => {});
}

export async function ensureSignedIn() {
  if (typeof window === 'undefined') return null;
  if (auth.currentUser) return auth.currentUser;

  try {
    const cred = await signInAnonymously(auth);
    if (cred?.user) return cred.user; // <- return immediately when possible
  } catch (e) {
    // fall through to listener; ignore race conditions
  }

  // Fallback: wait for auth state
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsub(); resolve(auth.currentUser || null); }, 10000);
    const unsub = onAuthStateChanged(
      auth,
      (user) => { clearTimeout(timer); unsub(); resolve(user || null); },
      (err) => { clearTimeout(timer); unsub(); reject(err); }
    );
  });
>>>>>>> main
}
