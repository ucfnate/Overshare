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
}
