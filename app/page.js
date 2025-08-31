// lib/firebase.js
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCLqoJOePWrtmZOjQ5K6yQIVOBQdF8Xl-o",
  authDomain: "overshare-239ef.firebaseapp.com",
  projectId: "overshare-239ef",
  storageBucket: "overshare-239ef.firebasestorage.app",
  messagingSenderId: "414367584189",
  appId: "1:414367584189:web:cb21f18f9ff2caa89bccd4",
  measurementId: "G-XELQH72Y2J"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// initialize Firestore with the modern persistent cache
initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export const db = getFirestore(app);
export default app;
