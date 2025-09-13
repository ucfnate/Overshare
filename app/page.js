'use client';
export const dynamic = 'force-dynamic';

/* =========================================================
   Imports
========================================================= */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users,
  MessageCircle,
  Heart,
  Sparkles,
  Lightbulb,
  Target,
  Flame,
  Volume2,
  VolumeX,
  SkipForward,
  HelpCircle,
  X,
  Crown,
  Trophy,
  CheckCircle2,
  Wand2
} from 'lucide-react';

import { db } from '../lib/firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';

import {
  questionCategories as qcImport,
  getRandomQuestion as getRandomQImport
} from '../lib/questionCategories';

/* =========================================================
   Small shared UI
========================================================= */
const ProgressIndicator = ({ current, total, className = '' }) => (
  <div className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full ${className}`}>
    <div
      className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
      style={{ width: `${total ? Math.min(100, Math.max(0, (current / total) * 100)) : 0}%` }}
    />
  </div>
);

const Scoreboard = ({ scores = {}, inline = false }) => {
  const entries = Object.entries(scores || {});
  const sorted = entries.sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, 3);

  if (inline) {
    return (
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-500" />
        <span className="text-sm">
          Top: {sorted.map(([n, s]) => `${n} (${s})`).join(' · ') || '—'}
        </span>
      </div>
    );
  }
  return (
    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
      <div className="flex items-center gap-2 mb-2">
        <Crown className="w-5 h-5 text-yellow-500" />
        <h4 className="font-semibold">Leaderboard</h4>
      </div>
      <ul className="space-y-1">
        {sorted.length ? (
          sorted.map(([n, s], i) => (
            <li key={n} className="flex justify-between">
              <span>{i + 1}. {n}</span>
              <span className="font-semibold">{s}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-gray-500 dark:text-gray-300">No scores yet</li>
        )}
      </ul>
    </div>
  );
};

/* =========================================================
   Party child components (avoid conditional hooks in parent)
========================================================= */

// --- Fill in the Blank: submission screen for non-turn players + pick favorite for turn owner
function FillCollectView({
  party,
  players,
  playerName,
  turnOwner,
  isTurnOwner,
  onSubmitAnswer,
  onMarkDone,
  onPickFavorite,
  onToggleScores
}) {
  const [draft, setDraft] = useState('');
  useEffect(() => { setDraft(''); }, [party?.prompt]);

  const mySubs = (party?.submissions?.[playerName] || []);
  const myDone = !!party?.done?.[playerName];
  const nonTurn = (players || []).filter(p => p.name !== turnOwner);
  const allDone = nonTurn.length > 0 && nonTurn.every(p =>
    party?.done?.[p.name] || (party?.submissions?.[p.name] || []).length > 0
  );

  return (
    <>
      {/* PROMPT ALWAYS VISIBLE */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 dark:border-purple-400 mb-4">
        <p className="font-medium">{party?.prompt}</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Turn owner: {turnOwner}</p>

      {!isTurnOwner ? (
        <>
          <div className="space-y-2 mb-3">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={mySubs.length >= 2 ? 'You reached 2 answers' : 'Your answer…'}
              disabled={mySubs.length >= 2 || myDone}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 bg-white dark:bg-gray-900"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { if (draft.trim()) onSubmitAnswer(draft); setDraft(''); }}
                disabled={mySubs.length >= 2 || myDone || !draft.trim()}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 rounded-xl font-semibold disabled:opacity-50"
              >
                Submit
              </button>
              <button
                onClick={onMarkDone}
                disabled={myDone}
                className="px-3 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600"
              >
                I’m done
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Submitted: {mySubs.length} / 2 {myDone && '✓'}
          </div>
        </>
      ) : (
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {allDone ? 'Everyone is done — pick your favorite below.' : 'Waiting for answers…'}
        </div>
      )}

      {isTurnOwner && allDone && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Pick your favorite</h3>
          <div className="space-y-2 max-h-60 overflow-auto">
            {Object.values(party?.submissions || {}).flat().map(a => (
              <button
                key={a.id}
                onClick={() => onPickFavorite(a.id)}
                className="w-full p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 text-left hover:border-purple-400"
              >
                {a.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// --- Superlatives: choose & submit a vote (two-step to avoid “game stops”)
function SuperVoteView({
  party,
  players,
  playerName,
  onSubmitVote,
}) {
  const [choice, setChoice] = useState(party?.votes?.[playerName] || '');
  useEffect(() => {
    // keep local in sync if state resets (e.g., tiebreaker)
    setChoice(party?.votes?.[playerName] || '');
  }, [party?.prompt, party?.tiebreak]);

  const myVoteSubmitted = !!party?.votes?.[playerName];

  return (
    <>
      {/* PROMPT ALWAYS VISIBLE */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 dark:border-purple-400 mb-4">
        <p className="font-medium">{party?.prompt}</p>
      </div>

      <div className="space-y-2">
        {players.map(p => (
          <button
            key={p.id}
            onClick={() => setChoice(p.name)}
            disabled={myVoteSubmitted}
            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
              choice === p.name
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
            } ${myVoteSubmitted ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {!myVoteSubmitted ? (
        <button
          onClick={() => { if (choice) onSubmitVote(choice); }}
          disabled={!choice}
          className="w-full mt-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
        >
          Submit Vote
        </button>
      ) : (
        <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-3">Vote submitted ✓</p>
      )}
    </>
  );
}

// --- Never Have I Ever: pick (highlight) then submit
function NhiCollectView({
  party,
  players,
  playerName,
  turnOwner,
  isTurnOwner,
  onSubmitMyAnswer
}) {
  const [local, setLocal] = useState(null);
  const myAnsOnServer = party?.nhiAnswers?.[playerName];
  const others = (players || []).filter(p => p.name !== turnOwner);
  const allSubmitted = others.length > 0 && others.every(p => party?.nhiAnswers?.[p.name] !== undefined);

  useEffect(() => {
    // reset local selection when the prompt changes
    setLocal(null);
  }, [party?.prompt]);

  return (
    <>
      {/* PROMPT ALWAYS VISIBLE */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 dark:border-purple-400 mb-4">
        <p className="font-medium">{party?.prompt}</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Turn owner: {turnOwner}</p>

      {!isTurnOwner ? (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setLocal(true)}
              disabled={myAnsOnServer !== undefined}
              className={`flex-1 border-2 py-3 rounded-xl font-semibold ${
                local === true
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600'
              } ${myAnsOnServer !== undefined ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              I have
            </button>
            <button
              onClick={() => setLocal(false)}
              disabled={myAnsOnServer !== undefined}
              className={`flex-1 border-2 py-3 rounded-xl font-semibold ${
                local === false
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600'
              } ${myAnsOnServer !== undefined ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              I haven’t
            </button>
          </div>

          {myAnsOnServer === undefined ? (
            <button
              onClick={() => { if (local !== null) onSubmitMyAnswer(local); }}
              disabled={local === null}
              className="w-full mt-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              Submit
            </button>
          ) : (
            <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-3">Answer submitted ✓</p>
          )}
        </>
      ) : (
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          Waiting for everyone to submit…
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
        Submitted: {Object.keys(party?.nhiAnswers || {}).length} / {others.length}
      </div>

      {isTurnOwner && allSubmitted && (
        <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-3">Everyone has submitted — proceed to guessing.</p>
      )}
    </>
  );
}

// --- NHI guessing: only turn owner chooses Has/Hasn’t for each player, then confirm
function NhiGuessView({
  party,
  players,
  playerName,
  turnOwner,
  isTurnOwner,
  onConfirmGuesses
}) {
  const [guessMap, setGuessMap] = useState({});
  const others = (players || []).filter(p => p.name !== turnOwner);

  return (
    <>
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 dark:border-purple-400 mb-4">
        <p className="font-medium">{party?.prompt}</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Turn owner: {turnOwner}</p>

      {isTurnOwner ? (
        <div className="space-y-2">
          {others.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600">
              <span className="font-medium">{p.name}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setGuessMap(m => ({ ...m, [p.name]: true }))}
                  className={`px-3 py-1 rounded-lg border-2 ${guessMap[p.name] === true ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600'}`}
                >
                  Has
                </button>
                <button
                  onClick={() => setGuessMap(m => ({ ...m, [p.name]: false }))}
                  className={`px-3 py-1 rounded-lg border-2 ${guessMap[p.name] === false ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}`}
                >
                  Hasn’t
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => onConfirmGuesses(guessMap)}
            className="w-full mt-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold"
          >
            Confirm Guesses
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {turnOwner} is guessing…
        </div>
      )}
    </>
  );
}

