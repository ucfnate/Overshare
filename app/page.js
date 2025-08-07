'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, MessageCircle, Heart, Sparkles, Lightbulb, Target, Flame } from 'lucide-react';
import { db } from '../lib/firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

import { questionCategories as questionData } from '../lib/questionCategories';

// --- Optimizations: Define constants outside the component so they are not recreated on every render ---

// Icon mapping for imported question categories
const iconMap = {
  'Sparkles': Sparkles,
  'Heart': Heart,
  'Lightbulb': Lightbulb,
  'Target': Target,
  'Flame': Flame,
  'MessageCircle': MessageCircle
};

// Transform the imported data to include actual icon components
const questionCategories = Object.entries(questionData).reduce((acc, [key, category]) => {
  acc[key] = {
    ...category,
    icon: iconMap[category.icon] || MessageCircle
  };
  return acc;
}, {});

const initialSurveyQuestions = [
    {
      id: 'personality',
      question: 'How would you describe yourself in social settings?',
      options: ['Outgoing & Love being center of attention', 'Friendly but prefer smaller groups', 'Thoughtful listener who observes first', 'Quiet but warm up over time']
    },
    {
      id: 'comfort_level',
      question: 'In conversations, you prefer:',
      options: ['Light, fun topics that make everyone laugh', 'Mix of light and meaningful discussions', 'Deep, personal conversations', 'Thought-provoking questions about life']
    },
    {
      id: 'sharing_style',
      question: 'When sharing personal things, you:',
      options: ['Share openly and easily', 'Share when others share first', 'Prefer to listen more than share', 'Share deeply with close people only']
    },
    {
      id: 'group_energy',
      question: 'You contribute best to group conversations when:',
      options: ['Everyone is laughing and having fun', 'There\'s a good mix of personalities', 'People are being real and authentic', 'The conversation has depth and meaning']
    }
];

// FIX #1: Define the missing relationshipOptions array
const relationshipOptions = [
    'Romantic partner/spouse',
    'Close friend (know each other well)',
    'Friend (hang out regularly)',
    'Family member',
    'Coworker/colleague',
    'Acquaintance (don\'t know well)',
    'Just met/new friend'
];


