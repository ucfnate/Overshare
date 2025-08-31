'use client';

/* =========================
   Imports
========================= */
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
  Trophy,
  Edit3
} from 'lucide-react';

import { db, auth, ensureSignedIn } from '../lib/firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

import {
  questionCategories as qcImport,
  getRandomQuestion as getRandomQImport
} from '../lib/questionCategories';

/* =========================
   Small party-prompt seeds
========================= */
const superlativeSeeds = [
  'Most likely to survive a zombie apocalypse',
  'Most likely to text “I’m outside” and still be 20 minutes away',
  'Most likely to become TikTok famous by accident',
  'Most likely to laugh during a serious moment',
  'Most likely to start a side quest at the grocery store'
];
const neverSeeds = [
  'gone to a concert alone',
  're-gifted a present',
  'pretended to be on a call to avoid someone',
  'eaten dessert for breakfast',
  'lied about my age'
];
const fillBlankSeeds = [
  'A TV show would be better if it added ________.',
  'My supervillain origin story starts when ________.',
  'The pettiest hill I’ll die on is ________.',
  'The wrong answer that still kinda works: ________.',
  'The most chaotic dinner guest is ________.'
];

/* =========================
   Helpers: random picks
========================= */
const pickRandom = (arr, exclude = []) => {
  if (!arr?.length) return '';
  const pool = arr.filter((x) => !exclude.includes(x));
  const list = pool.length ? pool : arr;
  return list[Math.floor(Math.random() * list.length)];
};

