// lib/firebase.js
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
const firebaseConfig = {
  apiKey: 'AIzaSyCLqoJOePWrtmZOjQ5K6yQIVOBQdF8Xl-o',
  authDomain: 'overshare-239ef.firebaseapp.com',
  projectId: 'overshare-239ef',
  storageBucket: 'overshare-239ef.firebasestorage.app',
  messagingSenderId: '414367584189',
  appId: '1:414367584189:web:cb21f18f9ff2caa89bccd4',
  measurementId: 'G-XELQH72Y2J',
};

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
  try { await signInAnonymously(auth); } catch {}
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { unsub(); resolve(auth.currentUser || null); }, 10000);
    const unsub = onAuthStateChanged(auth, (user) => { clearTimeout(t); unsub(); resolve(user || null); }, (e) => { clearTimeout(t); unsub(); reject(e); });
  });
}

export default app;