export default function Overshare() {
  const [gameState, setGameState] = useState('welcome');
  const [playerName, setPlayerName] = useState('');
  const [surveyAnswers, setSurveyAnswers] = useState({});
  const [relationshipAnswers, setRelationshipAnswers] = useState({});
  const [sessionCode, setSessionCode] = useState('');
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentCategory, setCurrentCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [usedCategories, setUsedCategories] = useState([]);
  const [turnHistory, setTurnHistory] = useState([]);
  const [categoryVotes, setCategoryVotes] = useState({});
  const [myVotedCategories, setMyVotedCategories] = useState([]);

  // --- Memoized Functions for Performance ---

  const calculateGroupIntimacy = useCallback((relationships) => {
    if (!relationships || Object.keys(relationships).length === 0) return 2;
    const intimacyMap = {
      'Romantic partner/spouse': 5,
      'Close friend (know each other well)': 4,
      'Friend (hang out regularly)': 3,
      'Family member': 4,
      'Coworker/colleague': 2,
      'Acquaintance (don\'t know well)': 1,
      'Just met/new friend': 1
    };
    const scores = Object.values(relationships).map(rel => intimacyMap[rel] || 2);
    if (scores.length === 0) return 2;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, []);

  const getGroupComfortLevel = useCallback((players) => {
    if (!players || players.length === 0) return 2;
    const comfortMap = {
      'Light, fun topics that make everyone laugh': 2,
      'Mix of light and meaningful discussions': 3,
      'Deep, personal conversations': 4,
      'Thought-provoking questions about life': 4
    };
    const scores = players
      .filter(p => p.surveyAnswers?.comfort_level)
      .map(p => comfortMap[p.surveyAnswers.comfort_level] || 2);
    if (scores.length === 0) return 2;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, []);

  const recommendCategories = useMemo(() => {
    const intimacyScore = calculateGroupIntimacy(relationshipAnswers);
    const comfortLevel = getGroupComfortLevel(players);
    const groupSize = players.length;
    let recommended = [];

    if (groupSize > 3 || intimacyScore < 3) recommended.push('icebreakers');
    if (groupSize > 2) recommended.push('creative');
    if (intimacyScore >= 3 && comfortLevel >= 3) recommended.push('deep_dive');
    if (intimacyScore >= 4 || (groupSize === 2 && intimacyScore >= 3)) recommended.push('growth');
    if (intimacyScore >= 4 && comfortLevel >= 4 && groupSize <= 4) recommended.push('spicy');
    
    return recommended.length > 0 ? recommended : ['icebreakers']; // Fallback
  }, [players, relationshipAnswers, calculateGroupIntimacy, getGroupComfortLevel]);

  const calculateTopCategories = useMemo(() => {
    const voteCount = {};
    Object.values(categoryVotes).forEach(playerVotes => {
      playerVotes.forEach(category => {
        voteCount[category] = (voteCount[category] || 0) + 1;
      });
    });
    const sortedCategories = Object.entries(voteCount)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);
    return sortedCategories.slice(0, Math.min(4, Math.max(3, sortedCategories.length)));
  }, [categoryVotes]);


  // --- Firebase Functions ---

  const createFirebaseSession = useCallback(async (code, hostPlayer) => {
    try {
      await setDoc(doc(db, 'sessions', code), {
        hostId: hostPlayer.id,
        players: [hostPlayer],
        currentQuestion: '',
        gameState: 'waiting',
        selectedCategories: [],
        currentTurnIndex: 0,
        availableCategories: [],
        usedCategories: [],
        turnHistory: [],
        categoryVotes: {},
        createdAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error creating session:', error);
      return false;
    }
  }, []);

  const listenToSession = useCallback((sessionCode) => {
    console.log('🚀 Setting up listener for session:', sessionCode);
    const sessionRef = doc(db, 'sessions', sessionCode);
    const unsubscribe = onSnapshot(sessionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setPlayers(data.players || []);
        setCurrentQuestion(data.currentQuestion || '');
        setCurrentCategory(data.currentCategory || '');
        setSelectedCategories(data.selectedCategories || []);
        setCurrentTurnIndex(data.currentTurnIndex || 0);
        setAvailableCategories(data.availableCategories || []);
        setUsedCategories(data.usedCategories || []);
        setTurnHistory(data.turnHistory || []);
        setCategoryVotes(data.categoryVotes || {});
        
        if (data.gameState && gameState !== data.gameState) {
          setGameState(data.gameState);
        }
      } else {
        console.log('❌ Session document does not exist');
        alert("Session has ended or does not exist.");
        setGameState('welcome');
      }
    }, (error) => {
      console.error('❌ Firebase listener error:', error);
    });

    return unsubscribe;
  }, [gameState]);

  // Cleanup listener on component unmount or when session code changes
  useEffect(() => {
    let unsubscribe;
    if (sessionCode) {
      unsubscribe = listenToSession(sessionCode);
    }
    return () => {
      if (unsubscribe) {
        console.log('🧹 Cleaning up listener');
        unsubscribe();
      }
    };
  }, [sessionCode, listenToSession]);


  // --- Event Handlers ---

  const handleSurveySubmit = useCallback(() => {
    if (Object.keys(surveyAnswers).length === initialSurveyQuestions.length) {
      setGameState('createOrJoin');
    }
  }, [surveyAnswers]);

  const handleCreateSession = useCallback(async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostPlayer = {
      id: Date.now().toString(),
      name: playerName,
      isHost: true,
      surveyAnswers,
      joinedAt: new Date().toISOString()
    };
    
    const success = await createFirebaseSession(code, hostPlayer);
    if (success) {
      setIsHost(true);
      setSessionCode(code); // This will trigger the useEffect to listen
      setGameState('waitingRoom');
    } else {
      alert('Failed to create session. Please try again.');
    }
  }, [playerName, surveyAnswers, createFirebaseSession]);

  const handleJoinSession = useCallback(async () => {
    const code = sessionCode.trim().toUpperCase();
    if (!code) return;

    const sessionRef = doc(db, 'sessions', code);
    const sessionSnap = await getDoc(sessionRef);

    if (sessionSnap.exists()) {
      setSessionCode(code); // This will trigger the useEffect to listen
      setGameState('waitingRoom');
    } else {
      alert('Session not found. Please check the code and try again.');
    }
  }, [sessionCode]);

  const handleRelationshipSurveySubmit = useCallback(async () => {
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data();
        const updatedPlayers = sessionData.players.map(p =>
          p.name === playerName ? { ...p, relationshipAnswers } : p
        );
        
        await updateDoc(sessionRef, { players: updatedPlayers });

        const allCompleted = updatedPlayers.every(p => p.relationshipAnswers || p.isHost); // Host might not have relationships if they are first
        if (allCompleted) {
          await updateDoc(sessionRef, {
            gameState: 'categoryPicking',
            currentTurnIndex: 0
          });
        } else {
          setGameState('waitingForOthers');
        }
      }
    } catch (error) {
      console.error('Error updating player data:', error);
    }
  }, [sessionCode, playerName, relationshipAnswers]);

  const handleCategoryVote = useCallback(async (selectedCats) => {
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data();
        const currentVotes = { ...sessionData.categoryVotes, [playerName]: selectedCats };

        await updateDoc(sessionRef, { categoryVotes: currentVotes });
        setMyVotedCategories(selectedCats);

        const allPlayersVoted = sessionData.players.every(player => currentVotes[player.name]);
        if (allPlayersVoted && isHost) {
          await updateDoc(sessionRef, { gameState: 'waitingForHost' });
        }
      }
    } catch (error) {
      console.error('Error submitting category votes:', error);
    }
  }, [sessionCode, playerName, isHost]);

  const handleStartGameAfterVoting = useCallback(async () => {
      if (!isHost) return;
      await updateDoc(doc(db, 'sessions', sessionCode), {
        gameState: 'relationshipSurvey',
        selectedCategories: calculateTopCategories,
        availableCategories: calculateTopCategories
      });
  }, [isHost, sessionCode, calculateTopCategories]);
  
  const handleCategoryPicked = useCallback(async (category) => {
    const currentPlayer = players[currentTurnIndex];
    const categoryQuestions = questionCategories[category]?.questions || questionCategories.icebreakers.questions;
    const question = categoryQuestions[Math.floor(Math.random() * categoryQuestions.length)];

    const newUsedCategories = [...usedCategories, category];
    const newAvailableCategories = availableCategories.filter(c => c !== category);
    const newTurnHistory = [...turnHistory, { player: currentPlayer.name, category, question }];

    await updateDoc(doc(db, 'sessions', sessionCode), {
      currentQuestion: question,
      currentCategory: category,
      gameState: 'playing',
      usedCategories: newUsedCategories,
      availableCategories: newAvailableCategories,
      turnHistory: newTurnHistory,
      currentQuestionAsker: currentPlayer.name
    });
  }, [players, currentTurnIndex, usedCategories, availableCategories, turnHistory, sessionCode]);
  
  const handleNextQuestion = useCallback(async () => {
    const nextTurnIndex = (currentTurnIndex + 1) % players.length;
    let newAvailable = availableCategories;
    let newUsed = usedCategories;

    if (availableCategories.length === 0) {
      newAvailable = selectedCategories;
      newUsed = [];
    }

    await updateDoc(doc(db, 'sessions', sessionCode), {
      gameState: 'categoryPicking',
      currentTurnIndex: nextTurnIndex,
      availableCategories: newAvailable,
      usedCategories: newUsed,
      currentQuestion: ''
    });
  }, [currentTurnIndex, players.length, availableCategories, usedCategories, selectedCategories, sessionCode]);
  

  // --- Render Logic ---
  
  // Welcome Screen
  if (gameState === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
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
            onClick={() => playerName.trim() && setGameState('survey')}
            disabled={!playerName.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Let's Get Started
          </button>
        </div>
      </div>
    );
  }

  // Survey Screen
  if (gameState === 'survey') {
    const currentQuestionIndex = Object.keys(surveyAnswers).length;
    const currentSurveyQuestion = initialSurveyQuestions[currentQuestionIndex];
    
    if (!currentSurveyQuestion) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Perfect, {playerName}!</h2>
            <p className="text-gray-600">We'll use this to create personalized questions for your group.</p>
            <button onClick={handleSurveySubmit} className="mt-6 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all">
              Continue
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">Question {currentQuestionIndex + 1} of {initialSurveyQuestions.length}</span>
              <div className="w-full h-2 bg-gray-200 rounded-full ml-4">
                <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all" style={{ width: `${((currentQuestionIndex + 1) / initialSurveyQuestions.length) * 100}%` }}/>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">{currentSurveyQuestion.question}</h2>
          </div>
          <div className="space-y-3">
            {currentSurveyQuestion.options.map((option, index) => (
              <button key={index} onClick={() => setSurveyAnswers({...surveyAnswers, [currentSurveyQuestion.id]: option})} className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all">
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Create or Join Screen
  if (gameState === 'createOrJoin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Ready to play, {playerName}!</h2>
          <div className="space-y-4">
            <button onClick={handleCreateSession} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center">
              <Users className="w-5 h-5 mr-2" /> Create New Game
            </button>
            <div className="flex items-center my-4">
              <div className="flex-1 h-px bg-gray-300"></div><span className="px-4 text-gray-500 text-sm">or</span><div className="flex-1 h-px bg-gray-300"></div>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="ENTER SESSION CODE" value={sessionCode} onChange={(e) => setSessionCode(e.target.value.toUpperCase())} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg font-mono tracking-widest bg-white text-gray-900"/>
              <button onClick={handleJoinSession} disabled={!sessionCode.trim()} className="w-full bg-white border-2 border-purple-500 text-purple-500 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                Join Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- FIX #2: Corrected Relationship Survey Screen ---
  if (gameState === 'relationshipSurvey') {
    // We only ask about other players
    const otherPlayers = players.filter(p => p.name !== playerName);
    const currentPlayerToSurvey = otherPlayers[Object.keys(relationshipAnswers).length];

    if (!currentPlayerToSurvey) {
      // This view shows when the survey is complete for this user
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">All set!</h2>
            <p className="text-gray-600">Thanks for the info. We're ready to start the game.</p>
            <button onClick={handleRelationshipSurveySubmit} className="mt-6 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all">
              See Who's Turn It Is
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">How are you connected to {currentPlayerToSurvey.name}?</h2>
            <p className="text-gray-600 text-sm">This helps us create better questions for your group.</p>
          </div>
          <div className="space-y-3">
            {relationshipOptions.map((option, index) => (
              <button key={index} onClick={() => setRelationshipAnswers({...relationshipAnswers, [currentPlayerToSurvey.name]: option})} className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all">
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Category Voting Screen
  if (gameState === 'categoryVoting') {
    const hasVoted = myVotedCategories.length > 0;
    const waitingFor = players.filter(p => !categoryVotes[p.name]).map(p => p.name);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{hasVoted ? 'Waiting for Others' : 'Vote for Categories'}</h2>
            <p className="text-gray-600">{hasVoted ? `${Object.keys(categoryVotes).length} of ${players.length} players have voted` : 'Select up to 3 categories.'}</p>
          </div>
          
          {!hasVoted ? (
            <>
              <div className="space-y-3 mb-6">
                {Object.entries(questionCategories).map(([key, category]) => {
                  const IconComponent = category.icon;
                  const isSelected = selectedCategories.includes(key);
                  return (
                    <button key={key} onClick={() => {
                        const newSelection = isSelected ? selectedCategories.filter(c => c !== key) : [...selectedCategories, key];
                        if (newSelection.length <= 3) setSelectedCategories(newSelection);
                      }} className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-start space-x-3 ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category.color}`}><IconComponent className="w-4 h-4 text-white" /></div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-800">{category.name}</h3>
                          {recommendCategories.includes(key) && <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">Recommended</span>}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => handleCategoryVote(selectedCategories)} disabled={selectedCategories.length === 0} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50">
                Submit Votes ({selectedCategories.length}/3)
              </button>
            </>
          ) : (
             <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4 animate-spin">
                  <Sparkles className="w-8 h-8 text-purple-500" />
                </div>
                <p className="text-gray-600 mb-2">Waiting for: {waitingFor.join(', ')}</p>
                {isHost && players.length === Object.keys(categoryVotes).length &&
                  <button onClick={handleStartGameAfterVoting} className="mt-4 text-sm text-purple-600 hover:text-purple-700 underline">All votes are in! Click to continue</button>
                }
             </div>
          )}
        </div>
      </div>
    );
  }

  // Waiting for Host Screen (After Category Voting)
  if (gameState === 'waitingForHost') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">All Votes Are In!</h2>
          <p className="text-gray-600 mb-6">Top categories based on everyone's votes:</p>
          <div className="mb-6 space-y-2">
              {calculateTopCategories.map((categoryKey) => {
                  const category = questionCategories[categoryKey];
                  const IconComponent = category.icon;
                  return (
                    <div key={categoryKey} className="flex items-center p-3 rounded-xl bg-purple-50 border-2 border-purple-300">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category.color}`}><IconComponent className="w-4 h-4 text-white" /></div>
                      <span className="font-medium ml-3">{category.name}</span>
                    </div>
                  );
              })}
          </div>
          {isHost ? (
            <button onClick={handleStartGameAfterVoting} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all">
              Let's See How You Know Each Other
            </button>
          ) : (
            <p className="text-gray-500">Waiting for {players.find(p => p.isHost)?.name || 'the host'} to continue...</p>
          )}
        </div>
      </div>
    );
  }

  // Waiting Room
  if (gameState === 'waitingRoom') {
    const isNewPlayer = !players.find(p => p.name === playerName);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Session Code</h2>
          <p className="text-4xl font-mono tracking-widest text-purple-600 mb-4">{sessionCode}</p>
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Players ({players.length})</h3>
            <div className="space-y-2">
              {players.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="font-medium">{player.name}</span>
                  {player.isHost && <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">Host</span>}
                </div>
              ))}
            </div>
          </div>
          
          {isNewPlayer && (
            <button
              onClick={async () => {
                const newPlayer = { id: Date.now().toString(), name: playerName, isHost: false, surveyAnswers, joinedAt: new Date().toISOString() };
                const sessionRef = doc(db, 'sessions', sessionCode);
                await updateDoc(sessionRef, { players: [...players, newPlayer] });
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all mb-4">
              Confirm Your Seat
            </button>
          )}
          
          {isHost && !isNewPlayer && (
            <button
              onClick={async () => { await updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'categoryVoting' }); }}
              disabled={players.length < 2}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              Start Game ({players.length}/2+)
            </button>
          )}
          
          {!isHost && !isNewPlayer && (
            <p className="text-gray-500">Waiting for the host to start the game...</p>
          )}
        </div>
      </div>
    );
  }

  // Category Picking Screen
  if (gameState === 'categoryPicking') {
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.name === playerName;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            {isMyTurn ? (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Turn!</h2>
                <p className="text-gray-600">Choose a category for the next question</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{currentPlayer?.name}'s Turn</h2>
                <p className="text-gray-600">Waiting for them to choose a category...</p>
                <div className="mt-4 inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full"><div className="w-6 h-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>
              </>
            )}
          </div>
          
          {isMyTurn && (
            <div className="space-y-3">
              {availableCategories.length > 0 ? (
                availableCategories.map((categoryKey) => {
                  const category = questionCategories[categoryKey];
                  const IconComponent = category.icon;
                  return (
                    <button key={categoryKey} onClick={() => handleCategoryPicked(categoryKey)} className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all text-left flex items-start space-x-3">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category.color}`}><IconComponent className="w-4 h-4 text-white" /></div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{category.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                        </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <p className="text-gray-600">All categories used! They will reset next round.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Playing Screen
  if (gameState === 'playing') {
    const currentCategoryData = questionCategories[currentCategory];
    const IconComponent = currentCategoryData?.icon || MessageCircle;
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.name === playerName;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            {currentCategoryData && <div className="mb-4"><span className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-gradient-to-r ${currentCategoryData.color} text-white text-sm`}><IconComponent className="w-3 h-3" /><span>{currentCategoryData.name}</span></span></div>}
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{turnHistory[turnHistory.length - 1]?.player}'s Question</h2>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border-l-4 border-purple-500">
              <p className="text-gray-800 text-lg leading-relaxed">{currentQuestion}</p>
            </div>
          </div>
          <div className="space-y-4">
            {isHost ? ( // Only the host should control moving to the next question
              <button onClick={handleNextQuestion} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all">
                Next Player's Turn
              </button>
            ) : (
              <div className="text-center">
                <p className="text-gray-600">Waiting for the host to start the next turn...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Waiting for Others Screen
  if (gameState === 'waitingForOthers') {
    const waitingFor = players.filter(p => !p.relationshipAnswers).map(p => p.name);
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Almost there...</h2>
          <p className="text-gray-600 mb-4">Waiting for others to complete their relationship surveys.</p>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>
          <p className="text-gray-600 mb-2">Still waiting for:</p>
          <p className="text-sm text-gray-500">{waitingFor.join(', ')}</p>
        </div>
      </div>
    );
  }

  return null; // Default return
}
