'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Heart, Sparkles, Lightbulb, Target, Flame,
  Volume2, VolumeX, SkipForward, HelpCircle, X, Trophy, Edit3
} from 'lucide-react';

import { db, auth, ensureSignedIn } from '../lib/firebase';
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp, arrayUnion
} from 'firebase/firestore';

import * as QLIB from '../lib/questionCategories';

/* ------------------ button classes (raw Tailwind) ------------------ */
const BTN_PRIMARY = 'bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY = 'bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all';
const BTN_OUTLINE_ORANGE = 'bg-white dark:bg-gray-900 border-2 border-orange-400 text-orange-600 dark:text-orange-300 py-3 px-6 rounded-xl font-semibold hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all';
const BTN_DISABLED = 'bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed py-3 px-6 rounded-xl font-semibold';

const iconMap = { Sparkles, Heart, Lightbulb, Target, Flame, MessageCircle };

const FALLBACK_CATEGORIES = {
  icebreakers: { name: 'Icebreakers', description: 'Warm up with easy, fun prompts.', icon: 'Sparkles', color: 'from-purple-500 to-pink-500', questions: ['What was a small win this week?','What’s your go-to fun fact?'] },
  creative: { name: 'Creative', description: 'Imagine, riff, and get playful.', icon: 'Lightbulb', color: 'from-indigo-500 to-purple-500', questions: ['Invent a holiday.','Mash two movies into one plot.'] },
  deep_dive: { name: 'Deep Dive', description: 'Thoughtful questions with heart.', icon: 'MessageCircle', color: 'from-blue-500 to-cyan-500', questions: ['What belief of yours changed lately?','What memory shaped you?'] },
  growth: { name: 'Growth', description: 'Reflect and level up.', icon: 'Target', color: 'from-emerald-500 to-teal-500', questions: ['What habit are you building?','What risk are you glad you took?'] },
  spicy: { name: 'Spicy', description: 'Bold prompts for brave groups.', icon: 'Flame', color: 'from-orange-500 to-red-500', questions: ['What’s a hot take you stand by?','What should people be more honest about?'] }
};

const LIB = (() => {
  const cats =
    QLIB.questionCategories ||
    QLIB.categories ||
    (QLIB.default && (QLIB.default.questionCategories || QLIB.default.categories)) ||
    FALLBACK_CATEGORIES;

  const getRandomQuestion =
    QLIB.getRandomQuestion ||
    (QLIB.default && QLIB.default.getRandomQuestion) ||
    ((catKey, exclude = []) => {
      const pool = (FALLBACK_CATEGORIES[catKey]?.questions || FALLBACK_CATEGORIES.icebreakers.questions);
      const choices = pool.filter(q => !exclude.includes(q));
      const arr = choices.length ? choices : pool;
      return arr[Math.floor(Math.random()*arr.length)];
    });

  return {
    cats,
    getRandomQuestion,
    getRandomSuperlative: QLIB.getRandomSuperlative,
    getRandomNeverIEver: QLIB.getRandomNeverIEver,
    getRandomFillBlank: QLIB.getRandomFillBlank,
  };
})();

