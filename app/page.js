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
  Swords,
  Crown,
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

import { superlativesPrompts, getRandomSuperlative } from '../lib/superlatives';
import { fillInPrompts, getRandomFillIn } from '../lib/fillin';
import { nhiePrompts, getRandomNHIE } from '../lib/nhie';

/* =========================
   Helpers
========================= */
function getOrMakeDeviceId() {
  try {
    const k = 'overshare:uid';
    let id = localStorage.getItem(k);
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(k, id);
    }
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* =========================
   Main Component
========================= */
export default function Overshare() {
  /* =========================
     State
  ========================= */
  const [gameState, setGameState] = useState('welcome'); // welcome -> modeMenu -> ...
  const [playerName, setPlayerName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [myUid, setMyUid] = useState('');
  const [hostId, setHostId] = useState('');

  // Core shared state
  const [players, setPlayers] = useState([]);
  const [surveyAnswers, setSurveyAnswers] = useState({}); // reserved for Classic initial Qs
  const [relationshipAnswers, setRelationshipAnswers] = useState({});

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

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [skipsUsedThisTurn, setSkipsUsedThisTurn] = useState(0);
  const [maxSkipsPerTurn] = useState(1);
  const [notification, setNotification] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  // Modes & Party
  const [mode, setMode] = useState(null); // 'classic' | 'party' | 'solo'
  const [partyPhase, setPartyPhase] = useState(null); // 'prompt' | 'collect' | 'results'
  const [partyRoundType, setPartyRoundType] = useState(null); // 'superlatives' | 'fillin' | 'nhie'
  const [scores, setScores] = useState({}); // {playerId: number}
  const [lives, setLives] = useState({});  // {playerId: number}, NHIE
  const [turnMasterId, setTurnMasterId] = useState(null);
  const [currentPromptId, setCurrentPromptId] = useState(null);
  const [submissions, setSubmissions] = useState([]); // [{playerId, text}]
  const [votes, setVotes] = useState([]); // [{voterId, targetPlayerId? , submissionIndex?}]

  // SOLO mode (local only)
  const [soloCategory, setSoloCategory] = useState('');
  const [soloQuestion, setSoloQuestion] = useState('');
  const [soloHistory, setSoloHistory] = useState([]);

  /* =========================
     Refs
  ========================= */
  const unsubscribeRef = useRef(null);
  const prevTurnIndexRef = useRef(0);
  const audioCtxRef = useRef(null);

  /* =========================
     Init: device id + saved name
  ========================= */
  useEffect(() => {
    try {
      const id = getOrMakeDeviceId();
      setMyUid(id);
      const savedName = localStorage.getItem('overshare:name');
      if (savedName) setPlayerName(savedName);
    } catch {}
  }, []);

  /* =========================
     Config / Memos
  ========================= */
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
        color: 'from-purple-500 to-pink-500'
      },
      creative: {
        name: 'Creative',
        description: 'Imagine, riff, and get playful.',
        icon: 'Lightbulb',
        color: 'from-indigo-500 to-purple-500'
      },
      deep_dive: {
        name: 'Deep Dive',
        description: 'Thoughtful questions with heart.',
        icon: 'MessageCircle',
        color: 'from-blue-500 to-cyan-500'
      },
      growth: {
        name: 'Growth',
        description: 'Reflect, learn, and level up.',
        icon: 'Target',
        color: 'from-emerald-500 to-teal-500'
      },
      spicy: {
        name: 'Spicy',
        description: 'Bold prompts for brave groups.',
        icon: 'Flame',
        color: 'from-orange-500 to-red-500'
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
    return (typeof getRandomQImport === 'function') && !usingFallback;
  }, [CATEGORIES, FALLBACK_CATEGORIES]);

  // Question fetcher (library-first)
  const getQuestion = useCallback(
    (categoryKey, exclude = []) => {
      if (typeof getRandomQImport === 'function') {
        try {
          let tries = 6;
          while (tries-- > 0) {
            const q = getRandomQImport(categoryKey, exclude);
            if (q && !exclude.includes(q)) return q;
          }
        } catch {}
      }
      const fallbackQs = {
        icebreakers: [
          'What was a small win you had this week?',
          'What’s your go-to fun fact about yourself?'
        ],
        creative: [
          'Invent a wild holiday and describe how we celebrate it.',
          'Merge two movies into one plot — what happens?'
        ],
        deep_dive: [
          'What belief of yours has changed in the last few years?',
          'What’s a memory that shaped who you are?'
        ],
        growth: [
          'What habit are you trying to build?',
          'What’s a risk you’re glad you took?'
        ],
        spicy: [
          'What’s a “hot take” you stand by?',
          'What’s a topic you wish people were more honest about?'
        ]
      };
      const pool = fallbackQs[categoryKey] || fallbackQs.icebreakers;
      let tries = 8;
      let q = pool[Math.floor(Math.random() * pool.length)];
      while (exclude.includes(q) && tries-- > 0) {
        q = pool[Math.floor(Math.random() * pool.length)];
      }
      return q;
    },
    []
  );

  // Initial questions (moved to Classic after lobby)
  const initialQuestions = [
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

  /* =========================
     Audio
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
    } catch { return null; }
  };

  const playSound = (type) => {
    const audio = getAudio();
    if (!audio) return;
    const tone = (seq) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.connect(gain); gain.connect(audio.destination);
      gain.gain.setValueAtTime(0.1, audio.currentTime);
      seq(osc, gain, audio.currentTime); osc.start();
    };
    const sounds = {
      click: () => tone((o,g,t) => { o.frequency.setValueAtTime(800,t); o.frequency.exponentialRampToValueAtTime(600,t+0.1); g.gain.exponentialRampToValueAtTime(0.01,t+0.1); o.stop(t+0.1); }),
      success: () => tone((o,g,t) => { o.frequency.setValueAtTime(523,t); o.frequency.setValueAtTime(659,t+0.1); o.frequency.setValueAtTime(784,t+0.2); g.gain.exponentialRampToValueAtTime(0.01,t+0.3); o.stop(t+0.3); }),
      turnTransition: () => tone((o,g,t) => { o.frequency.setValueAtTime(440,t); o.frequency.setValueAtTime(554,t+0.15); g.gain.exponentialRampToValueAtTime(0.01,t+0.3); o.stop(t+0.3); })
    };
    if (sounds[type]) sounds[type]();
  };

  /* =========================
     Notifications
  ========================= */
  const showNotification = (message, emoji = '🎉') => {
    setNotification({ message, emoji });
    window.clearTimeout((showNotification._t || 0));
    showNotification._t = window.setTimeout(() => setNotification(null), 3000);
  };

  /* =========================
     Session Helpers (Firestore)
  ========================= */
  const createFirebaseSession = async (code, hostPlayer) => {
    try {
      await setDoc(doc(db, 'sessions', code), {
        hostId: hostPlayer.id,
        players: [hostPlayer],
        // classic fields
        currentQuestion: '',
        currentCategory: '',
        currentQuestionAsker: '',
        selectedCategories: [],
        currentTurnIndex: 0,
        availableCategories: [],
        usedCategories: [],
        turnHistory: [],
        categoryVotes: {},
        // mode fields
        mode: null,               // 'classic' or 'party' (null until host chooses)
        gameState: 'waitingRoom', // classic uses existing states
        partyPhase: null,
        partyRoundType: null,
        scores: {},
        lives: {},
        turnMasterId: null,
        currentPromptId: null,
        submissions: [],
        votes: [],
        createdAt: serverTimestamp()
      });
      return true;
    } catch (err) {
      console.error('Error creating session:', err);
      return false;
    }
  };

  const listenToSession = useCallback(
    (code) => {
      if (!code) return () => {};
      if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }

      const sessionRef = doc(db, 'sessions', code);
      let previousPlayerCount = 0;

      const unsubscribe = onSnapshot(
        sessionRef,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() || {};

          // host / me
          setHostId(data.hostId || '');
          setIsHost((myUid && data.hostId && myUid === data.hostId) || false);

          // players
          const newCount = (data.players || []).length;
          if (previousPlayerCount > 0 && newCount > previousPlayerCount) {
            const newPlayer = (data.players || [])[newCount - 1];
            if (newPlayer && newPlayer.name !== playerName) {
              showNotification(`${newPlayer.name} joined the game!`, '👋');
              try { playSound('success'); } catch {}
            }
          }
          previousPlayerCount = newCount;

          setPlayers([...(data.players || [])]);

          // classic fields
          setCurrentQuestion(data.currentQuestion || '');
          setCurrentCategory(data.currentCategory || '');
          setCurrentQuestionAsker(data.currentQuestionAsker || '');
          setSelectedCategories([...(data.selectedCategories || [])]);
          setCurrentTurnIndex(typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0);
          setAvailableCategories([...(data.availableCategories || [])]);
          setUsedCategories([...(data.usedCategories || [])]);
          setTurnHistory([...(data.turnHistory || [])]);
          setCategoryVotes(data.categoryVotes || {});

          const incomingTurn = typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0;
          if (incomingTurn !== prevTurnIndexRef.current) {
            setSkipsUsedThisTurn(0);
            prevTurnIndexRef.current = incomingTurn;
          }

          // mode & party
          setMode(data.mode || null);
          setPartyPhase(data.partyPhase || null);
          setPartyRoundType(data.partyRoundType || null);
          setScores(data.scores || {});
          setLives(data.lives || {});
          setTurnMasterId(data.turnMasterId || null);
          setCurrentPromptId(data.currentPromptId || null);
          setSubmissions(data.submissions || []);
          setVotes(data.votes || []);

          // gameState
          const incoming = data.gameState || 'waitingRoom';
          if (incoming !== gameState) setGameState(incoming);
        },
        (error) => {
          console.error('Firebase listener error:', error);
        }
      );

      unsubscribeRef.current = unsubscribe;
      return unsubscribe;
    },
    [db, playerName, gameState, myUid]
  );

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
      try { if (audioCtxRef.current?.close) audioCtxRef.current.close(); } catch {}
    };
  }, []);

  /* =========================
     Create / Join
  ========================= */
  const handleCreateSession = async () => {
    const name = (playerName || '').trim();
    if (!name) { alert('Enter your name'); return; }
    try { localStorage.setItem('overshare:name', name); } catch {}

    const uid = myUid || getOrMakeDeviceId();
    setMyUid(uid);
    console.log('[create] uid:', uid);

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostPlayer = {
      id: uid, name, isHost: true, surveyAnswers: {}, joinedAt: new Date().toISOString()
    };

    const ok = await createFirebaseSession(code, hostPlayer);
    if (!ok) { alert('Failed to create session. Please try again.'); return; }

    setSessionCode(code);
    setIsHost(true);
    setPlayers([hostPlayer]);
    setGameState('waitingRoom');
    try { playSound('success'); } catch {}
    listenToSession(code);
  };

  const handleJoinSession = async () => {
    const name = (playerName || '').trim();
    if (!name) { alert('Enter your name'); return; }
    try { localStorage.setItem('overshare:name', name); } catch {}

    const raw = (sessionCode || '').trim();
    const code = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!code) { alert('Enter a valid session code'); return; }

    setJoinLoading(true);
    const uid = myUid || getOrMakeDeviceId();
    setMyUid(uid);
    console.log('[join] start', { code, name, uid });

    const sessionRef = doc(db, 'sessions', code);
    let snap;
    try { snap = await getDoc(sessionRef); }
    catch (e) { console.error('[join] getDoc error', e); alert(`Could not look up game (${e?.code || 'network'}).`); setJoinLoading(false); return; }

    if (!snap.exists()) { alert('Session not found. Double-check the code.'); setJoinLoading(false); return; }

    // Move to lobby + listen
    setSessionCode(code);
    listenToSession(code);
    setGameState('waitingRoom');

    const data = snap.data() || {};
    const alreadyIn = (data.players || []).some((p) => p?.id === uid);

    if (!alreadyIn) {
      const newPlayer = {
        id: uid, name, isHost: false, surveyAnswers: {}, relationshipAnswers: {}, joinedAt: new Date().toISOString()
      };
      try {
        await updateDoc(sessionRef, { players: arrayUnion(newPlayer) });
        console.log('[join] arrayUnion ok');
      } catch (err) {
        console.warn('[join] arrayUnion failed, manual merge', err?.code, err?.message);
        try {
          const fresh = (await getDoc(sessionRef)).data() || {};
          const next = [...(fresh.players || []), newPlayer].filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i);
          await updateDoc(sessionRef, { players: next });
          console.log('[join] manual merge ok');
        } catch (e2) {
          console.error('[join] manual merge failed', e2);
          alert(`Could not join game: ${e2?.code || 'error'}`);
        }
      }
    } else {
      console.log('[join] already in lobby');
    }

    setJoinLoading(false);
    try { playSound('success'); } catch {}
  };

  /* =========================
     Classic — initial Qs & relationship survey
  ========================= */
  const handleInitialQsSubmit = async () => {
    if (!sessionCode) return;
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const snap = await getDoc(sessionRef); if (!snap.exists()) return;
      const data = snap.data() || {};
      const updatedPlayers = (data.players || []).map(p => p.id === myUid ? { ...p, surveyAnswers } : p);
      await updateDoc(sessionRef, { players: updatedPlayers });

      const allDone = updatedPlayers.every(p => p?.surveyAnswers && Object.keys(p.surveyAnswers).length === initialQuestions.length);
      if (allDone) {
        await updateDoc(sessionRef, { gameState: 'relationshipSurvey' });
        setGameState('relationshipSurvey');
      } else {
        setGameState('waitingForOthers');
      }
    } catch (e) {
      console.error('InitialQs submit error:', e);
    }
  };

  const handleRelationshipSurveySubmit = async () => {
    if (!sessionCode) return;
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) return;

      const data = sessionSnap.data() || {};
      const updatedPlayers = (data.players || []).map((p) =>
        p?.id === myUid ? { ...p, relationshipAnswers } : p
      );

      await updateDoc(sessionRef, { players: updatedPlayers });

      const allCompleted = updatedPlayers.every((p) => p?.relationshipAnswers);
      if (allCompleted) {
        const top = (data.selectedCategories && data.selectedCategories.length > 0)
          ? data.selectedCategories : Object.keys(CATEGORIES);

        await updateDoc(sessionRef, {
          gameState: 'categoryVoting',
          selectedCategories: top
        });
        setGameState('categoryVoting');
        try { playSound('success'); } catch {}
      } else {
        setGameState('waitingForOthers');
      }
    } catch (err) {
      console.error('Error updating player data:', err);
    }
  };

  /* =========================
     Category Voting & Classic play (unchanged)
  ========================= */
  const handleCategoryVote = async (selectedCats) => {
    if (!sessionCode) return;
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) return;

      const data = sessionSnap.data() || {};
      const currentVotes = { ...(data.categoryVotes || {}) };
      const me = players.find((p) => p.id === myUid)?.name || playerName;
      currentVotes[me] = selectedCats;

      await updateDoc(sessionRef, { categoryVotes: currentVotes });

      setMyVotedCategories(selectedCats);
      setHasVotedCategories(true);
      try { playSound('success'); } catch {}

      const list = data.players || [];
      if (list.length > 1) {
        const allPlayersVoted = list.every(
          (p) => (currentVotes[p?.name] || []).length > 0
        );
        if (allPlayersVoted) {
          await updateDoc(sessionRef, { gameState: 'waitingForHost' });
          setGameState('waitingForHost');
        }
      }
    } catch (err) {
      console.error('Error submitting category votes:', err);
    }
  };

  const calculateTopCategories = (votes) => {
    const byPlayer = votes || {};
    const voteCount = {};
    Object.values(byPlayer).forEach((playerVotes) => {
      (playerVotes || []).forEach((cat) => { voteCount[cat] = (voteCount[cat] || 0) + 1; });
    });
    const sorted = Object.entries(voteCount).sort((a, b) => b[1] - a[1]).map(([k]) => k);
    return sorted.slice(0, Math.min(4, Math.max(3, sorted.length)));
  };

  const generatePersonalizedQuestion = (list, surveyData, relationships, forceCategory = null) => {
    let category = forceCategory || currentCategory || 'icebreakers';
    const question = getQuestion(category);
    setCurrentCategory(category);
    return question;
  };

  const handleCategoryPicked = async (category) => {
    if (!sessionCode) return;
    try {
      const currentPlayer = players[currentTurnIndex] || players[0];
      if (!currentPlayer) return;

      const question = generatePersonalizedQuestion(players, surveyAnswers, relationshipAnswers, category);

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

      setCurrentQuestion(question);
      setCurrentCategory(category);
      setCurrentQuestionAsker(currentPlayer.name);
      setUsedCategories(newUsed);
      setAvailableCategories(newAvail);
      setTurnHistory(newHistory);
      setGameState('playing');
      try { playSound('success'); } catch {}
    } catch (err) { console.error('Error in handleCategoryPicked:', err); }
  };

  const handleSkipQuestion = async () => {
    if (skipsUsedThisTurn >= maxSkipsPerTurn) {
      showNotification("You've used your skip for this turn!", '⏭️');
      return;
    }
    if (!sessionCode) return;

    const forcedCategory = currentCategory || (turnHistory[turnHistory.length - 1]?.category) || (selectedCategories[0]) || 'icebreakers';
    const newQuestion = getQuestion(forcedCategory, [currentQuestion]);

    try {
      await updateDoc(doc(db, 'sessions', sessionCode), {
        currentQuestion: newQuestion,
        currentCategory: forcedCategory
      });
      setCurrentQuestion(newQuestion);
      setCurrentCategory(forcedCategory);
      setSkipsUsedThisTurn((n) => n + 1);
      try { playSound('click'); } catch {}
    } catch (err) { console.error('Error skipping question:', err); }
  };

  const handleNextQuestion = async () => {
    if (!sessionCode) return;
    try {
      const count = players.length || 0; if (count === 0) return;
      const nextTurnIndex = (currentTurnIndex + 1) % count;

      let newAvailable = availableCategories;
      let newUsed = usedCategories;
      if ((availableCategories || []).length === 0) { newAvailable = [...(selectedCategories || [])]; newUsed = []; }

      await updateDoc(doc(db, 'sessions', sessionCode), {
        gameState: 'categoryPicking',
        currentTurnIndex: nextTurnIndex,
        availableCategories: newAvailable,
        usedCategories: newUsed,
        currentQuestion: '',
        currentCategory: '',
        currentQuestionAsker: ''
      });

      setCurrentTurnIndex(nextTurnIndex);
      setAvailableCategories(newAvailable);
      setUsedCategories(newUsed);
      setCurrentQuestion(''); setCurrentCategory(''); setCurrentQuestionAsker('');
      setGameState('categoryPicking'); setSkipsUsedThisTurn(0);
      try { playSound('turnTransition'); } catch {}
    } catch (err) { console.error('Error in handleNextQuestion:', err); }
  };

  /* =========================
     PARTY MODE — helpers
  ========================= */
  const initPartyIfNeeded = async () => {
    if (!sessionCode) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const snap = await getDoc(sessionRef); if (!snap.exists()) return;
    const data = snap.data() || {};

    const baseScores = { ...(data.scores || {}) };
    const baseLives  = { ...(data.lives  || {}) };

    (data.players || []).forEach(p => {
      if (baseScores[p.id] == null) baseScores[p.id] = 0;
      if (baseLives[p.id]  == null) baseLives[p.id]  = 10;
    });

    const firstTurnMaster = data.turnMasterId || data.hostId;

    await updateDoc(sessionRef, {
      scores: baseScores,
      lives: baseLives,
      turnMasterId: firstTurnMaster
    });

    setScores(baseScores); setLives(baseLives); setTurnMasterId(firstTurnMaster);
  };

  const pickNextPartyRoundType = (lastType = null) => {
    // 1:1:1 ratio → simple random across three types (avoid repeating if possible)
    const types = ['superlatives', 'fillin', 'nhie'];
    let pool = types;
    if (lastType) pool = types.filter(t => t !== lastType);
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const startNextPartyPrompt = async (forceType = null) => {
    if (!sessionCode) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const snap = await getDoc(sessionRef); if (!snap.exists()) return;
    const data = snap.data() || {};

    const type = forceType || pickNextPartyRoundType(data.partyRoundType);
    let prompt = null;

    const used = new Set([...(data.turnHistory || [])].map(h => h?.prompt));
    if (type === 'superlatives') prompt = getRandomSuperlative(used);
    if (type === 'fillin')       prompt = getRandomFillIn(used);
    if (type === 'nhie')         prompt = getRandomNHIE(used);

    await updateDoc(sessionRef, {
      partyRoundType: type,
      partyPhase: 'prompt',
      currentPromptId: prompt,
      submissions: [],
      votes: []
    });

    setPartyRoundType(type); setPartyPhase('prompt'); setCurrentPromptId(prompt);
    setSubmissions([]); setVotes([]);
  };

  const submitFillIn = async (text) => {
    if (!sessionCode) return;
    if (!text.trim()) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const fresh = (await getDoc(sessionRef)).data() || {};
    const existing = (fresh.submissions || []).filter(s => s.playerId !== myUid);
    const next = [...existing, { playerId: myUid, text: text.trim() }];
    await updateDoc(sessionRef, { submissions: next });
  };

  const voteForSuperlative = async (targetPlayerId) => {
    if (!sessionCode) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const fresh = (await getDoc(sessionRef)).data() || {};
    const existing = (fresh.votes || []).filter(v => v.voterId !== myUid);
    const next = [...existing, { voterId: myUid, targetPlayerId }];
    await updateDoc(sessionRef, { votes: next });
  };

  const voteForFillIn = async (submissionIndex) => {
    // Only Turn Master selects winner
    if (turnMasterId !== myUid) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const fresh = (await getDoc(sessionRef)).data() || {};
    await updateDoc(sessionRef, { votes: [{ voterId: myUid, submissionIndex }] });
  };

  const tallyAndAdvanceParty = async () => {
    if (!sessionCode) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const fresh = (await getDoc(sessionRef)).data() || {};
    const type = fresh.partyRoundType;

    let nextScores = { ...(fresh.scores || {}) };
    let nextLives  = { ...(fresh.lives  || {}) };
    let nextTurnMaster = fresh.turnMasterId;

    if (type === 'superlatives') {
      // Count votes → max
      const counts = {};
      (fresh.votes || []).forEach(v => { if (v.targetPlayerId) counts[v.targetPlayerId] = (counts[v.targetPlayerId] || 0) + 1; });
      const ranked = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
      if (ranked.length > 0) {
        // break ties randomly among top
        const topScore = ranked[0][1];
        const topIds = ranked.filter(([_,c])=>c===topScore).map(([pid])=>pid);
        const winnerId = topIds[Math.floor(Math.random()*topIds.length)];
        nextScores[winnerId] = (nextScores[winnerId] || 0) + 1;
      }
    }

    if (type === 'fillin') {
      // Turn Master picks exactly one submission
      const subms = fresh.submissions || [];
      const v = (fresh.votes || [])[0];
      if (v && typeof v.submissionIndex === 'number' && subms[v.submissionIndex]) {
        const winnerId = subms[v.submissionIndex].playerId;
        nextScores[winnerId] = (nextScores[winnerId] || 0) + 1;
        nextTurnMaster = winnerId; // winner becomes next turn master
      }
    }

    if (type === 'nhie') {
      // Everyone taps I Have / I Haven't via votes: we’ll store as {voterId, targetPlayerId:'HAVE'|'HAVENT'}
      // For simplicity, we used votes as {voterId, submissionIndex: 1 for HAVE, 0 for HAVENT}
      const vts = fresh.votes || [];
      vts.forEach(v => {
        if (v.submissionIndex === 1) { // I HAVE
          nextLives[v.voterId] = Math.max(0, (nextLives[v.voterId] ?? 10) - 1);
        }
      });
      // Alternative A: if only one player has lives > 0, award +3 and reset lives
      const alive = Object.entries(nextLives).filter(([_,L]) => L > 0).map(([pid])=>pid);
      if (alive.length === 1) {
        const lastId = alive[0];
        nextScores[lastId] = (nextScores[lastId] || 0) + 3;
        // Reset for next NHIE cycle
        const resetLives = { ...nextLives };
        Object.keys(resetLives).forEach(pid => { resetLives[pid] = 10; });
        nextLives = resetLives;
        showNotification('Last standing in NHIE! +3 points awarded.', '🏆');
      }
    }

    await updateDoc(sessionRef, {
      scores: nextScores,
      lives: nextLives,
      turnMasterId: nextTurnMaster,
      partyPhase: 'results'
    });

    setScores(nextScores); setLives(nextLives); setTurnMasterId(nextTurnMaster);
    setPartyPhase('results');
  };

  const continuePartyAfterResults = async () => {
    await startNextPartyPrompt();
  };

  /* =========================
     UI Components
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
            <p>Pick a mode: Solo for quick vibes, Multiplayer for Classic or Party.</p>
            <p>Classic = conversation rounds. Party = superlatives, fill-ins, and NHIE with scoring.</p>
            <p>Be kind, be bold, overshare responsibly.</p>
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

  const CategoryPill = ({ categoryKey }) => {
    const c = CATEGORIES[categoryKey] || {};
    const Icon = iconMap[c.icon] || MessageCircle;
    return (
      <span className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r ${c.color || 'from-gray-400 to-gray-500'} text-white text-sm`}>
        <Icon className="w-4 h-4" /><span>{c.name || categoryKey}</span>
      </span>
    );
  };

  const CategoryCard = ({ categoryKey, category, onClick, disabled = false }) => {
    const IconComponent = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'
        } border-gray-200 dark:border-gray-600 hover:border-purple-300`}
      >
        <div className="flex items-start space-x-3">
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category?.color || 'from-gray-400 to-gray-500'}`}>
            <IconComponent className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">{category?.name || 'Category'}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{category?.description || ''}</p>
          </div>
        </div>
      </button>
    );
  };

  const PlayerList = ({ players: list, title, currentPlayerName = null }) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
        {title} ({(list || []).length})
      </h3>
      <div className="space-y-2">
        {(list || []).map((player, index) => (
          <div
            key={`${player?.id || 'p'}-${index}`}
            className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl ${
              currentPlayerName === player?.name ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/30' : ''
            }`}
          >
            <span className="font-medium">{player?.name || 'Player'}</span>
            <div className="flex items-center space-x-2">
              {player?.id === hostId && (
                <span className="text-xs bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-200 px-2 py-1 rounded-full">Host</span>
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

  const MiniLeaderboard = ({ scores, players }) => {
    const entries = Object.entries(scores || {});
    const withNames = entries.map(([pid, sc]) => ({ pid, name: (players.find(p=>p.id===pid)?.name)||'—', sc }));
    withNames.sort((a,b)=>b.sc-a.sc);
    const top3 = withNames.slice(0,3);
    return (
      <div className="fixed top-4 left-4 z-40">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 shadow">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            <Crown className="w-4 h-4" /> Leaderboard
          </div>
          <div className="mt-2 space-y-1 text-sm">
            {top3.map((e,i)=>(
              <div key={e.pid} className="flex items-center justify-between">
                <span className="truncate max-w-[140px]">{i+1}. {e.name}</span>
                <span className="ml-3 font-semibold">{e.sc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* =========================
     SCREENS
  ========================= */

  // Welcome
  if (gameState === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
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
              autoComplete="off" autoCorrect="off" spellCheck={false}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            onClick={() => { if (!playerName.trim()) return; try { playSound('click'); } catch {} setGameState('modeMenu'); }}
            disabled={!playerName.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Mode Menu (Solo vs Multiplayer)
  if (gameState === 'modeMenu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
          <h2 className="text-2xl font-bold mb-2">How do you want to play today?</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Pick Solo for one device, or Multiplayer to play together.</p>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => { setMode('solo'); setGameState('soloCategories'); try { playSound('click'); } catch {} }}
              className="w-full py-4 px-6 rounded-xl border-2 border-purple-500 bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition flex items-center justify-center gap-2 font-semibold"
            >
              <Wand2 className="w-5 h-5" /> Solo (Single Device)
            </button>
            <button
              onClick={() => { setMode(null); setGameState('createOrJoin'); try { playSound('click'); } catch {} }}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition flex items-center justify-center gap-2 font-semibold"
            >
              <Users className="w-5 h-5" /> Multiplayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SOLO — Category picker
  if (gameState === 'soloCategories' && mode === 'solo') {
    const entries = Object.entries(CATEGORIES || {});
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Solo Mode</h2>
            <p className="text-gray-600 dark:text-gray-300">Pick a category and get a question. Don’t like it? Skip.</p>
          </div>
          <div className="space-y-3">
            {entries.map(([key, category]) => (
              <CategoryCard
                key={key}
                categoryKey={key}
                category={category}
                onClick={() => {
                  setSoloCategory(key);
                  const q = getQuestion(key, soloHistory);
                  setSoloQuestion(q); setSoloHistory(h => [...h, q]);
                  setGameState('soloPlaying');
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // SOLO — Playing
  if (gameState === 'soloPlaying' && mode === 'solo') {
    const c = CATEGORIES[soloCategory] || {};
    const Icon = iconMap[c.icon] || MessageCircle;
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 mx-auto mb-4"><Icon className="w-6 h-6 text-white"/></div>
            <div className="mb-4"><span className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-gradient-to-r ${c.color || 'from-gray-400 to-gray-500'} text-white text-sm`}><Icon className="w-3 h-3"/><span>{c.name || soloCategory}</span></span></div>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400">
              <p className="text-lg leading-relaxed">{soloQuestion}</p>
            </div>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => {
                const q = getQuestion(soloCategory, soloHistory);
                setSoloQuestion(q); setSoloHistory(h => [...h, q]);
                try { playSound('click'); } catch {}
              }}
              className="w-full py-3 px-6 rounded-xl font-semibold text-lg bg-white dark:bg-gray-900 border-2 border-orange-400 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition"
            >
              Skip
            </button>
            <button
              onClick={() => { setGameState('soloCategories'); try { playSound('turnTransition'); } catch {} }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
            >
              Choose Another Category
            </button>
            <button
              onClick={() => setGameState('modeMenu')}
              className="w-full bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create or Join (Multiplayer)
  if (gameState === 'createOrJoin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
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
                type="text" inputMode="text" autoComplete="off" autoCorrect="off" spellCheck={false}
                placeholder="Enter session code"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter' && sessionCode.trim()) { try { playSound('click'); } catch {} handleJoinSession(); } }}
                className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={() => { try { playSound('click'); } catch {} handleJoinSession(); }}
                disabled={!sessionCode.trim() || joinLoading}
                className="w-full bg-white dark:bg-gray-900 border-2 border-purple-500 text-purple-600 dark:text-purple-300 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joinLoading ? 'Joining…' : 'Join Game'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Room — host chooses Classic or Party (Party disabled <3 players)
  if (gameState === 'waitingRoom') {
    const alreadyIn = players.some((p) => p?.id === myUid);
    const amHost = myUid && hostId && myUid === hostId;
    const canParty = (players || []).length >= 3;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Session {sessionCode}</h2>
            <p className="text-gray-600 dark:text-gray-300">Share this code with others to join</p>
          </div>

          <PlayerList players={players} title="Players" />

          {!amHost && !alreadyIn && (
            <button
              onClick={async () => {
                try { playSound('click'); } catch {}
                const sessionRef = doc(db, 'sessions', sessionCode);
                const newPlayer = { id: myUid, name: playerName, isHost: false, surveyAnswers: {}, joinedAt: new Date().toISOString() };
                const snap = await getDoc(sessionRef);
                if (snap.exists()) {
                  try { await updateDoc(sessionRef, { players: arrayUnion(newPlayer) }); }
                  catch { const data = snap.data() || {}; const updatedPlayers = [...(data.players || []), newPlayer].filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i); await updateDoc(sessionRef, { players: updatedPlayers }); setPlayers(updatedPlayers); }
                  try { playSound('success'); } catch {}
                }
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all mb-4"
            >
              Join Game
            </button>
          )}

          {amHost && alreadyIn && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 text-left">
                <button
                  onClick={async () => {
                    try { playSound('click'); } catch {}
                    const sessionRef = doc(db, 'sessions', sessionCode);
                    await updateDoc(sessionRef, { mode: 'classic', gameState: 'classicInitial' });
                    setMode('classic'); setGameState('classicInitial');
                  }}
                  className="w-full py-4 px-6 rounded-xl border-2 border-purple-500 bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition flex items-center justify-center gap-2 font-semibold"
                >
                  <MessageCircle className="w-5 h-5" /> Start Classic
                </button>

                <button
                  onClick={async () => {
                    if (!canParty) return;
                    try { playSound('click'); } catch {}
                    const sessionRef = doc(db, 'sessions', sessionCode);
                    // initialize scores/lives/turnMaster and jump into party
                    await updateDoc(sessionRef, { mode: 'party', gameState: 'party', partyPhase: null, partyRoundType: null });
                    setMode('party'); setGameState('party');
                    await initPartyIfNeeded();
                    await startNextPartyPrompt();
                  }}
                  disabled={!canParty}
                  className={`w-full py-4 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:shadow-lg transition flex items-center justify-center gap-2 font-semibold ${!canParty ? 'opacity-60 cursor-not-allowed' : ''}`}
                  title={canParty ? 'Mix mini-games with scoring' : 'Need 3+ players'}
                >
                  <Swords className="w-5 h-5" /> Start Party Mode
                </button>
              </div>
            </div>
          )}

          {!amHost && alreadyIn && (
            <p className="text-gray-500 dark:text-gray-300">Waiting for host to choose a mode…</p>
          )}
        </div>
      </div>
    );
  }

  /* =========================
     Classic — Initial Questions
  ========================= */
  if (gameState === 'classicInitial' && mode === 'classic') {
    const currentIndex = Object.keys(surveyAnswers).length;
    const q = initialQuestions[currentIndex];

    if (currentIndex >= initialQuestions.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <TopBar /><HelpModal /><NotificationToast />
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Nice, {playerName}!</h2>
            <p className="text-gray-600 dark:text-gray-300">Next, a quick “how you know each other”.</p>
            <button
              onClick={handleInitialQsSubmit}
              className="mt-6 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-300">Question {currentIndex + 1} of {initialQuestions.length}</span>
              <ProgressIndicator current={currentIndex + 1} total={initialQuestions.length} className="w-16" />
            </div>
            <h2 className="text-xl font-semibold mb-6">{q.question}</h2>
          </div>
          <div className="space-y-3">
            {q.options.map((opt, i) => (
              <button
                key={`init-${q.id}-${i}`}
                onClick={() => {
                  try { playSound('click'); } catch {}
                  setSurveyAnswers(prev => ({ ...prev, [q.id]: opt }));
                }}
                className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* =========================
     Classic — Relationship Survey (unchanged)
  ========================= */
  if (gameState === 'relationshipSurvey' && mode === 'classic') {
    const otherPlayers = (players || []).filter((p) => p?.id !== myUid);
    const idx = Object.keys(relationshipAnswers || {}).length;
    const currentPlayer = otherPlayers[idx];

    if (idx >= otherPlayers.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <TopBar /><HelpModal /><NotificationToast />
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Great!</h2>
            <p className="text-gray-600 dark:text-gray-300">Now pick the categories you want.</p>
            <button
              onClick={handleRelationshipSurveySubmit}
              className="mt-6 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    const relationshipOptions = [
      'Romantic partner/spouse',
      'Close friend (know each other well)',
      'Friend (hang out regularly)',
      'Family member',
      'Coworker/colleague',
      "Acquaintance (don't know well)",
      'Just met/new friend'
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-300">
                Player {idx + 1} of {otherPlayers.length}
              </span>
              <ProgressIndicator current={idx + 1} total={otherPlayers.length} className="w-16" />
            </div>
            <h2 className="text-xl font-semibold mb-2">How are you connected to {currentPlayer?.name}?</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">This helps us create better questions for your group.</p>
          </div>
          <div className="space-y-3">
            {relationshipOptions.map((opt, i) => (
              <button
                key={`rel-${i}`}
                onClick={() => { try { playSound('click'); } catch {}; if (!currentPlayer?.name) return; setRelationshipAnswers(prev => ({ ...prev, [currentPlayer.name]: opt })); }}
                className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* =========================
     Category Voting (Classic)
  ========================= */
  if (gameState === 'categoryVoting' && mode === 'classic') {
    const entries = Object.entries(CATEGORIES || {});
    const allVotes = Object.values(categoryVotes || {});
    const totalVotes = allVotes.length;
    const waitingFor = (players || []).filter((p) => !(categoryVotes || {})[p?.name]).map((p) => p?.name);
    const allPlayersVoted = (players || []).every((p) => (categoryVotes || {})[p?.name] && (categoryVotes || {})[p?.name].length > 0);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{hasVotedCategories ? 'Waiting for Others' : 'Vote for Categories'}</h2>
            <p className="text-gray-600 dark:text-gray-300">
              {hasVotedCategories ? `${totalVotes} of ${players.length} players have voted` : "Select 2-3 categories you'd like to play with"}
            </p>
            {hasVotedCategories && (<p className="text-sm text-gray-500 dark:text-gray-300 mt-2">Session Code: {sessionCode}</p>)}
          </div>

          {!hasVotedCategories ? (
            <>
              <div className="space-y-3 mb-6">
                {entries.map(([key, category]) => (
                  <CategoryCard
                    key={key}
                    categoryKey={key}
                    category={category}
                    onClick={() => {
                      try { playSound('click'); } catch {}
                      setSelectedCategories((prev) => {
                        const has = prev.includes(key); if (has) return prev.filter((c) => c !== key);
                        if (prev.length >= 3) return prev; return [...prev, key];
                      });
                    }}
                  />
                ))}
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
              {allPlayersVoted
                ? <p className="text-gray-600 dark:text-gray-300">All players have voted! Waiting for host…</p>
                : (
                  <>
                    <LoadingSpinner size="w-16 h-16" />
                    <p className="text-gray-600 dark:text-gray-300 mb-2 mt-4">Waiting for:</p>
                    <p className="text-sm text-gray-500 dark:text-gray-300">{waitingFor.join(', ')}</p>
                  </>
                )
              }
            </div>
          )}
        </div>
      </div>
    );
  }

  // Waiting for Host — Classic → relationshipSurvey or categoryPicking
  if (gameState === 'waitingForHost' && mode === 'classic') {
    const voteResults = {};
    Object.values(categoryVotes || {}).forEach((votes) => { (votes || []).forEach((cat) => { voteResults[cat] = (voteResults[cat] || 0) + 1; }); });
    const topCategories = calculateTopCategories(categoryVotes || {});
    const safeTop = topCategories.length ? topCategories : Object.keys(CATEGORIES);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">All Votes Are In!</h2>
            <p className="text-gray-600 dark:text-gray-300">Top categories based on everyone's votes:</p>
          </div>
          <div className="mb-6">
            <div className="space-y-2">
              {Object.entries(voteResults).sort((a,b)=>b[1]-a[1]).map(([categoryKey, count]) => (
                <div key={categoryKey} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center space-x-3">
                    <CategoryPill categoryKey={categoryKey} />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{count} votes</span>
                </div>
              ))}
            </div>
          </div>
          {isHost ? (
            <button
              onClick={async () => {
                if (!sessionCode) return;
                try { playSound('click'); } catch {}
                await updateDoc(doc(db, 'sessions', sessionCode), {
                  gameState: 'categoryPicking',
                  selectedCategories: safeTop,
                  availableCategories: safeTop
                });
                setGameState('categoryPicking');
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
            >
              Start Round 1
            </button>
          ) : <p className="text-gray-500 dark:text-gray-300">Waiting for host…</p>}
        </div>
      </div>
    );
  }

  // Category Picking (Classic)
  if (gameState === 'categoryPicking' && mode === 'classic') {
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.id === myUid;
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{isMyTurn ? 'Your Turn!' : `${currentPlayer?.name}'s Turn`}</h2>
            <p className="text-gray-600 dark:text-gray-300">{isMyTurn ? 'Choose a category' : `${currentPlayer?.name} is choosing…`}</p>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">
              Round {players.length ? Math.floor((turnHistory.length || 0) / players.length) + 1 : 1}
            </p>
          </div>
          {isMyTurn ? (
            <div className="space-y-3">
              {(availableCategories || []).map((k) => (
                <CategoryCard key={k} categoryKey={k} category={CATEGORIES[k]} onClick={() => { try { playSound('click'); } catch {} handleCategoryPicked(k); }} />
              ))}
            </div>
          ) : (
            <div className="text-center">
              <LoadingSpinner size="w-16 h-16" />
              <p className="text-gray-500 dark:text-gray-300 mt-4">Waiting for {currentPlayer?.name}…</p>
            </div>
          )}
          {(usedCategories || []).length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Already Used:</h3>
              <div className="flex flex-wrap gap-2">
                {(usedCategories || []).map((k) => <CategoryPill key={k} categoryKey={k} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Playing (Classic)
  if (gameState === 'playing' && mode === 'classic') {
    const c = CATEGORIES[currentCategory] || {};
    const Icon = iconMap[c.icon] || MessageCircle;
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.id === myUid;
    const canSkip = skipsUsedThisTurn < maxSkipsPerTurn;
    const round = players.length ? Math.floor((turnHistory.length || 0) / players.length) + 1 : 1;
    const turn = players.length ? ((turnHistory.length || 0) % players.length) + 1 : 1;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 mx-auto mb-4"><Icon className="w-6 h-6 text-white" /></div>
            {currentCategory && (
              <div className="mb-4">
                <span className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-gradient-to-r ${c.color || 'from-gray-400 to-gray-500'} text-white text-sm`}>
                  <Icon className="w-3 h-3" /><span>{c.name || currentCategory}</span>
                </span>
              </div>
            )}
            <h2 className="text-lg font-semibold mb-2">{currentPlayer?.name || 'Player'}'s Question</h2>
            <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">Round {round} • Turn {turn} of {players.length || 1}</p>
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
                  className={`w-full py-3 px-6 rounded-xl font-semibold text-lg transition-all flex items-center justify-center ${canSkip ? 'bg-white dark:bg-gray-900 border-2 border-orange-400 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10' : 'bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'}`}
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
              <div className="text-center"><LoadingSpinner /><p className="text-gray-600 dark:text-gray-300 mt-4">Waiting for {currentPlayer?.name || 'player'}…</p></div>
            )}

            <button
              onClick={() => { try { playSound('click'); } catch {} setGameState('waitingRoom'); }}
              className="w-full bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================
     PARTY MODE
  ========================= */
  if (gameState === 'party' && mode === 'party') {
    const amHost = myUid && hostId && myUid === hostId;
    const me = players.find(p=>p.id===myUid);

    // helpers for rendering
    const playerNameById = (pid) => (players.find(p=>p.id===pid)?.name) || '—';
    const submissionsAnon = submissions.map((s, i) => ({ label: String.fromCharCode(65 + i), text: s.text, pid: s.playerId }));

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 p-4 flex items-center justify-center">
        <TopBar /><HelpModal /><NotificationToast />
        <MiniLeaderboard scores={scores} players={players} />

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          {/* Header */}
          <div className="mb-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 dark:bg-gray-700/50 border border-white/30 dark:border-gray-600 text-sm text-white">
              <Swords className="w-4 h-4" /> Party Mode
            </div>
            <h2 className="text-2xl font-bold mt-3 text-gray-900 dark:text-gray-100">
              {partyRoundType === 'superlatives' && 'Superlatives'}
              {partyRoundType === 'fillin' && 'Fill-in the Blank'}
              {partyRoundType === 'nhie' && 'Never Have I Ever'}
            </h2>
            {turnMasterId && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Turn Master: <span className="font-semibold">{playerNameById(turnMasterId)}</span>
              </p>
            )}
          </div>

          {/* PROMPT */}
          {partyPhase === 'prompt' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400">
                <p className="text-lg leading-relaxed">{currentPromptId}</p>
              </div>

              {partyRoundType === 'superlatives' && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Everyone: tap who fits this best on the next screen.
                </div>
              )}

              {partyRoundType === 'fillin' && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Everyone: write a short answer. The Turn Master will pick a winner (anonymous).
                </div>
              )}

              {partyRoundType === 'nhie' && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Tap “I Have” or “I Haven’t”. Lives remaining are shown after each NHIE round.
                </div>
              )}

              <button
                onClick={async () => {
                  try { playSound('click'); } catch {}
                  await updateDoc(doc(db,'sessions',sessionCode), { partyPhase: 'collect' });
                  setPartyPhase('collect');
                }}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Start Round
              </button>
            </div>
          )}

          {/* COLLECT */}
          {partyPhase === 'collect' && (
            <div className="space-y-6">
              {/* Superlatives: pick a player */}
              {partyRoundType === 'superlatives' && (
                <>
                  <p className="text-gray-700 dark:text-gray-200">Vote for who fits this prompt best:</p>
                  <div className="space-y-2">
                    {players.map(p => (
                      <button
                        key={p.id}
                        onClick={() => voteForSuperlative(p.id)}
                        className="w-full p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-left"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  {amHost && (
                    <button
                      onClick={tallyAndAdvanceParty}
                      className="w-full mt-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      Tally Votes
                    </button>
                  )}
                </>
              )}

              {/* Fill-in: anonymous write-ins */}
              {partyRoundType === 'fillin' && (
                <>
                  <FillInEntry onSubmit={submitFillIn} />
                  {amHost && (
                    <button
                      onClick={async () => {
                        // move to results selection screen for Turn Master
                        await updateDoc(doc(db,'sessions',sessionCode), { partyPhase: 'results' });
                        setPartyPhase('results');
                      }}
                      className="w-full mt-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      Reveal Answers
                    </button>
                  )}
                </>
              )}

              {/* NHIE: I Have / I Haven't */}
              {partyRoundType === 'nhie' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={async () => {
                        const sessionRef = doc(db,'sessions',sessionCode);
                        const fresh = (await getDoc(sessionRef)).data() || {};
                        const existing = (fresh.votes || []).filter(v => v.voterId !== myUid);
                        // submissionIndex: 1 = HAVE, 0 = HAVENT
                        const next = [...existing, { voterId: myUid, submissionIndex: 1 }];
                        await updateDoc(sessionRef, { votes: next });
                      }}
                      className="py-3 px-6 rounded-xl font-semibold bg-white dark:bg-gray-900 border-2 border-red-400 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/10 transition"
                    >
                      I Have
                    </button>
                    <button
                      onClick={async () => {
                        const sessionRef = doc(db,'sessions',sessionCode);
                        const fresh = (await getDoc(sessionRef)).data() || {};
                        const existing = (fresh.votes || []).filter(v => v.voterId !== myUid);
                        const next = [...existing, { voterId: myUid, submissionIndex: 0 }];
                        await updateDoc(sessionRef, { votes: next });
                      }}
                      className="py-3 px-6 rounded-xl font-semibold bg-white dark:bg-gray-900 border-2 border-green-400 text-green-600 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/10 transition"
                    >
                      I Haven’t
                    </button>
                  </div>
                  {amHost && (
                    <button
                      onClick={tallyAndAdvanceParty}
                      className="w-full mt-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      Show Results
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* RESULTS */}
          {partyPhase === 'results' && (
            <div className="space-y-6">
              {partyRoundType === 'superlatives' && (
                <>
                  <p className="text-gray-700 dark:text-gray-200">Votes:</p>
                  <div className="space-y-1 text-sm">
                    {players.map(p => {
                      const count = (votes || []).filter(v => v.targetPlayerId === p.id).length;
                      return (
                        <div key={p.id} className="flex items-center justify-between">
                          <span>{p.name}</span><span className="font-semibold">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  {amHost && (
                    <button
                      onClick={continuePartyAfterResults}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      Next Round
                    </button>
                  )}
                </>
              )}

              {partyRoundType === 'fillin' && (
                <>
                  <p className="text-gray-700 dark:text-gray-200">Pick your favorite:</p>
                  <div className="space-y-2">
                    {submissionsAnon.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => voteForFillIn(i)}
                        disabled={turnMasterId !== myUid}
                        className={`w-full p-4 rounded-xl border-2 ${turnMasterId === myUid ? 'hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20' : 'opacity-60 cursor-not-allowed'} border-gray-200 dark:border-gray-600 text-left`}
                      >
                        <span className="font-mono mr-2">{s.label}.</span> {s.text}
                      </button>
                    ))}
                  </div>
                  {amHost && (
                    <button
                      onClick={tallyAndAdvanceParty}
                      className="w-full mt-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      Confirm Winner
                    </button>
                  )}
                </>
              )}

              {partyRoundType === 'nhie' && (
                <>
                  <p className="text-gray-700 dark:text-gray-200">Lives after this round:</p>
                  <div className="space-y-1 text-sm">
                    {players.map(p => (
                      <div key={p.id} className="flex items-center justify-between">
                        <span>{p.name}</span><span className="font-semibold">{(lives || {})[p.id] ?? 10}</span>
                      </div>
                    ))}
                  </div>
                  {amHost && (
                    <button
                      onClick={continuePartyAfterResults}
                      className="w-full mt-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      Next Round
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
     Fallback
  ========================= */
  return null;
}

/* =========================
   Inline components
========================= */
function FillInEntry({ onSubmit }) {
  const [val, setVal] = useState('');
  return (
    <div>
      <textarea
        value={val}
        onChange={(e)=>setVal(e.target.value)}
        placeholder="Write your short answer…"
        rows={3}
        className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-900"
      />
      <button
        onClick={() => { if (val.trim()) { onSubmit(val.trim()); setVal(''); } }}
        className="w-full mt-2 bg-white dark:bg-gray-900 border-2 border-purple-500 text-purple-600 dark:text-purple-300 py-2 px-4 rounded-xl font-semibold hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all"
      >
        Submit
      </button>
    </div>
  );
}
