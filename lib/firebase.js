// lib/firebase.js
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  // local cache (v10+)
  persistentLocalCache,
  persistentMultipleTabManager,
  // alerts helpers
  collection, addDoc, serverTimestamp, query, where, orderBy,
  onSnapshot, deleteDoc, doc, getDocs
} from 'firebase/firestore';

const firebaseConfig = {
  // your config
};

const app = initializeApp(firebaseConfig);

// Better offline + fewer flaky reconnects (removes the deprecation warning)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  // If you’re behind strict proxies and see QUIC errors, uncomment this:
//  experimentalForceLongPolling: true,
//  useFetchStreams: false,
});
export { db };

/** Alerts live in a subcollection:
 *   sessions/{code}/alerts/{autoId}
 *   { to: string ('*' for broadcast or playerName), type: 'success'|'info'|'warning',
 *     message: string, createdAt: TS }
 */
export async function pushAlert(code, to, message, type = 'info') {
  const col = collection(db, 'sessions', code, 'alerts');
  await addDoc(col, { to, type, message, createdAt: serverTimestamp() });
}

/** Listener for alerts addressed to me (or broadcast '*').
 *  Calls onAlert({ id, type, message }) and auto-deletes the alert doc after we show it.
 */
export function listenToAlerts(code, playerName, onAlert) {
  const col = collection(db, 'sessions', code, 'alerts');
  const q = query(col, where('to', 'in', [playerName, '*']), orderBy('createdAt', 'asc'));
  const unsub = onSnapshot(q, async (snap) => {
    for (const d of snap.docs) {
      const data = d.data() || {};
      onAlert({ id: d.id, type: data.type || 'info', message: data.message || '' });
      try {
        await deleteDoc(doc(db, 'sessions', code, 'alerts', d.id));
      } catch {}
    }
  });
  return unsub;
}
