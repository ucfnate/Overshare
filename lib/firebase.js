import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCLqoJOePWrtmZOjQ5K6yQIVOBQdF8Xl-o",
  authDomain: "overshare-239ef.firebaseapp.com",
  projectId: "overshare-239ef",
  storageBucket: "overshare-239ef.firebasestorage.app",
  messagingSenderId: "414367584189",
  appId: "1:414367584189:web:cb21f18f9ff2caa89bccd4",
  measurementId: "G-XELQH72Y2J"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;