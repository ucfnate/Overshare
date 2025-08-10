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
  X
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

/* =========================
   Main Component
========================= */
export default function Overshare() {
  /* =========================
     State
  ========================= */
  const [gameState, setGameState] = useState('welcome');
  const [playerName, setPlayerName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [isHost, setIsHost] = useState(false);

  const [players, setPlayers] = useState([]);
  const [surveyAnswers, setSurveyAnswers] = useState({});
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
    () => ({
      Sparkles,
      Heart,
      Lightbulb,
      Target,
      Flame,
      MessageCircle
    }),
    []
  );

  // Fallback categories (used only if import is missing/shape is different)
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

  // Resolve categories regardless of export style (named vs default)
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

  // Are we using the external library?
  const libraryOK = useMemo(() => {
    const usingFallback = CATEGORIES === FALLBACK_CATEGORIES;
    return (typeof getRandomQImport === 'function') && !usingFallback;
  }, [CATEGORIES, FALLBACK_CATEGORIES]);

  // Safe question getter (works even if helper not exported)
  const getQuestion = useCallback(
    (categoryKey, exclude = []) => {
      // Try library first: make a few attempts to avoid repeats
      if (typeof getRandomQImport === 'function') {
        try {
          let tries = 6;
          while (tries-- > 0) {
            const q = getRandomQImport(categoryKey, exclude);
            if (q && !exclude.includes(q)) return q;
          }
        } catch {}
      }

      // Fallback pool with repeat-avoidance
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

  const relationshipOptions = [
    'Romantic partner/spouse',
    'Close friend (know each other well)',
    'Friend (hang out regularly)',
    'Family member',
    'Coworker/colleague',
    "Acquaintance (don't know well)",
    'Just met/new friend'
  ];

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
    showNotification._t = window.setTimeout(() => setNotification(null), 3000);
  };

  /* =========================
     Algorithms (category logic)
  ========================= */
  const calculateGroupIntimacy = (relationships) => {
    if (!relationships || Object.keys(relationships).length === 0) return 2;
    const intimacyMap = {
      'Romantic partner/spouse': 5,
      'Close friend (know each other well)': 4,
      'Friend (hang out regularly)': 3,
      'Family member': 4,
      'Coworker/colleague': 2,
      "Acquaintance (don't know well)": 1,
      'Just met/new friend': 1
    };
    const scores = Object.values(relationships).map((rel) => intimacyMap[rel] || 2);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const getGroupComfortLevel = (list) => {
    if (!list || list.length === 0) return 2;
    const comfortMap = {
      'Light, fun topics that make everyone laugh': 2,
      'Mix of light and meaningful discussions': 3,
      'Deep, personal conversations': 4,
      'Thought-provoking questions about life': 4
    };
    const scores =
      list
        .filter((p) => p?.surveyAnswers?.comfort_level)
        .map((p) => comfortMap[p.surveyAnswers.comfort_level] || 2) || [];
    if (scores.length === 0) return 2;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const recommendCategories = (list, relationships) => {
    const intimacy = calculateGroupIntimacy(relationships);
    const comfort = getGroupComfortLevel(list);
    const groupSize = list?.length || 0;
    const rec = [];
    if (groupSize > 3 || intimacy < 3) rec.push('icebreakers');
    if (groupSize > 2) rec.push('creative');
    if (intimacy >= 3 && comfort >= 3) rec.push('deep_dive');
    if (intimacy >= 4 || (groupSize === 2 && intimacy >= 3)) rec.push('growth');
    if (intimacy >= 4 && comfort >= 4 && groupSize <= 4) rec.push('spicy');
    return rec;
  };

  const generatePersonalizedQuestion = (list, surveyData, relationships, forceCategory = null) => {
    let category = forceCategory;
    if (!category) {
      if ((selectedCategories || []).length === 0) {
        const rec = recommendCategories(list, relationships);
        category = rec[Math.floor(Math.random() * (rec.length || 1))] || 'icebreakers';
      } else {
        category =
          selectedCategories[Math.floor(Math.random() * selectedCategories.length)] ||
          'icebreakers';
      }
    }
    const question = getQuestion(category);
    setCurrentCategory(category);
    return question;
  };

  const calculateTopCategories = (votes) => {
    const byPlayer = votes || {};
    const voteCount = {};
    Object.values(byPlayer).forEach((playerVotes) => {
      (playerVotes || []).forEach((cat) => {
        voteCount[cat] = (voteCount[cat] || 0) + 1;
      });
    });
    const sorted = Object.entries(voteCount).sort((a, b) => b[1] - a[1]).map(([k]) => k);
    return sorted.slice(0, Math.min(4, Math.max(3, sorted.length)));
  };

  /* =========================
     Firestore Session Helpers
  ========================= */
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

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      const sessionRef = doc(db, 'sessions', code);
      let previousPlayerCount = 0;

      const unsubscribe = onSnapshot(
        sessionRef,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() || {};

          const newCount = (data.players || []).length;
          if (previousPlayerCount > 0 && newCount > previousPlayerCount) {
            const newPlayer = (data.players || [])[newCount - 1];
            if (newPlayer && newPlayer.name !== playerName) {
              showNotification(`${newPlayer.name} joined the game!`, '👋');
              try {
                playSound('success');
              } catch {}
            }
          }
          previousPlayerCount = newCount;

          setPlayers([...(data.players || [])]);
          setCurrentQuestion(data.currentQuestion || '');
          setCurrentCategory(data.currentCategory || '');
          setCurrentQuestionAsker(data.currentQuestionAsker || '');
          setSelectedCategories([...(data.selectedCategories || [])]);
          setCurrentTurnIndex(
            typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0
          );
          setAvailableCategories([...(data.availableCategories || [])]);
          setUsedCategories([...(data.usedCategories || [])]);
          setTurnHistory([...(data.turnHistory || [])]);
          setCategoryVotes(data.categoryVotes || {});

          const incomingRaw = data.gameState || 'waitingRoom';
          const incoming = incomingRaw === 'waiting' ? 'waitingRoom' : incomingRaw;

          const incomingTurn =
            typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0;
          if (incomingTurn !== prevTurnIndexRef.current) {
            setSkipsUsedThisTurn(0);
            prevTurnIndexRef.current = incomingTurn;
          }

          if (incoming !== gameState) {
            setGameState(incoming);
            if (incoming === 'playing') {
              try {
                playSound('success');
              } catch {}
            } else if (incoming === 'categoryPicking') {
              try {
                playSound('turnTransition');
              } catch {}
            }
          }
        },
        (error) => {
          console.error('Firebase listener error:', error);
        }
      );

      unsubscribeRef.current = unsubscribe;
      return unsubscribe;
    },
    [db, playerName, gameState]
  );

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      try {
        if (audioCtxRef.current?.close) audioCtxRef.current.close();
      } catch {}
    };
  }, []);

  /* =========================
     Handlers: Survey & Session
  ========================= */
  const handleSurveySubmit = () => {
    if (Object.keys(surveyAnswers).length === initialSurveyQuestions.length) {
      try {
        playSound('success');
      } catch {}
      setGameState('createOrJoin');
    }
  };

  const handleCreateSession = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostPlayer = {
      id: Date.now().toString(),
      name: playerName,
      isHost: true,
      surveyAnswers,
      joinedAt: new Date().toISOString()
    };

    const ok = await createFirebaseSession(code, hostPlayer);
    if (!ok) {
      alert('Failed to create session. Please try again.');
      return;
    }

    setSessionCode(code);
    setIsHost(true);
    setPlayers([hostPlayer]);
    setGameState('waitingRoom');
    try {
      playSound('success');
    } catch {}
    listenToSession(code);
  };

  const handleJoinSession = async () => {
    const code = (sessionCode || '').trim().toUpperCase();
    if (!code) return;

    const sessionRef = doc(db, 'sessions', code);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) {
      alert('Session not found. Please check the code and try again.');
      return;
    }
    const data = sessionSnap.data() || {};

    const alreadyIn = (data.players || []).some((p) => p?.name === playerName);
    if (!alreadyIn) {
      const newPlayer = {
        id: Date.now().toString(),
        name: playerName,
        isHost: false,
        surveyAnswers,
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

    setPlayers([...(data.players || [])]);
    setSelectedCategories([...(data.selectedCategories || [])]);
    setSessionCode(code);

    listenToSession(code);
    setGameState('waitingRoom');
    try {
      playSound('success');
    } catch {}
  };

  /* =========================
     Handlers: Relationship Survey & Voting
  ========================= */
  const handleRelationshipSurveySubmit = async () => {
    if (!sessionCode) return;
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) return;

      const data = sessionSnap.data() || {};
      const updatedPlayers = (data.players || []).map((p) =>
        p?.name === playerName ? { ...p, relationshipAnswers } : p
      );

      await updateDoc(sessionRef, { players: updatedPlayers });

      const allCompleted = updatedPlayers.every((p) => p?.relationshipAnswers);
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
        try {
          playSound('success');
        } catch {}
      } else {
        setGameState('waitingForOthers');
      }
    } catch (err) {
      console.error('Error updating player data:', err);
    }
  };

  const handleCategoryVote = async (selectedCats) => {
    if (!sessionCode) return;
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const sessionSnap = await getDoc(sessionRef);
      if (!sessionSnap.exists()) return;

      const data = sessionSnap.data() || {};
      const currentVotes = { ...(data.categoryVotes || {}) };
      currentVotes[playerName] = selectedCats;

      await updateDoc(sessionRef, { categoryVotes: currentVotes });

      setMyVotedCategories(selectedCats);
      setHasVotedCategories(true);
      try {
        playSound('success');
      } catch {}

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

  /* =========================
     Handlers: Picking / Playing Flow
  ========================= */
  const handleCategoryPicked = async (category) => {
    if (!sessionCode) return;
    try {
      const currentPlayer = players[currentTurnIndex] || players[0];
      if (!currentPlayer) return;

      const question = generatePersonalizedQuestion(
        players,
        surveyAnswers,
        relationshipAnswers,
        category
      );

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
      try {
        playSound('success');
      } catch {}
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
        currentQuestionAsker: ''
      });

      setCurrentTurnIndex(nextTurnIndex);
      setAvailableCategories(newAvailable);
      setUsedCategories(newUsed);
      setCurrentQuestion('');
      setCurrentCategory('');
      setCurrentQuestionAsker('');
      setGameState('categoryPicking');
      setSkipsUsedThisTurn(0);
      try {
        playSound('turnTransition');
      } catch {}
    } catch (err) {
      console.error('Error in handleNextQuestion:', err);
    }
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
        onClick={() => {
          setAudioEnabled((v) => !v);
          try {
            playSound('click');
          } catch {}
        }}
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
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowHelp(false);
        }}
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
            <p>It’s a conversation game — don’t overthink it.</p>
            <p>Take turns asking the group the question on your screen, then pass it to the next player.</p>
            <p>Play it your way: bend rules, make new ones — just have fun.</p>
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
      <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-4 z-50 animate-bounce">
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
          <div
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${
              category?.color || 'from-gray-400 to-gray-500'
            }`}
          >
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

  const PlayerList = ({ players: list, title, showProgress = false, currentPlayerName = null }) => (
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
              if (!playerName.trim()) return;
              setGameState('survey');
              try {
                playSound('click');
              } catch {}
            }}
            disabled={!playerName.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Let's Get Started
          </button>
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Survey
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
              <p className="text-gray-600 dark:text-gray-300">We'll use this to create personalized questions for your group.</p>
            </div>
            <button
              onClick={() => {
                try {
                  playSound('success');
                } catch {}
                handleSurveySubmit();
              }}
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
                  try {
                    playSound('click');
                  } catch {}
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
              onClick={() => {
                try {
                  playSound('click');
                } catch {}
                handleCreateSession();
              }}
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
                onClick={() => {
                  try {
                    playSound('click');
                  } catch {}
                  handleJoinSession();
                }}
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
     Screens: Waiting Room
  ========================= */
  if (gameState === 'waitingRoom') {
    const isNewPlayer = !players.find((p) => p?.name === playerName);

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

          <PlayerList players={players} title="Players" />

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
                      className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r ${
                        category?.color || 'from-gray-400 to-gray-500'
                      } text-white text-sm`}
                    >
                      <IconComponent className="w-4 h-4" />
                      <span>{category?.name || categoryKey}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isNewPlayer && (
            <button
              onClick={async () => {
                try {
                  playSound('click');
                } catch {}
                const newPlayer = {
                  id: Date.now().toString(),
                  name: playerName,
                  isHost: false,
                  surveyAnswers,
                  joinedAt: new Date().toISOString()
                };

                const sessionRef = doc(db, 'sessions', sessionCode);
                const snap = await getDoc(sessionRef);
                if (snap.exists()) {
                  try {
                    await updateDoc(sessionRef, { players: arrayUnion(newPlayer) });
                  } catch {
                    const data = snap.data() || {};
                    const updatedPlayers = [...(data.players || []), newPlayer];
                    await updateDoc(sessionRef, { players: updatedPlayers });
                    setPlayers(updatedPlayers);
                  }
                  try {
                    playSound('success');
                  } catch {}
                }
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all mb-4"
            >
              Join Game
            </button>
          )}

          {isHost && !isNewPlayer && (
            <button
              onClick={async () => {
                if (!sessionCode) return;
                try {
                  playSound('click');
                } catch {}
                await updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'categoryVoting' });
                setGameState('categoryVoting');
              }}
              disabled={players.length < 2}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Game
            </button>
          )}

          {!isHost && !isNewPlayer && (
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
    const recommended = recommendCategories(players, relationshipAnswers);
    const allVotes = Object.values(categoryVotes || {});
    const totalVotes = allVotes.length;
    const waitingFor = (players || [])
      .filter((p) => !(categoryVotes || {})[p?.name])
      .map((p) => p?.name);
    const allPlayersVoted = (players || []).every(
      (p) => (categoryVotes || {})[p?.name] && (categoryVotes || {})[p?.name].length > 0
    );

    const entries = Object.entries(CATEGORIES || {}); // ensure we render something

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
                        try {
                          playSound('click');
                        } catch {}
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
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Your Votes:</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {(myVotedCategories || []).map((categoryKey) => {
                    const category = CATEGORIES[categoryKey];
                    const IconComponent =
                      category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
                    return (
                      <div
                        key={categoryKey}
                        className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r ${
                          category?.color || 'from-gray-400 to-gray-500'
                        } text-white text-sm`}
                      >
                        <IconComponent className="w-4 h-4" />
                        <span>{category?.name || categoryKey}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {allPlayersVoted && isHost ? (
                <div className="space-y-3">
                  <p className="text-center text-gray-600 dark:text-gray-300 mb-4">All players have voted!</p>
                  <button
                    onClick={async () => {
                      if (!sessionCode) return;
                      try {
                        playSound('click');
                      } catch {}
                      await updateDoc(doc(db, 'sessions', sessionCode), {
                        gameState: 'waitingForHost'
                      });
                      setGameState('waitingForHost');
                    }}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
                  >
                    View Results & Start Game
                  </button>
                </div>
              ) : waitingFor.length > 0 ? (
                <div className="text-center">
                  <LoadingSpinner size="w-16 h-16" />
                  <p className="text-gray-600 dark:text-gray-300 mb-2 mt-4">Waiting for:</p>
                  <p className="text-sm text-gray-500 dark:text-gray-300">{waitingFor.join(', ')}</p>

                  {isHost && (
                    <button
                      onClick={async () => {
                        if (!sessionCode) return;
                        try {
                          playSound('click');
                        } catch {}
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
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-300">All players have voted!</p>
                  {!isHost && (
                    <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">Waiting for host to start the game...</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Waiting For Host (DARK MODE FIXED)
  ========================= */
  if (gameState === 'waitingForHost') {
    const voteResults = {};
    Object.values(categoryVotes || {}).forEach((votes) => {
      (votes || []).forEach((cat) => {
        voteResults[cat] = (voteResults[cat] || 0) + 1;
      });
    });
    const topCategories = calculateTopCategories(categoryVotes || {});

    const recommendedFallback = recommendCategories(players, relationshipAnswers);
    const safeTop =
      (topCategories && topCategories.length > 0)
        ? topCategories
        : (recommendedFallback && recommendedFallback.length > 0)
          ? recommendedFallback
          : Object.keys(CATEGORIES);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">All Votes Are In!</h2>
            <p className="text-gray-600 dark:text-gray-300">Top categories based on everyone's votes:</p>
          </div>

          <div className="mb-6">
            <div className="space-y-2">
              {Object.entries(voteResults)
                .sort((a, b) => b[1] - a[1])
                .map(([categoryKey, voteCount]) => {
                  const category = CATEGORIES[categoryKey];
                  const IconComponent =
                    category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
                  const isSelected = (safeTop || []).includes(categoryKey);
                  return (
                    <div
                      key={categoryKey}
                      className={`flex items-center justify-between p-3 rounded-xl border ${isSelected
                        ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-500/50'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${
                            category?.color || 'from-gray-400 to-gray-500'
                          }`}
                        >
                          <IconComponent className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium">{category?.name || categoryKey}</span>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">{voteCount} votes</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {isHost ? (
            <button
              onClick={async () => {
                if (!sessionCode) return;
                try {
                  playSound('click');
                } catch {}
                await updateDoc(doc(db, 'sessions', sessionCode), {
                  gameState: 'relationshipSurvey',
                  selectedCategories: safeTop,
                  availableCategories: safeTop
                });
                setGameState('relationshipSurvey');
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
            >
              Let's See How You Know Each Other
            </button>
          ) : (
            <p className="text-gray-500 dark:text-gray-300">
              Waiting for {players.find((p) => p?.isHost)?.name || 'host'} to continue...
            </p>
          )}
        </div>
      </div>
    );
  }

  /* =========================
     Screens: Relationship Survey
  ========================= */
  if (gameState === 'relationshipSurvey') {
    const currentPlayerIndex = Object.keys(relationshipAnswers || {}).length;
    const otherPlayers = (players || []).filter((p) => p?.name !== playerName);
    const currentPlayer = otherPlayers[currentPlayerIndex];

    if (currentPlayerIndex >= otherPlayers.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <TopBar />
          <HelpModal />
          <NotificationToast />
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="mb-6">
              <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Great!</h2>
              <p className="text-gray-600 dark:text-gray-300">Now let's choose what types of questions you want to explore.</p>
            </div>
            <button
              onClick={() => {
                try {
                  playSound('success');
                } catch {}
                handleRelationshipSurveySubmit();
              }}
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
                Player {currentPlayerIndex + 1} of {otherPlayers.length}
              </span>
              <ProgressIndicator current={currentPlayerIndex + 1} total={otherPlayers.length} className="w-16" />
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
                  try {
                    playSound('click');
                  } catch {}
                  if (!currentPlayer?.name) return;
                  setRelationshipAnswers((prev) => ({ ...prev, [currentPlayer.name]: option }));
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
            <p className="text-gray-600 dark:text-gray-300">Waiting for others to complete their surveys...</p>
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
    const isMyTurn = currentPlayer?.name === playerName;

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
                <h2 className="text-2xl font-bold mb-2">{currentPlayer?.name}'s Turn</h2>
                <p className="text-gray-600 dark:text-gray-300">{currentPlayer?.name} is choosing a category...</p>
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
                      onClick={() => {
                        try {
                          playSound('click');
                        } catch {}
                        handleCategoryPicked(categoryKey);
                      }}
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
              <p className="text-gray-500 dark:text-gray-300 mt-4">Waiting for {currentPlayer?.name} to choose...</p>
            </div>
          )}

          {(usedCategories || []).length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Already Used:</h3>
              <div className="flex flex-wrap gap-2">
                {(usedCategories || []).map((categoryKey) => {
                  const category = CATEGORIES[categoryKey];
                  return (
                    <span
                      key={categoryKey}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
                    >
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
     Screens: Playing (CRASH FIXED)
  ========================= */
  if (gameState === 'playing') {
    const currentCategoryData = CATEGORIES[currentCategory] || null; // fixed
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
                <span
                  className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-gradient-to-r ${currentCategoryData.color} text-white text-sm`}
                >
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
                  <span className="ml-2 text-sm">
                    ({skipsUsedThisTurn}/{maxSkipsPerTurn})
                  </span>
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
                  Waiting for {currentPlayer?.name || 'player'} to finish their turn...
                </p>
              </div>
            )}

            <button
              onClick={() => {
                try {
                  playSound('click');
                } catch {}
                setGameState('waitingRoom');
              }}
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
     Fallback
  ========================= */
  return null;
}