/* =========================
   Main Component
========================= */
export default function Overshare() {
  /* =========================
     State
  ========================= */
  const [gameState, setGameState] = useState('welcome'); // welcome | survey | createOrJoin | quickstart | waitingRoom | categoryVoting | waitingForHost | relationshipSurvey | waitingForOthers | categoryPicking | playing
  const [playerName, setPlayerName] = useState('');
  const [myUid, setMyUid] = useState(null);

  const [sessionCode, setSessionCode] = useState('');
  const [isHost, setIsHost] = useState(false);

  const [players, setPlayers] = useState([]);
  const [surveyAnswers, setSurveyAnswers] = useState({});
  const [relationshipAnswers, setRelationshipAnswers] = useState({}); // maps otherUid -> relationship string

  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentCategory, setCurrentCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);

  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [usedCategories, setUsedCategories] = useState([]);
  const [turnHistory, setTurnHistory] = useState([]);
  const [currentQuestionAsker, setCurrentQuestionAsker] = useState('');

  const [categoryVotes, setCategoryVotes] = useState({}); // { uid: [cats] }
  const myVotedCategories = categoryVotes?.[myUid] || [];
  const hasVotedCategories = !!(myVotedCategories?.length);

  const [round, setRound] = useState(null); // for party modes & classic write-ins

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [skipsUsedThisTurn, setSkipsUsedThisTurn] = useState(0);
  const [maxSkipsPerTurn] = useState(1);
  const [notification, setNotification] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const [questionDraft, setQuestionDraft] = useState('');
  const [myAnswerDraft, setMyAnswerDraft] = useState('');

  /* =========================
     Refs
  ========================= */
  const unsubscribeRef = useRef(null);
  const prevTurnIndexRef = useRef(0);
  const audioCtxRef = useRef(null);

  /* =========================
     Config / Memos
  ========================= */
  const iconMap = useMemo(
    () => ({ Sparkles, Heart, Lightbulb, Target, Flame, MessageCircle }),
    []
  );

  // Fallback categories (only if import missing)
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

  // Resolve categories regardless of export style
  const CATEGORIES = useMemo(() => {
    const raw =
      qcImport && typeof qcImport === 'object'
        ? (qcImport.default && typeof qcImport.default === 'object'
            ? qcImport.default
            : qcImport)
        : {};
    const keys = Object.keys(raw || {});
    return keys.length > 0 ? raw : FALLBACK_CATEGORIES;
  }, [FALLBACK_CATEGORIES]);

  const libraryOK = useMemo(() => {
    const usingFallback = CATEGORIES === FALLBACK_CATEGORIES;
    return typeof getRandomQImport === 'function' && !usingFallback;
  }, [CATEGORIES, FALLBACK_CATEGORIES]);

  const getQuestion = useCallback((categoryKey, exclude = []) => {
    if (typeof getRandomQImport === 'function') {
      try {
        let tries = 6;
        while (tries-- > 0) {
          const q = getRandomQImport(categoryKey, exclude);
          if (q && !exclude.includes(q)) return q;
        }
      } catch {}
    }
    const fallback = CATEGORIES[categoryKey]?.questions || CATEGORIES.icebreakers.questions;
    return pickRandom(fallback, exclude);
  }, [CATEGORIES]);

  /* =========================
     Initial effects: auth + name
  ========================= */
  useEffect(() => {
    // hydrate saved name
    try {
      const saved = localStorage.getItem('overshare:name');
      if (saved) setPlayerName(saved);
    } catch {}

    // ensure anon auth
    const ensureAuth = async () => {
      let u = null;
      try {
        if (typeof ensureSignedIn === 'function') {
          u = await ensureSignedIn();
        }
      } catch {}
      if (!u?.uid) {
        try {
          const cred = await signInAnonymously(auth);
          u = cred?.user || null;
        } catch {
          // wait for any auth state to appear
          u = await new Promise((resolve) => {
            const to = setTimeout(() => { unsub(); resolve(auth.currentUser || null); }, 4000);
            const unsub = onAuthStateChanged(auth, (usr) => { clearTimeout(to); unsub(); resolve(usr || null); });
          });
        }
      }
      setMyUid(u?.uid || null);
    };
    ensureAuth();
  }, []);

  // derive host flag from players + myUid
  useEffect(() => {
    if (!myUid) return;
    const me = (players || []).find(p => p?.id === myUid);
    setIsHost(!!me?.isHost);
  }, [players, myUid]);

  /* =========================
     Audio (no eval, CSP-safe)
  ========================= */
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
    const audio = getAudio();
    if (!audio) return;
    const tone = (seq) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.connect(gain);
      gain.connect(audio.destination);
      gain.gain.setValueAtTime(0.1, audio.currentTime);
      seq(osc, gain, audio.currentTime);
      osc.start();
    };
    const sounds = {
      click: () =>
        tone((osc, gain, t0) => {
          osc.frequency.setValueAtTime(800, t0);
          osc.frequency.exponentialRampToValueAtTime(600, t0 + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.1);
          osc.stop(t0 + 0.1);
        }),
      success: () =>
        tone((osc, gain, t0) => {
          osc.frequency.setValueAtTime(523, t0);
          osc.frequency.setValueAtTime(659, t0 + 0.1);
          osc.frequency.setValueAtTime(784, t0 + 0.2);
          gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.3);
          osc.stop(t0 + 0.3);
        }),
      turnTransition: () =>
        tone((osc, gain, t0) => {
          osc.frequency.setValueAtTime(440, t0);
          osc.frequency.setValueAtTime(554, t0 + 0.15);
          gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.3);
          osc.stop(t0 + 0.3);
        })
    };
    if (sounds[type]) sounds[type]();
  };

  /* =========================
     Notifications
  ========================= */
  const showNotification = (message, emoji = '🎉') => {
    setNotification({ message, emoji });
    window.clearTimeout((showNotification._t || 0));
    showNotification._t = window.setTimeout(() => setNotification(null), 2600);
  };

  /* =========================
     Algorithms (recommendation)
  ========================= */
  const relationshipOptions = [
    'Romantic partner/spouse',
    'Close friend (know each other well)',
    'Friend (hang out regularly)',
    'Family member',
    'Coworker/colleague',
    "Acquaintance (don't know well)",
    'Just met/new friend'
  ];

  const calculateGroupIntimacy = (relationshipsByPlayer) => {
    if (!relationshipsByPlayer || Object.keys(relationshipsByPlayer).length === 0) return 2;
    const map = {
      'Romantic partner/spouse': 5,
      'Close friend (know each other well)': 4,
      'Friend (hang out regularly)': 3,
      'Family member': 4,
      'Coworker/colleague': 2,
      "Acquaintance (don't know well)": 1,
      'Just met/new friend': 1
    };
    const all = Object.values(relationshipsByPlayer).flatMap(obj => Object.values(obj || {}));
    if (!all.length) return 2;
    const scores = all.map(rel => map[rel] || 2);
    return scores.reduce((a,b)=>a+b,0)/scores.length;
  };

  const getGroupComfortLevel = (list) => {
    if (!list || list.length === 0) return 2;
    const map = {
      'Light, fun topics that make everyone laugh': 2,
      'Mix of light and meaningful discussions': 3,
      'Deep, personal conversations': 4,
      'Thought-provoking questions about life': 4
    };
    const scores =
      list
        .filter(p => p?.surveyAnswers?.comfort_level)
        .map(p => map[p.surveyAnswers.comfort_level] || 2);
    if (!scores.length) return 2;
    return scores.reduce((a,b)=>a+b,0)/scores.length;
  };

  const recommendCategories = (list, relationshipsByPlayer) => {
    const intimacy = calculateGroupIntimacy(relationshipsByPlayer);
    const comfort = getGroupComfortLevel(list);
    const groupSize = list?.length || 0;
    const rec = [];
    if (groupSize > 3 || intimacy < 3) rec.push('icebreakers');
    if (groupSize > 2) rec.push('creative');
    if (intimacy >= 3 && comfort >= 3) rec.push('deep_dive');
    if (intimacy >= 4 || (groupSize === 2 && intimacy >= 3)) rec.push('growth');
    if (intimacy >= 4 && comfort >= 4 && groupSize <= 4) rec.push('spicy');
    return rec.length ? rec : Object.keys(CATEGORIES);
  };

  const generatePersonalizedQuestion = (list, forceCategory = null) => {
    let category = forceCategory;
    if (!category) {
      const rec = recommendCategories(list, buildRelationshipsMap(list));
      category = pickRandom(rec);
    }
    const q = getQuestion(category, [currentQuestion, round?.prompt].filter(Boolean));
    setCurrentCategory(category);
    return q;
  };

  /* =========================
     Firestore Session Helpers
  ========================= */
  const listenToSession = useCallback((code) => {
    if (!code) return () => {};
    if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }

    const sessionRef = doc(db, 'sessions', code);
    let prevCount = 0;

    const unsub = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};

      const newCount = (data.players || []).length;
      if (prevCount > 0 && newCount > prevCount) {
        const newPlayer = (data.players || [])[newCount - 1];
        if (newPlayer && newPlayer.id !== myUid) {
          showNotification(`${newPlayer.name} joined the game!`, '👋');
          try { playSound('success'); } catch {}
        }
      }
      prevCount = newCount;

      setPlayers([...(data.players || [])]);
      setCurrentQuestion(data.currentQuestion || '');
      setCurrentCategory(data.currentCategory || '');
      setCurrentQuestionAsker(data.currentQuestionAsker || '');
      setSelectedCategories([...(data.selectedCategories || [])]);
      setCurrentTurnIndex(typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0);
      setAvailableCategories([...(data.availableCategories || [])]);
      setUsedCategories([...(data.usedCategories || [])]);
      setTurnHistory([...(data.turnHistory || [])]);
      setCategoryVotes(data.categoryVotes || {});
      setRound(data.round || null);

      const incomingRaw = data.gameState || 'waitingRoom';
      const incoming = incomingRaw === 'waiting' ? 'waitingRoom' : incomingRaw;

      const incomingTurn = typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0;
      if (incomingTurn !== prevTurnIndexRef.current) {
        setSkipsUsedThisTurn(0);
        prevTurnIndexRef.current = incomingTurn;
      }

      if (incoming !== gameState) {
        setGameState(incoming);
        if (incoming === 'playing') { try { playSound('success'); } catch {} }
        else if (incoming === 'categoryPicking') { try { playSound('turnTransition'); } catch {} }
      }
    }, (e) => console.error('onSnapshot error', e));

    unsubscribeRef.current = unsub;
    return unsub;
  }, [db, myUid, gameState]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
      try { if (audioCtxRef.current?.close) audioCtxRef.current.close(); } catch {}
    };
  }, []);

  const createFirebaseSession = async (code, hostPlayer) => {
    try {
      await setDoc(doc(db, 'sessions', code), {
        hostId: hostPlayer.id,
        players: [hostPlayer],
        currentQuestion: '',
        currentCategory: '',
        currentQuestionAsker: '',
        gameState: 'waitingRoom',
        selectedCategories: [],
        currentTurnIndex: 0,
        availableCategories: [],
        usedCategories: [],
        turnHistory: [],
        categoryVotes: {},
        scores: {},
        mode: 'classic',
        round: null,
        createdAt: serverTimestamp()
      });
      return true;
    } catch (err) {
      console.error('Error creating session:', err);
      alert(`Create failed: ${err?.code || 'unknown'} — ${err?.message || ''}`);
      return false;
    }
  };

  const buildRelationshipsMap = (list) => {
    // { playerUid: relationshipAnswersObject or {} }
    const out = {};
    (list || []).forEach(p => { out[p.id] = p.relationshipAnswers || {}; });
    return out;
  };

  /* =========================
     Handlers: Survey & Session
  ========================= */
  const initialSurveyQuestions = [
    {
      id: 'personality',
      question: 'How would you describe yourself in social settings?',
      options: [
        'Outgoing & Love being center of attention',
        'Friendly but prefer smaller groups',
        'Thoughtful listener who observes first',
        'Quiet but warm up over time'
      ]
    },
    {
      id: 'comfort_level',
      question: 'In conversations, you prefer:',
      options: [
        'Light, fun topics that make everyone laugh',
        'Mix of light and meaningful discussions',
        'Deep, personal conversations',
        'Thought-provoking questions about life'
      ]
    },
    {
      id: 'sharing_style',
      question: 'When sharing personal things, you:',
      options: [
        'Share openly and easily',
        'Share when others share first',
        'Prefer to listen more than share',
        'Share deeply with close people only'
      ]
    },
    {
      id: 'group_energy',
      question: 'You contribute best to group conversations when:',
      options: [
        'Everyone is laughing and having fun',
        "There's a good mix of personalities",
        'People are being real and authentic',
        'The conversation has depth and meaning'
      ]
    }
  ];

  const handleSurveySubmit = () => {
    if (Object.keys(surveyAnswers).length === initialSurveyQuestions.length) {
      try { playSound('success'); } catch {}
      setGameState('createOrJoin');
    }
  };

  const ensureAuthed = async () => {
    let u = auth?.currentUser || null;
    try {
      if (!u && typeof ensureSignedIn === 'function') u = await ensureSignedIn();
    } catch {}
    if (!u?.uid) {
      try {
        const cred = await signInAnonymously(auth);
        u = cred?.user || null;
      } catch {}
    }
    return u;
  };

  const handleCreateSession = async () => {
    if (!playerName.trim()) { alert('Enter your name'); return; }
    try { localStorage.setItem('overshare:name', playerName.trim()); } catch {}

    const user = await ensureAuthed();
    const uid = user?.uid || `guest_${Date.now()}`;

    // NEW: lock in UID ASAP
    setMyUid(uid);

    // requested debug line
    console.log('[create] uid:', uid);

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostPlayer = {
      id: uid,
      name: playerName.trim(),
      isHost: true,
      surveyAnswers,
      relationshipAnswers: {},
      joinedAt: new Date().toISOString()
    };

    const ok = await createFirebaseSession(code, hostPlayer);
    if (!ok) return;

    setSessionCode(code);
    setPlayers([hostPlayer]);
    setIsHost(true);
    setGameState('waitingRoom');
    try { playSound('success'); } catch {}
    listenToSession(code);
  };

  const handleJoinSession = async () => {
    if (!playerName.trim()) { alert('Enter your name'); return; }
    try { localStorage.setItem('overshare:name', playerName.trim()); } catch {}

    const code = (sessionCode || '').trim().toUpperCase();
    if (!code) return;

    const user = await ensureAuthed();
    const uid = user?.uid || `guest_${Date.now()}`;

    // NEW: lock in UID ASAP
    setMyUid(uid);

    const sessionRef = doc(db, 'sessions', code);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) { alert('Session not found.'); return; }
    const data = snap.data() || {};

    const alreadyIn = (data.players || []).some(p => p?.id === uid);
    if (!alreadyIn) {
      const newPlayer = {
        id: uid,
        name: playerName.trim(),
        isHost: false,
        surveyAnswers,
        relationshipAnswers: {},
        joinedAt: new Date().toISOString()
      };
      try {
        await updateDoc(sessionRef, { players: arrayUnion(newPlayer) });
      } catch {
        // fallback merge (object equality vs arrayUnion)
        const fresh = (await getDoc(sessionRef)).data() || {};
        const next = [...(fresh.players || []), newPlayer]
          .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
        await updateDoc(sessionRef, { players: next });
      }
    }

    setSessionCode(code);
    setGameState('waitingRoom');
    listenToSession(code);
    try { playSound('success'); } catch {}
  };

  /* =========================
     Handlers: Voting & Relationship
  ========================= */
  const handleCategoryVote = async (selectedCats) => {
    if (!sessionCode || !myUid) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    await updateDoc(sessionRef, { [`categoryVotes.${myUid}`]: selectedCats });
    try { playSound('success'); } catch {}
  };

  const handleRelationshipSurveySubmit = async () => {
    if (!sessionCode || !myUid) return;
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const snap = await getDoc(sessionRef);
      if (!snap.exists()) return;
      const data = snap.data() || {};
      const updatedPlayers = (data.players || []).map((p) =>
        p?.id === myUid ? { ...p, relationshipAnswers } : p
      );
      await updateDoc(sessionRef, { players: updatedPlayers });

      const allCompleted = updatedPlayers.every((p) => p?.relationshipAnswers && Object.keys(p.relationshipAnswers).length >= (updatedPlayers.length - 1));
      if (allCompleted) {
        const top =
          (data.selectedCategories && data.selectedCategories.length > 0)
            ? data.selectedCategories
            : Object.keys(CATEGORIES);
        await updateDoc(sessionRef, {
          gameState: 'categoryPicking',
          currentTurnIndex: 0,
          availableCategories: top,
          usedCategories: [],
          turnHistory: []
        });
        setGameState('categoryPicking');
        try { playSound('success'); } catch {}
      } else {
        setGameState('waitingForOthers');
      }
    } catch (err) {
      console.error('Error updating player data:', err);
    }
  };

  /* =========================
     Handlers: Picking / Playing Flow
  ========================= */
  const handleCategoryPicked = async (category) => {
    if (!sessionCode) return;
    try {
      const currentPlayer = players[currentTurnIndex] || players[0];
      if (!currentPlayer) return;

      const question = generatePersonalizedQuestion(players, category);

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
        currentQuestionAsker: currentPlayer.name,
        round: { mode: 'classic', phase: 'ask', prompt: question, answers: {} }
      });

      setCurrentQuestion(question);
      setCurrentCategory(category);
      setCurrentQuestionAsker(currentPlayer.name);
      setUsedCategories(newUsed);
      setAvailableCategories(newAvail);
      setTurnHistory(newHistory);
      setRound({ mode: 'classic', phase: 'ask', prompt: question, answers: {} });
      setGameState('playing');
      try { playSound('success'); } catch {}
    } catch (err) {
      console.error('Error in handleCategoryPicked:', err);
    }
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

    const newQuestion = getQuestion(forcedCategory, [currentQuestion, round?.prompt].filter(Boolean));
    try {
      await updateDoc(doc(db, 'sessions', sessionCode), {
        currentQuestion: newQuestion,
        currentCategory: forcedCategory,
        round: { mode: 'classic', phase: 'ask', prompt: newQuestion, answers: {} }
      });
      setCurrentQuestion(newQuestion);
      setCurrentCategory(forcedCategory);
      setRound({ mode: 'classic', phase: 'ask', prompt: newQuestion, answers: {} });
      setSkipsUsedThisTurn((n) => n + 1);
      try { playSound('click'); } catch {}
    } catch (err) {
      console.error('Error skipping question:', err);
    }
  };

  const handleNextQuestion = async () => {
    if (!sessionCode) return;
    try {
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
        currentQuestionAsker: '',
        round: null
      });

      setCurrentTurnIndex(nextTurnIndex);
      setAvailableCategories(newAvailable);
      setUsedCategories(newUsed);
      setCurrentQuestion('');
      setCurrentCategory('');
      setCurrentQuestionAsker('');
      setRound(null);
      setGameState('categoryPicking');
      setSkipsUsedThisTurn(0);
      try { playSound('turnTransition'); } catch {}
    } catch (err) {
      console.error('Error in handleNextQuestion:', err);
    }
  };

  /* =========================
     Party Modes: switch/init
  ========================= */
  const hostInitMode = async (newMode) => {
    if (!isHost || !sessionCode) return;
    let prompt = '';
    if (newMode === 'superlatives') prompt = pickRandom(superlativeSeeds, [round?.prompt]);
    if (newMode === 'never') prompt = `Never have I ever ${pickRandom(neverSeeds, [round?.prompt?.replace(/^Never have I ever\s*/i,'')])}`;
    if (newMode === 'fill_blank') prompt = pickRandom(fillBlankSeeds, [round?.prompt]);

    const base = {
      mode: newMode,
      prompt,
      phase: newMode === 'superlatives' ? 'prompt' : (newMode === 'fill_blank' ? 'collect_submissions' : 'collect'),
      submissions: {},
      votes: {},
      responses: {},
      answers: {}
    };
    await updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'playing', round: base, mode: newMode });
    setRound(base);
    setGameState('playing');
  };

  const hostUpdateScores = async (patch) => {
    if (!isHost || !sessionCode) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const snap = await getDoc(sessionRef);
    const data = snap.data() || {};
    const scores = { ...(data.scores || {}) };
    Object.entries(patch || {}).forEach(([name, inc]) => {
      scores[name] = (scores[name] || 0) + inc;
    });
    await updateDoc(sessionRef, { scores });
  };

  /* =========================
     UI: Top Bar / Modals / Partials
  ========================= */
  const TopBar = () => (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <span
        title={libraryOK ? 'Using external question library' : 'Using built-in fallback questions'}
        className={`hidden sm:inline-flex px-2 py-1 rounded-lg text-xs font-medium ${libraryOK ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`}
      >
        {libraryOK ? 'Library' : 'Fallback'}
      </span>

      <button
        onClick={() => { setAudioEnabled((v) => !v); try { playSound('click'); } catch {} }}
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
            <p>Pick Classic for multiplayer or Quickstart for single-device play.</p>
            <p>Classic flow: survey → create/join → lobby → category voting → relationships → category pick → play.</p>
            <p>Party modes: Superlatives (vote), Never Have I Ever (responses), Fill-in-the-Blank (submit → vote).</p>
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

  const CategoryCard = ({ categoryKey, category, isSelected, isRecommended, onClick, disabled = false }) => {
    const IconComponent =
      category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
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

  const PlayerList = ({ players: list, title, showProgress = false, currentPlayerUid = null }) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
        {title} ({(list || []).length})
      </h3>
      <div className="space-y-2">
        {(list || []).map((player) => (
          <div
            key={player?.id}
            className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl ${currentPlayerUid === player?.id ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/30' : ''}`}
          >
            <span className="font-medium">{player?.name || 'Player'}</span>
            <div className="flex items-center space-x-2">
              {player?.isHost && (
                <span className="text-xs bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-200 px-2 py-1 rounded-full">
                  Host
                </span>
              )}
              {showProgress && player?.relationshipAnswers && (
                <span className="text-xs bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-200 px-2 py-1 rounded-full">
                  ✓
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const LoadingSpinner = ({ size = 'w-8 h-8' }) => (
    <div className="inline-flex items-center justify-center">
      <div className={`${size} border-4 border-purple-500 border-t-transparent rounded-full animate-spin`} />
    </div>
  );

  const ModeSwitcher = ({ mode }) => {
    if (!isHost || !sessionCode) return null;
    const Btn = ({k,label}) => (
      <button onClick={()=>hostInitMode(k)}
        className={`text-xs px-3 py-1 rounded-lg border ${mode===k?'bg-purple-600 text-white border-purple-600':'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}>
        {label}
      </button>
    );
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex gap-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-600 dark:text-gray-300 mr-1">Mode:</span>
        <Btn k="classic" label="Classic" />
        <Btn k="superlatives" label="Superlatives" />
        <Btn k="never" label="Never" />
        <Btn k="fill_blank" label="Fill-Blank" />
      </div>
    );
  };

  /* =========================
     Screens: Welcome
  ========================= */
  if (gameState === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
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
            onClick={() => {
              const v = playerName.trim();
              if (!v) return;
              try { localStorage.setItem('overshare:name', v); } catch {}
              setGameState('survey');
              try { playSound('click'); } catch {}
            }}
            disabled={!playerName.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Let's Get Started
          </button>

          <div className="mt-6 text-center">
            <div className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">
              How do you want to play today?
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const v = playerName.trim();
                  if (!v) return;
                  try { localStorage.setItem('overshare:name', v); } catch {}
                  setGameState('quickstart');
                }}
                className="bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              >
                Quickstart
              </button>
              <button
                onClick={() => {
                  const v = playerName.trim();
                  if (!v) return;
                  try { localStorage.setItem('overshare:name', v); } catch {}
                  setGameState('survey');
                }}
                className="bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              >
                Classic
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Survey (one-by-one)
  ========================= */
  if (gameState === 'survey') {
    const currentQuestionIndex = Object.keys(surveyAnswers).length;
    const currentSurveyQuestion = initialSurveyQuestions[currentQuestionIndex];

    if (currentQuestionIndex >= initialSurveyQuestions.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <TopBar />
          <HelpModal />
          <NotificationToast />
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="mb-6">
              <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Perfect, {playerName}!</h2>
              <p className="text-gray-600 dark:text-gray-300">We’ll use this to tailor the vibe.</p>
            </div>
            <button
              onClick={() => { try { playSound('success'); } catch {} handleSurveySubmit(); }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-300">
                Question {currentQuestionIndex + 1} of {initialSurveyQuestions.length}
              </span>
              <ProgressIndicator current={currentQuestionIndex + 1} total={initialSurveyQuestions.length} className="w-16" />
            </div>
            <h2 className="text-xl font-semibold mb-6">{currentSurveyQuestion.question}</h2>
          </div>

          <div className="space-y-3">
            {currentSurveyQuestion.options.map((option, index) => (
              <button
                key={`${currentSurveyQuestion.id}-${index}`}
                onClick={() => {
                  try { playSound('click'); } catch {}
                  setSurveyAnswers((prev) => ({ ...prev, [currentSurveyQuestion.id]: option }));
                }}
                className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Create or Join
  ========================= */
  if (gameState === 'createOrJoin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold mb-6">Ready to play, {playerName}!</h2>

          <div className="space-y-4">
            <button
              onClick={() => { try { playSound('click'); } catch {} handleCreateSession(); }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center"
            >
              <Users className="w-5 h-5 mr-2" />
              Create New Game
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
                onClick={() => { try { playSound('click'); } catch {} handleJoinSession(); }}
                disabled={!sessionCode.trim()}
                className="w-full bg-white dark:bg-gray-900 border-2 border-purple-500 text-purple-600 dark:text-purple-300 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Quickstart (single device)
  ========================= */
  if (gameState === 'quickstart') {
    return (
      <QuickstartSolo
        CATEGORIES={CATEGORIES}
        getQuestion={getQuestion}
        onBack={() => setGameState('welcome')}
      />
    );
  }

  /* =========================
     Screens: Waiting Room
  ========================= */
  if (gameState === 'waitingRoom') {
    // NEW: treat host or name matches as "already in"
    const alreadyIn =
      isHost ||
      players.some(p => p?.id === myUid) ||
      (playerName && players.some(p => (p?.name || '').toLowerCase() === playerName.trim().toLowerCase()));

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Session {sessionCode}</h2>
            <p className="text-gray-600 dark:text-gray-300">Share this code with others to join</p>
          </div>

          <PlayerList players={players} title="Players" currentPlayerUid={myUid} />

          {selectedCategories.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Question Categories</h3>
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map((categoryKey) => {
                  const category = CATEGORIES[categoryKey];
                  const IconComponent =
                    category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
                  return (
                    <div
                      key={categoryKey}
                      className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r ${category?.color || 'from-gray-400 to-gray-500'} text-white text-sm`}
                    >
                      <IconComponent className="w-4 h-4" />
                      <span>{category?.name || categoryKey}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!alreadyIn && (
            <button
              onClick={async () => {
                try { playSound('click'); } catch {}
                const user = await ensureAuthed();
                const uid = user?.uid || `guest_${Date.now()}`;
                const newPlayer = {
                  id: uid,
                  name: playerName.trim(),
                  isHost: false,
                  surveyAnswers,
                  relationshipAnswers: {},
                  joinedAt: new Date().toISOString()
                };
                const sessionRef = doc(db, 'sessions', sessionCode);
                const snap = await getDoc(sessionRef);
                if (snap.exists()) {
                  try {
                    await updateDoc(sessionRef, { players: arrayUnion(newPlayer) });
                  } catch {
                    const data = snap.data() || {};
                    const updatedPlayers = [...(data.players || []), newPlayer]
                      .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
                    await updateDoc(sessionRef, { players: updatedPlayers });
                    setPlayers(updatedPlayers);
                  }
                  try { playSound('success'); } catch {}
                }
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all mb-4"
            >
              Join Game
            </button>
          )}

          {isHost && alreadyIn && (
            <button
              onClick={async () => {
                if (!sessionCode) return;
                try { playSound('click'); } catch {}
                await updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'categoryVoting' });
                setGameState('categoryVoting');
              }}
              // NEW: allow solo start during dev
              disabled={players.length < 1}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Game
            </button>
          )}

          {!isHost && alreadyIn && (
            <p className="text-gray-500 dark:text-gray-300">Waiting for host to continue...</p>
          )}
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Category Voting
  ========================= */
  if (gameState === 'categoryVoting') {
    const recommended = recommendCategories(players, buildRelationshipsMap(players));
    const allVotes = Object.values(categoryVotes || {});
    const totalVotes = allVotes.length;
    const waitingFor = (players || [])
      .filter((p) => !(categoryVotes || {})[p?.id])
      .map((p) => p?.name);
    const allPlayersVoted = (players || []).every(
      (p) => (categoryVotes || {})[p?.id] && (categoryVotes || {})[p?.id].length > 0
    );

    const entries = Object.entries(CATEGORIES || {});
    const isSelected = (k) => selectedCategories.includes(k);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
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
                : "Select 2-3 categories you'd like to play with"}
            </p>
            {hasVotedCategories && (
              <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">Session Code: {sessionCode}</p>
            )}
          </div>

          {!hasVotedCategories ? (
            <>
              <div className="space-y-3 mb-6">
                {entries.map(([key, category]) => {
                  const rec = (recommended || []).includes(key);
                  const chosen = isSelected(key);
                  const disabled = !chosen && selectedCategories.length >= 3;
                  return (
                    <CategoryCard
                      key={key}
                      categoryKey={key}
                      category={category}
                      isSelected={chosen}
                      isRecommended={rec}
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
                disabled={selectedCategories.length === 0}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit My Votes ({selectedCategories.length}/3)
              </button>
            </>
          ) : (
            <div className="text-center">
              {allPlayersVoted && isHost ? (
                <div className="space-y-3">
                  <p className="text-center text-gray-600 dark:text-gray-300 mb-4">All players have voted!</p>
                  <button
                    onClick={async () => {
                      if (!sessionCode) return;
                      try { playSound('click'); } catch {}

                      // compute top categories
                      const counts = {};
                      Object.values(categoryVotes || {}).forEach((arr) => (arr || []).forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
                      const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
                      const safeTop = top.length ? top.slice(0, 6) : Object.keys(CATEGORIES);

                      await updateDoc(doc(db, 'sessions', sessionCode), {
                        gameState: 'waitingForHost',
                        selectedCategories: safeTop,
                        availableCategories: safeTop
                      });
                      setGameState('waitingForHost');
                    }}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
                  >
                    View Results & Start Game
                  </button>
                </div>
              ) : (
                <>
                  <LoadingSpinner size="w-16 h-16" />
                  <p className="text-gray-600 dark:text-gray-300 mb-2 mt-4">Waiting for:</p>
                  <p className="text-sm text-gray-500 dark:text-gray-300">{waitingFor.join(', ') || '—'}</p>
                  {isHost && (
                    <button
                      onClick={async () => {
                        if (!sessionCode) return;
                        try { playSound('click'); } catch {}
                        await updateDoc(doc(db, 'sessions', sessionCode), {
                          gameState: 'waitingForHost'
                        });
                        setGameState('waitingForHost');
                      }}
                      className="mt-4 text-sm text-purple-700 dark:text-purple-300 hover:underline"
                    >
                      Continue without waiting
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Waiting For Host (results)
  ========================= */
  if (gameState === 'waitingForHost') {
    const voteResults = {};
    Object.values(categoryVotes || {}).forEach((votes) => { (votes || []).forEach((cat) => { voteResults[cat] = (voteResults[cat] || 0) + 1; }); });

    const sorted = Object.entries(voteResults).sort((a,b)=>b[1]-a[1]);
    const topCategories = sorted.map(([k])=>k);
    const recommendedFallback = recommendCategories(players, buildRelationshipsMap(players));
    const safeTop = topCategories.length ? topCategories : recommendedFallback;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">All Votes Are In!</h2>
            <p className="text-gray-600 dark:text-gray-300">Top categories based on everyone’s votes:</p>
          </div>

          <div className="mb-6 space-y-2">
            {sorted.map(([categoryKey, count]) => {
              const category = CATEGORIES[categoryKey];
              const IconComponent = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
              const isTop = (safeTop || []).includes(categoryKey);
              return (
                <div key={categoryKey}
                  className={`flex items-center justify-between p-3 rounded-xl border ${isTop ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-500/50' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}`}>
                  <div className="flex items-center space-x-3">
                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category?.color || 'from-gray-400 to-gray-500'}`}>
                      <IconComponent className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-medium">{category?.name || categoryKey}</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{count} votes</span>
                </div>
              );
            })}
          </div>

          {isHost ? (
            <button
              onClick={async () => {
                if (!sessionCode) return;
                try { playSound('click'); } catch {}
                await updateDoc(doc(db, 'sessions', sessionCode), {
                  gameState: 'relationshipSurvey',
                  selectedCategories: safeTop.slice(0, 6),
                  availableCategories: safeTop.slice(0, 6)
                });
                setGameState('relationshipSurvey');
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
            >
              Let’s See How You Know Each Other
            </button>
          ) : (
            <p className="text-gray-500 dark:text-gray-300">Waiting for host to continue…</p>
          )}
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Relationship Survey
  ========================= */
  if (gameState === 'relationshipSurvey') {
    const others = (players || []).filter((p) => p?.id !== myUid);
    const currentIdx = Object.keys(relationshipAnswers || {}).length;
    const currentPlayer = others[currentIdx];

    if (currentIdx >= others.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <TopBar />
          <HelpModal />
          <NotificationToast />
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="mb-6">
              <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Great!</h2>
              <p className="text-gray-600 dark:text-gray-300">Now let’s choose what types of questions you want to explore.</p>
            </div>
            <button
              onClick={() => { try { playSound('success'); } catch {} handleRelationshipSurveySubmit(); }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-300">
                Player {currentIdx + 1} of {others.length}
              </span>
              <ProgressIndicator current={currentIdx + 1} total={others.length} className="w-16" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              How are you connected to {currentPlayer?.name}?
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">This helps us create better questions for your group.</p>
          </div>

          <div className="space-y-3">
            {relationshipOptions.map((option, index) => (
              <button
                key={`rel-${index}`}
                onClick={() => {
                  try { playSound('click'); } catch {}
                  if (!currentPlayer?.id) return;
                  setRelationshipAnswers((prev) => ({ ...prev, [currentPlayer.id]: option }));
                }}
                className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Waiting For Others
  ========================= */
  if (gameState === 'waitingForOthers') {
    const playersWithRelationships = (players || []).filter((p) => p?.relationshipAnswers);
    const waitingFor = (players || [])
      .filter((p) => !p?.relationshipAnswers)
      .map((p) => p?.name);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Thanks!</h2>
            <p className="text-gray-600 dark:text-gray-300">Waiting for others to complete their surveys…</p>
          </div>

          <div className="mb-4">
            <p className="text-lg">
              {playersWithRelationships.length} of {players.length} completed
            </p>
          </div>

          {waitingFor.length > 0 && (
            <div className="text-center">
              <LoadingSpinner size="w-16 h-16" />
              <p className="text-gray-600 dark:text-gray-300 mb-2 mt-4">Still waiting for:</p>
              <p className="text-sm text-gray-500 dark:text-gray-300">{waitingFor.join(', ')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Category Picking
  ========================= */
  if (gameState === 'categoryPicking') {
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.id === myUid;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            {isMyTurn ? (
              <>
                <h2 className="text-2xl font-bold mb-2">Your Turn!</h2>
                <p className="text-gray-600 dark:text-gray-300">Choose a category for the next question</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-2">{currentPlayer?.name}’s Turn</h2>
                <p className="text-gray-600 dark:text-gray-300">{currentPlayer?.name} is choosing a category…</p>
              </>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">
              Round {players.length ? Math.floor((turnHistory.length || 0) / players.length) + 1 : 1}
            </p>
          </div>

          {isMyTurn ? (
            <div className="space-y-3">
              {(availableCategories || []).length > 0 ? (
                (availableCategories || []).map((categoryKey) => {
                  const category = CATEGORIES[categoryKey];
                  return (
                    <CategoryCard
                      key={categoryKey}
                      categoryKey={categoryKey}
                      category={category}
                      isSelected={false}
                      isRecommended={false}
                      onClick={() => { try { playSound('click'); } catch {} handleCategoryPicked(categoryKey); }}
                    />
                  );
                })
              ) : (
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <p className="text-gray-600 dark:text-gray-300">
                    All categories have been used! Categories will reset for the next round.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <LoadingSpinner size="w-16 h-16" />
              <p className="text-gray-500 dark:text-gray-300 mt-4">Waiting for {currentPlayer?.name} to choose…</p>
            </div>
          )}

          {(usedCategories || []).length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Already Used:</h3>
              <div className="flex flex-wrap gap-2">
                {(usedCategories || []).map((categoryKey) => {
                  const category = CATEGORIES[categoryKey];
                  return (
                    <span key={categoryKey} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                      {category?.name || categoryKey}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Playing (Classic + Party Modes)
  ========================= */
  if (gameState === 'playing') {
    const currentCategoryData = CATEGORIES[currentCategory] || null;
    const IconComponent = currentCategoryData && iconMap[currentCategoryData.icon]
      ? iconMap[currentCategoryData.icon]
      : MessageCircle;
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.id === myUid;
    const canSkip = skipsUsedThisTurn < maxSkipsPerTurn;

    const roundNo = players.length ? Math.floor((turnHistory.length || 0) / players.length) + 1 : 1;
    const turnNo = players.length ? ((turnHistory.length || 0) % players.length) + 1 : 1;

    // Party mode routes
    if (round?.mode === 'superlatives') {
      return (
        <SuperlativesScreen
          round={round}
          players={players}
          myUid={myUid}
          isHost={isHost}
          onStart={async () => {
            await updateDoc(doc(db,'sessions',sessionCode), { round: { ...round, phase:'vote' } });
            setRound(r => ({ ...r, phase:'vote' }));
          }}
          onNextPrompt={async () => {
            const next = pickRandom(superlativeSeeds, [round.prompt]);
            await updateDoc(doc(db,'sessions',sessionCode), { round: { mode:'superlatives', phase:'prompt', prompt: next, votes:{} } });
            setRound({ mode:'superlatives', phase:'prompt', prompt: next, votes:{} });
          }}
          onVote={async (targetUid) => {
            const sessionRef = doc(db,'sessions',sessionCode);
            const snap = await getDoc(sessionRef); const data = snap.data() || {};
            const r = data.round || { mode:'superlatives', phase:'vote', prompt: round.prompt, votes:{} };
            const votes = { ...(r.votes||{}), [myUid]: targetUid };
            await updateDoc(sessionRef, { round: { ...r, phase:'vote', votes } });
            setRound({ ...r, phase:'vote', votes });
          }}
          onReveal={async () => {
            const counts = {};
            Object.values(round.votes||{}).forEach(t => { counts[t] = (counts[t]||0)+1; });
            const ordered = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
            const topCount = ordered[0]?.[1] || 0;
            const winners = ordered.filter(([,c])=>c===topCount).map(([uid])=>uid);
            const namePatch = {};
            winners.forEach(uid=>{
              const name = (players.find(p=>p.id===uid)?.name) || uid;
              namePatch[name] = 1;
            });
            await hostUpdateScores(namePatch);
            await updateDoc(doc(db,'sessions',sessionCode), { round: { ...round, phase:'reveal' } });
            setRound(r=>({ ...r, phase:'reveal' }));
          }}
        >
          <ModeSwitcher mode="superlatives" />
        </SuperlativesScreen>
      );
    }

    if (round?.mode === 'never') {
      return (
        <NeverScreen
          round={round}
          players={players}
          myUid={myUid}
          isHost={isHost}
          onRespond={async (val) => {
            const sessionRef = doc(db,'sessions',sessionCode);
            const snap = await getDoc(sessionRef); const data = snap.data() || {};
            const r = data.round || { mode:'never', phase:'collect', prompt: round.prompt, responses:{} };
            const responses = { ...(r.responses||{}), [myUid]: !!val };
            await updateDoc(sessionRef, { round: { ...r, phase:'collect', responses } });
            setRound({ ...r, phase:'collect', responses });
          }}
          onReveal={async () => {
            await updateDoc(doc(db,'sessions',sessionCode), { round: { ...round, phase:'reveal' } });
            setRound(r=>({ ...r, phase:'reveal' }));
          }}
          onNextPrompt={async () => {
            const topic = pickRandom(neverSeeds, [round.prompt.replace(/^Never have I ever\s*/i,'')]);
            const next = `Never have I ever ${topic}`;
            await updateDoc(doc(db,'sessions',sessionCode), { round: { mode:'never', phase:'collect', prompt: next, responses:{} } });
            setRound({ mode:'never', phase:'collect', prompt: next, responses:{} });
          }}
        >
          <ModeSwitcher mode="never" />
        </NeverScreen>
      );
    }

    if (round?.mode === 'fill_blank') {
      return (
        <FillBlankScreen
          round={round}
          players={players}
          myUid={myUid}
          isHost={isHost}
          onSubmit={async (text) => {
            if (!text.trim()) return;
            const sessionRef = doc(db,'sessions',sessionCode);
            const snap = await getDoc(sessionRef); const data = snap.data() || {};
            const r = data.round || { mode:'fill_blank', phase:'collect_submissions', prompt: round.prompt, submissions:{}, votes:{} };
            const submissions = { ...(r.submissions||{}), [myUid]: { id: myUid, text: text.trim() } };
            await updateDoc(sessionRef, { round: { ...r, phase:'collect_submissions', submissions, votes: r.votes||{} } });
            setRound({ ...r, phase:'collect_submissions', submissions, votes: r.votes||{} });
          }}
          onStartVoting={async () => {
            await updateDoc(doc(db,'sessions',sessionCode), { round: { ...round, phase:'collect_votes' } });
            setRound(r=>({ ...r, phase:'collect_votes' }));
          }}
          onVote={async (targetUid) => {
            const sessionRef = doc(db,'sessions',sessionCode);
            const snap = await getDoc(sessionRef); const data = snap.data() || {};
            const r = data.round || { mode:'fill_blank', phase:'collect_votes', prompt: round.prompt, submissions: round.submissions, votes:{} };
            const votes = { ...(r.votes||{}), [myUid]: targetUid };
            await updateDoc(sessionRef, { round: { ...r, phase:'collect_votes', votes, submissions: r.submissions||{} } });
            setRound({ ...r, phase:'collect_votes', votes, submissions: r.submissions||{} });
          }}
          onReveal={async () => {
            const counts = {};
            Object.values(round.votes||{}).forEach(t => { counts[t] = (counts[t]||0)+1; });
            const ordered = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
            const winnerUid = ordered[0]?.[0] || null;
            if (winnerUid) {
              const winnerName = (players.find(p=>p.id===winnerUid)?.name) || winnerUid;
              await hostUpdateScores({ [winnerName]: 1 });
              const idx = players.findIndex(p=>p.id===winnerUid);
              if (idx >= 0) await updateDoc(doc(db,'sessions',sessionCode), { currentTurnIndex: idx });
            }
            await updateDoc(doc(db,'sessions',sessionCode), { round: { ...round, phase:'reveal', winner: winnerUid } });
            setRound(r=>({ ...r, phase:'reveal', winner: winnerUid }));
          }}
          onNextPrompt={async () => {
            const next = pickRandom(fillBlankSeeds, [round.prompt]);
            await updateDoc(doc(db,'sessions',sessionCode), { round: { mode:'fill_blank', phase:'collect_submissions', prompt: next, submissions:{}, votes:{} } });
            setRound({ mode:'fill_blank', phase:'collect_submissions', prompt: next, submissions:{}, votes:{} });
          }}
        >
          <ModeSwitcher mode="fill_blank" />
        </FillBlankScreen>
      );
    }

    // Classic default view
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
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
              {currentPlayer?.name || 'Player'}’s Question
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">
              Round {roundNo} • Turn {turnNo} of {players.length || 1}
            </p>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400">
              <p className="text-lg leading-relaxed">{round?.prompt || currentQuestion}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Optional: write-in answer */}
            <div className="flex gap-2">
              <input
                value={myAnswerDraft}
                onChange={(e)=>setMyAnswerDraft(e.target.value)}
                placeholder="(Optional) Type your answer..."
                className="flex-1 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
              />
              <button
                onClick={async () => {
                  if (!sessionCode || !myAnswerDraft.trim()) return;
                  const sessionRef = doc(db,'sessions',sessionCode);
                  const snap = await getDoc(sessionRef);
                  const data = snap.data() || {};
                  const r = data.round || { mode:'classic', phase:'ask', prompt: currentQuestion, answers:{} };
                  const answers = { ...(r.answers || {}), [myUid]: { text: myAnswerDraft.trim(), at: Date.now() } };
                  await updateDoc(sessionRef, { round: { ...r, answers } });
                  setRound({ ...r, answers });
                  setMyAnswerDraft('');
                  showNotification('Answer submitted', '✅');
                }}
                className="bg-white dark:bg-gray-900 border-2 border-purple-500 text-purple-600 dark:text-purple-300 px-4 rounded-xl font-semibold hover:bg-purple-50 dark:hover:bg-purple-900/10"
              >
                Send
              </button>
            </div>
            {round?.answers && Object.keys(round.answers).length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-300">
                Answers submitted: {Object.keys(round.answers).length}/{players.length}
              </p>
            )}

            {isMyTurn ? (
              <>
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={questionDraft}
                    onChange={(e)=>setQuestionDraft(e.target.value)}
                    className="w-full p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
                    placeholder="(Optional) Propose a custom question..."
                  />
                  <button
                    onClick={async () => {
                      if (!questionDraft.trim()) return;
                      const newQ = questionDraft.trim();
                      await updateDoc(doc(db,'sessions',sessionCode), {
                        round: { mode:'classic', phase:'ask', prompt: newQ, answers:{} },
                        currentQuestion: newQ
                      });
                      setRound({ mode:'classic', phase:'ask', prompt: newQ, answers:{} });
                      setCurrentQuestion(newQ);
                      setQuestionDraft('');
                      showNotification('Custom question set', '✍️');
                    }}
                    className="w-full bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                  >
                    <Edit3 className="inline w-4 h-4 mr-2" />
                    Use Custom
                  </button>
                </div>

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
              <div className="text-center">
                <LoadingSpinner />
                <p className="text-gray-600 dark:text-gray-300 mt-4">
                  Waiting for {currentPlayer?.name || 'player'} to finish their turn…
                </p>
              </div>
            )}

            <button
              onClick={() => { try { playSound('click'); } catch {} setGameState('waitingRoom'); }}
              className="w-full bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              Back to Lobby
            </button>
          </div>
        </div>

        {/* host-only mode switcher */}
        <ModeSwitcher mode={round?.mode || 'classic'} />
      </div>
    );
  }

  /* =========================
     Fallback
  ========================= */
  return null;
}

/* ======================================================================= */
/*                             SUBCOMPONENTS                               */
/* ======================================================================= */

function QuickstartSolo({ CATEGORIES, getQuestion, onBack }) {
  const [qsSelected, setQsSelected] = useState(['icebreakers']);
  const [qsQuestion, setQsQuestion] = useState('');
  const [qsCategory, setQsCategory] = useState('icebreakers');

  useEffect(() => {
    const q = getQuestion('icebreakers', []);
    setQsQuestion(q); setQsCategory('icebreakers');
  }, [getQuestion]);

  const toggle = (k) => setQsSelected(prev => prev.includes(k) ? prev.filter(x=>x!==k) : [...prev, k]);
  const entries = Object.entries(CATEGORIES || {});
  const pickQuestion = (cat) => { const q = getQuestion(cat, [qsQuestion]); setQsQuestion(q); setQsCategory(cat); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <h2 className="text-2xl font-bold mb-4 text-center">Quickstart</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-4">Pick categories and get instant prompts. No code, no lobby.</p>
        <div className="space-y-2 mb-4">
          {entries.map(([key, cat])=>(
            <label key={key} className="flex items-center gap-2 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600">
              <input type="checkbox" checked={qsSelected.includes(key)} onChange={()=>toggle(key)} />
              <span className="font-medium">{cat?.name||key}</span>
            </label>
          ))}
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400 mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Category: <b>{CATEGORIES[qsCategory]?.name||qsCategory}</b></p>
          <p className="text-lg leading-relaxed">{qsQuestion}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={()=>{ if(qsSelected.length===0) return; const c = qsSelected[Math.random()*qsSelected.length|0]; pickQuestion(c); }}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            New Question
          </button>
          <button onClick={onBack} className="flex-1 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function FrameLocal({ title, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function SuperlativesScreen({ round, players, myUid, isHost, onStart, onNextPrompt, onVote, onReveal, children }) {
  const prompt = round.prompt || 'Most likely to...';
  const votes = round.votes || {};
  const everyoneVoted = players.length>0 && players.every(p => votes[p?.id]);

  return (
    <FrameLocal title="Superlatives">
      <h2 className="text-2xl font-bold text-center mb-4">{prompt}</h2>
      {round.phase === 'prompt' && isHost && (
        <div className="flex gap-2">
          <button onClick={onStart} className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all">Use This</button>
          <button onClick={onNextPrompt} className="flex-1 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">New Prompt</button>
        </div>
      )}
      {round.phase === 'vote' && (
        <>
          <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-3">Vote for who fits best (not yourself)</p>
          <div className="space-y-2">
            {players.map((p)=>(
              <button key={p.id} onClick={()=> onVote(p.id)}
                className={`w-full p-3 rounded-xl border-2 ${votes[myUid]===p.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20':'border-gray-200 dark:border-gray-600'}`}>
                {p.name}
              </button>
            ))}
          </div>
          {isHost && <button disabled={!everyoneVoted} onClick={onReveal} className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all">Reveal {everyoneVoted?'':'(waiting...)'}</button>}
        </>
      )}
      {round.phase === 'reveal' && (
        <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-3">Host can start a new prompt from the mode switcher.</p>
      )}
      {children}
    </FrameLocal>
  );
}

function NeverScreen({ round, players, myUid, isHost, onRespond, onReveal, onNextPrompt, children }) {
  const prompt = round.prompt || 'Never have I ever...';
  const responses = round.responses || {};
  const everyoneAnswered = players.length>0 && players.every(p => responses.hasOwnProperty(p?.id));

  return (
    <FrameLocal title="Never Have I Ever">
      <h2 className="text-2xl font-bold text-center mb-4">{prompt}</h2>
      {round.phase !== 'reveal' ? (
        <>
          <div className="flex gap-2 mb-4">
            <button onClick={()=>onRespond(true)} className={`flex-1 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 py-3 rounded-xl font-semibold ${responses[myUid]===true?'ring-2 ring-purple-500':''}`}>I have</button>
            <button onClick={()=>onRespond(false)} className={`flex-1 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 py-3 rounded-xl font-semibold ${responses[myUid]===false?'ring-2 ring-purple-500':''}`}>I haven’t</button>
          </div>
          {isHost && <button disabled={!everyoneAnswered} onClick={onReveal} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all">Reveal</button>}
        </>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {players.map(p=>(
              <div key={p.id} className="p-3 rounded-xl border bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 flex justify-between">
                <span>{p.name}</span>
                <span className="font-medium">{responses[p.id] ? 'I have' : 'I haven’t'}</span>
              </div>
            ))}
          </div>
          {isHost && <button onClick={onNextPrompt} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all">Next Prompt</button>}
        </>
      )}
      {children}
    </FrameLocal>
  );
}

function FillBlankScreen({ round, players, myUid, isHost, onSubmit, onStartVoting, onVote, onReveal, onNextPrompt, children }) {
  const [myDraft, setMyDraft] = useState('');
  const submissions = round.submissions || {};
  const votes = round.votes || {};
  const allSubmitted = players.length>0 && players.every(p => submissions[p?.id]?.text);
  const everyoneVoted = players.length>0 && players.every(p => votes[p?.id]);

  return (
    <FrameLocal title="Fill-in-the-Blank">
      <h2 className="text-2xl font-bold text-center mb-4">{round.prompt || 'Write the funniest answer!'}</h2>

      {round.phase === 'collect_submissions' && (
        <>
          <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-2">Write your funniest answer.</p>
          {!submissions[myUid] && (
            <div className="space-y-2 mb-3">
              <textarea value={myDraft} onChange={(e)=>setMyDraft(e.target.value)} rows={3}
                className="w-full p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900" placeholder="Your answer..." />
              <button onClick={()=>{ if(myDraft.trim()) onSubmit(myDraft); setMyDraft(''); }} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all">Submit</button>
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-300 text-center">Submissions: {Object.keys(submissions).length}/{players.length}</p>
          {isHost && <button disabled={!allSubmitted} onClick={onStartVoting} className="w-full mt-3 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">Start Voting</button>}
        </>
      )}

      {round.phase === 'collect_votes' && (
        <>
          <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-3">Vote for the best answer</p>
          <div className="space-y-2">
            {Object.entries(submissions).map(([uid, sub])=>(
              <button key={uid} onClick={()=>onVote(uid)}
                className={`w-full p-3 rounded-xl border-2 text-left ${votes[myUid]===uid ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20':'border-gray-200 dark:border-gray-600'}`}>
                <span className="block text-xs text-gray-500 dark:text-gray-300 mb-1">by {players.find(p=>p.id===uid)?.name || uid}</span>
                <span className="block">{sub.text}</span>
              </button>
            ))}
          </div>
          {isHost && <button disabled={!everyoneVoted} onClick={onReveal} className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all">Reveal {everyoneVoted?'':'(waiting...)'}</button>}
        </>
      )}

      {round.phase === 'reveal' && (
        <>
          <div className="space-y-2 mb-4">
            {Object.entries(submissions).map(([uid, sub])=>{
              const count = Object.values(votes).filter(v=>v===uid).length;
              const name = players.find(p=>p.id===uid)?.name || uid;
              const isWinner = round.winner === uid;
              return (
                <div key={uid} className={`p-3 rounded-xl border ${isWinner ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400':'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}>
                  <div className="flex justify-between mb-1"><span className="font-medium">{name}</span><span>{count} vote(s)</span></div>
                  <div>{sub.text}</div>
                </div>
              );
            })}
          </div>
          {isHost && <button onClick={onNextPrompt} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all">Next Prompt</button>}
        </>
      )}
      {children}
    </FrameLocal>
  );
}