/* =========================================================
   Main Component
========================================================= */
export default function Overshare() {
  /* State */
  const [gameState, setGameState] = useState('welcome');
  const [playerName, setPlayerName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [isHost, setIsHost] = useState(false);

  const [appMode, setAppMode] = useState(null); // 'solo' | 'multi'
  const [mpMode, setMpMode] = useState(null);   // 'classic' | 'party'

  // Shared / classic
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentCategory, setCurrentCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [usedCategories, setUsedCategories] = useState([]);
  const [turnHistory, setTurnHistory] = useState([]);
  const [currentQuestionAsker, setCurrentQuestionAsker] = useState('');
  const [categoryVotes, setCategoryVotes] = useState({});
  const [myVotedCategories, setMyVotedCategories] = useState([]);
  const [hasVotedCategories, setHasVotedCategories] = useState(false);

  // Party session blob
  const [party, setParty] = useState(null); // { state, type, prompt, round, turnIndex, submissions, done, votes, nhiAnswers, guesses, scores, winner, tiebreak, nextTurnIndex }

  // Solo
  const [soloCategories, setSoloCategories] = useState([]);
  const [soloAsked, setSoloAsked] = useState([]);

  // UX
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [skipsUsedThisTurn, setSkipsUsedThisTurn] = useState(0);
  const [maxSkipsPerTurn] = useState(1);
  const [notification, setNotification] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showScores, setShowScores] = useState(false);
// --- Background themes
const BG_THEMES = {
  sunset: 'bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500',
  ocean:  'bg-gradient-to-br from-sky-600 via-cyan-500 to-emerald-500',
  dusk:   'bg-gradient-to-br from-indigo-700 via-purple-700 to-fuchsia-600',
  vapor:  'bg-gradient-to-br from-rose-400 via-fuchsia-500 to-indigo-500',
  slate:  'bg-gradient-to-br from-slate-700 via-slate-800 to-black',
  plain:  'bg-gray-100 dark:bg-gray-900', // non-gradient
};

const [bgTheme, setBgTheme] = useState('sunset');
const bgClass = BG_THEMES[bgTheme] || BG_THEMES.sunset;

// persist choice locally (optional)
useEffect(() => {
  try { const saved = localStorage.getItem('bgTheme'); if (saved) setBgTheme(saved); } catch {}
}, []);
useEffect(() => {
  try { localStorage.setItem('bgTheme', bgTheme); } catch {}
}, [bgTheme]);

  /* Refs */
  const unsubscribeRef = useRef(null);
  const prevTurnIndexRef = useRef(0);
  const audioCtxRef = useRef(null);

  /* Category library */
  const iconMap = useMemo(
    () => ({ Sparkles, Heart, Lightbulb, Target, Flame, MessageCircle }),
    []
  );

  const FALLBACK_CATEGORIES = useMemo(
    () => ({
      icebreakers: {
        name: 'Icebreakers',
        description: 'Warm up with easy, fun prompts.',
        icon: 'Sparkles',
        color: 'from-purple-500 to-pink-500',
        questions: [
          'What was a small win you had this week?',
          'What’s your go-to fun fact about yourself?'
        ]
      },
      creative: {
        name: 'Creative',
        description: 'Imagine, riff, and get playful.',
        icon: 'Lightbulb',
        color: 'from-indigo-500 to-purple-500',
        questions: [
          'Invent a wild holiday and describe how we celebrate it.',
          'Merge two movies into one plot — what happens?'
        ]
      },
      deep_dive: {
        name: 'Deep Dive',
        description: 'Thoughtful questions with heart.',
        icon: 'MessageCircle',
        color: 'from-blue-500 to-cyan-500',
        questions: [
          'What belief of yours has changed in the last few years?',
          'What’s a memory that shaped who you are?'
        ]
      },
      growth: {
        name: 'Growth',
        description: 'Reflect, learn, and level up.',
        icon: 'Target',
        color: 'from-emerald-500 to-teal-500',
        questions: [
          'What habit are you trying to build?',
          'What’s a risk you’re glad you took?'
        ]
      },
      spicy: {
        name: 'Spicy',
        description: 'Bold prompts for brave groups.',
        icon: 'Flame',
        color: 'from-orange-500 to-red-500',
        questions: [
          'What’s a “hot take” you stand by?',
          'What’s a topic you wish people were more honest about?'
        ]
      }
    }),
    []
  );

  const CATEGORIES = useMemo(() => {
    const raw =
      qcImport && typeof qcImport === 'object'
        ? (qcImport.default && typeof qcImport.default === 'object'
            ? qcImport.default
            : qcImport)
        : {};
    const keys = Object.keys(raw || {});
    if (keys.length > 0) return raw;
    return FALLBACK_CATEGORIES;
  }, [FALLBACK_CATEGORIES]);

  const libraryOK = useMemo(() => {
    const usingFallback = CATEGORIES === FALLBACK_CATEGORIES;
    return typeof getRandomQImport === 'function' && !usingFallback;
  }, [CATEGORIES, FALLBACK_CATEGORIES]);

  /* Audio + notifications */
  const getAudio = () => {
    if (!audioEnabled) return null;
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioCtxRef.current = new Ctx();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  const playSound = (type) => {
    try {
      const audio = getAudio();
      if (!audio) return;

      const tone = (seq) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(audio.destination);
        const t0 = audio.currentTime + 0.001;
        gain.gain.setValueAtTime(0.1, t0);
        osc.start(t0);
        try { seq(osc, gain, t0); } catch { try { osc.stop(t0 + 0.15); } catch {} }
      };

      const sounds = {
        click: () => tone((osc, gain, t0) => {
          osc.frequency.setValueAtTime(800, t0);
          osc.frequency.exponentialRampToValueAtTime(600, t0 + 0.10);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.10);
          osc.stop(t0 + 0.11);
        }),
        success: () => tone((osc, gain, t0) => {
          osc.frequency.setValueAtTime(523.25, t0);
          osc.frequency.setValueAtTime(659.25, t0 + 0.10);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
          osc.stop(t0 + 0.24);
        }),
        turn: () => tone((osc, gain, t0) => {
          osc.frequency.setValueAtTime(440, t0);
          osc.frequency.setValueAtTime(554.37, t0 + 0.15);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.30);
          osc.stop(t0 + 0.32);
        }),
      };

      if (sounds[type]) sounds[type]();
    } catch {}
  };

  const showNotification = (message, emoji = '🎉') => {
    setNotification({ message, emoji });
    window.clearTimeout((showNotification._t || 0));
    showNotification._t = window.setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
  if (!sessionCode || !playerName) return;

  const unsub = listenToAlerts(sessionCode, playerName, ({ type, message }) => {
    // start simple:
    alert(message);

    // or, use your built-in toast instead of alert:
    // showNotification(message, type === 'success' ? '✅' : '🔔');
    try { playSound('success'); } catch {}
  });

  return () => unsub && unsub();
}, [sessionCode, playerName]);

  /* Questions & prompts */
  const getQuestion = useCallback((categoryKey, exclude = []) => {
    if (typeof getRandomQImport === 'function') {
      try {
        let tries = 8;
        while (tries-- > 0) {
          const q = getRandomQImport(categoryKey, exclude);
          if (q && !exclude.includes(q)) return q;
        }
      } catch {}
    }
    const pool = (CATEGORIES[categoryKey]?.questions || []);
    if (pool.length === 0) return 'Question unavailable — pick a different category.';
    let q = pool[Math.floor(Math.random() * pool.length)];
    let tries = 10;
    while (exclude.includes(q) && tries-- > 0) {
      q = pool[Math.floor(Math.random() * pool.length)];
    }
    return q;
  }, [CATEGORIES]);

  const SUPERLATIVES = useMemo(() => [
    'Most likely to survive a zombie apocalypse',
    'Most likely to forget why they walked into a room',
    'Most likely to go viral accidentally',
    'Best unintentional comedian',
    'Most likely to befriend their barista',
    'Best chaotic good energy',
    'Most likely to bring snacks to everything',
    'Most likely to start a group chat argument',
    'Most likely to wear sunglasses indoors',
    'Most likely to have a secret second life'
  ], []);

  const FILL_PROMPTS = useMemo(() => [
    'Write the worst possible movie tagline for a rom-com.',
    'Give a fake but convincing “fun fact” about a common object.',
    'Invent a new holiday and one cursed tradition.',
    'Name a brand-new dating app and its unhinged slogan.',
    'Give a brutal but fair nickname for the person on your left.',
    'Write a two-word horror story.'
  ], []);

  const NHI_PROMPTS = useMemo(() => [
    'Never have I ever eaten an entire pizza alone.',
    'Never have I ever lied to get out of plans.',
    'Never have I ever stalked an ex on social media.',
    'Never have I ever laughed at the wrong moment.',
    'Never have I ever sent a text to the wrong person.',
    'Never have I ever fallen asleep on a video call.'
  ], []);

  const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* Firestore: session helpers */
  const createFirebaseSession = async (code, hostPlayer) => {
    try {
      await setDoc(doc(db, 'sessions', code), {
        hostId: hostPlayer.id,
        players: [hostPlayer],
        mode: null,
        gameState: 'waitingRoom',
        selectedCategories: [],
        currentTurnIndex: 0,
        currentQuestion: '',
        currentCategory: '',
        currentQuestionAsker: '',
        availableCategories: [],
        usedCategories: [],
        turnHistory: [],
        categoryVotes: {},
        party: null,
        createdAt: serverTimestamp()
      });
      return true;
    } catch (err) {
      console.error('Error creating session:', err);
      return false;
    }
  };

  const listenToSession = useCallback((code) => {
    if (!code) return () => {};
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    const sessionRef = doc(db, 'sessions', code);
    let prevCount = 0;

    const unsubscribe = onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};

        const newCount = (data.players || []).length;
        if (prevCount > 0 && newCount > prevCount) {
          const newPlayer = (data.players || [])[newCount - 1];
          if (newPlayer && newPlayer.name !== playerName) {
            showNotification(`${newPlayer.name} joined the game!`, '👋');
            try { playSound('success'); } catch {}
          }
        }
        prevCount = newCount;

        setPlayers([...(data.players || [])]);
        setSelectedCategories([...(data.selectedCategories || [])]);
        setCurrentTurnIndex(typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0);
        setCurrentQuestion(data.currentQuestion || '');
        setCurrentCategory(data.currentCategory || '');
        setCurrentQuestionAsker(data.currentQuestionAsker || '');
        setAvailableCategories([...(data.availableCategories || [])]);
        setUsedCategories([...(data.usedCategories || [])]);
        setTurnHistory([...(data.turnHistory || [])]);
        setCategoryVotes(data.categoryVotes || {});
        setMpMode(data.mode || null);
        setParty(data.party || null);

        const incomingTurn = typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0;
        if (incomingTurn !== prevTurnIndexRef.current) {
          setSkipsUsedThisTurn(0);
          prevTurnIndexRef.current = incomingTurn;
        }

        const incomingRaw = data.gameState || 'waitingRoom';
        const incoming = incomingRaw === 'waiting' ? 'waitingRoom' : incomingRaw;
        if (incoming !== gameState) {
          setGameState(incoming);
          if (incoming === 'playing') { try { playSound('success'); } catch {} }
          else if (incoming === 'categoryPicking' || incoming === 'party_setup' || incoming === 'party_active') {
            try { playSound('turn'); } catch {}
          }
        }
      },
      (error) => console.error('Firebase listener error:', error)
    );

    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, [playerName, gameState]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
      try { if (audioCtxRef.current?.close) audioCtxRef.current.close(); } catch {}
    };
  }, []);

  /* Create / Join / Return */
  const handleCreateSession = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostPlayer = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      name: playerName,
      isHost: true,
      joinedAt: new Date().toISOString()
    };
    const ok = await createFirebaseSession(code, hostPlayer);
    if (!ok) { alert('Failed to create session. Please try again.'); return; }
    setSessionCode(code);
    setIsHost(true);
    setPlayers([hostPlayer]);
    listenToSession(code);
    setGameState('waitingRoom');
    try { playSound('success'); } catch {}
    showNotification(`Lobby created: ${code}`, '🧩');
  };

  const handleJoinSession = async () => {
    const code = (sessionCode || '').trim().toUpperCase();
    if (!code) return;
    const sessionRef = doc(db, 'sessions', code);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) { alert('Session not found. Check the code and try again.'); return; }
    const data = snap.data() || {};
    const alreadyIn = (data.players || []).some((p) => p?.name === playerName);
    if (!alreadyIn) {
      const newPlayer = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        name: playerName,
        isHost: false,
        joinedAt: new Date().toISOString()
      };
      try { await updateDoc(sessionRef, { players: arrayUnion(newPlayer) }); }
      catch {
        const fresh = (await getDoc(sessionRef)).data() || {};
        const updated = [...(fresh.players || []), newPlayer];
        await updateDoc(sessionRef, { players: updated });
      }
    }
    setIsHost(false);
    listenToSession(code);
    setGameState('waitingRoom');
    try { playSound('success'); } catch {}
  };

  const returnToLobby = async () => {
    if (!sessionCode) return;
    await updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'waitingRoom' });
    setGameState('waitingRoom');
  };

  /* Classic helpers */
  const calculateTopCategories = (votes) => {
    const counts = {};
    Object.values(votes || {}).forEach(arr => (arr || []).forEach(cat => {
      counts[cat] = (counts[cat] || 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 4);
  };

  const handleCategoryPicked = async (category) => {
    if (!sessionCode) return;
    const currentPlayer = players[currentTurnIndex] || players[0];
    if (!currentPlayer) return;
    const question = getQuestion(category, [currentQuestion]);
    const newUsed = [...usedCategories, category];
    const newAvail = (availableCategories || []).filter((c) => c !== category);
    const newHistory = [...turnHistory, { player: currentPlayer.name, category, question }];
    await updateDoc(doc(db, 'sessions', sessionCode), {
      currentQuestion: question,
      currentCategory: category,
      gameState: 'playing',
      usedCategories: newUsed,
      availableCategories: newAvail,
      turnHistory: newHistory,
      currentQuestionAsker: currentPlayer.name
    });
    try { playSound('success'); } catch {}
  };

  const handleSkipQuestion = async () => {
    if (skipsUsedThisTurn >= maxSkipsPerTurn) {
      showNotification("You've used your skip for this turn!", '⏭️');
      return;
    }
    if (!sessionCode) return;
    const forcedCategory =
      currentCategory ||
      (turnHistory[turnHistory.length - 1]?.category) ||
      (selectedCategories[0]) ||
      'icebreakers';
    const newQuestion = getQuestion(forcedCategory, [currentQuestion]);
    await updateDoc(doc(db, 'sessions', sessionCode), {
      currentQuestion: newQuestion,
      currentCategory: forcedCategory
    });
    setSkipsUsedThisTurn((n) => n + 1);
    try { playSound('click'); } catch {}
  };

  const handleNextQuestion = async () => {
    if (!sessionCode) return;
    const count = players.length || 0; if (!count) return;
    const nextTurn = (currentTurnIndex + 1) % count;
    let newAvailable = availableCategories;
    let newUsed = usedCategories;
    if ((availableCategories || []).length === 0) {
      newAvailable = [...(selectedCategories || [])];
      newUsed = [];
    }
    await updateDoc(doc(db, 'sessions', sessionCode), {
      gameState: 'categoryPicking',
      currentTurnIndex: nextTurn,
      availableCategories: newAvailable,
      usedCategories: newUsed,
      currentQuestion: '',
      currentCategory: '',
      currentQuestionAsker: ''
    });
    try { playSound('turn'); } catch {}
  };

  /* Party helpers */
  const partyChooseTypeAndPrompt = (roundNum) => {
    const mod = ((roundNum || 1) - 1) % 3; // 1: fill, 2: super, 3: nhi
    const type = mod === 0 ? 'fill' : mod === 1 ? 'super' : 'nhi';
    return {
      type,
      prompt: type === 'fill' ? randomOf(FILL_PROMPTS) : type === 'super' ? randomOf(SUPERLATIVES) : randomOf(NHI_PROMPTS),
    };
  };

  const startPartyMode = async () => {
    if (!sessionCode) return;
    await updateDoc(doc(db, 'sessions', sessionCode), {
      mode: 'party',
      gameState: 'party_setup',
      currentTurnIndex: 0,
      party: {
        state: 'setup', // setup → collect_fill | vote_super | collect_nhi | guessing_nhi → reveal → wait_next
        type: null,
        prompt: '',
        round: 1,
        turnIndex: 0,
        submissions: {},
        done: {},
        votes: {},
        nhiAnswers: {},
        guesses: {},
        scores: {},
        winner: null,
        tiebreak: 0,
        nextTurnIndex: 0,
      }
    });
    setMpMode('party');
  };

  const hostStartPartyRound = async () => {
    if (!sessionCode || !party) return;
    // host button only renders on setup; but allow anyone to tap if they’re the next owner in wait_next
    const round = party.round || 1;
    const { type, prompt } = partyChooseTypeAndPrompt(round);
    const next = {
      ...party,
      state: type === 'fill' ? 'collect_fill' : type === 'super' ? 'vote_super' : 'collect_nhi',
      type,
      prompt,
      submissions: {},
      done: {},
      votes: {},
      nhiAnswers: {},
      guesses: {},
      winner: null,
      // keep turnIndex as set before entering setup/wait_next
      tiebreak: type === 'super' ? (party.tiebreak || 0) : 0,
    };
    await updateDoc(doc(db, 'sessions', sessionCode), { party: next, gameState: 'party_active' });
  };

  // Next-turn-only starter
  const nextOwnerStartNextRound = async () => {
    if (!sessionCode || !party) return;
    const iAmNext = players[party.nextTurnIndex]?.name === playerName;
    if (!iAmNext) return;
    const round = party.round || 2; // already incremented in reveal
    const { type, prompt } = partyChooseTypeAndPrompt(round);
    const next = {
      ...party,
      state: type === 'fill' ? 'collect_fill' : type === 'super' ? 'vote_super' : 'collect_nhi',
      type,
      prompt,
      submissions: {},
      done: {},
      votes: {},
      nhiAnswers: {},
      guesses: {},
      winner: null,
      tiebreak: type === 'super' ? (party.tiebreak || 0) : 0,
      turnIndex: party.nextTurnIndex,
    };
    await updateDoc(doc(db, 'sessions', sessionCode), {
      party: next,
      gameState: 'party_active',
      currentTurnIndex: party.nextTurnIndex
    });
  };

  // Fill: submit answer / done (non-turn only)
  const submitFillAnswer = async (text) => {
    if (!sessionCode || !party) return;
    const me = playerName;
    const turnPlayer = players[party.turnIndex]?.name;
    if (me === turnPlayer) return;
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const cur = { ...(party.submissions || {}) };
    const mine = [...(cur[me] || [])];
    if (mine.length >= 2) return;
    mine.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}`, by: me, text: trimmed });
    cur[me] = mine;
    await updateDoc(doc(db, 'sessions', sessionCode), { 'party.submissions': cur });
    showNotification('Answer submitted', '✍️');
  };

  const markFillDone = async () => {
    if (!sessionCode || !party) return;
    const me = playerName;
    const done = { ...(party.done || {}), [me]: true };
    await updateDoc(doc(db, 'sessions', sessionCode), { 'party.done': done });
  };

  // Fill: pick favorite → reveal, winner goes next
  const hostPickFavorite = async (answerId) => {
    if (!sessionCode || !party) return;
    const all = Object.values(party.submissions || {}).flat();
    const picked = all.find(a => a.id === answerId);
    if (!picked) return;

    const scores = { ...(party.scores || {}) };
    scores[picked.by] = (scores[picked.by] || 0) + 1;

    const winnerIndex = Math.max(0, players.findIndex(p => p.name === picked.by));

    const next = {
      ...party,
      state: 'reveal',
      winner: picked.by,
      scores,
      nextTurnIndex: winnerIndex,
      round: (party.round || 1) + 1
    };

    await updateDoc(doc(db, 'sessions', sessionCode), { party: next });
  };

  // Superlatives: submit vote, tally when all in (auto), or tiebreak
  const submitSuperVote = async (voteForName) => {
    if (!sessionCode || !party) return;
    const votes = { ...(party.votes || {}), [playerName]: voteForName };
    await updateDoc(doc(db, 'sessions', sessionCode), { 'party.votes': votes });

    // If everyone voted, tally on whoever’s client hits last; that’s fine since we write idempotently
    const everyoneVoted = players.length > 0 && players.every(p => votes[p.name]);
    if (everyoneVoted) {
      const tally = {};
      Object.values(votes).forEach(name => { tally[name] = (tally[name] || 0) + 1; });
      const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
      if (!sorted.length) return;

      const topCount = sorted[0][1];
      const tied = sorted.filter(([_, c]) => c === topCount).map(([n]) => n);

      if (tied.length > 1) {
        const next = {
          ...party,
          prompt: randomOf(SUPERLATIVES),
          votes: {},
          tiebreak: (party.tiebreak || 0) + 1,
          state: 'vote_super'
        };
        await updateDoc(doc(db, 'sessions', sessionCode), { party: next });
      } else {
        const winner = sorted[0][0];
        const scores = { ...(party.scores || {}) };
        scores[winner] = (scores[winner] || 0) + 1;
        const winnerIndex = Math.max(0, players.findIndex(p => p.name === winner));
        const next = {
          ...party,
          state: 'reveal',
          winner,
          scores,
          nextTurnIndex: winnerIndex,
          round: (party.round || 1) + 1
        };
        await updateDoc(doc(db, 'sessions', sessionCode), { party: next });
      }
    }
  };

  // NHI: non-turn answer submission (now two-step in UI)
  const submitNhiAnswer = async (hasDone) => {
    if (!sessionCode || !party) return;
    const me = playerName;
    const turnPlayer = players[party.turnIndex]?.name;
    if (me === turnPlayer) return;
    const ans = { ...(party.nhiAnswers || {}), [me]: !!hasDone };
    await updateDoc(doc(db, 'sessions', sessionCode), { 'party.nhiAnswers': ans });
  };

  // Move to guessing stage (guarded by UI)
  const startNhiGuessing = async () => {
    if (!sessionCode || !party) return;
    const next = { ...party, state: 'guessing_nhi' };
    await updateDoc(doc(db, 'sessions', sessionCode), { party: next });
  };

  // NHI: confirm guesses; host points + player points; next is sequential
  const hostSubmitNhiGuesses = async (guessesMap) => {
    if (!sessionCode || !party) return;
    const actual = party.nhiAnswers || {};
    const scores = { ...(party.scores || {}) };
    let hostPoints = 0;

    Object.entries(actual).forEach(([name, has]) => {
      const guess = guessesMap[name];
      if (guess === undefined) return;
      const correct = (guess && has) || (!guess && !has);
      if (correct) {
        hostPoints += 1;
        scores[name] = (scores[name] || 0) + 1;
      }
    });

    const owner = players[party.turnIndex]?.name;
    if (owner) scores[owner] = (scores[owner] || 0) + hostPoints;

    const nextTurn = (party.turnIndex + 1) % (players.length || 1);

    const next = {
      ...party,
      state: 'reveal',
      winner: null,
      guesses: guessesMap,
      scores,
      nextTurnIndex: nextTurn,
      round: (party.round || 1) + 1
    };
    await updateDoc(doc(db, 'sessions', sessionCode), { party: next });
  };

  /* =========================
     Topbar / helpers
  ========================= */
  const TopBar = () => (
const TopBar = () => (
  <>
    {/* existing top-right toolbar */}
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <span
        title={libraryOK ? 'Using external question library' : 'Using built-in fallback questions'}
        className={`hidden sm:inline-flex px-2 py-1 rounded-lg text-xs font-medium ${libraryOK ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`}
      >
        {libraryOK ? 'Library' : 'Fallback'}
      </span>

      <button
        onClick={() => { setAudioEnabled(v => !v); try { playSound('click'); } catch {} }}
        className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-all"
        aria-label={audioEnabled ? 'Disable sound' : 'Enable sound'}
        title={audioEnabled ? 'Sound: on' : 'Sound: off'}
      >
        {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>

      <button
        onClick={() => setShowHelp(true)}
        className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-all"
        aria-label="Help"
        title="Help"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>

    {/* NEW: floating background picker on the left */}
    <ThemePicker value={bgTheme} onChange={setBgTheme} />
  </>
);

function ThemePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed left-3 top-1/2 -translate-y-1/2 z-50">
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow hover:bg-white"
        title="Background theme"
        aria-haspopup="listbox"
      >
        🎨
      </button>

      {open && (
        <div className="mt-2 w-44 rounded-xl bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 shadow-lg p-2">
          <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Background</label>
          <select
            value={value}
            onChange={(e) => { onChange(e.target.value); setOpen(false); }}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm p-2"
          >
            <option value="sunset">Sunset</option>
            <option value="ocean">Ocean</option>
            <option value="dusk">Dusk</option>
            <option value="vapor">Vapor</option>
            <option value="slate">Slate</option>
            <option value="plain">Plain</option>
          </select>
        </div>
      )}
    </div>
  );
}

  const HelpModal = () => {
    if (!showHelp) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }}
      >
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-2xl p-6 relative">
          <button
            className="absolute top-3 right-3 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
            onClick={() => setShowHelp(false)}
            aria-label="Close help"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-semibold">How to Play Overshare</h3>
          </div>

          <div className="space-y-3 text-gray-700 dark:text-gray-200">
            <p>Pick Solo for a quick, one-device game; pick Multiplayer to host or join a lobby.</p>
            <p>Classic = conversation rounds by category. Party = Fill-in-the-Blank, Superlatives, and Never Have I Ever with scoring.</p>
            <p className="text-sm text-gray-500 dark:text-gray-300">Pro tip: the more you share, the better the stories get.</p>
          </div>

          <div className="mt-6 border-t border-gray-200 dark:border-gray-600 pt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-300">Enjoying the game?</span>
            <a
              href="https://venmo.com/ucfnate"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:shadow-md"
            >
              💜 Donate
            </a>
          </div>
        </div>
      </div>
    );
  };

  const NotificationToast = () => {
    if (!notification) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-4 z-50">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{notification.emoji}</span>
          <span className="font-medium text-gray-800 dark:text-gray-100">{notification.message}</span>
        </div>
      </div>
    );
  };

  const CategoryChip = ({ categoryKey }) => {
    const category = CATEGORIES[categoryKey];
    const IconComponent = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
    return (
      <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r ${category?.color || 'from-gray-400 to-gray-500'} text-white text-sm`}>
        <IconComponent className="w-4 h-4" />
        <span>{category?.name || categoryKey}</span>
      </div>
    );
  };

  const PlayerList = ({ players: list, title, showCheck = false, highlight = null }) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
        {title} ({(list || []).length})
      </h3>
      <div className="space-y-2">
        {(list || []).map((p, i) => (
          <div
            key={`${p?.id || 'p'}-${i}`}
            className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl ${
              highlight === p?.name ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/30' : ''
            }`}
          >
            <span className="font-medium">{p?.name || 'Player'}</span>
            <div className="flex items-center gap-2">
              {p?.isHost && (
                <span className="text-xs bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-200 px-2 py-1 rounded-full">
                  Host
                </span>
              )}
              {showCheck && (<CheckCircle2 className="w-4 h-4 text-green-500" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* =========================
     Screens
  ========================= */

  // Welcome
  if (gameState === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Overshare</h1>
            <p className="text-gray-600 dark:text-gray-300">Personalized conversation games that bring people closer together</p>
          </div>

          <div className="mb-6">
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          <button
            onClick={() => { if (!playerName.trim()) return; setGameState('modeSelect'); try { playSound('click'); } catch {} }}
            disabled={!playerName.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Let’s Get Started
          </button>
        </div>
      </div>
    );
  }

  // Mode select
  if (gameState === 'modeSelect') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold mb-6">How do you want to play today, {playerName}?</h2>

          <div className="space-y-4">
            <button
              onClick={() => { setAppMode('solo'); setGameState('soloSetup'); try { playSound('click'); } catch {} }}
              className="w-full bg-white dark:bg-gray-900 border-2 border-purple-500 text-purple-600 dark:text-purple-300 py-4 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all"
            >
              Solo Quickstart (one device)
            </button>

            <button
              onClick={() => { setAppMode('multi'); setGameState('createOrJoin'); try { playSound('click'); } catch {} }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center"
            >
              <Users className="w-5 h-5 mr-2" />
              Multiplayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Solo setup
  if (gameState === 'soloSetup') {
    const entries = Object.entries(CATEGORIES || {});
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <h2 className="text-2xl font-bold mb-4">Pick your categories</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Use your library. You can skip questions you don’t like.</p>
          <div className="space-y-3 mb-6">
            {entries.map(([key, category]) => {
              const IconComponent = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
              const selected = soloCategories.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSoloCategories(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
                    try { playSound('click'); } catch {}
                  }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selected ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category?.color || 'from-gray-400 to-gray-500'}`}>
                      <IconComponent className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">{category?.name || key}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">{category?.description || ''}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              if (soloCategories.length === 0) return;
              setGameState('soloPlay');
              try { playSound('success'); } catch {}
              const firstCat = soloCategories[0];
              const q = getQuestion(firstCat, []);
              setCurrentCategory(firstCat);
              setCurrentQuestion(q);
              setSoloAsked([q]);
            }}
            disabled={soloCategories.length === 0}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            Start Solo
          </button>

          <button
            onClick={() => setGameState('modeSelect')}
            className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // Solo play
  if (gameState === 'soloPlay') {
    const changeCategory = (key) => {
      const q = getQuestion(key, soloAsked);
      setCurrentCategory(key);
      setCurrentQuestion(q);
      setSoloAsked((prev) => [...prev, q]);
    };
    const skipSolo = () => {
      const q = getQuestion(currentCategory, soloAsked);
      setCurrentQuestion(q);
      setSoloAsked((prev) => [...prev, q]);
      try { playSound('click'); } catch {}
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Category</div>
            <div className="flex flex-wrap gap-2">
              {soloCategories.map((key) => (
                <button
                  key={key}
                  onClick={() => changeCategory(key)}
                  className={`px-3 py-1 rounded-lg border text-sm ${key === currentCategory ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 text-purple-700 dark:text-purple-200' : 'border-gray-300 dark:border-gray-600'}`}
                >
                  {CATEGORIES[key]?.name || key}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400 mb-6">
            <p className="text-lg leading-relaxed">{currentQuestion}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={skipSolo}
              className="flex-1 bg-white dark:bg-gray-900 border-2 border-orange-400 text-orange-600 dark:text-orange-300 py-3 px-6 rounded-xl font-semibold hover:bg-orange-50 dark:hover:bg-orange-900/10"
            >
              Skip
            </button>
            <button
              onClick={() => { const q = getQuestion(currentCategory, soloAsked); setSoloAsked(p => [...p, q]); setCurrentQuestion(q); try { playSound('turn'); } catch {} }}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg"
            >
              Next
            </button>
          </div>

          <button
            onClick={() => setGameState('modeSelect')}
            className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // Create / Join (multiplayer)
  if (gameState === 'createOrJoin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold mb-6">Ready to play, {playerName}!</h2>

          <div className="space-y-4">
            <button
              onClick={() => { try { playSound('click'); } catch {}; handleCreateSession(); }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center"
            >
              <Users className="w-5 h-5 mr-2" />
              Create Multiplayer Lobby
            </button>

            <div className="flex items-center my-4">
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
              <span className="px-4 text-gray-500 dark:text-gray-300 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Enter session code"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={() => { try { playSound('click'); } catch {}; handleJoinSession(); }}
                disabled={!sessionCode.trim()}
                className="w-full bg-white dark:bg-gray-900 border-2 border-purple-500 text-purple-600 dark:text-purple-300 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join by Code
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Waiting room
  if (gameState === 'waitingRoom') {
    const isNewPlayer = !players.find((p) => p?.name === playerName);
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Lobby {sessionCode}</h2>
            <p className="text-gray-600 dark:text-gray-300">Share this code to join</p>
          </div>
{/* Under the lobby header in the waitingRoom block */}
<div className="mb-3">
  <button
    onClick={async () => {
      try { await navigator.clipboard.writeText(sessionCode); alert('Session code copied!'); }
      catch { alert('Could not copy. Long-press / select to copy.'); }
    }}
    className="px-3 py-1 text-sm rounded-lg border bg-white/80 dark:bg-gray-800/80"
  >
    Copy code
  </button>
</div>

          <PlayerList players={players} title="Players" />

          {isNewPlayer && (
            <button
              onClick={async () => {
                try { playSound('click'); } catch {}
                const newPlayer = {
                  id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
                  name: playerName,
                  isHost: false,
                  joinedAt: new Date().toISOString()
                };
                const sessionRef = doc(db, 'sessions', sessionCode);
                const snap = await getDoc(sessionRef);
                if (snap.exists()) {
                  try { await updateDoc(sessionRef, { players: arrayUnion(newPlayer) }); }
                  catch {
                    const data = snap.data() || {};
                    const updated = [...(data.players || []), newPlayer];
                    await updateDoc(sessionRef, { players: updated });
                  }
                  try { playSound('success'); } catch {}
                }
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all mb-4"
            >
              Join Lobby
            </button>
          )}

          {isHost && !isNewPlayer && (
            <button
              onClick={async () => {
                if (!sessionCode) return;
                try { playSound('click'); } catch {}
                await updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'mpModeSelect' });
                setGameState('mpModeSelect');
              }}
              disabled={players.length < 2}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Game
            </button>
          )}

          {!isHost && !isNewPlayer && (
            <p className="text-gray-500 dark:text-gray-300">Waiting for host to continue…</p>
          )}
        </div>
      </div>
    );
  }

  // Multiplayer mode select
  if (gameState === 'mpModeSelect') {
    const partyDisabled = players.length < 3;
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold mb-6">Choose a game mode</h2>

          {isHost ? (
            <div className="space-y-4">
              <button
                onClick={async () => {
                  try { playSound('click'); } catch {}
                  await updateDoc(doc(db, 'sessions', sessionCode), { mode: 'classic', gameState: 'categoryVoting', categoryVotes: {} });
                  setMpMode('classic');
                  setGameState('categoryVoting');
                }}
                className="w-full bg-white dark:bg-gray-900 border-2 border-purple-500 text-purple-600 dark:text-purple-300 py-4 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all"
              >
                Classic (conversation)
              </button>

              <button
                onClick={async () => {
                  if (partyDisabled) return;
                  try { playSound('click'); } catch {}
                  await startPartyMode();
                }}
                disabled={partyDisabled}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all ${partyDisabled
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg'
                }`}
              >
                Party Mode (3+ players)
              </button>
              {partyDisabled && <p className="text-sm text-gray-500 dark:text-gray-300">Need at least 3 players for Party Mode.</p>}

              {/* Host can bounce back to lobby easily */}
              <button
                onClick={returnToLobby}
                className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 rounded-xl font-semibold"
              >
                Return to Lobby
              </button>
                 <button
                  onClick={() => {
                    if (!confirm('Leave the current round and return everyone to the lobby?')) return;
                    returnToLobby(); // you already have this helper
                  }}
                  className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 rounded-xl font-semibold"
                >
                  Return to Lobby
                </button>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-300">Waiting for host to select a mode…</p>
          )}
        </div>
      </div>
    );
  }

  // Category voting (classic)
  if (gameState === 'categoryVoting') {
    const recommended = Object.keys(CATEGORIES).slice(0, 3);
    const allVotes = Object.values(categoryVotes || {});
    const totalVotes = allVotes.length;
    const waitingFor = (players || [])
      .filter((p) => !(categoryVotes || {})[p?.name])
      .map((p) => p?.name);
    const allPlayersVoted = (players || []).every(p => (categoryVotes || {})[p?.name] && (categoryVotes || {})[p?.name].length > 0);
    const entries = Object.entries(CATEGORIES || {});

    const CategoryCard = ({ categoryKey, category, isSelected, isRecommended, onClick, disabled = false }) => {
      const IconComponent = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
      return (
        <button
          onClick={onClick}
          disabled={disabled}
          className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
            isSelected ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
        >
          <div className="flex items-start space-x-3">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category?.color || 'from-gray-400 to-gray-500'}`}>
              <IconComponent className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">{category?.name || 'Category'}</h3>
                {isRecommended && (
                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200 px-2 py-1 rounded-full">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{category?.description || ''}</p>
            </div>
          </div>
        </button>
      );
    };

    const handleCategoryVote = async (selectedCats) => {
      if (!sessionCode) return;
      const sessionRef = doc(db, 'sessions', sessionCode);
      const snap = await getDoc(sessionRef);
      if (!snap.exists()) return;
      const data = snap.data() || {};
      const currentVotes = { ...(data.categoryVotes || {}) };
      currentVotes[playerName] = selectedCats;
      await updateDoc(sessionRef, { categoryVotes: currentVotes });
      setMyVotedCategories(selectedCats);
      setHasVotedCategories(true);
      try { playSound('success'); } catch {}
      if ((data.players || []).every(p => (currentVotes[p?.name] || []).length > 0)) {
        await updateDoc(sessionRef, { gameState: 'waitingForHost' });
        setGameState('waitingForHost');
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {hasVotedCategories ? 'Waiting for Others' : 'Vote for Categories'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {hasVotedCategories
                ? `${totalVotes} of ${players.length} players have voted`
                : "Select 2–3 categories you'd like to play"}
            </p>
            {hasVotedCategories && (
              <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">Session Code: {sessionCode}</p>
            )}
          </div>

          {!hasVotedCategories ? (
            <>
              <div className="space-y-3 mb-6">
                {entries.map(([key, category]) => {
                  const isRecommended = (recommended || []).includes(key);
                  const isSelected = (selectedCategories || []).includes(key);
                  const disabled = !isSelected && (selectedCategories || []).length >= 3;
                  return (
                    <CategoryCard
                      key={key}
                      categoryKey={key}
                      category={category}
                      isSelected={isSelected}
                      isRecommended={isRecommended}
                      disabled={disabled}
                      onClick={() => {
                        try { playSound('click'); } catch {}
                        setSelectedCategories((prev) => {
                          const has = prev.includes(key);
                          if (has) return prev.filter((c) => c !== key);
                          if (prev.length >= 3) return prev;
                          return [...prev, key];
                        });
                      }}
                    />
                  );
                })}
              </div>
              <button
                onClick={() => handleCategoryVote(selectedCategories)}
                disabled={(selectedCategories || []).length === 0}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit My Votes ({(selectedCategories || []).length}/3)
              </button>
            </>
          ) : (
            <div className="text-center">
              <div className="mb-4"><ProgressIndicator current={Object.keys(categoryVotes || {}).length} total={players.length} /></div>
              {isHost ? <p className="text-gray-600 dark:text-gray-300">You can continue once everyone votes.</p> : <p className="text-gray-600 dark:text-gray-300">Waiting for host…</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Waiting for Host (classic)
  if (gameState === 'waitingForHost') {
    const topCategories = calculateTopCategories(categoryVotes || {});
    const safeTop = topCategories.length ? topCategories : Object.keys(CATEGORIES).slice(0, 4);
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Votes are in!</h2>
            <p className="text-gray-600 dark:text-gray-300">Top categories:</p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {safeTop.map((k) => <CategoryChip key={k} categoryKey={k} />)}
          </div>

          {isHost ? (
            <button
              onClick={async () => {
                try { playSound('click'); } catch {}
                await updateDoc(doc(db, 'sessions', sessionCode), {
                  selectedCategories: safeTop,
                  availableCategories: safeTop,
                  gameState: 'categoryPicking'
                });
                setGameState('categoryPicking');
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg"
            >
              Start Round 1
            </button>
          ) : (
            <p className="text-gray-500 dark:text-gray-300">Waiting for host to start…</p>
          )}
        </div>
      </div>
    );
  }

  // Category picking (classic)
  if (gameState === 'categoryPicking') {
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.name === playerName;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            {isMyTurn ? (
              <>
                <h2 className="text-2xl font-bold mb-2">Your Turn!</h2>
                <p className="text-gray-600 dark:text-gray-300">Choose a category</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-2">{currentPlayer?.name}'s Turn</h2>
                <p className="text-gray-600 dark:text-gray-300">{currentPlayer?.name} is choosing a category…</p>
              </>
            )}
          </div>

          {isMyTurn ? (
            <div className="space-y-3">
              {(availableCategories || []).map((categoryKey) => {
                const category = CATEGORIES[categoryKey];
                const IconComponent = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
                return (
                  <button
                    key={categoryKey}
                    onClick={() => { try { playSound('click'); } catch {}; handleCategoryPicked(categoryKey); }}
                    className="w-full p-4 rounded-xl border-2 text-left transition-all border-gray-200 dark:border-gray-600 hover:border-purple-300"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category?.color || 'from-gray-400 to-gray-500'}`}>
                        <IconComponent className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold">{category?.name || categoryKey}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">{category?.description || ''}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-300">Please wait…</div>
          )}

          {(usedCategories || []).length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Used:</h3>
              <div className="flex flex-wrap gap-2">{usedCategories.map((k) => <span key={k} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">{CATEGORIES[k]?.name || k}</span>)}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Playing (classic)
  if (gameState === 'playing') {
    const currentCategoryData = CATEGORIES[currentCategory] || null;
    const IconComponent =
      currentCategoryData && iconMap[currentCategoryData.icon]
        ? iconMap[currentCategoryData.icon]
        : MessageCircle;
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.name === playerName;
    const canSkip = skipsUsedThisTurn < maxSkipsPerTurn;

    const round = players.length ? Math.floor((turnHistory.length || 0) / players.length) + 1 : 1;
    const turn = players.length ? ((turnHistory.length || 0) % players.length) + 1 : 1;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 mx-auto mb-4">
              <IconComponent className="w-6 h-6 text-white" />
            </div>
            {currentCategoryData && (
              <div className="mb-4">
                <span className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-gradient-to-r ${currentCategoryData.color} text-white text-sm`}>
                  <IconComponent className="w-3 h-3" />
                  <span>{currentCategoryData.name}</span>
                </span>
              </div>
            )}

            <h2 className="text-lg font-semibold mb-2">
              {currentPlayer?.name || 'Player'}'s Question
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">
              Round {round} • Turn {turn} of {players.length || 1}
            </p>

            {/* QUESTION ALWAYS VISIBLE */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400">
              <p className="text-lg leading-relaxed">{currentQuestion}</p>
            </div>
          </div>

          <div className="space-y-4">
            {isMyTurn ? (
              <>
                <button
                  onClick={handleSkipQuestion}
                  disabled={!canSkip}
                  className={`w-full py-3 px-6 rounded-xl font-semibold text-lg transition-all flex items-center justify-center ${
                    canSkip
                      ? 'bg-white dark:bg-gray-900 border-2 border-orange-400 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10'
                      : 'bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <SkipForward className="w-5 h-5 mr-2" />
                  {canSkip ? 'Skip This Question' : 'Skip Used'}
                  <span className="ml-2 text-sm">({skipsUsedThisTurn}/{maxSkipsPerTurn})</span>
                </button>

                <button
                  onClick={handleNextQuestion}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
                >
                  Pass to {players.length ? players[(currentTurnIndex + 1) % players.length]?.name : '—'}
                </button>
              </>
            ) : (
              <div className="text-center text-gray-600 dark:text-gray-300">
                Waiting for {currentPlayer?.name || 'player'} to finish their turn…
              </div>
            )}

            {isHost && (
              <button
                onClick={returnToLobby}
                className="w-full bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 px-6 rounded-xl font-semibold"
              >
                Return to Lobby
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------
     PARTY MODE SCREENS
  -------------------------- */

  // Party setup (host sees Start Round; host also has Return to lobby)
  if (gameState === 'party_setup' && party) {
    const turnOwner = players[party.turnIndex]?.name;
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>  
        <TopBar />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Party Mode</h2>
            <Scoreboard scores={party.scores || {}} inline />
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Round {party.round || 1}</p>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 mb-4">
            <p><span className="font-semibold">Turn:</span> {turnOwner}</p>
          </div>

          {isHost ? (
            <button
              onClick={hostStartPartyRound}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg"
            >
              Start Round
            </button>
          ) : (
            <p className="text-gray-500 dark:text-gray-300 text-center">Waiting for host to start the round…</p>
          )}

          <button
            onClick={() => setShowScores(s => !s)}
            className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
          >
            {showScores ? 'Hide' : 'Show'} Scores
          </button>
          {showScores && <div className="mt-3"><Scoreboard scores={party.scores || {}} /></div>}

          {isHost && (
            <button
              onClick={returnToLobby}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              Return to Lobby
            </button>
          )}
        </div>
      </div>
    );
  }

  // Active party round
  if (gameState === 'party_active' && party) {
    const turnOwner = players[party.turnIndex]?.name;
    const iAmTurnOwner = playerName === turnOwner;

    // Fill
    if (party.state === 'collect_fill') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
          <TopBar />
          <NotificationToast />
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold">Fill in the Blank</h2>
              <Scoreboard scores={party.scores || {}} inline />
            </div>

            <FillCollectView
              party={party}
              players={players}
              playerName={playerName}
              turnOwner={turnOwner}
              isTurnOwner={iAmTurnOwner}
              onSubmitAnswer={submitFillAnswer}
              onMarkDone={markFillDone}
              onPickFavorite={hostPickFavorite}
            />

            <button
              onClick={() => setShowScores(s => !s)}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              {showScores ? 'Hide' : 'Show'} Scores
            </button>
            {showScores && <div className="mt-3"><Scoreboard scores={party.scores || {}} /></div>}

            {isHost && (
              <button
                onClick={returnToLobby}
                className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
              >
                Return to Lobby
              </button>
            )}
          </div>
        </div>
      );
    }

    // Superlatives
    if (party.state === 'vote_super') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
          <TopBar />
          <NotificationToast />
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold">Superlatives</h2>
              <Scoreboard scores={party.scores || {}} inline />
            </div>

            <SuperVoteView
              party={party}
              players={players}
              playerName={playerName}
              onSubmitVote={submitSuperVote}
            />

            <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-3">
              Votes: {Object.keys(party.votes || {}).length} / {players.length}
            </p>

            <button
              onClick={() => setShowScores(s => !s)}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              {showScores ? 'Hide' : 'Show'} Scores
            </button>
            {showScores && <div className="mt-3"><Scoreboard scores={party.scores || {}} /></div>}

            {isHost && (
              <button
                onClick={returnToLobby}
                className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
              >
                Return to Lobby
              </button>
            )}
          </div>
        </div>
      );
    }

    // NHI collect
    if (party.state === 'collect_nhi') {
      const others = players.filter(p => p.name !== turnOwner);
      const allSubmitted = others.length > 0 && others.every(p => party.nhiAnswers?.[p.name] !== undefined);
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
          <TopBar />
          <NotificationToast />
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold">Never Have I Ever</h2>
              <Scoreboard scores={party.scores || {}} inline />
            </div>

            <NhiCollectView
              party={party}
              players={players}
              playerName={playerName}
              turnOwner={turnOwner}
              isTurnOwner={iAmTurnOwner}
              onSubmitMyAnswer={submitNhiAnswer}
            />

            {iAmTurnOwner && allSubmitted && (
              <button
                onClick={startNhiGuessing}
                className="w-full mt-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold"
              >
                Start Guessing
              </button>
            )}

            <button
              onClick={() => setShowScores(s => !s)}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              {showScores ? 'Hide' : 'Show'} Scores
            </button>
            {showScores && <div className="mt-3"><Scoreboard scores={party.scores || {}} /></div>}

            {isHost && (
              <button
                onClick={returnToLobby}
                className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
              >
                Return to Lobby
              </button>
            )}
          </div>
        </div>
      );
    }

    // NHI guessing
    if (party.state === 'guessing_nhi') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
          <TopBar />
          <NotificationToast />
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold">Never Have I Ever — Guess</h2>
              <Scoreboard scores={party.scores || {}} inline />
            </div>

            <NhiGuessView
              party={party}
              players={players}
              playerName={playerName}
              turnOwner={players[party.turnIndex]?.name}
              isTurnOwner={playerName === players[party.turnIndex]?.name}
              onConfirmGuesses={hostSubmitNhiGuesses}
            />

            <button
              onClick={() => setShowScores(s => !s)}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              {showScores ? 'Hide' : 'Show'} Scores
            </button>
            {showScores && <div className="mt-3"><Scoreboard scores={party.scores || {}} /></div>}

            {isHost && (
              <button
                onClick={returnToLobby}
                className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
              >
                Return to Lobby
              </button>
            )}
          </div>
        </div>
      );
    }
  }

  // Reveal + wait for next turn owner to start next round
  if (gameState === 'party_active' && party && party.state === 'reveal') {
    const iAmNextOwner = players[party.nextTurnIndex]?.name === playerName;
    const nextOwnerName = players[party.nextTurnIndex]?.name || '—';
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <TopBar />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Wand2 className="w-6 h-6 text-purple-500" />
            <h2 className="text-2xl font-bold">Round Results</h2>
          </div>

          {/* PROMPT ALWAYS VISIBLE */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 dark:border-purple-400 mb-4 text-left">
            <div className="text-sm text-gray-500 dark:text-gray-300 mb-1">Prompt</div>
            <p className="font-medium">{party.prompt}</p>
          </div>

          {party.winner ? (
            <p className="text-lg mb-2"><strong>{party.winner}</strong> gets the point!</p>
          ) : (
            <p className="text-lg mb-2">Scores updated.</p>
          )}

          <Scoreboard scores={party.scores || {}} />

          <div className="mt-6">
            {iAmNextOwner ? (
              <button
                onClick={nextOwnerStartNextRound}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold"
              >
                Start the next round
              </button>
            ) : (
              <p className="text-gray-600 dark:text-gray-300">It’s {nextOwnerName}’s turn — nothing for you to do yet.</p>
            )}
          </div>

          {isHost && (
            <button
              onClick={returnToLobby}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              Return to Lobby
            </button>
          )}
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}

