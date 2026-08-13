import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const projectId = 'overshare-rules-test';
const roomCode = 'ROOM42';
let testEnv;

const room = {
  hostId: 'host-uid',
  participantUids: ['host-uid', 'guest-uid'],
  players: [
    { id: 'host-uid', name: 'Host', isHost: true },
    { id: 'guest-uid', name: 'Guest', isHost: false },
  ],
  gameState: 'categoryVoting',
  currentTurnIndex: 0,
  currentQuestion: '',
  currentCategory: '',
  currentQuestionAsker: '',
  availableCategories: [],
  usedCategories: [],
  turnHistory: [],
  categoryVotes: {},
  preferencesReady: { 'host-uid': true, 'guest-uid': true },
  relationshipsReady: {},
  party: null,
  createdAt: Timestamp.now(),
  expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
};

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'sessions', roomCode), room);
  });
});

after(async () => testEnv?.cleanup());

describe('room access', () => {
  test('requires authentication to discover a room', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'sessions', roomCode)));
  });

  test('allows an authenticated player to look up an unexpired room by code', async () => {
    const db = testEnv.authenticatedContext('new-uid').firestore();
    await assertSucceeds(getDoc(doc(db, 'sessions', roomCode)));
  });

  test('allows only a constrained self-join', async () => {
    const db = testEnv.authenticatedContext('new-uid').firestore();
    const ref = doc(db, 'sessions', roomCode);
    await assertSucceeds(updateDoc(ref, {
      participantUids: [...room.participantUids, 'new-uid'],
      players: [...room.players, { id: 'new-uid', name: 'New', isHost: false }],
      'preferencesReady.new-uid': true,
    }));
  });

  test('rejects adding somebody else as a participant', async () => {
    const db = testEnv.authenticatedContext('attacker-uid').firestore();
    await assertFails(updateDoc(doc(db, 'sessions', roomCode), {
      participantUids: [...room.participantUids, 'victim-uid'],
      players: [...room.players, { id: 'victim-uid', name: 'Victim', isHost: false }],
      'preferencesReady.victim-uid': true,
    }));
  });
});

describe('private profiles', () => {
  test('lets players manage only their own questionnaire document', async () => {
    const guestDb = testEnv.authenticatedContext('guest-uid').firestore();
    const ownProfile = doc(guestDb, 'sessions', roomCode, 'privateProfiles', 'guest-uid');
    await assertSucceeds(setDoc(ownProfile, { preferences: { depth: 'balanced' } }));
    await assertSucceeds(getDoc(ownProfile));

    const hostDb = testEnv.authenticatedContext('host-uid').firestore();
    await assertFails(getDoc(doc(hostDb, 'sessions', roomCode, 'privateProfiles', 'guest-uid')));
  });
});

describe('multiplayer mutations', () => {
  test('prevents a non-host from forcing a room-wide state transition', async () => {
    const db = testEnv.authenticatedContext('guest-uid').firestore();
    await assertFails(updateDoc(doc(db, 'sessions', roomCode), { gameState: 'playing' }));
  });

  test('lets a player change only their own category vote', async () => {
    const db = testEnv.authenticatedContext('guest-uid').firestore();
    const ref = doc(db, 'sessions', roomCode);
    await assertSucceeds(updateDoc(ref, { 'categoryVotes.guest-uid': ['icebreakers'] }));
    await assertFails(updateDoc(ref, { 'categoryVotes.host-uid': ['spicy'] }));
  });
});

describe('alerts', () => {
  test('delivers an alert only to its intended participant', async () => {
    const hostDb = testEnv.authenticatedContext('host-uid').firestore();
    const alertRef = await assertSucceeds(addDoc(collection(hostDb, 'sessions', roomCode, 'alerts'), {
      toUid: 'guest-uid',
      type: 'info',
      message: 'Your turn',
      createdAt: Timestamp.now(),
    }));

    const guestDb = testEnv.authenticatedContext('guest-uid').firestore();
    await assertSucceeds(getDoc(doc(guestDb, 'sessions', roomCode, 'alerts', alertRef.id)));

    const hostReadDb = testEnv.authenticatedContext('host-uid').firestore();
    await assertFails(getDoc(doc(hostReadDb, 'sessions', roomCode, 'alerts', alertRef.id)));

    await assertSucceeds(deleteDoc(doc(guestDb, 'sessions', roomCode, 'alerts', alertRef.id)));
  });
});
