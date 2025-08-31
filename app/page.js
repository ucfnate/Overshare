'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users, MessageCircle, Heart, Sparkles, Lightbulb, Target, Flame,
  Volume2, VolumeX, SkipForward, HelpCircle, X, Crown, Trophy, Check, Loader2
} from 'lucide-react';

import { db } from '../lib/firebase';
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot,
  serverTimestamp, arrayUnion
} from 'firebase/firestore';

import {
  questionCategories as qcImport,
  getRandomQuestion as getRandomQImport
} from '../lib/questionCategories';

import { superlativesPrompts, getRandomSuperlative } from '../lib/superlatives';
import { fillInPrompts, getRandomFillIn } from '../lib/fillin';
import { nhiePrompts, getRandomNHIE } from '../lib/nhie';

/* =========================================================
   Helpers (icons, library resolution, little utils)
========================================================= */
const iconMap = { Sparkles, Heart, Lightbulb, Target, Flame, MessageCircle };

function classNames(...xs) { return xs.filter(Boolean).join(' '); }
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/* =========================================================
   Component
========================================================= */
export default function Overshare() {
  /* ----------------------------
     Core state (shared)
  ---------------------------- */
  const [gameState, setGameState] = useState('welcome'); // welcome → playChoice → solo | createOrJoin | waitingRoom | classic… | party
  const [playerName, setPlayerName] = useState('');
  const [myId] = useState(uid());
  const [sessionCode, setSessionCode] = useState('');
  const [isHost, setIsHost] = useState(false);

  // players, categories, classic
  const [players, setPlayers] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [usedCategories, setUsedCategories] = useState([]);
  const [turnHistory, setTurnHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentCategory, setCurrentCategory] = useState('');
  const [currentQuestionAsker, setCurrentQuestionAsker] = useState('');

  // voting (classic)
  const [categoryVotes, setCategoryVotes] = useState({});
  const [myVotedCategories, setMyVotedCategories] = useState([]);
  const [hasVotedCategories, setHasVotedCategories] = useState(false);

  // audio / toasts
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [notification, setNotification] = useState(null);
  const audioCtxRef = useRef(null);

  // skips (classic)
  const [skipsUsedThisTurn, setSkipsUsedThisTurn] = useState(0);
  const maxSkipsPerTurn = 1;

  // modal
  const [showHelp, setShowHelp] = useState(false);

  // firebase listener
  const unsubscribeRef = useRef(null);
  const prevTurnIndexRef = useRef(0);

  /* ----------------------------
     Party Mode state
  ---------------------------- */
  const [mode, setMode] = useState(null); // null | 'classic' | 'party'
  const [partyRound, setPartyRound] = useState(0); // increments each round
  const [partyRoundType, setPartyRoundType] = useState(null); // 'fillin' | 'nhie' | 'superlatives'
  const [partyPhase, setPartyPhase] = useState(null); // 'prep' | 'collect' | 'guess' | 'results'
  const [partyPrompt, setPartyPrompt] = useState('');
  const [turnMasterId, setTurnMasterId] = useState(null); // player.id in control
  const [submissions, setSubmissions] = useState([]); // fill-in answers [{playerId, text}]
  const [fillDone, setFillDone] = useState({}); // map playerId -> boolean
  const [superVotes, setSuperVotes] = useState({}); // map voterId -> targetId
  const [nhieAnswers, setNhieAnswers] = useState({}); // map playerId -> boolean
  const [nhieGuesses, setNhieGuesses] = useState({}); // map playerId -> boolean
  const [scores, setScores] = useState({}); // map playerId -> number
  const [announcement, setAnnouncement] = useState(null);

  // local-only helper for NHIE guess building
  const [guessDraft, setGuessDraft] = useState({}); // {playerId: true/false}

  // Solo (Quickstart) local-only
  const [soloCategory, setSoloCategory] = useState(null);
  const [soloQuestion, setSoloQuestion] = useState('');
  const [soloHistory, setSoloHistory] = useState([]);

  /* ----------------------------
     Category fallback & library
  ---------------------------- */
  const FALLBACK_CATEGORIES = useMemo(
    () => ({
      icebreakers: { name: 'Icebreakers', description: 'Warm up with easy, fun prompts.', icon: 'Sparkles', color: 'from-purple-500 to-pink-500' },
      creative: { name: 'Creative', description: 'Imagine, riff, and get playful.', icon: 'Lightbulb', color: 'from-indigo-500 to-purple-500' },
      deep_dive: { name: 'Deep Dive', description: 'Thoughtful questions with heart.', icon: 'MessageCircle', color: 'from-blue-500 to-cyan-500' },
      growth: { name: 'Growth', description: 'Reflect, learn, and level up.', icon: 'Target', color: 'from-emerald-500 to-teal-500' },
      spicy: { name: 'Spicy', description: 'Bold prompts for brave groups.', icon: 'Flame', color: 'from-orange-500 to-red-500' },
    }),
    []
  );

  const CATEGORIES = useMemo(() => {
    const raw = qcImport && typeof qcImport === 'object'
      ? (qcImport.default && typeof qcImport.default === 'object' ? qcImport.default : qcImport)
      : {};
    return Object.keys(raw || {}).length ? raw : FALLBACK_CATEGORIES;
  }, [FALLBACK_CATEGORIES]);

  const libraryOK = useMemo(() => {
    const usingFallback = CATEGORIES === FALLBACK_CATEGORIES;
    return (typeof getRandomQImport === 'function') && !usingFallback;
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
    const fallbackQs = {
      icebreakers: ['What was a small win you had this week?', 'What’s your go-to fun fact about yourself?'],
      creative: ['Invent a wild holiday and describe how we celebrate it.', 'Merge two movies into one plot — what happens?'],
      deep_dive: ['What belief of yours has changed in the last few years?', 'What’s a memory that shaped who you are?'],
      growth: ['What habit are you trying to build?', 'What’s a risk you’re glad you took?'],
      spicy: ['What’s a “hot take” you stand by?', 'What’s a topic you wish people were more honest about?']
    };
    const pool = fallbackQs[categoryKey] || fallbackQs.icebreakers;
    let tries = 8;
    let q = pool[Math.floor(Math.random() * pool.length)];
    while (exclude.includes(q) && tries-- > 0) q = pool[Math.floor(Math.random() * pool.length)];
    return q;
  }, []);

  /* ----------------------------
     Audio + toasts
  ---------------------------- */
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
      seq(osc, gain, audio.currentTime);
      osc.start();
    };
    const sounds = {
      click: () => tone((o, g, t) => { o.frequency.setValueAtTime(760, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.08); o.stop(t + 0.08); }),
      success: () => tone((o, g, t) => { o.frequency.setValueAtTime(523, t); o.frequency.setValueAtTime(659, t + 0.1); g.gain.exponentialRampToValueAtTime(0.01, t + 0.22); o.stop(t + 0.22); }),
      turn: () => tone((o, g, t) => { o.frequency.setValueAtTime(440, t); o.frequency.setValueAtTime(554, t + 0.15); g.gain.exponentialRampToValueAtTime(0.01, t + 0.3); o.stop(t + 0.3); })
    };
    if (sounds[type]) sounds[type]();
  };
  const showNotification = (message, emoji = '🎉') => {
    setNotification({ message, emoji });
    window.clearTimeout(showNotification._t || 0);
    showNotification._t = window.setTimeout(() => setNotification(null), 3000);
  };

  /* ----------------------------
     Firestore helpers
  ---------------------------- */
  const createFirebaseSession = async (code, hostPlayer) => {
    try {
      await setDoc(doc(db, 'sessions', code), {
        hostId: hostPlayer.id,
        players: [hostPlayer],
        gameState: 'waitingRoom',
        mode: null, // 'classic' | 'party'
        selectedCategories: [],
        currentQuestion: '',
        currentCategory: '',
        currentQuestionAsker: '',
        currentTurnIndex: 0,
        availableCategories: [],
        usedCategories: [],
        turnHistory: [],
        categoryVotes: {},

        // party block
        partyRound: 0,
        partyRoundType: null,
        partyPhase: null,
        partyPrompt: '',
        turnMasterId: hostPlayer.id,
        submissions: [],
        fillDone: {},
        superVotes: {},
        nhieAnswers: {},
        nhieGuesses: {},
        scores: {},
        announcement: null,

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
    if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }

    const sessionRef = doc(db, 'sessions', code);
    let previousPlayerCount = 0;

    const unsubscribe = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};

      // player join ping
      const newCount = (d.players || []).length;
      if (previousPlayerCount > 0 && newCount > previousPlayerCount) {
        const newPlayer = (d.players || [])[newCount - 1];
        if (newPlayer && newPlayer.name !== playerName) {
          showNotification(`${newPlayer.name} joined the game!`, '👋');
          playSound('success');
        }
      }
      previousPlayerCount = newCount;

      // classic fields
      setPlayers([...(d.players || [])]);
      setSelectedCategories([...(d.selectedCategories || [])]);
      setCurrentQuestion(d.currentQuestion || '');
      setCurrentCategory(d.currentCategory || '');
      setCurrentQuestionAsker(d.currentQuestionAsker || '');
      setCurrentTurnIndex(typeof d.currentTurnIndex === 'number' ? d.currentTurnIndex : 0);
      setAvailableCategories([...(d.availableCategories || [])]);
      setUsedCategories([...(d.usedCategories || [])]);
      setTurnHistory([...(d.turnHistory || [])]);
      setCategoryVotes(d.categoryVotes || {});

      // mode + state
      setMode(d.mode || null);
      setGameState(d.gameState || 'waitingRoom');

      // party block
      setPartyRound(d.partyRound || 0);
      setPartyRoundType(d.partyRoundType || null);
      setPartyPhase(d.partyPhase || null);
      setPartyPrompt(d.partyPrompt || '');
      setTurnMasterId(d.turnMasterId || null);
      setSubmissions([...(d.submissions || [])]);
      setFillDone({ ...(d.fillDone || {}) });
      setSuperVotes({ ...(d.superVotes || {}) });
      setNhieAnswers({ ...(d.nhieAnswers || {}) });
      setNhieGuesses({ ...(d.nhieGuesses || {}) });
      setScores({ ...(d.scores || {}) });
      setAnnouncement(d.announcement || null);

      // reset per-turn skip count when index changes
      const incomingTurn = typeof d.currentTurnIndex === 'number' ? d.currentTurnIndex : 0;
      if (incomingTurn !== prevTurnIndexRef.current) {
        setSkipsUsedThisTurn(0);
        prevTurnIndexRef.current = incomingTurn;
      }
    }, (err) => console.error('listener error:', err));

    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, [playerName]);

  useEffect(() => () => {
    if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
    try { audioCtxRef.current?.close?.(); } catch {}
  }, []);

  /* ----------------------------
     Classic handlers (unchanged vibe)
  ---------------------------- */
  const handleCreateSession = async () => {
    if (!playerName.trim()) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostPlayer = {
      id: myId,
      name: playerName,
      isHost: true,
      joinedAt: new Date().toISOString()
    };
    const ok = await createFirebaseSession(code, hostPlayer);
    if (!ok) { alert('Failed to create session. Please try again.'); return; }
    setSessionCode(code); setIsHost(true); setPlayers([hostPlayer]); setGameState('waitingRoom');
    listenToSession(code); playSound('success');
  };

  const handleJoinSession = async () => {
    if (!playerName.trim()) return;
    const code = (sessionCode || '').trim().toUpperCase();
    if (!code) return;

    const sessionRef = doc(db, 'sessions', code);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) { alert('Session not found.'); return; }

    const d = snap.data() || {};
    const exists = (d.players || []).some(p => p?.id === myId || p?.name === playerName);
    if (!exists) {
      const newPlayer = { id: myId, name: playerName, isHost: false, joinedAt: new Date().toISOString() };
      try { await updateDoc(sessionRef, { players: arrayUnion(newPlayer) }); }
      catch {
        const fresh = (await getDoc(sessionRef)).data() || {};
        await updateDoc(sessionRef, { players: [...(fresh.players || []), newPlayer] });
      }
    }
    setIsHost(false); setSessionCode(code); setGameState('waitingRoom');
    listenToSession(code); playSound('success');
  };

  // Classic voting & flow kept from your last good build
  const calculateTopCategories = (votes) => {
    const vc = {};
    Object.values(votes || {}).forEach(list => (list || []).forEach(cat => vc[cat] = (vc[cat] || 0) + 1));
    return Object.entries(vc).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 4);
  };

  const handleCategoryVote = async (selectedCats) => {
    if (!sessionCode) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const snap = await getDoc(sessionRef); if (!snap.exists()) return;
    const d = snap.data() || {};
    const currentVotes = { ...(d.categoryVotes || {}) };
    currentVotes[playerName] = selectedCats;
    await updateDoc(sessionRef, { categoryVotes: currentVotes });
    setMyVotedCategories(selectedCats); setHasVotedCategories(true); playSound('success');

    const list = d.players || [];
    if (list.length > 1) {
      const allPlayersVoted = list.every(p => (currentVotes[p?.name] || []).length > 0);
      if (allPlayersVoted) { await updateDoc(sessionRef, { gameState: 'waitingForHost' }); setGameState('waitingForHost'); }
    }
  };

  const handleCategoryPicked = async (category) => {
    if (!sessionCode) return;
    const currentPlayer = players[currentTurnIndex] || players[0];
    const question = getQuestion(category);

    const newUsed = [...usedCategories, category];
    const newAvail = (availableCategories || []).filter(c => c !== category);
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

    setCurrentQuestion(question); setCurrentCategory(category); setCurrentQuestionAsker(currentPlayer.name);
    setUsedCategories(newUsed); setAvailableCategories(newAvail); setTurnHistory(newHistory);
    setGameState('playing'); playSound('success');
  };

  const handleSkipQuestion = async () => {
    if (skipsUsedThisTurn >= maxSkipsPerTurn || !sessionCode) { showNotification("You've used your skip for this turn!", '⏭️'); return; }
    const forcedCategory = currentCategory || (turnHistory.at(-1)?.category) || (selectedCategories[0]) || 'icebreakers';
    const newQuestion = getQuestion(forcedCategory, [currentQuestion]);
    await updateDoc(doc(db, 'sessions', sessionCode), {
      currentQuestion: newQuestion, currentCategory: forcedCategory
    });
    setCurrentQuestion(newQuestion); setCurrentCategory(forcedCategory);
    setSkipsUsedThisTurn(n => n + 1); playSound('click');
  };

  const handleNextQuestion = async () => {
    if (!sessionCode) return;
    const count = players.length || 0; if (!count) return;
    const nextTurnIndex = (currentTurnIndex + 1) % count;

    let newAvailable = availableCategories, newUsed = usedCategories;
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

    setCurrentTurnIndex(nextTurnIndex); setAvailableCategories(newAvailable); setUsedCategories(newUsed);
    setCurrentQuestion(''); setCurrentCategory(''); setCurrentQuestionAsker('');
    setGameState('categoryPicking'); setSkipsUsedThisTurn(0); playSound('turn');
  };

  /* ----------------------------
     Party Mode helpers
  ---------------------------- */
  const getPlayerById = (id) => (players || []).find(p => p.id === id);
  const isTurnMaster = turnMasterId === myId;

  // ratio 1:1:1 across [fillin, nhie, super]
  const nextPartyTypeFromRound = (r) => (['fillin', 'nhie', 'superlatives'][r % 3]);

  const startPartyMode = async () => {
    if (!sessionCode) return;
    const firstTM = (players || [])[0]?.id || myId;
    // initialize scores for everyone
    const initScores = {};
    (players || []).forEach(p => { initScores[p.id] = 0; });

    await updateDoc(doc(db, 'sessions', sessionCode), {
      mode: 'party',
      gameState: 'party',
      partyRound: 0,
      scores: initScores,
      turnMasterId: firstTM,
      announcement: null
    });
    await startNextPartyPrompt(true);
  };

  const startNextPartyPrompt = async (first = false) => {
    if (!sessionCode) return;
    // decide type
    const snap = await getDoc(doc(db, 'sessions', sessionCode));
    const d = snap.data() || {};
    const round = (d.partyRound || 0) + (first ? 0 : 1);
    const type = nextPartyTypeFromRound(round);

    let prompt = '';
    if (type === 'fillin') prompt = getRandomFillIn(new Set());
    else if (type === 'nhie') prompt = getRandomNHIE(new Set());
    else prompt = getRandomSuperlative(new Set());

    await updateDoc(doc(db, 'sessions', sessionCode), {
      gameState: 'party',
      mode: 'party',
      partyRound: round,
      partyRoundType: type,
      partyPhase: 'prep',
      partyPrompt: prompt,
      submissions: [],
      fillDone: {},
      superVotes: {},
      nhieAnswers: {},
      nhieGuesses: {},
      announcement: null
    });
  };

  const partyStartCollect = async () => {
    if (!sessionCode || !isTurnMaster) return;
    await updateDoc(doc(db, 'sessions', sessionCode), { partyPhase: 'collect' });
  };

  /* ----- FILL-IN: submit answers (2 max), done flag, pick favorite ----- */
  const mySubmitCount = useMemo(
    () => (submissions || []).filter(s => s.playerId === myId).length,
    [submissions, myId]
  );
  const canSubmitMore = mySubmitCount < 2;

  const submitFillInAnswer = async (text) => {
    if (!sessionCode) return;
    if (turnMasterId === myId) return; // TM cannot submit/earn
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    if (!canSubmitMore) return;

    const sessionRef = doc(db, 'sessions', sessionCode);
    const fresh = (await getDoc(sessionRef)).data() || {};
    const newSubs = [...(fresh.submissions || []), { playerId: myId, text: trimmed }];
    const newFillDone = { ...(fresh.fillDone || {}) };
    const myCount = newSubs.filter(s => s.playerId === myId).length;
    if (myCount >= 2) newFillDone[myId] = true;

    await updateDoc(sessionRef, { submissions: newSubs, fillDone: newFillDone });
  };

  const markFillInDone = async () => {
    if (!sessionCode) return;
    if (turnMasterId === myId) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const fresh = (await getDoc(sessionRef)).data() || {};
    const newFillDone = { ...(fresh.fillDone || {}) };
    newFillDone[myId] = true;

    // if all non-TM players done, advance to results
    const nonTM = (fresh.players || []).filter(p => p.id !== fresh.turnMasterId);
    const allDone = nonTM.every(p => newFillDone[p.id]);
    await updateDoc(sessionRef, {
      fillDone: newFillDone,
      ...(allDone ? { partyPhase: 'results' } : {})
    });
  };

  const voteForFillIn = async (submissionIndex) => {
    if (!sessionCode || !isTurnMaster) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const fresh = (await getDoc(sessionRef)).data() || {};
    const subs = fresh.submissions || [];
    const winner = subs[submissionIndex]; if (!winner) return;

    const nextScores = { ...(fresh.scores || {}) };
    nextScores[winner.playerId] = (nextScores[winner.playerId] || 0) + 1;

    await updateDoc(sessionRef, {
      scores: nextScores,
      turnMasterId: winner.playerId,
      announcement: {
        ts: Date.now(),
        message: `${(fresh.players || []).find(p => p.id === winner.playerId)?.name || 'Someone'} won that round!`,
        emoji: '✨'
      }
    });
    await startNextPartyPrompt();
  };

  /* ----- NHIE: players answer; TM guesses; score both sides on correct ----- */
  useEffect(() => {
    if (mode === 'party' && partyRoundType === 'nhie' && partyPhase === 'guess') {
      setGuessDraft({});
    }
  }, [mode, partyRoundType, partyPhase]);

  const submitNhieAnswer = async (hasDone) => {
    if (!sessionCode) return;
    if (turnMasterId === myId) return; // TM does not answer here
    const sessionRef = doc(db, 'sessions', sessionCode);
    const fresh = (await getDoc(sessionRef)).data() || {};
    const curr = { ...(fresh.nhieAnswers || {}) };
    curr[myId] = !!hasDone;

    const nonTM = (fresh.players || []).filter(p => p.id !== fresh.turnMasterId);
    const allAnswered = nonTM.every(p => curr.hasOwnProperty(p.id));

    await updateDoc(sessionRef, {
      nhieAnswers: curr,
      ...(allAnswered ? { partyPhase: 'guess' } : {})
    });
  };

  const submitNhieGuesses = async () => {
    if (!sessionCode || !isTurnMaster) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const fresh = (await getDoc(sessionRef)).data() || {};
    const answers = fresh.nhieAnswers || {};
    const guesses = { ...guessDraft };

    // scoring: +1 to TM for each correct; +1 to each correctly-guessed player
    const nextScores = { ...(fresh.scores || {}) };
    let tmPoints = 0;
    (fresh.players || []).forEach(p => {
      if (p.id === fresh.turnMasterId) return;
      if (guesses.hasOwnProperty(p.id) && answers.hasOwnProperty(p.id) && guesses[p.id] === answers[p.id]) {
        tmPoints += 1;
        nextScores[p.id] = (nextScores[p.id] || 0) + 1;
      }
    });
    nextScores[fresh.turnMasterId] = (nextScores[fresh.turnMasterId] || 0) + tmPoints;

    // rotate TM to next player in order
    const idx = (fresh.players || []).findIndex(p => p.id === fresh.turnMasterId);
    const nextIdx = ((idx + 1) % (fresh.players || []).length);
    const nextTM = (fresh.players || [])[nextIdx]?.id || fresh.turnMasterId;

    await updateDoc(sessionRef, {
      scores: nextScores,
      nhieGuesses: guesses,
      announcement: {
        ts: Date.now(),
        message: `NHIE round done: ${getPlayerById(fresh.turnMasterId)?.name || 'Guesser'} got ${tmPoints} right.`,
        emoji: '✅'
      },
      turnMasterId: nextTM
    });
    await startNextPartyPrompt();
  };

  /* ----- SUPERLATIVES: everyone votes; tie = new superlative until single winner ----- */
  const submitSuperVote = async (targetPlayerId) => {
    if (!sessionCode) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const fresh = (await getDoc(sessionRef)).data() || {};
    const votes = { ...(fresh.superVotes || {}) };
    votes[myId] = targetPlayerId;

    const allVoted = (fresh.players || []).every(p => votes[p.id]);
    if (!allVoted) {
      await updateDoc(sessionRef, { superVotes: votes });
      return;
    }

    // tally
    const tally = {};
    Object.values(votes).forEach(pid => { tally[pid] = (tally[pid] || 0) + 1; });
    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const [topId, topCount] = entries[0] || [];
    const isTie = entries.length > 1 && entries[1][1] === topCount;

    if (isTie || !topId) {
      // tie-breaker: new prompt, clear votes
      await updateDoc(sessionRef, {
        partyPrompt: getRandomSuperlative(new Set()),
        superVotes: {},
        announcement: { ts: Date.now(), message: 'Tie! New superlative for tie-breaker.', emoji: '🔁' }
      });
      return;
    }

    // single winner
    const nextScores = { ...(fresh.scores || {}) };
    nextScores[topId] = (nextScores[topId] || 0) + 1;

    // rotate TM to next in order
    const idx = (fresh.players || []).findIndex(p => p.id === fresh.turnMasterId);
    const nextIdx = ((idx + 1) % (fresh.players || []).length);
    const nextTM = (fresh.players || [])[nextIdx]?.id || fresh.turnMasterId;

    await updateDoc(sessionRef, {
      scores: nextScores,
      superVotes: votes,
      announcement: { ts: Date.now(), message: `${getPlayerById(topId)?.name || 'Someone'} won Superlatives!`, emoji: '🏅' },
      turnMasterId: nextTM
    });
    await startNextPartyPrompt();
  };

  /* ----------------------------
     Solo Quickstart (local)
  ---------------------------- */
  const soloPick = (catKey) => {
    const q = getQuestion(catKey, soloHistory);
    setSoloCategory(catKey); setSoloQuestion(q); setSoloHistory(h => [...h, q]);
  };
  const soloSkip = () => {
    if (!soloCategory) return;
    const q = getQuestion(soloCategory, soloHistory);
    setSoloQuestion(q); setSoloHistory(h => [...h, q]);
    playSound('click');
  };

  /* =========================================================
     UI bits
  ========================================================= */
  const TopBar = () => (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <span
        title={libraryOK ? 'Using external question library' : 'Using built-in fallback questions'}
        className={classNames(
          'hidden sm:inline-flex px-2 py-1 rounded-lg text-xs font-medium',
          libraryOK ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'
        )}
      >
        {libraryOK ? 'Library' : 'Fallback'}
      </span>
      <button
        onClick={() => { setAudioEnabled(v => !v); playSound('click'); }}
        className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-all"
        title={audioEnabled ? 'Sound: on' : 'Sound: off'}
      >
        {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>
      <button
        onClick={() => setShowHelp(true)}
        className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-all"
        title="Help"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  );

  const HelpModal = () => showHelp ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-2xl p-6 relative">
        <button className="absolute top-3 right-3 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
                onClick={() => setShowHelp(false)} aria-label="Close help">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-semibold">How to Play Overshare</h3>
        </div>
        <div className="space-y-3 text-gray-700 dark:text-gray-200">
          <p>Party Mode: rotating mini-games; earn points; top 3 leaderboard.</p>
          <p>Classic Mode: conversation questions, take turns, no scoring.</p>
          <p>Solo Quickstart: pick a category, get a question, skip if you want.</p>
        </div>
      </div>
    </div>
  ) : null;

  const NotificationToast = () => notification ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-4 z-50 animate-bounce">
      <div className="flex items-center space-x-2">
        <span className="text-2xl">{notification.emoji}</span>
        <span className="font-medium text-gray-800 dark:text-gray-100">{notification.message}</span>
      </div>
    </div>
  ) : null;

  const ProgressIndicator = ({ current, total, className = '' }) => (
    <div className={classNames('w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full', className)}>
      <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
           style={{ width: `${total ? Math.min(100, Math.max(0, (current / total) * 100)) : 0}%` }} />
    </div>
  );

  const CategoryPill = ({ categoryKey }) => {
    const category = CATEGORIES[categoryKey];
    const Icon = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
    return (
      <span className={classNames('inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r text-white text-sm',
        category?.color || 'from-gray-400 to-gray-500')}>
        <Icon className="w-4 h-4" />
        <span>{category?.name || categoryKey}</span>
      </span>
    );
  };

  const PlayerBadge = ({ pId }) => (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      {getPlayerById(pId)?.name || 'Player'}
    </span>
  );

  const Leaderboard = () => {
    const entries = Object.entries(scores || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, 3);
    if (!entries.length) return null;
    return (
      <div className="rounded-xl bg-white/70 dark:bg-gray-800/70 p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-amber-500" /><span className="text-sm font-semibold">Leaderboard</span>
        </div>
        <div className="space-y-1">
          {entries.map(([pid, sc], idx) => (
            <div key={pid} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-5 text-center">{idx + 1}.</span>
                <span>{getPlayerById(pid)?.name || 'Player'}</span>
              </div>
              <span className="font-semibold">{sc || 0}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* =========================================================
     Screens
  ========================================================= */

  /* ----- Welcome ----- */
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
            <p className="text-gray-600 dark:text-gray-300">Personalized conversation games that bring people closer</p>
          </div>
          <input
            type="text" placeholder="Enter your name"
            value={playerName} onChange={(e) => setPlayerName(e.target.value)}
            className="w-full p-3 mb-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={() => { if (!playerName.trim()) return; setGameState('playChoice'); playSound('click'); }}
            disabled={!playerName.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  /* ----- Play Choice (Solo or Multiplayer) ----- */
  if (gameState === 'playChoice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold mb-2">How do you want to play today?</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Choose Quickstart (solo) or set up a multiplayer lobby.</p>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => { setGameState('solo'); setSoloCategory(null); setSoloQuestion(''); setSoloHistory([]); playSound('click'); }}
              className="w-full border-2 border-purple-500 text-purple-600 dark:text-purple-300 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all"
            >
              Quickstart (Solo)
            </button>
            <button
              onClick={() => { setGameState('createOrJoin'); playSound('click'); }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center"
            >
              <Users className="w-5 h-5 mr-2" /> Multiplayer Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ----- Solo Quickstart ----- */
  if (gameState === 'solo') {
    const entries = Object.entries(CATEGORIES || {});
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-4 text-center">
            <h2 className="text-2xl font-bold mb-2">Solo Mode</h2>
            <p className="text-gray-600 dark:text-gray-300">Pick a category and get a question. Don’t like it? Skip.</p>
          </div>
          {!soloCategory ? (
            <div className="space-y-2">
              {entries.map(([key, cat]) => {
                const Icon = cat && iconMap[cat.icon] ? iconMap[cat.icon] : MessageCircle;
                return (
                  <button key={key}
                          className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-purple-400 hover:shadow transition text-left"
                          onClick={() => soloPick(key)}>
                    <div className="flex items-start gap-3">
                      <div className={classNames('inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r', cat?.color || 'from-gray-400 to-gray-500')}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold">{cat?.name || key}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">{cat?.description || ''}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="mb-4 text-center">
                <CategoryPill categoryKey={soloCategory} />
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400 mb-4">
                <p className="text-lg leading-relaxed">{soloQuestion}</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={soloSkip}
                  className="w-full bg-white dark:bg-gray-900 border-2 border-orange-400 text-orange-600 dark:text-orange-300 py-3 px-6 rounded-xl font-semibold hover:bg-orange-50 dark:hover:bg-orange-900/10 transition"
                >
                  Skip Question
                </button>
                <button
                  onClick={() => { setSoloCategory(null); setSoloQuestion(''); }}
                  className="w-full bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  Choose Another Category
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ----- Create / Join (Multiplayer) ----- */
  if (gameState === 'createOrJoin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold mb-6">Ready to play, {playerName}!</h2>
          <div className="space-y-4">
            <button onClick={() => { playSound('click'); handleCreateSession(); }}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center">
              <Users className="w-5 h-5 mr-2" /> Create Game
            </button>
            <div className="flex items-center my-2">
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
              <span className="px-4 text-gray-500 dark:text-gray-300 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="space-y-3">
              <input
                type="text" placeholder="Enter session code"
                value={sessionCode} onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={() => { playSound('click'); handleJoinSession(); }}
                disabled={!sessionCode.trim()}
                className="w-full bg-white dark:bg-gray-900 border-2 border-purple-500 text-purple-600 dark:text-purple-300 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all disabled:opacity-50"
              >
                Join Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ----- Waiting Room (mode select here) ----- */
  if (gameState === 'waitingRoom') {
    const canParty = (players || []).length >= 3;
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-1">Session {sessionCode}</h2>
            <p className="text-gray-600 dark:text-gray-300">Share this code so others can join</p>
          </div>
          <div className="mb-4 space-y-2 text-left">
            {(players || []).map(p => (
              <div key={p.id} className={classNames(
                'flex items-center justify-between p-3 rounded-xl',
                p.isHost ? 'bg-purple-50 dark:bg-purple-900/30' : 'bg-gray-50 dark:bg-gray-700'
              )}>
                <span className="font-medium">{p.name}</span>
                {p.isHost && <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200">Host</span>}
              </div>
            ))}
          </div>

          {isHost ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">Choose a mode:</p>
              <button
                onClick={async () => {
                  await updateDoc(doc(db, 'sessions', sessionCode), { mode: 'classic', gameState: 'categoryVoting' });
                  setMode('classic'); setGameState('categoryVoting'); playSound('click');
                }}
                className="w-full border-2 border-purple-500 text-purple-600 dark:text-purple-300 py-3 px-6 rounded-xl font-semibold hover:bg-purple-50 dark:hover:bg-purple-900/10 transition"
              >
                Classic (conversation)
              </button>
              <button
                disabled={!canParty}
                onClick={async () => { await startPartyMode(); playSound('click'); }}
                className={classNames(
                  'w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition',
                  !canParty && 'opacity-50 cursor-not-allowed'
                )}
              >
                Party Mode { !canParty && '(need 3+ players)' }
              </button>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-300">Waiting for {players.find(p => p.isHost)?.name || 'host'} to choose a mode…</p>
          )}
        </div>
      </div>
    );
  }

  /* ----- Category Voting (Classic) ----- */
  if (gameState === 'categoryVoting') {
    const entries = Object.entries(CATEGORIES || {});
    const allVotes = Object.values(categoryVotes || {});
    const totalVotes = allVotes.length;
    const waitingFor = (players || []).filter(p => !(categoryVotes || {})[p?.name]).map(p => p?.name);
    const allPlayersVoted = (players || []).every(p => (categoryVotes || {})[p?.name] && (categoryVotes || {})[p?.name].length > 0);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {hasVotedCategories ? 'Waiting for Others' : 'Vote for Categories'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {hasVotedCategories ? `${totalVotes} of ${players.length} players have voted`
                : "Select 2-3 categories you'd like to play with"}
            </p>
          </div>

          {!hasVotedCategories ? (
            <>
              <div className="space-y-3 mb-6">
                {entries.map(([key, category]) => {
                  const Icon = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
                  const isSelected = (selectedCategories || []).includes(key);
                  const disabled = !isSelected && (selectedCategories || []).length >= 3;
                  return (
                    <button key={key}
                            onClick={() => {
                              playSound('click');
                              setSelectedCategories(prev => (prev.includes(key) ? prev.filter(c => c !== key) : (prev.length >= 3 ? prev : [...prev, key])));
                            }}
                            disabled={disabled}
                            className={classNames('w-full p-4 rounded-xl border-2 transition text-left',
                              isSelected ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' : 'border-gray-200 dark:border-gray-600 hover:border-purple-300',
                              disabled && 'opacity-50 cursor-not-allowed')}
                    >
                      <div className="flex items-start gap-3">
                        <div className={classNames('inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r', category?.color || 'from-gray-400 to-gray-500')}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{category?.name || key}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">{category?.description || ''}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handleCategoryVote(selectedCategories)}
                disabled={(selectedCategories || []).length === 0}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition disabled:opacity-50"
              >
                Submit My Votes ({(selectedCategories || []).length}/3)
              </button>
            </>
          ) : (
            <div className="text-center">
              {allPlayersVoted ? (
                isHost ? (
                  <button
                    onClick={async () => {
                      if (!sessionCode) return;
                      await updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'waitingForHost' });
                      setGameState('waitingForHost'); playSound('click');
                    }}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold"
                  >
                    View Results & Start
                  </button>
                ) : (
                  <p className="text-gray-500 dark:text-gray-300">All votes in — waiting for host…</p>
                )
              ) : (
                <>
                  <div className="flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Waiting for: {waitingFor.join(', ') || '—'}</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ----- Waiting for Host (Classic) ----- */
  if (gameState === 'waitingForHost') {
    const voteResults = {};
    Object.values(categoryVotes || {}).forEach(vs => (vs || []).forEach(cat => voteResults[cat] = (voteResults[cat] || 0) + 1));
    const topCategories = calculateTopCategories(categoryVotes || {});
    const safeTop = topCategories.length ? topCategories : Object.keys(CATEGORIES);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-1">Top picks</h2>
            <p className="text-gray-600 dark:text-gray-300">Based on your votes</p>
          </div>
          <div className="space-y-2 mb-6">
            {Object.entries(voteResults).sort((a,b)=>b[1]-a[1]).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center gap-2"><CategoryPill categoryKey={cat} /></div>
                <span className="text-sm">{count} votes</span>
              </div>
            ))}
          </div>
          {isHost ? (
            <button
              onClick={async () => {
                await updateDoc(doc(db, 'sessions', sessionCode), {
                  gameState: 'relationshipSurvey',
                  selectedCategories: safeTop,
                  availableCategories: safeTop
                });
                setSelectedCategories(safeTop); setAvailableCategories(safeTop);
                setGameState('relationshipSurvey'); playSound('click');
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold"
            >
              Continue
            </button>
          ) : (
            <p className="text-gray-500 dark:text-gray-300">Waiting for host…</p>
          )}
        </div>
      </div>
    );
  }

  /* ----- Relationship survey (Classic) ----- */
  if (gameState === 'relationshipSurvey') {
    const others = (players || []).filter(p => p.id !== myId);
    // We’ll keep the simple “ack and continue” screen (you asked to keep initial questions for later).
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <Heart className="w-12 h-12 text-pink-500 mx-auto mb-3" />
          <h2 className="text-2xl font-bold mb-2">Let’s get started</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">We’ll jump straight into category picking.</p>
          {isHost ? (
            <button
              onClick={async () => {
                await updateDoc(doc(db, 'sessions', sessionCode), {
                  gameState: 'categoryPicking',
                  currentTurnIndex: 0
                });
                setGameState('categoryPicking'); setCurrentTurnIndex(0); playSound('click');
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold"
            >
              Continue to Category Picking
            </button>
          ) : (
            <p className="text-gray-500 dark:text-gray-300">Waiting for host…</p>
          )}
        </div>
      </div>
    );
  }

  /* ----- Category Picking (Classic) ----- */
  if (gameState === 'categoryPicking') {
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.id === myId;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
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
                <p className="text-gray-600 dark:text-gray-300">{currentPlayer?.name} is choosing…</p>
              </>
            )}
          </div>
          {isMyTurn ? (
            <div className="space-y-3">
              {(availableCategories || []).map((ck) => {
                const cat = CATEGORIES[ck];
                const Icon = cat && iconMap[cat.icon] ? iconMap[cat.icon] : MessageCircle;
                return (
                  <button key={ck} onClick={() => { playSound('click'); handleCategoryPicked(ck); }}
                          className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-purple-300 text-left">
                    <div className="flex items-start gap-3">
                      <div className={classNames('inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r', cat?.color || 'from-gray-400 to-gray-500')}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold">{cat?.name || ck}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">{cat?.description || ''}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-300">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-purple-500" />
              <p className="mt-2">Waiting for {currentPlayer?.name}…</p>
            </div>
          )}

          {(usedCategories || []).length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Already Used:</h3>
              <div className="flex flex-wrap gap-2">
                {(usedCategories || []).map((ck) => <CategoryPill key={ck} categoryKey={ck} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ----- Playing (Classic) ----- */
  if (gameState === 'playing') {
    const currentCategoryData = CATEGORIES[currentCategory] || null;
    const Icon = currentCategoryData && iconMap[currentCategoryData.icon] ? iconMap[currentCategoryData.icon] : MessageCircle;
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.id === myId;

    const round = players.length ? Math.floor((turnHistory.length || 0) / players.length) + 1 : 1;
    const turn = players.length ? ((turnHistory.length || 0) % players.length) + 1 : 1;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 mx-auto mb-4">
              <Icon className="w-6 h-6 text-white" />
            </div>
            {currentCategoryData && (
              <div className="mb-4">
                <span className={classNames('inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-gradient-to-r text-white text-sm', currentCategoryData.color)}>
                  <Icon className="w-3 h-3" /><span>{currentCategoryData.name}</span>
                </span>
              </div>
            )}
            <h2 className="text-lg font-semibold mb-2">{currentPlayer?.name || 'Player'}’s Question</h2>
            <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">Round {round} • Turn {turn} of {players.length || 1}</p>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400">
              <p className="text-lg leading-relaxed">{currentQuestion}</p>
            </div>
          </div>

          <div className="space-y-3">
            {isMyTurn ? (
              <>
                <button onClick={handleSkipQuestion}
                        disabled={skipsUsedThisTurn >= maxSkipsPerTurn}
                        className={classNames(
                          'w-full py-3 px-6 rounded-xl font-semibold text-lg transition flex items-center justify-center',
                          skipsUsedThisTurn < maxSkipsPerTurn
                            ? 'bg-white dark:bg-gray-900 border-2 border-orange-400 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10'
                            : 'bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                        )}>
                  <SkipForward className="w-5 h-5 mr-2" />
                  {skipsUsedThisTurn < maxSkipsPerTurn ? 'Skip This Question' : 'Skip Used'}
                  <span className="ml-2 text-sm">({skipsUsedThisTurn}/{maxSkipsPerTurn})</span>
                </button>
                <button onClick={handleNextQuestion}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition">
                  Pass to {players.length ? players[(currentTurnIndex + 1) % players.length]?.name : '—'}
                </button>
              </>
            ) : (
              <div className="text-center text-gray-600 dark:text-gray-300">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-500" />
                <p className="mt-2">Waiting for {currentPlayer?.name}…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ----- Party Mode ----- */
  if (gameState === 'party' && mode === 'party') {
    const tm = getPlayerById(turnMasterId);
    const iAmTM = isTurnMaster;

    const PromptHeader = () => (
      <div className="mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Crown className={classNames('w-5 h-5', iAmTM ? 'text-amber-500' : 'text-gray-400')} />
          <span className="text-sm">{tm ? `${tm.name} is the Turn Master` : 'Turn Master'}</span>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wide text-gray-500">Prompt</span>
            {partyRoundType === 'fillin' && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Fill-in</span>}
            {partyRoundType === 'nhie' && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Never Have I Ever</span>}
            {partyRoundType === 'superlatives' && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Superlatives</span>}
          </div>
          <p className="text-lg leading-relaxed">{partyPrompt}</p>
        </div>
      </div>
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-start justify-center p-4">
        <TopBar /><HelpModal /><NotificationToast />
        <div className="w-full max-w-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">Party Mode</h2>
                <Leaderboard />
              </div>

              <PromptHeader />

              {/* PREP — only TM sees "Start Round" */}
              {partyPhase === 'prep' && (
                <div className="text-center">
                  {iAmTM ? (
                    <button onClick={partyStartCollect}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg">
                      <Crown className="w-5 h-5" /> Start Round
                    </button>
                  ) : (
                    <div className="text-gray-600 dark:text-gray-300">
                      <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-500 mb-2" />
                      Waiting for {tm?.name || 'Turn Master'} to start…
                    </div>
                  )}
                </div>
              )}

              {/* FILL-IN -------------------------------------------------- */}
              {partyRoundType === 'fillin' && partyPhase === 'collect' && (
                iAmTM ? (
                  <div className="text-center text-gray-600 dark:text-gray-300">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-500 mb-2" />
                    Waiting for answers…
                    <div className="mt-3 text-sm">
                      Submitted: {(submissions || []).length} • Done: {Object.values(fillDone || {}).filter(Boolean).length}/{(players || []).length - 1}
                    </div>
                  </div>
                ) : (
                  <FillInSubmitter
                    canSubmitMore={canSubmitMore}
                    mySubmitCount={mySubmitCount}
                    onSubmit={submitFillInAnswer}
                    onDone={markFillInDone}
                  />
                )
              )}

              {partyRoundType === 'fillin' && partyPhase === 'results' && (
                <div>
                  {/* Show to everyone, but only TM can pick a favorite */}
                  <h3 className="text-lg font-semibold mb-3">Submissions</h3>
                  <div className="grid gap-2">
                    {(submissions || []).map((s, idx) => (
                      <div key={`${s.playerId}-${idx}`} className="p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                        <div className="flex items-start justify-between gap-3">
                          <p className="whitespace-pre-wrap">{s.text}</p>
                          {iAmTM && (
                            <button
                              onClick={() => voteForFillIn(idx)}
                              className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white text-sm hover:brightness-110"
                              title="Pick your favorite"
                            >
                              <Check className="w-4 h-4" /> Pick
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!iAmTM && (
                    <p className="text-sm text-gray-500 dark:text-gray-300 mt-3">Waiting for {tm?.name} to pick a favorite…</p>
                  )}
                </div>
              )}

              {/* NHIE ----------------------------------------------------- */}
              {partyRoundType === 'nhie' && partyPhase === 'collect' && (
                iAmTM ? (
                  <div className="text-center text-gray-600 dark:text-gray-300">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-500 mb-2" />
                    Waiting for players to submit…
                    <div className="mt-3 text-sm">
                      Submitted: {Object.keys(nhieAnswers || {}).length}/{(players || []).length - 1}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => submitNhieAnswer(true)}
                      disabled={nhieAnswers.hasOwnProperty(myId)}
                      className="px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50"
                    >
                      I HAVE
                    </button>
                    <button
                      onClick={() => submitNhieAnswer(false)}
                      disabled={nhieAnswers.hasOwnProperty(myId)}
                      className="px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
                    >
                      I HAVEN’T
                    </button>
                    {nhieAnswers.hasOwnProperty(myId) && (
                      <span className="text-emerald-600 font-medium inline-flex items-center gap-1"><Check className="w-4 h-4" /> Submitted</span>
                    )}
                  </div>
                )
              )}

              {partyRoundType === 'nhie' && partyPhase === 'guess' && (
                iAmTM ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Make your guesses</h3>
                    <div className="space-y-2">
                      {(players || []).filter(p => p.id !== turnMasterId).map(p => {
                        const sel = guessDraft[p.id];
                        return (
                          <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700">
                            <span className="font-medium">{p.name}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setGuessDraft(g => ({ ...g, [p.id]: true }))}
                                className={classNames('px-3 py-1 rounded-lg text-sm border',
                                  sel === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600')}
                              >
                                Has
                              </button>
                              <button
                                onClick={() => setGuessDraft(g => ({ ...g, [p.id]: false }))}
                                className={classNames('px-3 py-1 rounded-lg text-sm border',
                                  sel === false ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600')}
                              >
                                Hasn’t
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={submitNhieGuesses}
                      disabled={!((players || []).filter(p => p.id !== turnMasterId).every(p => guessDraft.hasOwnProperty(p.id)))}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold disabled:opacity-50"
                    >
                      Submit Guesses
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-gray-600 dark:text-gray-300">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-500 mb-2" />
                    {tm?.name} is guessing…
                  </div>
                )
              )}

              {/* SUPERLATIVES -------------------------------------------- */}
              {partyRoundType === 'superlatives' && partyPhase === 'collect' && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Vote for who fits best</h3>
                  <div className="grid gap-2">
                    {(players || []).map(p => (
                      <button key={p.id}
                        onClick={() => submitSuperVote(p.id)}
                        disabled={!!superVotes[myId]}
                        className={classNames('w-full p-3 rounded-xl border-2 text-left',
                          superVotes[myId] === p.id ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300')}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{p.name}</span>
                          {superVotes[myId] === p.id && <Check className="w-4 h-4 text-emerald-600" />}
                        </div>
                      </button>
                    ))}
                  </div>
                  {superVotes[myId] && <p className="text-sm text-emerald-600 mt-2 inline-flex items-center gap-1"><Check className="w-4 h-4" /> Vote submitted</p>}
                </div>
              )}

              {/* Announcement */}
              {announcement && (
                <div className="mt-6 p-3 rounded-xl bg-white/70 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-center">
                  <span className="text-xl mr-1">{announcement.emoji || '✨'}</span>
                  <span className="font-medium">{announcement.message}</span>
                </div>
              )}
            </div>

            {/* Sidebar: players & scores */}
            <div className="w-64 hidden md:block">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700 p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Players</span>
                </div>
                <div className="space-y-2">
                  {(players || []).map(p => (
                    <div key={p.id} className={classNames(
                      'flex items-center justify-between p-2 rounded-lg',
                      p.id === turnMasterId ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-white dark:bg-gray-800'
                    )}>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-sm font-semibold">{scores[p.id] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ----- Fallback ----- */
  return null;
}

/* =========================================================
   Small child component (Fill-in submit)
========================================================= */
function FillInSubmitter({ canSubmitMore, mySubmitCount, onSubmit, onDone }) {
  const [text, setText] = useState('');
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Your answers ({mySubmitCount}/2)</h3>
      <div className="flex items-center gap-2 mb-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a funny answer…"
          className="flex-1 px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        />
        <button
          onClick={() => { if (!text.trim()) return; onSubmit(text.trim()); setText(''); }}
          disabled={!canSubmitMore || !text.trim()}
          className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50"
        >
          Submit
        </button>
      </div>
      <div className="text-right">
        <button
          onClick={onDone}
          className="text-sm text-gray-700 dark:text-gray-300 underline"
        >
          I’m done
        </button>
      </div>
    </div>
  );
}
