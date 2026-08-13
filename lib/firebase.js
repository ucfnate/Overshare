// lib/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  enableIndexedDbPersistence,
  collection, addDoc, serverTimestamp,
  query, where, orderBy, onSnapshot,
  deleteDoc, doc,
} from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([key, value]) => key !== 'measurementId' && !value)
  .map(([key]) => key);

if (missingConfig.length) {
  throw new Error(`Missing Firebase configuration: ${missingConfig.join(', ')}`);
}

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
    if (cred?.user) return cred.user;
  } catch (e) {
    // ignore and fall through to onAuthStateChanged
  }

  // Fallback: wait briefly for auth state
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsub(); resolve(auth.currentUser || null); }, 10000);
    const unsub = onAuthStateChanged(
      auth,
      (user) => { clearTimeout(timer); unsub(); resolve(user || null); },
      (err) => { clearTimeout(timer); unsub(); reject(err); }
    );
  });
}

/** Alerts API */
export async function pushAlert(code, to, message, type = 'info') {
  const col = collection(db, 'sessions', code, 'alerts');
  await addDoc(col, { to, type, message, createdAt: serverTimestamp() });
}

export function listenToAlerts(code, playerName, onAlert) {
  const col = collection(db, 'sessions', code, 'alerts');
  const q = query(col, where('to', 'in', [playerName, '*']), orderBy('createdAt', 'asc'));
  return onSnapshot(q, async (snap) => {
    for (const d of snap.docs) {
      const data = d.data() || {};
      onAlert({ id: d.id, type: data.type || 'info', message: data.message || '' });
      try { await deleteDoc(doc(db, 'sessions', code, 'alerts', d.id)); } catch {}
    }
  });
}