/* -------------------------- main component -------------------------- */
export default function Page() {
  // Flow stages: welcome -> survey -> createOrJoin/quickstart -> waitingRoom -> voting -> picking -> playing
  const [gameState, setGameState] = useState('welcome');
  const [mode, setMode] = useState('classic');

  // identity + survey
  const [playerName, setPlayerName] = useState('');
  const [surveyAnswers, setSurveyAnswers] = useState({ vibe: 'balanced', topics: [], introvert: 'neutral' });

  // session
  const [sessionCode, setSessionCode] = useState('');
  const [isHost, setIsHost] = useState(false);

  // doc fields
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentCategory, setCurrentCategory] = useState('');
  const [currentQuestionAsker, setCurrentQuestionAsker] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [usedCategories, setUsedCategories] = useState([]);
  const [turnHistory, setTurnHistory] = useState([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [categoryVotes, setCategoryVotes] = useState({});
  const [scores, setScores] = useState({});
  const [round, setRound] = useState(null);

  // ui
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [notification, setNotification] = useState(null);
  const [skipsUsedThisTurn, setSkipsUsedThisTurn] = useState(0);
  const maxSkipsPerTurn = 1;
  const [questionDraft, setQuestionDraft] = useState('');
  const [myAnswerDraft, setMyAnswerDraft] = useState('');

  // derived
  const CATEGORIES = LIB.cats;
  const libraryOK = !!QLIB.getRandomQuestion;
  const myUid = auth?.currentUser?.uid || null;

  // stable refs
  const unsubscribeRef = useRef(null);
  const prevTurnIdxRef = useRef(0);

  /* ----------------------------- helpers ----------------------------- */
  const showToast = (message, emoji = '🎉') => {
    setNotification({ message, emoji });
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setNotification(null), 2400);
  };

  // do NOT call AudioContext on every keystroke; only on explicit taps
  const toggleSound = () => setAudioEnabled(v => !v);

  /* ---------------------- Firestore subscription --------------------- */
  const listenToSession = useCallback((code) => {
    if (!code) return;
    if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
    const sessionRef = doc(db, 'sessions', code);
    const unsub = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};
      setPlayers([...(data.players || [])]);
      setCurrentQuestion(data.currentQuestion || '');
      setCurrentCategory(data.currentCategory || '');
      setCurrentQuestionAsker(data.currentQuestionAsker || '');
      setSelectedCategories([...(data.selectedCategories || [])]);
      setAvailableCategories([...(data.availableCategories || [])]);
      setUsedCategories([...(data.usedCategories || [])]);
      setTurnHistory([...(data.turnHistory || [])]);
      setCategoryVotes(data.categoryVotes || {});
      setScores(data.scores || {});
      setMode(data.mode || 'classic');
      setRound(data.round || null);

      const incomingTurn = typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0;
      setCurrentTurnIndex(incomingTurn);
      if (incomingTurn !== prevTurnIdxRef.current) {
        prevTurnIdxRef.current = incomingTurn;
        setSkipsUsedThisTurn(0);
      }

      // Do not force a screen jump here; let host’s buttons set gameState.
      // Only snap to waitingRoom if this is a brand new listener and the doc says so.
      if (gameState === 'createOrJoin' && data.gameState) setGameState(data.gameState);
    }, (e) => console.error('onSnapshot error', e));

    unsubscribeRef.current = unsub;
  }, [db, gameState]);

  useEffect(() => () => {
    if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
  }, []);

  /* -------------------------- create / join -------------------------- */
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
        createdAt: serverTimestamp(),
      });
      return true;
    } catch (err) {
      console.error('create session error:', err.code, err.message);
      return false;
    }
  };

  const handleCreateSession = async () => {
    if (!playerName.trim()) return;
    const user = await ensureSignedIn();
    const uid = user?.uid;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostPlayer = {
      id: uid,
      name: playerName,
      isHost: true,
      surveyAnswers,
      joinedAt: new Date().toISOString(),
    };
    const ok = await createFirebaseSession(code, hostPlayer);
    if (!ok) { alert('Failed to create session. Check auth + rules.'); return; }
    setSessionCode(code);
    setIsHost(true);
    setPlayers([hostPlayer]);
    setGameState('waitingRoom');
    listenToSession(code);
  };

  const handleJoinSession = async () => {
    if (!playerName.trim() || !sessionCode.trim()) return;
    const user = await ensureSignedIn();
    const uid = user?.uid;

    const code = sessionCode.trim().toUpperCase();
    const sessionRef = doc(db, 'sessions', code);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) { alert('Session not found.'); return; }
    const data = snap.data() || {};
    const alreadyIn = (data.players || []).some(p => p?.id === uid);

    if (!alreadyIn) {
      const newPlayer = {
        id: uid,
        name: playerName,
        isHost: false,
        surveyAnswers,
        joinedAt: new Date().toISOString(),
      };
      try {
        await updateDoc(sessionRef, { players: arrayUnion(newPlayer) });
      } catch {
        const fresh = (await getDoc(sessionRef)).data() || {};
        const next = [...(fresh.players || []), newPlayer]
          .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
        await updateDoc(sessionRef, { players: next });
      }
    }

    setPlayers((await getDoc(sessionRef)).data().players || []);
    setSessionCode(code);
    setIsHost(false);
    setGameState('waitingRoom');
    listenToSession(code);
  };

  /* -------------------- voting & category picking -------------------- */
  const saveMyCategoryVotes = async (choices) => {
    if (!sessionCode || !auth?.currentUser?.uid) return;
    await updateDoc(doc(db, 'sessions', sessionCode), {
      [`categoryVotes.${auth.currentUser.uid}`]: choices.slice(0, 3)
    });
    showToast('Votes saved', '🗳️');
  };

  const calculateTopCategories = (votesMap) => {
    const counts = {};
    Object.values(votesMap || {}).forEach(arr => (arr || []).forEach(c => { counts[c] = (counts[c] || 0) + 1; }));
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k]) => k);
  };

  const hostFinalizeVoting = async () => {
    if (!isHost || !sessionCode) return;
    const tops = calculateTopCategories(categoryVotes);
    const selected = tops.length ? tops.slice(0, 6) : Object.keys(CATEGORIES).slice(0, 6);
    await updateDoc(doc(db,'sessions',sessionCode), {
      selectedCategories: selected,
      availableCategories: selected,
      usedCategories: [],
      currentTurnIndex: 0,
      currentQuestion: '',
      currentCategory: '',
      currentQuestionAsker: '',
      gameState: 'categoryPicking',
      mode: 'classic',
      round: null
    });
    setSelectedCategories(selected);
    setAvailableCategories(selected);
    setUsedCategories([]);
    setGameState('categoryPicking');
    setMode('classic');
  };

  const hostPickCategory = async (category) => {
    if (!isHost || !sessionCode) return;
    const asker = players[currentTurnIndex] || players[0];
    const q = LIB.getRandomQuestion(category, [currentQuestion]);
    const newUsed = [...usedCategories, category];
    const newAvail = (availableCategories || []).filter(c => c !== category);
    const newHistory = [...turnHistory, { player: asker?.name, category, question: q }];

    await updateDoc(doc(db,'sessions',sessionCode), {
      currentQuestion: q,
      currentCategory: category,
      currentQuestionAsker: asker?.name || '',
      gameState: 'playing',
      usedCategories: newUsed,
      availableCategories: newAvail,
      turnHistory: newHistory,
      round: { mode: 'classic', phase: 'ask', prompt: q, answers: {} }
    });

    setCurrentQuestion(q);
    setCurrentCategory(category);
    setCurrentQuestionAsker(asker?.name || '');
    setUsedCategories(newUsed);
    setAvailableCategories(newAvail);
    setTurnHistory(newHistory);
    setGameState('playing');
    setMode('classic');
  };

  const hostNextTurn = async () => {
    if (!isHost || !sessionCode) return;
    const count = players.length || 0;
    if (!count) return;
    const nextTurn = (currentTurnIndex + 1) % count;
    let newAvail = availableCategories, newUsed = usedCategories;
    if ((availableCategories || []).length === 0) { newAvail = [...(selectedCategories||[])]; newUsed = []; }
    await updateDoc(doc(db,'sessions',sessionCode), {
      gameState: 'categoryPicking',
      currentTurnIndex: nextTurn,
      availableCategories: newAvail,
      usedCategories: newUsed,
      currentQuestion: '',
      currentCategory: '',
      currentQuestionAsker: '',
      round: null
    });
    setCurrentTurnIndex(nextTurn);
    setAvailableCategories(newAvail);
    setUsedCategories(newUsed);
    setCurrentQuestion('');
    setCurrentCategory('');
    setCurrentQuestionAsker('');
    setGameState('categoryPicking');
    setSkipsUsedThisTurn(0);
  };

  /* ---------------------- classic write-in / skip --------------------- */
  const submitQuestionWriteIn = async () => {
    if (!sessionCode || !questionDraft.trim()) return;
    const newQ = questionDraft.trim();
    const sessionRef = doc(db,'sessions',sessionCode);
    const snap = await getDoc(sessionRef); const data = snap.data() || {};
    const r = data.round || { mode:'classic', phase:'ask', prompt: currentQuestion, answers:{} };
    await updateDoc(sessionRef, { round: { ...r, prompt: newQ } });
    setRound({ ...r, prompt: newQ });
    setQuestionDraft('');
    showToast('Custom question set', '✍️');
  };

  const hostSkipQuestion = async () => {
    if (!isHost || !sessionCode) return;
    if (skipsUsedThisTurn >= maxSkipsPerTurn) { showToast('Skip already used this turn', '⏭️'); return; }
    const cat = currentCategory || selectedCategories[0] || 'icebreakers';
    const newQ = LIB.getRandomQuestion(cat, [currentQuestion, round?.prompt].filter(Boolean));
    await updateDoc(doc(db,'sessions',sessionCode), {
      currentQuestion: newQ,
      currentCategory: cat,
      round: { mode:'classic', phase:'ask', prompt: newQ, answers: {} }
    });
    setCurrentQuestion(newQ);
    setRound({ mode:'classic', phase:'ask', prompt: newQ, answers: {} });
    setSkipsUsedThisTurn(n=>n+1);
  };

  const submitMyAnswer = async () => {
    if (!sessionCode || !myAnswerDraft.trim()) return;
    const uid = auth?.currentUser?.uid;
    if (!uid) return;
    const sessionRef = doc(db,'sessions',sessionCode);
    const snap = await getDoc(sessionRef);
    const data = snap.data() || {};
    const r = data.round || { mode:'classic', phase:'ask', prompt: currentQuestion, answers:{} };
    const answers = { ...(r.answers || {}), [uid]: { text: myAnswerDraft.trim(), submittedAt: Date.now() } };
    await updateDoc(sessionRef, { round: { ...r, answers } });
    setRound({ ...r, answers });
    setMyAnswerDraft('');
    showToast('Answer submitted', '✅');
  };

  /* --------------------------- mode switching ------------------------- */
  const hostInitMode = async (newMode) => {
    if (!isHost || !sessionCode) return;
    let prompt = '';
    if (newMode === 'superlatives' && LIB.getRandomSuperlative) prompt = LIB.getRandomSuperlative();
    if (newMode === 'never' && LIB.getRandomNeverIEver) prompt = `Never have I ever ${LIB.getRandomNeverIEver()}`;
    if (newMode === 'fill_blank' && LIB.getRandomFillBlank) prompt = LIB.getRandomFillBlank();
    await updateDoc(doc(db,'sessions',sessionCode), {
      mode: newMode,
      gameState: 'playing',
      round: { mode: newMode, phase: newMode==='superlatives' ? 'prompt' : (newMode==='fill_blank' ? 'collect_submissions' : 'collect'), prompt, submissions: {}, votes: {}, responses: {} }
    });
    setMode(newMode);
    setRound({ mode: newMode, phase: (newMode==='superlatives' ? 'prompt' : (newMode==='fill_blank' ? 'collect_submissions' : 'collect')), prompt, submissions: {}, votes: {}, responses: {} });
    setGameState('playing');
  };

  const hostUpdateScores = async (patch) => {
    if (!isHost || !sessionCode) return;
    const updated = { ...(scores || {}) };
    Object.entries(patch || {}).forEach(([k,v]) => { updated[k] = (updated[k] || 0) + v; });
    await updateDoc(doc(db,'sessions',sessionCode), { scores: updated });
    setScores(updated);
  };

  /* ------------------------------- UI -------------------------------- */
  const TopBar = () => (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-2 pointer-events-auto">
      <span className={`hidden sm:inline-flex px-2 py-1 rounded-lg text-xs font-medium ${libraryOK ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`}>
        {libraryOK ? 'Library' : 'Fallback'}
      </span>
      {sessionCode && (
        <div className="hidden md:flex items-center gap-1 bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white px-3 py-2 rounded-xl">
          <Trophy className="w-4 h-4" /><span className="text-xs">Scores</span>
          <span className="text-xs ml-2">
            {Object.keys(scores||{}).length
              ? Object.entries(scores).sort((a,b)=> (b[1]||0)-(a[1]||0)).map(([n,s])=>`${n}:${s}`).join(' · ')
              : '—'}
          </span>
        </div>
      )}
      <button onClick={toggleSound} className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-all" aria-label="Toggle sound">
        {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>
      <button onClick={()=>setShowHelp(true)} className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-all" aria-label="Help">
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  );

  const HelpModal = () => !showHelp ? null : (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e)=>{ if (e.target === e.currentTarget) setShowHelp(false); }}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-2xl p-6 relative">
        <button className="absolute top-3 right-3 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100" onClick={()=>setShowHelp(false)} aria-label="Close help">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-semibold">How to Play</h3>
        </div>
        <div className="space-y-3 text-gray-700 dark:text-gray-200">
          <p>Start with a quick survey, then host or join a session.</p>
          <p>Classic: Host advances, can skip. Anyone can propose a custom question and type answers.</p>
          <p>Party modes: Superlatives (vote), Never (I have/haven’t), Fill-in-the-Blank (submit → vote → reveal).</p>
        </div>
      </div>
    </div>
  );

  const NotificationToast = () => !notification ? null : (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-4 z-50">
      <div className="flex items-center space-x-2">
        <span className="text-2xl">{notification.emoji}</span>
        <span className="font-medium text-gray-800 dark:text-gray-100">{notification.message}</span>
      </div>
    </div>
  );

  const Frame = ({ title, children, showBack }) => (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <TopBar /><HelpModal /><NotificationToast />
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">{title}</h1>
          {sessionCode && <span className="text-xs text-gray-500 dark:text-gray-300">Session: {sessionCode}</span>}
        </div>
        {children}
        {showBack && (
          <button onClick={()=>setGameState('waitingRoom')}
            className={`w-full mt-4 ${BTN_SECONDARY}`}>
            Back to Lobby
          </button>
        )}
      </div>
    </div>
  );

  const ModeSwitcher = () => {
    if (!isHost || !sessionCode) return null;
    const Btn = ({k,label}) => (
      <button onClick={()=>hostInitMode(k)}
        className={`text-xs px-3 py-1 rounded-lg border ${mode===k?'bg-purple-600 text-white border-purple-600':'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}>
        {label}
      </button>
    );
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex gap-2 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-600 dark:text-gray-300 mr-1">Mode:</span>
        <Btn k="classic" label="Classic" />
        <Btn k="superlatives" label="Superlatives" />
        <Btn k="never" label="Never" />
        <Btn k="fill_blank" label="Fill-Blank" />
      </div>
    );
  };

  /* ------------------------------ Screens ----------------------------- */

  // 1) Welcome
  if (gameState === 'welcome') {
    return (
      <Frame title="Overshare">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-100/90"></p>
          <p className="text-gray-200"></p>
        </div>
        <input
          type="text"
          inputMode="text"
          autoComplete="name"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Enter your name"
          value={playerName}
          onChange={(e)=>setPlayerName(e.target.value)}
          onKeyDown={(e)=>e.stopPropagation()}
          className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 mb-4"
        />
        <button
          onClick={()=>{ if(!playerName.trim()) return; setGameState('survey'); }}
          className={`w-full ${BTN_PRIMARY}`}
        >
          Continue
        </button>
      </Frame>
    );
  }

  // 2) Survey (quick + stable controls)
  if (gameState === 'survey') {
    const toggleTopic = (t) => {
      setSurveyAnswers((prev) => {
        const has = (prev.topics||[]).includes(t);
        return { ...prev, topics: has ? prev.topics.filter(x=>x!==t) : [...(prev.topics||[]), t] };
      });
    };
    return (
      <Frame title="Quick Survey">
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Vibe</label>
            <div className="grid grid-cols-3 gap-2">
              {['light','balanced','deep'].map(v=>(
                <button key={v} onClick={()=>setSurveyAnswers(s=>({...s, vibe:v}))}
                  className={`p-2 rounded-xl border-2 ${surveyAnswers.vibe===v?'border-purple-500 bg-purple-50 dark:bg-purple-900/20':'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-900`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Topics (optional)</label>
            <div className="grid grid-cols-2 gap-2">
              {['work','family','travel','relationships','sports','art'].map(t=>(
                <button key={t} onClick={()=>toggleTopic(t)}
                  className={`p-2 rounded-xl border-2 ${surveyAnswers.topics?.includes(t)?'border-purple-500 bg-purple-50 dark:bg-purple-900/20':'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-900 text-left`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Social energy</label>
            <div className="grid grid-cols-3 gap-2">
              {['introvert','neutral','extrovert'].map(v=>(
                <button key={v} onClick={()=>setSurveyAnswers(s=>({...s, introvert:v}))}
                  className={`p-2 rounded-xl border-2 ${surveyAnswers.introvert===v?'border-purple-500 bg-purple-50 dark:bg-purple-900/20':'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-900`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <button onClick={()=>setGameState('createOrJoin')} className={`w-full ${BTN_PRIMARY}`}>Multiplayer (Host / Join)</button>
          <button onClick={()=>{ setMode('quickstart'); setGameState('quickstart'); }} className={`w-full ${BTN_SECONDARY}`}>Quickstart (Solo)</button>
        </div>
      </Frame>
    );
  }

  // 3) Create or Join
  if (gameState === 'createOrJoin') {
    return (
      <Frame title="Create or Join">
        <div className="space-y-3">
          <button onClick={handleCreateSession} className={`w-full ${BTN_PRIMARY}`}>Create Game</button>
          <div className="flex gap-2">
            <input
              value={sessionCode}
              onChange={(e)=>setSessionCode(e.target.value.toUpperCase())}
              onKeyDown={(e)=>e.stopPropagation()}
              placeholder="Enter code"
              inputMode="text"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900"
            />
            <button onClick={handleJoinSession} className={`${BTN_SECONDARY}`}>Join</button>
          </div>
        </div>
      </Frame>
    );
  }

  // 4) Quickstart Solo
  if (gameState === 'quickstart') {
    return <QuickstartSolo
      CATEGORIES={CATEGORIES}
      getQuestion={LIB.getRandomQuestion}
      onBack={() => { setGameState('survey'); setMode('classic'); }}
    />;
  }

  // 5) Waiting Room
  if (gameState === 'waitingRoom') {
    return (
      <Frame title="Waiting Room">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Share the code and wait for friends to join.</p>
        <div className="space-y-2 mb-4">
          {(players||[]).map((p)=>(
            <div key={p.id} className="p-3 rounded-xl border bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 flex justify-between">
              <span>{p.name}{p.id===auth?.currentUser?.uid ? ' (you)' : ''}</span>
              <span className="text-xs text-gray-500 dark:text-gray-300">{p.isHost ? 'Host' : ''}</span>
            </div>
          ))}
        </div>
        {isHost ? (
          <button
            onClick={()=> updateDoc(doc(db,'sessions',sessionCode), { gameState:'categoryVoting', categoryVotes:{} }).then(()=> setGameState('categoryVoting'))}
            className={`w-full ${BTN_PRIMARY}`}
          >
            Start Category Voting
          </button>
        ) : (
          <p className="text-center text-sm text-gray-600 dark:text-gray-300">Waiting for host…</p>
        )}
      </Frame>
    );
  }

  // 6) Category Voting
  if (gameState === 'categoryVoting') {
    return (
      <Frame title="Pick up to 3 categories">
        <CategoryVoting
          CATEGORIES={CATEGORIES}
          myUid={myUid}
          myVotes={(categoryVotes||{})[myUid] || []}
          onChange={(arr)=>saveMyCategoryVotes(arr)}
        />
        {isHost && (
          <button onClick={hostFinalizeVoting} className={`w-full mt-4 ${BTN_PRIMARY}`}>Finalize & Continue</button>
        )}
      </Frame>
    );
  }

  // 7) Category Picking
  if (gameState === 'categoryPicking') {
    const currentPlayer = players[currentTurnIndex] || players[0];
    const entries = (availableCategories||[]).map(k => [k, CATEGORIES[k]]).filter(([,v]) => !!v);
    const canPick = isHost; // host-only per rules
    return (
      <Frame title="Category Picking" showBack>
        <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-3">Current player: <b>{currentPlayer?.name||'—'}</b></p>
        <div className="grid grid-cols-1 gap-3">
          {entries.map(([key, cat])=>{
            const IconCmp = iconMap[cat.icon] || MessageCircle;
            return (
              <button key={key} disabled={!canPick} onClick={()=>hostPickCategory(key)}
                className={`p-4 rounded-2xl border-2 ${canPick?'border-gray-200 dark:border-gray-600 hover:border-purple-500':'border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'} bg-white dark:bg-gray-900 text-left`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${cat.color} grid place-items-center`}>
                    <IconCmp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">{cat.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-300">{cat.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {!canPick && <p className="text-xs text-center mt-3 text-gray-500 dark:text-gray-300">Host picks the category (rules).</p>}
      </Frame>
    );
  }

  // 8) Playing (routes to the active mode)
  if (gameState === 'playing') {
    if (mode === 'superlatives' && round) {
      return <SuperlativesScreen
        round={round}
        players={players}
        isHost={isHost}
        onStart={() => updateDoc(doc(db,'sessions',sessionCode), { round: { ...round, phase:'vote' } }).then(()=>setRound(r=>({ ...r, phase:'vote' })))}
        onNextPrompt={async () => {
          const next = LIB.getRandomSuperlative ? LIB.getRandomSuperlative([round.prompt]) : 'Most likely to...';
          await updateDoc(doc(db,'sessions',sessionCode), { round: { mode:'superlatives', phase:'prompt', prompt: next, votes:{} } });
          setRound({ mode:'superlatives', phase:'prompt', prompt: next, votes:{} });
        }}
        onVote={async (targetUid) => {
          const uid = auth?.currentUser?.uid; if (!uid) return;
          const sessionRef = doc(db,'sessions',sessionCode);
          const snap = await getDoc(sessionRef); const data = snap.data() || {};
          const r = data.round || { mode:'superlatives', phase:'vote', prompt: round.prompt, votes:{} };
          const votes = { ...(r.votes||{}), [uid]: targetUid };
          await updateDoc(sessionRef, { round: { ...r, phase:'vote', votes, prompt: r.prompt } });
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
        <ModeSwitcher />
      </SuperlativesScreen>;
    }

    if (mode === 'never' && round) {
      return <NeverScreen
        round={round}
        players={players}
        isHost={isHost}
        onRespond={async (val) => {
          const uid = auth?.currentUser?.uid; if (!uid) return;
          const sessionRef = doc(db,'sessions',sessionCode);
          const snap = await getDoc(sessionRef); const data = snap.data() || {};
          const r = data.round || { mode:'never', phase:'collect', prompt: round.prompt, responses:{} };
          const responses = { ...(r.responses||{}), [uid]: !!val };
          await updateDoc(sessionRef, { round: { ...r, phase:'collect', responses, prompt: r.prompt } });
          setRound({ ...r, phase:'collect', responses });
        }}
        onReveal={async () => {
          await updateDoc(doc(db,'sessions',sessionCode), { round: { ...round, phase:'reveal' } });
          setRound(r=>({ ...r, phase:'reveal' }));
        }}
        onNextPrompt={async () => {
          const topic = LIB.getRandomNeverIEver ? LIB.getRandomNeverIEver([round.prompt.replace(/^Never have I ever\s*/i,'')]) : 'done something silly';
          const next = `Never have I ever ${topic}`;
          await updateDoc(doc(db,'sessions',sessionCode), { round: { mode:'never', phase:'collect', prompt: next, responses:{} } });
          setRound({ mode:'never', phase:'collect', prompt: next, responses:{} });
        }}
      >
        <ModeSwitcher />
      </NeverScreen>;
    }

    if (mode === 'fill_blank' && round) {
      return <FillBlankScreen
        round={round}
        players={players}
        isHost={isHost}
        onSubmit={async (text) => {
          const uid = auth?.currentUser?.uid; if (!uid || !text.trim()) return;
          const sessionRef = doc(db,'sessions',sessionCode);
          const snap = await getDoc(sessionRef); const data = snap.data() || {};
          const r = data.round || { mode:'fill_blank', phase:'collect_submissions', prompt: round.prompt, submissions:{}, votes:{} };
          const submissions = { ...(r.submissions||{}), [uid]: { id: uid, text: text.trim() } };
          await updateDoc(sessionRef, { round: { ...r, phase:'collect_submissions', submissions, votes: r.votes||{}, prompt: r.prompt } });
          setRound({ ...r, phase:'collect_submissions', submissions, votes: r.votes||{} });
        }}
        onStartVoting={async () => {
          await updateDoc(doc(db,'sessions',sessionCode), { round: { ...round, phase:'collect_votes' } });
          setRound(r=>({ ...r, phase:'collect_votes' }));
        }}
        onVote={async (targetUid) => {
          const uid = auth?.currentUser?.uid; if (!uid) return;
          const sessionRef = doc(db,'sessions',sessionCode);
          const snap = await getDoc(sessionRef); const data = snap.data() || {};
          const r = data.round || { mode:'fill_blank', phase:'collect_votes', prompt: round.prompt, submissions: round.submissions, votes:{} };
          const votes = { ...(r.votes||{}), [uid]: targetUid };
          await updateDoc(sessionRef, { round: { ...r, phase:'collect_votes', votes, submissions: r.submissions||{}, prompt: r.prompt } });
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
          const next = LIB.getRandomFillBlank ? LIB.getRandomFillBlank([round.prompt]) : 'A topic everyone can riff on';
          await updateDoc(doc(db,'sessions',sessionCode), { round: { mode:'fill_blank', phase:'collect_submissions', prompt: next, submissions:{}, votes:{} } });
          setRound({ mode:'fill_blank', phase:'collect_submissions', prompt: next, submissions:{}, votes:{} });
        }}
      >
        <ModeSwitcher />
      </FillBlankScreen>;
    }

    // Classic default
    const currentPlayer = players[currentTurnIndex] || players[0];
    const roundNo = players.length ? Math.floor((turnHistory.length||0)/players.length)+1 : 1;
    const turnNo = players.length ? ((turnHistory.length||0)%players.length)+1 : 1;
    const questionToShow = (round?.mode==='classic' && round?.prompt) ? round.prompt : currentQuestion;
    const cat = CATEGORIES[currentCategory] || null;
    const IconCmp = cat ? (iconMap[cat.icon] || MessageCircle) : MessageCircle;

    return (
      <Frame title="Classic" showBack>
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 mx-auto mb-3">
            <IconCmp className="w-6 h-6 text-white" />
          </div>
          {cat && (
            <span className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-gradient-to-r ${cat.color} text-white text-sm mb-3`}>
              <IconCmp className="w-3 h-3" /><span>{cat.name}</span>
            </span>
          )}
          <h2 className="text-lg font-semibold mb-1">{currentPlayer?.name || 'Player'}'s Question</h2>
          <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">Round {roundNo} • Turn {turnNo} of {players.length||1}</p>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400 mb-3">
            <p className="text-lg leading-relaxed">{questionToShow}</p>
          </div>

          {auth?.currentUser?.uid === (players[currentTurnIndex]?.id) && (
            <div className="mb-4">
              <div className="space-y-2">
                <textarea rows={2} value={questionDraft} onChange={(e)=>setQuestionDraft(e.target.value)}
                  onKeyDown={(e)=>e.stopPropagation()}
                  className="w-full p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900" placeholder="(Optional) Propose a custom question..." />
                <div className="flex gap-2">
                  <button onClick={submitQuestionWriteIn} className={`flex-1 ${BTN_SECONDARY}`}>
                    <Edit3 className="w-4 h-4 inline mr-2" /> Use Custom
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4">
            <div className="flex gap-2">
              <input value={myAnswerDraft} onChange={(e)=>setMyAnswerDraft(e.target.value)} placeholder="(Optional) Type your answer..."
                onKeyDown={(e)=>e.stopPropagation()}
                className="flex-1 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900" />
              <button onClick={submitMyAnswer} className={`${BTN_SECONDARY}`}>Send</button>
            </div>
            {round?.answers && Object.keys(round.answers).length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">
                Answers submitted: {Object.keys(round.answers).length}/{players.length}
              </p>
            )}
          </div>

          {isHost ? (
            <>
              <button onClick={hostSkipQuestion}
                className={`w-full ${skipsUsedThisTurn < maxSkipsPerTurn ? BTN_OUTLINE_ORANGE : BTN_DISABLED}`}>
                <SkipForward className="w-5 h-5 mr-2 inline" /> {skipsUsedThisTurn < maxSkipsPerTurn ? 'Skip This Question' : 'Skip Used'} <span className="ml-1 text-sm">({skipsUsedThisTurn}/{maxSkipsPerTurn})</span>
              </button>
              <button onClick={hostNextTurn} className={`w-full mt-3 ${BTN_PRIMARY}`}>
                Next Turn → {players.length ? players[(currentTurnIndex+1)%players.length]?.name : '—'}
              </button>
            </>
          ) : (
            <p className="text-center text-sm text-gray-600 dark:text-gray-300">Waiting for host…</p>
          )}
        </div>

        <ModeSwitcher />
      </Frame>
    );
  }

  return null;
}

/* ---------------------------- subcomponents ---------------------------- */

function QuickstartSolo({ CATEGORIES, getQuestion, onBack }) {
  const [qsSelected, setQsSelected] = useState(['icebreakers']);
  const [qsQuestion, setQsQuestion] = useState('');
  const [qsCategory, setQsCategory] = useState('icebreakers');

  useEffect(() => {
    const q = getQuestion('icebreakers', []);
    setQsQuestion(q); setQsCategory('icebreakers');
  }, []);

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
          <button onClick={()=>{ if(qsSelected.length===0) return; const c = qsSelected[Math.random()*qsSelected.length|0]; pickQuestion(c); }} className={`flex-1 ${BTN_PRIMARY}`}>New Question</button>
          <button onClick={onBack} className={`flex-1 ${BTN_SECONDARY}`}>Back</button>
        </div>
      </div>
    </div>
  );
}

function CategoryVoting({ CATEGORIES, myUid, myVotes, onChange }) {
  const [selected, setSelected] = useState(myVotes || []);
  useEffect(()=>{ setSelected(myVotes || []); }, [myVotes]);

  const toggle = (key) => {
    setSelected(prev => prev.includes(key)
      ? prev.filter(x=>x!==key)
      : (prev.length >= 3 ? prev : [...prev, key]));
  };

  useEffect(() => { onChange && onChange(selected); }, [selected]);

  const entries = Object.entries(CATEGORIES || {});
  return (
    <>
      <div className="grid grid-cols-1 gap-3">
        {entries.map(([key, cat])=>{
          const IconCmp = iconMap[cat.icon] || MessageCircle;
          const active = selected.includes(key);
          return (
            <button key={key} onClick={()=>toggle(key)}
              className={`p-4 rounded-2xl border-2 ${active?'border-purple-500 bg-purple-50 dark:bg-purple-900/20':'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-900 text-left`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${cat.color} grid place-items-center`}>
                  <IconCmp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold">{cat.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-300">{cat.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-center text-gray-500 dark:text-gray-300 mt-3">Selected {selected.length}/3</p>
    </>
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

function SuperlativesScreen({ round, players, isHost, onStart, onNextPrompt, onVote, onReveal, children }) {
  const prompt = round.prompt || 'Most likely to...';
  const votes = round.votes || {};
  const everyoneVoted = players.length>0 && players.every(p => votes[p?.id]);
  return (
    <FrameLocal title="Superlatives">
      <h2 className="text-2xl font-bold text-center mb-4">{prompt}</h2>
      {round.phase === 'prompt' && isHost && (
        <div className="flex gap-2">
          <button onClick={onStart} className={`flex-1 ${BTN_PRIMARY}`}>Use This</button>
          <button onClick={onNextPrompt} className={`flex-1 ${BTN_SECONDARY}`}>New Prompt</button>
        </div>
      )}
      {round.phase === 'vote' && (
        <>
          <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-3">Vote for who fits best (not yourself)</p>
          <div className="space-y-2">
            {players.map((p)=>(
              <button key={p.id} onClick={()=> onVote(p.id)}
                className={`w-full p-3 rounded-xl border-2 ${votes[auth?.currentUser?.uid]===p.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20':'border-gray-200 dark:border-gray-600'}`}>
                {p.name}
              </button>
            ))}
          </div>
          {isHost && <button disabled={!everyoneVoted} onClick={onReveal} className={`w-full mt-4 ${BTN_PRIMARY}`}>Reveal {everyoneVoted?'':'(waiting...)'}</button>}
        </>
      )}
      {round.phase === 'reveal' && (
        <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-3">Host can start a new prompt from the mode switcher.</p>
      )}
      {children}
    </FrameLocal>
  );
}

function NeverScreen({ round, players, isHost, onRespond, onReveal, onNextPrompt, children }) {
  const prompt = round.prompt || 'Never have I ever...';
  const responses = round.responses || {};
  const everyoneAnswered = players.length>0 && players.every(p => responses.hasOwnProperty(p?.id));
  return (
    <FrameLocal title="Never Have I Ever">
      <h2 className="text-2xl font-bold text-center mb-4">{prompt}</h2>
      {round.phase !== 'reveal' ? (
        <>
          <div className="flex gap-2 mb-4">
            <button onClick={()=>onRespond(true)} className={`flex-1 ${BTN_SECONDARY} ${responses[auth?.currentUser?.uid]===true?'ring-2 ring-purple-500':''}`}>I have</button>
            <button onClick={()=>onRespond(false)} className={`flex-1 ${BTN_SECONDARY} ${responses[auth?.currentUser?.uid]===false?'ring-2 ring-purple-500':''}`}>I haven’t</button>
          </div>
          {isHost && <button disabled={!everyoneAnswered} onClick={onReveal} className={`w-full ${BTN_PRIMARY}`}>Reveal</button>}
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
          {isHost && <button onClick={onNextPrompt} className={`w-full ${BTN_PRIMARY}`}>Next Prompt</button>}
        </>
      )}
      {children}
    </FrameLocal>
  );
}

function FillBlankScreen({ round, players, isHost, onSubmit, onStartVoting, onVote, onReveal, onNextPrompt, children }) {
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
          {!submissions[auth?.currentUser?.uid] && (
            <div className="space-y-2 mb-3">
              <textarea value={myDraft} onChange={(e)=>setMyDraft(e.target.value)} rows={3}
                onKeyDown={(e)=>e.stopPropagation()}
                className="w-full p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900" placeholder="Your answer..." />
              <button onClick={()=>{ if(myDraft.trim()) onSubmit(myDraft); setMyDraft(''); }} className={`w-full ${BTN_PRIMARY}`}>Submit</button>
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-300 text-center">Submissions: {Object.keys(submissions).length}/{players.length}</p>
          {isHost && <button disabled={!allSubmitted} onClick={onStartVoting} className={`w-full mt-3 ${BTN_SECONDARY}`}>Start Voting</button>}
        </>
      )}

      {round.phase === 'collect_votes' && (
        <>
          <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-3">Vote for the best answer</p>
          <div className="space-y-2">
            {Object.entries(submissions).map(([uid, sub])=>(
              <button key={uid} onClick={()=>onVote(uid)}
                className={`w-full p-3 rounded-xl border-2 text-left ${votes[auth?.currentUser?.uid]===uid ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20':'border-gray-200 dark:border-gray-600'}`}>
                <span className="block text-xs text-gray-500 dark:text-gray-300 mb-1">by {players.find(p=>p.id===uid)?.name || uid}</span>
                <span className="block">{sub.text}</span>
              </button>
            ))}
          </div>
          {isHost && <button disabled={!everyoneVoted} onClick={onReveal} className={`w-full mt-4 ${BTN_PRIMARY}`}>Reveal {everyoneVoted?'':'(waiting...)'}</button>}
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
          {isHost && <button onClick={onNextPrompt} className={`w-full ${BTN_PRIMARY}`}>Next Prompt</button>}
        </>
      )}
      {children}
    </FrameLocal>
  );
}

