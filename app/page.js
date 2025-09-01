// Route segment options for "/"
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0; // must be a number or false

'use client';

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
  ThumbsUp,
  Wand2
} from 'lucide-react';

import { db, pushAlert, listenToAlerts } from '../lib/firebase';
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
   Component
========================================================= */
export default function Overshare() {
  /* =========================================================
     State
  ========================================================= */
  const [gameState, setGameState] = useState('welcome'); // welcome → modeSelect → soloSetup/soloPlay OR createOrJoin → waitingRoom → mpModeSelect → …
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

  // Party mode session blob (lives in Firestore under `party`)
  const [party, setParty] = useState(null); // { state, type, prompt, round, turnIndex, submissions, done, votes, nhiAnswers, guesses, scores, winner, tiebreak }

  // Solo mode
  const [soloCategories, setSoloCategories] = useState([]);
  const [soloAsked, setSoloAsked] = useState([]);

  // UX
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [skipsUsedThisTurn, setSkipsUsedThisTurn] = useState(0);
  const [maxSkipsPerTurn] = useState(1);
  const [notification, setNotification] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showScores, setShowScores] = useState(false);

  /* =========================================================
     Refs
  ========================================================= */
  const unsubscribeRef = useRef(null);
  const alertUnsubRef = useRef(null);
  const prevTurnIndexRef = useRef(0);
  const audioCtxRef = useRef(null);

  /* =========================================================
     Config / Memos
  ========================================================= */
  const iconMap = useMemo(
    () => ({ Sparkles, Heart, Lightbulb, Target, Flame, MessageCircle }),
    []
  );

  // Fallback categories if library not found
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

  // Resolve categories regardless of import style
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

  /* =========================================================
     Helpers: Audio + Notifications
  ========================================================= */
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

  // SAFE synth (never throws on click)
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
        try {
          seq(osc, gain, t0);
        } catch {
          try { osc.stop(t0 + 0.15); } catch {}
        }
      };

      const sounds = {
        click: () =>
          tone((osc, gain, t0) => {
            osc.frequency.setValueAtTime(800, t0);
            osc.frequency.exponentialRampToValueAtTime(600, t0 + 0.10);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.10);
            osc.stop(t0 + 0.11);
          }),
        success: () =>
          tone((osc, gain, t0) => {
            osc.frequency.setValueAtTime(523.25, t0);
            osc.frequency.setValueAtTime(659.25, t0 + 0.10);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
            osc.stop(t0 + 0.24);
          }),
        turn: () =>
          tone((osc, gain, t0) => {
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

  // Alerts (cross-device toasts via Firestore)
  useEffect(() => {
    if (!sessionCode) return;
    if (alertUnsubRef.current) {
      alertUnsubRef.current();
      alertUnsubRef.current = null;
    }
    alertUnsubRef.current = listenToAlerts(sessionCode, (alert) => {
      if (!alert?.message) return;
      showNotification(alert.message, '🔔');
      try { playSound('success'); } catch {}
    });
    return () => {
      if (alertUnsubRef.current) {
        alertUnsubRef.current();
        alertUnsubRef.current = null;
      }
    };
  }, [sessionCode]);

  /* =========================================================
     Helpers: Questions & Party Prompts
  ========================================================= */
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

  /* =========================================================
     Firestore Session helpers
  ========================================================= */
  const createFirebaseSession = async (code, hostPlayer) => {
    try {
      await setDoc(doc(db, 'sessions', code), {
        hostId: hostPlayer.id,
        players: [hostPlayer],
        mode: null, // 'classic' or 'party' later
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
    let previousCount = 0;

    const unsubscribe = onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};

        // new player joined toast
        const newCount = (data.players || []).length;
        if (previousCount > 0 && newCount > previousCount) {
          const newPlayer = (data.players || [])[newCount - 1];
          if (newPlayer && newPlayer.name !== playerName) {
            showNotification(`${newPlayer.name} joined the game!`, '👋');
            try { playSound('success'); } catch {}
          }
        }
        previousCount = newCount;

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

        // reset skip per turn
        const incomingTurn = typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0;
        if (incomingTurn !== prevTurnIndexRef.current) {
          setSkipsUsedThisTurn(0);
          prevTurnIndexRef.current = incomingTurn;
        }

        // state
        const incomingRaw = data.gameState || 'waitingRoom';
        const incoming = incomingRaw === 'waiting' ? 'waitingRoom' : incomingRaw;
        if (incoming !== gameState) {
          setGameState(incoming);
          if (incoming === 'playing') {
            try { playSound('success'); } catch {}
          } else if (incoming === 'categoryPicking' || incoming === 'party_setup') {
            try { playSound('turn'); } catch {}
          }
        }
      },
      (error) => {
        console.error('Firebase listener error:', error);
      }
    );

    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, [playerName, gameState]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (alertUnsubRef.current) {
        alertUnsubRef.current();
        alertUnsubRef.current = null;
      }
      try { if (audioCtxRef.current?.close) audioCtxRef.current.close(); } catch {}
    };
  }, []);

  /* =========================================================
     Create / Join
  ========================================================= */
  const handleCreateSession = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostPlayer = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      name: playerName,
      isHost: true,
      joinedAt: new Date().toISOString()
    };

    console.log('[create] start', { code, myId: hostPlayer.id, name: playerName });

    const ok = await createFirebaseSession(code, hostPlayer);
    console.log('[create] setDoc ok:', ok);
    if (!ok) {
      alert('Failed to create session. Please try again.');
      return;
    }

    setSessionCode(code);
    setIsHost(true);
    setPlayers([hostPlayer]);
    listenToSession(code);

    // Push to waiting room
    setGameState('waitingRoom');
    try { playSound('success'); } catch {}
    showNotification(`Lobby created: ${code}`, '🧩');
  };

  const handleJoinSession = async () => {
    const code = (sessionCode || '').trim().toUpperCase();
    if (!code) return;

    const sessionRef = doc(db, 'sessions', code);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) {
      alert('Session not found. Check the code and try again.');
      return;
    }
    const data = snap.data() || {};

    const alreadyIn = (data.players || []).some((p) => p?.name === playerName);
    if (!alreadyIn) {
      const newPlayer = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        name: playerName,
        isHost: false,
        joinedAt: new Date().toISOString()
      };
      try {
        await updateDoc(sessionRef, { players: arrayUnion(newPlayer) });
      } catch {
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

  /* =========================================================
     Classic Mode (unchanged core)
  ========================================================= */
  const calculateTopCategories = (votes) => {
    const counts = {};
    Object.values(votes || {}).forEach(arr => (arr || []).forEach(cat => {
      counts[cat] = (counts[cat] || 0) + 1;
    }));
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k])=>k).slice(0,4);
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
    const count = players.length || 0;
    if (count === 0) return;
    const nextTurnIndex = (currentTurnIndex + 1) % count;

    let newAvailable = availableCategories;
    let newUsed = usedCategories;
    if ((availableCategories || []).length === 0) {
      newAvailable = [...(selectedCategories || [])];
      newUsed = [];
    }

    await updateDoc(doc(db, 'sessions', sessionCode), {
      gameState: 'categoryPicking',
      currentTurnIndex: nextTurnIndex,
      availableCategories: newAvailable,
      usedCategories: newUsed,
      currentQuestion: '',
      currentCategory: '',
      currentQuestionAsker: ''
    });

    try { playSound('turn'); } catch {}
  };

  /* =========================================================
     Party Mode
  ========================================================= */
  const startPartyMode = async () => {
    if (!sessionCode) return;
    await updateDoc(doc(db, 'sessions', sessionCode), {
      mode: 'party',
      gameState: 'party_setup',
      currentTurnIndex: 0,
      party: {
        state: 'setup', // setup → collect_fill | vote_super | collect_nhi | guessing_nhi → reveal → setup
        type: null,
        prompt: '',
        round: 1,
        turnIndex: 0,
        submissions: {},  // name -> [answers]
        done: {},         // name -> true when finished
        votes: {},        // name -> votedForName (superlatives)
        nhiAnswers: {},   // name -> true/false (has)
        guesses: {},      // name -> 'has'|'hasnt' from turn owner
        scores: {},       // name -> number
        winner: null,
        tiebreak: 0
      }
    });
    setMpMode('party');
  };

  const partyChooseTypeAndPrompt = () => {
    // 1:1:1 ratio via round modulo
    const round = (party?.round || 1);
    const mod = (round - 1) % 3;
    const type = mod === 0 ? 'fill' : mod === 1 ? 'super' : 'nhi';
    let prompt = '';
    if (type === 'fill') prompt = randomOf(FILL_PROMPTS);
    if (type === 'super') prompt = randomOf(SUPERLATIVES);
    if (type === 'nhi') prompt = randomOf(NHI_PROMPTS);
    return { type, prompt };
  };

  const hostStartPartyRound = async () => {
    if (!sessionCode || !party) return;
    const { type, prompt } = partyChooseTypeAndPrompt();
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
      tiebreak: type === 'super' ? (party.tiebreak || 0) : 0
    };
    await updateDoc(doc(db, 'sessions', sessionCode), { party: next, gameState: 'party_active' });
  };

  // Fill-in-the-blank submissions (non-turn players only, up to 2)
  const submitFillAnswer = async (text) => {
    if (!sessionCode || !party) return;
    const me = playerName;
    const turnPlayer = players[party.turnIndex]?.name;
    if (me === turnPlayer) return; // turn owner cannot submit
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

  // Pick favorite (turn owner only, anonymous list)
  const hostPickFavorite = async (answerId) => {
    if (!sessionCode || !party) return;
    const me = playerName;
    const turnOwner = players[party.turnIndex]?.name;
    if (me !== turnOwner) return;

    const all = Object.values(party.submissions || {}).flat();
    const picked = all.find(a => a.id === answerId);
    if (!picked) return;

    const scores = { ...(party.scores || {}) };
    scores[picked.by] = (scores[picked.by] || 0) + 1;

    // Winner goes next
    const winnerIndex = Math.max(0, players.findIndex(p => p.name === picked.by));

    const next = {
      ...party,
      state: 'reveal',
      winner: picked.by,
      scores
    };

    await updateDoc(doc(db, 'sessions', sessionCode), {
      party: next,
      currentTurnIndex: winnerIndex
    });

    // Alert winner on all devices
    await pushAlert(sessionCode, {
      type: 'fillWin',
      message: `${turnOwner} picked your answer — you're up next!`,
      meta: { winner: picked.by }
    });
  };

  const hostAdvanceAfterReveal = async () => {
    if (!sessionCode || !party) return;

    // Keep party.turnIndex in sync with session's currentTurnIndex
    const next = {
      ...party,
      state: 'setup',
      round: (party.round || 1) + 1,
      turnIndex: currentTurnIndex
    };
    await updateDoc(doc(db, 'sessions', sessionCode), {
      party: next,
      gameState: 'party_setup'
    });
  };

  // Superlatives: everyone (including turn owner) votes for a player
  const submitSuperVote = async (voteForName) => {
    if (!sessionCode || !party) return;
    const me = playerName;
    if (!players.some(p => p.name === voteForName)) return;
    const votes = { ...(party.votes || {}), [me]: voteForName };
    await updateDoc(doc(db, 'sessions', sessionCode), { 'party.votes': votes });
  };

  const hostTallySuper = async () => {
    if (!sessionCode || !party) return;

    const votes = { ...(party.votes || {}) };
    if (players.length === 0 || !players.every(p => votes[p.name])) {
      // Not everyone voted yet — optional: allow host to tally anyway
    }

    // tally
    const tally = {};
    Object.values(votes).forEach(name => { tally[name] = (tally[name] || 0) + 1; });
    const sorted = Object.entries(tally).sort((a,b)=>b[1]-a[1]);
    if (sorted.length === 0) return;

    const topCount = sorted[0][1];
    const tied = sorted.filter(([_,c]) => c === topCount).map(([n]) => n);

    if (tied.length > 1) {
      // tiebreaker: pick a new superlative prompt and reset votes
      const next = {
        ...party,
        prompt: randomOf(SUPERLATIVES),
        votes: {},
        tiebreak: (party.tiebreak || 0) + 1,
        state: 'vote_super'
      };
      await updateDoc(doc(db, 'sessions', sessionCode), { party: next });
    } else {
      // winner → gets point AND goes next (to keep tempo consistent)
      const winner = sorted[0][0];
      const winnerIndex = Math.max(0, players.findIndex(p => p.name === winner));
      const scores = { ...(party.scores || {}) };
      scores[winner] = (scores[winner] || 0) + 1;
      const next = { ...party, state: 'reveal', winner, scores };
      await updateDoc(doc(db, 'sessions', sessionCode), {
        party: next,
        currentTurnIndex: winnerIndex
      });
      await pushAlert(sessionCode, {
        type: 'superWin',
        message: `${winner} won the superlative — you're up next!`,
        meta: { winner }
      });
    }
  };

  // Never Have I Ever: non-turn players submit has/hasn't
  const submitNhiAnswer = async (hasDone) => {
    if (!sessionCode || !party) return;
    const me = playerName;
    const turnPlayer = players[party.turnIndex]?.name;
    if (me === turnPlayer) return;
    const ans = { ...(party.nhiAnswers || {}), [me]: !!hasDone };
    await updateDoc(doc(db, 'sessions', sessionCode), { 'party.nhiAnswers': ans });
  };

  // Host guesses has/hasn't for each player
  const hostSubmitNhiGuesses = async (guessesMap) => {
    if (!sessionCode || !party) return;

    const actual = party.nhiAnswers || {};
    const scores = { ...(party.scores || {}) };
    let hostPoints = 0;

    Object.entries(actual).forEach(([name, has]) => {
      const guess = guessesMap[name];
      if (guess === undefined) return;
      const correct = (guess === true && has === true) || (guess === false && has === false);
      if (correct) {
        hostPoints += 1;                       // host (turn owner) gains a point
        scores[name] = (scores[name] || 0) + 1; // correctly guessed player gains a point
      }
    });

    const turnOwner = players[party.turnIndex]?.name;
    scores[turnOwner] = (scores[turnOwner] || 0) + hostPoints;

    // rotate to next player for next round
    const nextIndex = ((party.turnIndex || 0) + 1) % (players.length || 1);

    const next = { ...party, state: 'reveal', winner: null, guesses: guessesMap, scores };
    await updateDoc(doc(db, 'sessions', sessionCode), {
      party: next,
      currentTurnIndex: nextIndex
    });

    await pushAlert(sessionCode, {
      type: 'nhiReveal',
      message: `${turnOwner} locked guesses — scores updated!`,
      meta: { turnOwner, hostPoints }
    });
  };

  /* =========================================================
     UI bits
  ========================================================= */
  const TopBar = () => (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <span
        title={libraryOK ? 'Using external question library' : 'Using built-in fallback questions'}
        className={`hidden sm:inline-flex px-2 py-1 rounded-lg text-xs font-medium ${libraryOK ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`}
      >
        {libraryOK ? 'Library' : 'Fallback'}
      </span>

      <button
        onClick={() => { setAudioEnabled(v=>!v); try { playSound('click'); } catch {} }}
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
  );

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

  const ProgressIndicator = ({ current, total, className = '' }) => (
    <div className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full ${className}`}>
      <div
        className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
        style={{ width: `${total ? Math.min(100, Math.max(0, (current / total) * 100)) : 0}%` }}
      />
    </div>
  );

  const CategoryChip = ({ categoryKey }) => {
    const category = CATEGORIES[categoryKey];
    const IconComponent = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
    return (
      <div
        className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r ${
          category?.color || 'from-gray-400 to-gray-500'
        } text-white text-sm`}
      >
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
              {showCheck && (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const Score
