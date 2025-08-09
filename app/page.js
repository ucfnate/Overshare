'use client';

/**
 * Overshare - App Router page
 * Stable build with guarded state transitions, resilient Firestore listener,
 * and minimal UI helpers (Top bar + Help modal).
 * 
 * Keep external module paths exactly as requested:
 *   - ../lib/firebase
 *   - ../lib/questionCategories
 */

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
  serverTimestamp
} from 'firebase/firestore';
import { questionCategories, getRandomQuestion } from '../lib/questionCategories';

/* =====================================================================================
 * 1) ROOT COMPONENT
 * =====================================================================================*/
export default function Overshare() {
  /* --------------------------------------------------------------------------
   * 1A) STATE
   * --------------------------------------------------------------------------*/
  const [gameState, setGameState] = useState<'welcome' | 'survey' | 'createOrJoin' | 'waitingRoom' | 'categoryVoting' | 'waitingForHost' | 'relationshipSurvey' | 'waitingForOthers' | 'categoryPicking' | 'playing'>('welcome');
  const [playerName, setPlayerName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [isHost, setIsHost] = useState(false);

  const [players, setPlayers] = useState<any[]>([]);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
  const [relationshipAnswers, setRelationshipAnswers] = useState<Record<string, string>>({});

  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentCategory, setCurrentCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [usedCategories, setUsedCategories] = useState<string[]>([]);
  const [turnHistory, setTurnHistory] = useState<any[]>([]);
  const [currentQuestionAsker, setCurrentQuestionAsker] = useState('');
  const [categoryVotes, setCategoryVotes] = useState<Record<string, string[]>>({});
  const [myVotedCategories, setMyVotedCategories] = useState<string[]>([]);
  const [hasVotedCategories, setHasVotedCategories] = useState(false);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [skipsUsedThisTurn, setSkipsUsedThisTurn] = useState(0);
  const [notification, setNotification] = useState<{ message: string; emoji?: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const maxSkipsPerTurn = 1;

  /* --------------------------------------------------------------------------
   * 1B) REFS & CONSTANTS
   * --------------------------------------------------------------------------*/
  const unsubscribeRef = useRef<null | (() => void)>(null);
  const prevTurnIndexRef = useRef(0);

  // icon mapping used across category cards
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

  // initial 4-question onboarding survey
  const initialSurveyQuestions = useMemo(
    () => [
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
    ],
    []
  );

  const relationshipOptions = useMemo(
    () => [
      'Romantic partner/spouse',
      'Close friend (know each other well)',
      'Friend (hang out regularly)',
      'Family member',
      'Coworker/colleague',
      "Acquaintance (don't know well)",
      'Just met/new friend'
    ],
    []
  );

  /* --------------------------------------------------------------------------
   * 1C) AUDIO (safe, no-crash)
   * --------------------------------------------------------------------------*/
  const getAudioContext = () => {
    if (!audioEnabled) return null;
    if (typeof window === 'undefined') return null;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      // keep a weak singleton per page instance
      if (!(window as any).__overshare_audio__) {
        (window as any).__overshare_audio__ = new Ctx();
      }
      return (window as any).__overshare_audio__ as AudioContext;
    } catch {
      return null;
    }
  };

  const playSound = (type: 'click' | 'success' | 'turnTransition') => {
    const audio = getAudioContext();
    if (!audio) return;

    const tone = (seq: (osc: OscillatorNode, gain: GainNode, t0: number) => void) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.connect(gain);
      gain.connect(audio.destination);
      gain.gain.setValueAtTime(0.1, audio.currentTime);
      seq(osc, gain, audio.currentTime);
      osc.start();
    };

    const sounds: Record<string, () => void> = {
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

  /* --------------------------------------------------------------------------
   * 1D) NOTIFICATIONS
   * --------------------------------------------------------------------------*/
  const showNotification = (message: string, emoji = '🎉') => {
    setNotification({ message, emoji });
    // simple auto-dismiss
    window.setTimeout(() => setNotification(null), 3000);
  };

  /* --------------------------------------------------------------------------
   * 1E) RECOMMENDATION & QUESTION GENERATION
   * --------------------------------------------------------------------------*/
  const calculateGroupIntimacy = (relationships: Record<string, string>) => {
    if (!relationships || Object.keys(relationships).length === 0) return 2;
    const map: Record<string, number> = {
      'Romantic partner/spouse': 5,
      'Close friend (know each other well)': 4,
      'Friend (hang out regularly)': 3,
      'Family member': 4,
      'Coworker/colleague': 2,
      "Acquaintance (don't know well)": 1,
      'Just met/new friend': 1
    };
    const scores = Object.values(relationships).map((rel) => map[rel] ?? 2);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const getGroupComfortLevel = (groupPlayers: any[]) => {
    if (!groupPlayers || groupPlayers.length === 0) return 2;
    const map: Record<string, number> = {
      'Light, fun topics that make everyone laugh': 2,
      'Mix of light and meaningful discussions': 3,
      'Deep, personal conversations': 4,
      'Thought-provoking questions about life': 4
    };
    const scores = groupPlayers
      .filter((p) => p?.surveyAnswers?.comfort_level)
      .map((p) => map[p.surveyAnswers.comfort_level] ?? 2);
    if (scores.length === 0) return 2;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const recommendCategories = (groupPlayers: any[], relationships: Record<string, string>) => {
    const intimacy = calculateGroupIntimacy(relationships);
    const comfort = getGroupComfortLevel(groupPlayers);
    const size = groupPlayers.length;
    const out: string[] = [];

    if (size > 3 || intimacy < 3) out.push('icebreakers');
    if (size > 2) out.push('creative');
    if (intimacy >= 3 && comfort >= 3) out.push('deep_dive');
    if (intimacy >= 4 || (size === 2 && intimacy >= 3)) out.push('growth');
    if (intimacy >= 4 && comfort >= 4 && size <= 4) out.push('spicy');

    return out;
  };

  const generatePersonalizedQuestion = (
    groupPlayers: any[],
    _survey: Record<string, string>,
    relationships: Record<string, string>,
    forceCategory: string | null = null
  ) => {
    let category = forceCategory || '';
    if (!category) {
      if (selectedCategories.length === 0) {
        const rec = recommendCategories(groupPlayers, relationships);
        category = rec[Math.floor(Math.random() * Math.max(rec.length, 1))] || 'icebreakers';
      } else {
        category = selectedCategories[Math.floor(Math.random() * selectedCategories.length)];
      }
    }
    const q = getRandomQuestion(category);
    setCurrentCategory(category);
    return q;
  };

  const calculateTopCategories = (votes: Record<string, string[]>) => {
    const counts: Record<string, number> = {};
    Object.values(votes || {}).forEach((arr) => {
      (arr || []).forEach((c) => {
        counts[c] = (counts[c] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c)
      .slice(0, 4);
  };

  /* --------------------------------------------------------------------------
   * 1F) FIRESTORE HELPERS (stable/guarded)
   * --------------------------------------------------------------------------*/
  const createFirebaseSession = async (code: string, hostPlayer: any) => {
    try {
      // Start sessions in waitingRoom so the UI has a valid state immediately
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
    } catch (e) {
      console.error('createFirebaseSession error', e);
      return false;
    }
  };

  const attachSessionListener = useCallback(
    (code: string) => {
      if (!code) return () => {};

      // cleanup previous
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      const ref = doc(db, 'sessions', code);
      let prevCount = 0;

      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as any;

          // Join notifications
          const count = (data.players || []).length;
          if (prevCount > 0 && count > prevCount) {
            const newPlayer = (data.players || [])[count - 1];
            if (newPlayer && newPlayer.name && newPlayer.name !== playerName) {
              showNotification(`${newPlayer.name} joined the game!`, '👋');
              try {
                playSound('success');
              } catch {}
            }
          }
          prevCount = count;

          // Set state from canonical snapshot (defensive spreads)
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

          // Reset skips on authoritative turn change
          const incomingTurn = typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0;
          if (incomingTurn !== prevTurnIndexRef.current) {
            setSkipsUsedThisTurn(0);
            prevTurnIndexRef.current = incomingTurn;
          }

          // State transitions with audio
          if (data.gameState && data.gameState !== gameState) {
            setGameState(data.gameState);
            try {
              if (data.gameState === 'playing') playSound('success');
              else if (data.gameState === 'categoryPicking') playSound('turnTransition');
            } catch {}
          }
        },
        (err) => console.error('onSnapshot error', err)
      );

      unsubscribeRef.current = unsub;
      return unsub;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, playerName, gameState]
  );

  // detach listener on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  /* --------------------------------------------------------------------------
   * 1G) LOCAL PERSISTENCE (resume on refresh)
   * --------------------------------------------------------------------------*/
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = JSON.parse(window.localStorage.getItem('overshare__client') || '{}');
      if (cached?.playerName) setPlayerName(cached.playerName);
      if (cached?.sessionCode) setSessionCode(cached.sessionCode);
      if (cached?.isHost) setIsHost(!!cached.isHost);

      // If we have session + name, try to reattach
      if (cached?.sessionCode) {
        attachSessionListener(cached.sessionCode);
        setGameState('waitingRoom');
      }
    } catch {}
  }, [attachSessionListener]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({ playerName, sessionCode, isHost });
    try {
      window.localStorage.setItem('overshare__client', payload);
    } catch {}
  }, [playerName, sessionCode, isHost]);

  /* --------------------------------------------------------------------------
   * 1H) EVENT HANDLERS
   * --------------------------------------------------------------------------*/
  const handleSurveySubmit = () => {
    if (Object.keys(surveyAnswers).length === initialSurveyQuestions.length) {
      try {
        playSound('success');
      } catch {}
      setGameState('createOrJoin');
    }
  };

  const handleCreateSession = async () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const hostPlayer = {
      id: Date.now().toString(),
      name: playerName.trim(),
      isHost: true,
      surveyAnswers,
      joinedAt: new Date().toISOString()
    };

    const ok = await createFirebaseSession(code, hostPlayer);
    if (!ok) return alert('Failed to create session. Please try again.');

    setSessionCode(code);
    setIsHost(true);
    setPlayers([hostPlayer]);
    setGameState('waitingRoom');
    try {
      playSound('success');
    } catch {}

    attachSessionListener(code);
  };

  const addPlayerUniqByName = async (code: string, newPlayer: any) => {
    const sref = doc(db, 'sessions', code);
    const snap = await getDoc(sref);
    if (!snap.exists()) return false;
    const data = snap.data() as any;
    const existing = (data.players || []);
    const exists = existing.some((p: any) => (p?.name || '').toLowerCase() === (newPlayer?.name || '').toLowerCase());
    if (exists) return true;
    const updated = [...existing, newPlayer];
    await updateDoc(sref, { players: updated });
    return true;
  };

  const handleJoinSession = async () => {
    const code = (sessionCode || '').trim().toUpperCase();
    if (!code) return;

    const sref = doc(db, 'sessions', code);
    const snap = await getDoc(sref);
    if (!snap.exists()) return alert('Session not found. Please check the code and try again.');

    const newPlayer = {
      id: Date.now().toString(),
      name: playerName.trim(),
      isHost: false,
      surveyAnswers,
      joinedAt: new Date().toISOString()
    };

    try {
      await addPlayerUniqByName(code, newPlayer);
    } catch (e) {
      console.error('Join session error', e);
    }

    setSessionCode(code);
    setIsHost(false);
    setGameState('waitingRoom');
    try {
      playSound('success');
    } catch {}

    attachSessionListener(code);
  };

  const handleRelationshipSurveySubmit = async () => {
    try {
      const sref = doc(db, 'sessions', sessionCode);
      const snap = await getDoc(sref);
      if (!snap.exists()) return;
      const data = snap.data() as any;

      const updatedPlayers = (data.players || []).map((p: any) =>
        p.name === playerName ? { ...p, relationshipAnswers } : p
      );

      await updateDoc(sref, { players: updatedPlayers });

      const done = updatedPlayers.every((p: any) => p.relationshipAnswers);
      if (done) {
        const top = data.selectedCategories || [];
        await updateDoc(sref, {
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
    } catch (e) {
      console.error('relationship submit error', e);
    }
  };

  const handleCategoryVote = async (selectedCats: string[]) => {
    try {
      const sref = doc(db, 'sessions', sessionCode);
      const snap = await getDoc(sref);
      if (!snap.exists()) return;
      const data = snap.data() as any;

      const current = data.categoryVotes || {};
      current[playerName] = selectedCats;

      await updateDoc(sref, { categoryVotes: current });

      setMyVotedCategories(selectedCats);
      setHasVotedCategories(true);
      try {
        playSound('success');
      } catch {}

      const everyone = (data.players || []).every(
        (p: any) => current[p.name] && current[p.name].length > 0
      );
      if (everyone) {
        await updateDoc(sref, { gameState: 'waitingForHost' });
        setGameState('waitingForHost');
      }
    } catch (e) {
      console.error('vote error', e);
    }
  };

  const handleCategoryPicked = async (category: string) => {
    try {
      const asker = players[currentTurnIndex] || players[0];
      if (!asker) return;
      const question = generatePersonalizedQuestion(players, surveyAnswers, relationshipAnswers, category);

      const newUsed = [...usedCategories, category];
      const newAvail = availableCategories.filter((c) => c !== category);
      const newTurns = [...turnHistory, { player: asker.name, category, question }];

      await updateDoc(doc(db, 'sessions', sessionCode), {
        currentQuestion: question,
        currentCategory: category,
        gameState: 'playing',
        usedCategories: newUsed,
        availableCategories: newAvail,
        turnHistory: newTurns,
        currentQuestionAsker: asker.name
      });

      setCurrentQuestion(question);
      setCurrentCategory(category);
      setCurrentQuestionAsker(asker.name);
      setUsedCategories(newUsed);
      setAvailableCategories(newAvail);
      setTurnHistory(newTurns);
      setGameState('playing');
      try {
        playSound('success');
      } catch {}
    } catch (e) {
      console.error('pick category error', e);
    }
  };

  const handleSkipQuestion = async () => {
    if (skipsUsedThisTurn >= maxSkipsPerTurn) {
      showNotification("You've used your skip for this turn!", '⏭️');
      return;
    }
    try {
      const q = generatePersonalizedQuestion(players, surveyAnswers, relationshipAnswers, currentCategory);
      await updateDoc(doc(db, 'sessions', sessionCode), { currentQuestion: q });
      setCurrentQuestion(q);
      setSkipsUsedThisTurn((n) => n + 1);
      try {
        playSound('click');
      } catch {}
    } catch (e) {
      console.error('skip error', e);
    }
  };

  const handleNextQuestion = async () => {
    try {
      const count = players.length || 1;
      const nextIdx = (currentTurnIndex + 1) % count;

      let newAvail = [...availableCategories];
      let newUsed = [...usedCategories];
      if (newAvail.length === 0) {
        newAvail = [...selectedCategories];
        newUsed = [];
      }

      await updateDoc(doc(db, 'sessions', sessionCode), {
        gameState: 'categoryPicking',
        currentTurnIndex: nextIdx,
        availableCategories: newAvail,
        usedCategories: newUsed,
        currentQuestion: '',
        currentCategory: '',
        currentQuestionAsker: ''
      });

      setCurrentTurnIndex(nextIdx);
      setAvailableCategories(newAvail);
      setUsedCategories(newUsed);
      setCurrentQuestion('');
      setCurrentCategory('');
      setCurrentQuestionAsker('');
      setGameState('categoryPicking');
      setSkipsUsedThisTurn(0);
      try {
        playSound('turnTransition');
      } catch {}
    } catch (e) {
      console.error('next question error', e);
    }
  };

  /* =====================================================================================
   * 2) UI SUBCOMPONENTS
   * =====================================================================================*/
  const TopBar = () => (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <button
        onClick={() => {
          setAudioEnabled((v) => !v);
          try {
            playSound('click');
          } catch {}
        }}
        className="bg-white/20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 transition-all"
        aria-label={audioEnabled ? 'Disable sound' : 'Enable sound'}
        title={audioEnabled ? 'Sound: on' : 'Sound: off'}
      >
        {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>
      <button
        onClick={() => setShowHelp(true)}
        className="bg-white/20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 transition-all"
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
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 relative">
          <button
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            onClick={() => setShowHelp(false)}
            aria-label="Close help"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800">How to Play Overshare</h3>
          </div>

          <div className="space-y-3 text-gray-700">
            <p>It’s a conversation game — don’t overthink it.</p>
            <p>Take turns asking the group the question on your screen, then pass it to the next player.</p>
            <p>Play it your way: bend rules, make new ones — just have fun.</p>
            <p className="text-sm text-gray-500">Pro tip: the more you share, the better the stories get.</p>
          </div>

          <div className="mt-6 border-t pt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">Enjoying the game?</span>
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
      <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50 animate-bounce">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{notification.emoji}</span>
          <span className="font-medium text-gray-800">{notification.message}</span>
        </div>
      </div>
    );
  };

  const ProgressIndicator = ({ current, total, className = '' }: { current: number; total: number; className?: string }) => (
    <div className={`w-full h-2 bg-gray-200 rounded-full ${className}`}>
      <div
        className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
        style={{ width: `${total ? (current / total) * 100 : 0}%` }}
      />
    </div>
  );

  const CategoryCard = ({
    categoryKey,
    category,
    isSelected,
    isRecommended,
    onClick,
    disabled = false
  }: {
    categoryKey: string;
    category: any;
    isSelected: boolean;
    isRecommended: boolean;
    onClick: () => void;
    disabled?: boolean;
  }) => {
    const IconComponent = category && iconMap[category.icon] ? (iconMap as any)[category.icon] : MessageCircle;
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
          isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
      >
        <div className="flex items-start space-x-3">
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category?.color || 'from-gray-400 to-gray-500'}`}>
            <IconComponent className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-800">{category?.name || 'Category'}</h3>
              {isRecommended && <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">Recommended</span>}
            </div>
            <p className="text-sm text-gray-600 mt-1">{category?.description || ''}</p>
          </div>
        </div>
      </button>
    );
  };

  const PlayerList = ({
    players,
    title,
    showProgress = false,
    currentPlayerName = null
  }: {
    players: any[];
    title: string;
    showProgress?: boolean;
    currentPlayerName?: string | null;
  }) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        {title} ({players.length})
      </h3>
      <div className="space-y-2">
        {players.map((player, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-3 bg-gray-50 rounded-xl ${
              currentPlayerName === player.name ? 'ring-2 ring-purple-500 bg-purple-50' : ''
            }`}
          >
            <span className="font-medium">{player.name}</span>
            <div className="flex items-center space-x-2">
              {player.isHost && (
                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">Host</span>
              )}
              {showProgress && player.relationshipAnswers && (
                <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">✓</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const LoadingSpinner = ({ size = 'w-8 h-8' }: { size?: string }) => (
    <div className="inline-flex items-center justify-center">
      <div className={`${size} border-4 border-purple-500 border-t-transparent rounded-full animate-spin`} />
    </div>
  );

  /* =====================================================================================
   * 3) SCREENS
   * =====================================================================================*/

  // 3A) Welcome
  if (gameState === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Overshare</h1>
            <p className="text-gray-600">Personalized conversation games that bring people closer together</p>
          </div>

          <div className="mb-6">
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg bg-white text-gray-900"
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

  // 3B) Survey
  if (gameState === 'survey') {
    const idx = Object.keys(surveyAnswers).length;
    const q = initialSurveyQuestions[idx];

    if (idx >= initialSurveyQuestions.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <TopBar />
          <HelpModal />
          <NotificationToast />
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="mb-6">
              <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Perfect, {playerName}!</h2>
              <p className="text-gray-600">We'll use this to create personalized questions for your group.</p>
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
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">
                Question {idx + 1} of {initialSurveyQuestions.length}
              </span>
              <ProgressIndicator current={idx + 1} total={initialSurveyQuestions.length} className="w-16" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">{q.question}</h2>
          </div>

          <div className="space-y-3">
            {q.options.map((option: string, i: number) => (
              <button
                key={i}
                onClick={() => {
                  try {
                    playSound('click');
                  } catch {}
                  setSurveyAnswers((s) => ({ ...s, [q.id]: option }));
                }}
                className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3C) Create or Join
  if (gameState === 'createOrJoin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Ready to play, {playerName}!</h2>

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
              <div className="flex-1 h-px bg-gray-300" />
              <span className="px-4 text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Enter session code"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg font-mono bg-white text-gray-900"
              />
              <button
                onClick={() => {
                  try {
                    playSound('click');
                  } catch {}
                  handleJoinSession();
                }}
                disabled={!sessionCode.trim()}
                className="w-full bg-white border-2 border-purple-500 text-purple-500 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3D) Waiting Room
  if (gameState === 'waitingRoom') {
    const isNewPlayer = !players.find((p: any) => p.name === playerName);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Session {sessionCode}</h2>
            <p className="text-gray-600">Share this code with others to join</p>
          </div>

          <PlayerList players={players} title="Players" />

          {selectedCategories.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Question Categories</h3>
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map((key) => {
                  const cat = (questionCategories as any)[key];
                  const Icon = cat && iconMap[cat.icon] ? (iconMap as any)[cat.icon] : MessageCircle;
                  return (
                    <div
                      key={key}
                      className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r ${cat?.color || 'from-gray-400 to-gray-500'} text-white text-sm`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{cat?.name || key}</span>
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
                const sref = doc(db, 'sessions', sessionCode);
                const snap = await getDoc(sref);
                if (!snap.exists()) return;
                const newPlayer = {
                  id: Date.now().toString(),
                  name: playerName.trim(),
                  isHost: false,
                  surveyAnswers,
                  joinedAt: new Date().toISOString()
                };
                try {
                  await addPlayerUniqByName(sessionCode, newPlayer);
                  try {
                    playSound('success');
                  } catch {}
                } catch (e) {
                  console.error('waitingRoom join error', e);
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

          {!isHost && !isNewPlayer && <p className="text-gray-500">Waiting for host to continue...</p>}
        </div>
      </div>
    );
  }

  // 3E) Category Voting
  if (gameState === 'categoryVoting') {
    const recommended = recommendCategories(players as any[], relationshipAnswers);
    const waitingFor = players.filter((p: any) => !(categoryVotes || {})[p.name]).map((p: any) => p.name);
    const allPlayersVoted = players.every(
      (p: any) => (categoryVotes || {})[p.name] && (categoryVotes || {})[p.name].length > 0
    );
    const allVotes = Object.values(categoryVotes || {});
    const totalVotes = allVotes.length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {hasVotedCategories ? 'Waiting for Others' : 'Vote for Categories'}
            </h2>
            <p className="text-gray-600">
              {hasVotedCategories
                ? `${totalVotes} of ${players.length} players have voted`
                : "Select 2-3 categories you'd like to play with"}
            </p>
            {hasVotedCategories && <p className="text-sm text-gray-500 mt-2">Session Code: {sessionCode}</p>}
          </div>

          {!hasVotedCategories ? (
            <>
              <div className="space-y-3 mb-6">
                {Object.entries(questionCategories as any).map(([key, cat]: [string, any]) => {
                  const isRecommended = recommended.includes(key);
                  const isSelected = selectedCategories.includes(key);
                  const disabled = !isSelected && selectedCategories.length >= 3;
                  return (
                    <CategoryCard
                      key={key}
                      categoryKey={key}
                      category={cat}
                      isSelected={isSelected}
                      isRecommended={isRecommended}
                      disabled={disabled}
                      onClick={() => {
                        try {
                          playSound('click');
                        } catch {}
                        setSelectedCategories((list) =>
                          isSelected ? list.filter((c) => c !== key) : list.length < 3 ? [...list, key] : list
                        );
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
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Your Votes:</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {myVotedCategories.map((key) => {
                    const cat = (questionCategories as any)[key];
                    const Icon = cat && iconMap[cat.icon] ? (iconMap as any)[cat.icon] : MessageCircle;
                    return (
                      <div
                        key={key}
                        className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r ${
                          cat?.color || 'from-gray-400 to-gray-500'
                        } text-white text-sm`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{cat?.name || key}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {allPlayersVoted && isHost ? (
                <div className="space-y-3">
                  <p className="text-center text-gray-600 mb-4">All players have voted!</p>
                  <button
                    onClick={async () => {
                      try {
                        playSound('click');
                      } catch {}
                      await updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'waitingForHost' });
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
                  <p className="text-gray-600 mb-2 mt-4">Waiting for:</p>
                  <p className="text-sm text-gray-500">{waitingFor.join(', ')}</p>

                  {isHost && (
                    <button
                      onClick={async () => {
                        try {
                          playSound('click');
                        } catch {}
                        await updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'waitingForHost' });
                        setGameState('waitingForHost');
                      }}
                      className="mt-4 text-sm text-purple-600 hover:text-purple-700 underline"
                    >
                      Continue without waiting
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-600">All players have voted!</p>
                  {!isHost && <p className="text-sm text-gray-500 mt-2">Waiting for host to start the game...</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3F) Waiting for Host (vote results)
  if (gameState === 'waitingForHost') {
    const results: Record<string, number> = {};
    Object.values(categoryVotes || {}).forEach((votes) => {
      (votes || []).forEach((cat) => {
        results[cat] = (results[cat] || 0) + 1;
      });
    });
    const top = calculateTopCategories(categoryVotes || {});

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">All Votes Are In!</h2>
            <p className="text-gray-600">Top categories based on everyone's votes:</p>
          </div>

          <div className="mb-6">
            <div className="space-y-2">
              {Object.entries(results)
                .sort((a, b) => b[1] - a[1])
                .map(([key, count]) => {
                  const cat = (questionCategories as any)[key];
                  const Icon = cat && iconMap[cat.icon] ? (iconMap as any)[cat.icon] : MessageCircle;
                  const isPicked = top.includes(key);
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        isPicked ? 'bg-purple-50 border-2 border-purple-300' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${cat?.color || 'from-gray-400 to-gray-500'}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium text-gray-800">{cat?.name || key}</span>
                      </div>
                      <span className="text-sm text-gray-600">{count} votes</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {isHost ? (
            <button
              onClick={async () => {
                try {
                  playSound('click');
                } catch {}
                await updateDoc(doc(db, 'sessions', sessionCode), {
                  gameState: 'relationshipSurvey',
                  selectedCategories: top,
                  availableCategories: top
                });
                setGameState('relationshipSurvey');
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
            >
              Let's See How You Know Each Other
            </button>
          ) : (
            <p className="text-gray-500">
              Waiting for {players.find((p: any) => p.isHost)?.name || 'host'} to continue...
            </p>
          )}
        </div>
      </div>
    );
  }

  // 3G) Relationship Survey
  if (gameState === 'relationshipSurvey') {
    const idx = Object.keys(relationshipAnswers).length;
    const others = players.filter((p: any) => p.name !== playerName);
    const current = others[idx];

    if (idx >= others.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <TopBar />
          <HelpModal />
          <NotificationToast />
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="mb-6">
              <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Great!</h2>
              <p className="text-gray-600">Now let's choose what types of questions you want to explore.</p>
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
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">
                Player {idx + 1} of {others.length}
              </span>
              <ProgressIndicator current={idx + 1} total={others.length} className="w-16" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">How are you connected to {current?.name}?</h2>
            <p className="text-gray-600 text-sm">This helps us create better questions for your group.</p>
          </div>

          <div className="space-y-3">
            {relationshipOptions.map((option, i) => (
              <button
                key={i}
                onClick={() => {
                  try {
                    playSound('click');
                  } catch {}
                  setRelationshipAnswers((s) => ({ ...s, [current.name]: option }));
                }}
                className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3H) Waiting for Others
  if (gameState === 'waitingForOthers') {
    const done = players.filter((p: any) => p.relationshipAnswers).length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Thanks!</h2>
            <p className="text-gray-600">Waiting for others to complete their surveys...</p>
          </div>

          <div className="mb-4">
            <p className="text-lg text-gray-700">
              {done} of {players.length} completed
            </p>
          </div>

          <div className="text-center">
            <LoadingSpinner size="w-16 h-16" />
          </div>
        </div>
      </div>
    );
  }

  // 3I) Category Picking
  if (gameState === 'categoryPicking') {
    const current = players[currentTurnIndex] || players[0];
    const isMine = current?.name === playerName;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            {isMine ? (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Turn!</h2>
                <p className="text-gray-600">Choose a category for the next question</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{current?.name}'s Turn</h2>
                <p className="text-gray-600">{current?.name} is choosing a category...</p>
              </>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Round {players.length ? Math.floor((turnHistory.length || 0) / players.length) + 1 : 1}
            </p>
          </div>

          {isMine ? (
            <div className="space-y-3">
              {availableCategories.length > 0 ? (
                availableCategories.map((key) => {
                  const cat = (questionCategories as any)[key];
                  return (
                    <CategoryCard
                      key={key}
                      categoryKey={key}
                      category={cat}
                      isSelected={false}
                      isRecommended={false}
                      onClick={() => {
                        try {
                          playSound('click');
                        } catch {}
                        handleCategoryPicked(key);
                      }}
                    />
                  );
                })
              ) : (
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <p className="text-gray-600">All categories have been used! Categories will reset for the next round.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <LoadingSpinner size="w-16 h-16" />
              <p className="text-gray-500 mt-4">Waiting for {current?.name} to choose...</p>
            </div>
          )}

          {usedCategories.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Already Used:</h3>
              <div className="flex flex-wrap gap-2">
                {usedCategories.map((key) => {
                  const cat = (questionCategories as any)[key];
                  return (
                    <span key={key} className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">
                      {cat?.name || key}
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

  // 3J) Playing
  if (gameState === 'playing') {
    const cat = (questionCategories as any)[currentCategory];
    const Icon = cat && iconMap[cat.icon] ? (iconMap as any)[cat.icon] : MessageCircle;
    const current = players[currentTurnIndex] || players[0];
    const mine = current?.name === playerName;
    const canSkip = skipsUsedThisTurn < maxSkipsPerTurn;

    const round = players.length ? Math.floor((turnHistory.length || 0) / players.length) + 1 : 1;
    const turn = players.length ? ((turnHistory.length || 0) % players.length) + 1 : 1;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar />
        <HelpModal />
        <NotificationToast />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 mx-auto mb-4">
              <Icon className="w-6 h-6 text-white" />
            </div>

            {cat && (
              <div className="mb-4">
                <span className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-gradient-to-r ${cat.color} text-white text-sm`}>
                  <Icon className="w-3 h-3" />
                  <span>{cat.name}</span>
                </span>
              </div>
            )}

            <h2 className="text-lg font-semibold text-gray-800 mb-2">{current?.name || 'Player'}'s Question</h2>
            <p className="text-sm text-gray-500 mb-4">
              Round {round} • Turn {turn} of {players.length || 1}
            </p>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border-l-4 border-purple-500">
              <p className="text-gray-800 text-lg leading-relaxed">{currentQuestion}</p>
            </div>
          </div>

          <div className="space-y-4">
            {mine ? (
              <>
                <button
                  onClick={handleSkipQuestion}
                  disabled={!canSkip}
                  className={`w-full py-3 px-6 rounded-xl font-semibold text-lg transition-all flex items-center justify-center ${
                    canSkip
                      ? 'bg-white border-2 border-orange-400 text-orange-600 hover:bg-orange-50'
                      : 'bg-gray-200 border-2 border-gray-300 text-gray-400 cursor-not-allowed'
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
                <p className="text-gray-600 mt-4">Waiting for {current?.name || 'player'} to finish their turn...</p>
              </div>
            )}

            <button
              onClick={() => {
                try {
                  playSound('click');
                } catch {}
                setGameState('waitingRoom');
              }}
              className="w-full bg-white border-2 border-gray-300 text-gray-600 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-all"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================================================
   * 4) NEVER-BLANK FALLBACK
   * =====================================================================================*/
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-6 text-white">
      <TopBar />
      <HelpModal />
      <div className="text-center">
        <LoadingSpinner size="w-12 h-12" />
        <p className="mt-4 opacity-90">Loading…</p>
      </div>
    </div>
  );
}
