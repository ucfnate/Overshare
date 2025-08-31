// lib/firebase.js
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
 * 🔒 PASTE YOUR REAL WEB CONFIG HERE (the same one you already use)
 * Example keys:
 *  - apiKey
 *  - authDomain
 *  - projectId
 *  - storageBucket
 *  - messagingSenderId
 *  - appId
 * (measurementId optional)
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
}
