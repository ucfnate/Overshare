'use client';

import React, { useState, useEffect } from 'react';
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
  const [sessionListener, setSessionListener] = useState(null);
  // Add these state variables with your existing ones
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [usedCategories, setUsedCategories] = useState([]);
  const [turnHistory, setTurnHistory] = useState([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

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

  const relationshipOptions = [
    'Romantic partner/spouse',
    'Close friend (know each other well)',
    'Friend (hang out regularly)',
    'Family member',
    'Coworker/colleague', 
    'Acquaintance (don\'t know well)',
    'Just met/new friend'
  ];

  const questionCategories = {
    icebreakers: {
      name: 'Icebreakers',
      icon: Sparkles,
      description: 'Light, fun questions to get everyone talking',
      color: 'from-blue-400 to-cyan-400',
      questions: [
        "If you could have any superpower for just one day, what would you do with it?",
        "What's the weirdest food combination you actually enjoy?",
        "If you could instantly become an expert at any skill, what would you choose?",
        "What's something you believed as a kid that makes you laugh now?",
        "If you could have dinner with any fictional character, who would it be?",
        "What's the most useless talent you have?",
        "If you could rename yourself, what name would you choose?",
        "What's the strangest compliment you've ever received?",
        "If you could live in any TV show universe, which would you pick?",
        "What's something everyone seems to love that you just don't get?",
        "If you could ask your pet one question, what would it be?",
        "What's the most embarrassing thing you've googled?",
        "If you could swap lives with anyone for a week, who would it be?",
        "What's a skill you wish was taught in school but wasn't?",
        "If you could make one rule that everyone had to follow, what would it be?"
      ]
    },
    deep_dive: {
      name: 'Deep Dive',
      icon: Heart,
      description: 'Meaningful questions for genuine connection',
      color: 'from-purple-400 to-pink-400',
      questions: [
        "What's a belief you held strongly as a child that you've completely changed your mind about?",
        "What's the most important lesson you've learned about yourself in the past year?",
        "If you could send a message to your past self, what age would you choose and what would you say?",
        "What's something you're secretly proud of but rarely talk about?",
        "What fear have you overcome that you're most grateful for conquering?",
        "What's a conversation you've been avoiding that you know you need to have?",
        "What's something about yourself that you hope never changes?",
        "If you knew you couldn't fail, what would you attempt?",
        "What's the kindest thing someone has ever done for you?",
        "What do you wish people understood about you without you having to explain it?",
        "What's a moment when you felt most proud of who you are?",
        "What's something you've forgiven yourself for that was hard to let go?",
        "What would you want to be remembered for?",
        "What's a risk you took that taught you something important about yourself?",
        "What's the most valuable piece of advice you've received but initially ignored?"
      ]
    },
    creative: {
      name: 'Creative & Imaginative',
      icon: Lightbulb,
      description: 'Fun hypotheticals and creative scenarios',
      color: 'from-yellow-400 to-orange-400',
      questions: [
        "If you could design a new holiday, what would it celebrate and how would people observe it?",
        "You can time travel but only to observe, not change anything. Where/when do you go?",
        "If you could add one feature to the human body, what would make life better?",
        "You're designing a theme park. What's your signature ride or attraction?",
        "If you could make any two animals swap sounds, which would be the funniest combination?",
        "You can give everyone in the world one book to read. Which book changes everything?",
        "If you could redesign how humans sleep, what would you change?",
        "You're creating a new planet. What's one unique feature that makes it special?",
        "If you could make one everyday object sentient, what would be most interesting?",
        "You can add background music to real life. What plays during different activities?",
        "If you could change one law of physics temporarily, what chaos would you create?",
        "You're founding a new country. What's your national motto and why?",
        "If you could give everyone a new sense (beyond the five we have), what would it be?",
        "You can make one extinct animal come back to life. What's your choice and why?",
        "If you could redesign the concept of money, what would the new system look like?"
      ]
    },
    spicy: {
      name: 'Spicy',
      icon: Flame,
      description: 'Bold questions for adventurous groups',
      color: 'from-red-400 to-pink-400',
      questions: [
        "What's something you've never told anyone but would feel relieved to share?",
        "What's the most embarrassing thing you've done when you had a crush on someone?",
        "If you could read minds for one day, whose thoughts would you be most curious about?",
        "What's a secret skill or talent you have that would surprise people?",
        "What's the most rebellious thing you've ever done?",
        "If you could anonymously tell someone exactly what you think of them, who would it be?",
        "What's something you judge people for but probably shouldn't?",
        "What's the biggest lie you've told to avoid hurting someone's feelings?",
        "If you could erase one memory from your life, what would it be?",
        "What's something you pretend to like but actually can't stand?",
        "What's the most awkward misunderstanding you've been part of?",
        "If you could know the honest answer to any question about yourself, what would you ask?",
        "What's something you've done that you'd never want your parents to find out about?",
        "What's your most unpopular opinion that you'd defend?",
        "If you could switch lives with someone you know for 24 hours, who would you choose?"
      ]
    },
    growth: {
      name: 'Goals & Growth',
      icon: Target,
      description: 'Future-focused and aspirational questions',
      color: 'from-green-400 to-blue-400',
      questions: [
        "What's something you want to be brave enough to do in the next year?",
        "If you could master one area of your life completely, which would have the biggest impact?",
        "What's a habit you want to build that would change your daily life for the better?",
        "What's something you used to dream about that you've stopped pursuing? Why?",
        "If you could give your future self one piece of advice, what would it be?",
        "What's a skill you want to develop that would make you feel more confident?",
        "What's something you want to stop caring so much about?",
        "If you could change one thing about how you spend your time, what would it be?",
        "What's a fear you want to face head-on this year?",
        "What's something you want to create or build in your lifetime?",
        "If you could develop one character trait overnight, what would serve you best?",
        "What's a relationship in your life you want to invest more energy in?",
        "What's something you want to experience before you turn [next milestone age]?",
        "What's a way you want to challenge yourself that excites and scares you?",
        "If you could design your ideal typical day five years from now, what would it look like?"
      ]
    }
  };

  // Smart category recommendation based on group composition and survey answers
  const recommendCategories = (players, relationships) => {
    const intimacyScore = calculateGroupIntimacy(relationships);
    const comfortLevel = getGroupComfortLevel(players);
    const groupSize = players.length;

    let recommended = [];

    // Always include icebreakers for groups > 3 or low intimacy
    if (groupSize > 3 || intimacyScore < 3) {
      recommended.push('icebreakers');
    }

    // Add creative for mixed groups
    if (groupSize > 2) {
      recommended.push('creative');
    }

    // Add deep dive for close relationships and high comfort
    if (intimacyScore >= 3 && comfortLevel >= 3) {
      recommended.push('deep_dive');
    }

    // Add growth for couples or very close friends
    if (intimacyScore >= 4 || (groupSize === 2 && intimacyScore >= 3)) {
      recommended.push('growth');
    }

    // Only suggest spicy for very comfortable groups
    if (intimacyScore >= 4 && comfortLevel >= 4 && groupSize <= 4) {
      recommended.push('spicy');
    }

    return recommended;
  };

  const calculateGroupIntimacy = (relationships) => {
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
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const getGroupComfortLevel = (players) => {
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
  };

  // Enhanced question generation with category logic
  const generatePersonalizedQuestion = (players, surveyData, relationships, forceCategory = null) => {
    let category = forceCategory;
    
    if (!category) {
      // If no categories selected, pick one intelligently
      if (selectedCategories.length === 0) {
        const recommended = recommendCategories(players, relationships);
        category = recommended[Math.floor(Math.random() * recommended.length)] || 'icebreakers';
      } else {
        // Pick from selected categories
        category = selectedCategories[Math.floor(Math.random() * selectedCategories.length)];
      }
    }

    const categoryQuestions = questionCategories[category]?.questions || questionCategories.icebreakers.questions;
    const question = categoryQuestions[Math.floor(Math.random() * categoryQuestions.length)];
    
    setCurrentCategory(category);
    return question;
  };

  // Firebase functions
  // Update your createFirebaseSession function to include turn data
  const createFirebaseSession = async (sessionCode, hostPlayer) => {
    try {
      await setDoc(doc(db, 'sessions', sessionCode), {
        hostId: hostPlayer.id,
        players: [hostPlayer],
        currentQuestion: '',
        gameState: 'waiting',
        selectedCategories: [],
        // NEW: Turn system data
        currentTurnIndex: 0,
        availableCategories: [],
        usedCategories: [],
        turnHistory: [], // Track who picked what
        createdAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error creating session:', error);
      return false;
    }
  };

  const joinFirebaseSession = async (sessionCode, player) => {
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data();
        const updatedPlayers = [...sessionData.players, player];
        
        await updateDoc(sessionRef, {
          players: updatedPlayers
        });
        
        return sessionData;
      } else {
        throw new Error('Session not found');
      }
    } catch (error) {
      console.error('Error joining session:', error);
      return null;
    }
  };

  const updateGameQuestion = async (sessionCode, question, category) => {
    try {
      await updateDoc(doc(db, 'sessions', sessionCode), {
        currentQuestion: question,
        currentCategory: category,
        gameState: 'playing'
      });
    } catch (error) {
      console.error('Error updating question:', error);
    }
  };

  const updateSessionCategories = async (sessionCode, categories) => {
    try {
      await updateDoc(doc(db, 'sessions', sessionCode), {
        selectedCategories: categories
      });
    } catch (error) {
      console.error('Error updating categories:', error);
    }
  };

  const listenToSession = (sessionCode) => {
    console.log('🚀 Setting up listener for session:', sessionCode);
    
    const sessionRef = doc(db, 'sessions', sessionCode);
    
    const unsubscribe = onSnapshot(sessionRef, (doc) => {
      console.log('🔥 Listener triggered! Doc exists:', doc.exists());
      
      if (doc.exists()) {
        const data = doc.data();
        console.log('📊 Session data:', data);
        
        // Update existing state
        setPlayers([...data.players || []]);
        setCurrentQuestion(data.currentQuestion || '');
        setCurrentCategory(data.currentCategory || '');
        setSelectedCategories([...data.selectedCategories || []]);
        
        // Update new turn-related state
        setCurrentTurnIndex(data.currentTurnIndex || 0);
        setAvailableCategories([...data.availableCategories || []]);
        setUsedCategories([...data.usedCategories || []]);
        setTurnHistory([...data.turnHistory || []]);
        
        // Handle game state transitions
        if (data.gameState === 'playing' && gameState !== 'playing') {
          setGameState('playing');
        } else if (data.gameState === 'categoryPicking' && gameState !== 'categoryPicking') {
          setGameState('categoryPicking');
        }
      } else {
        console.log('❌ Session document does not exist');
      }
    }, (error) => {
      console.error('❌ Firebase listener error:', error);
    });
    
    // Store the unsubscribe function directly (not in state)
    window.currentSessionListener = unsubscribe;
    
    return unsubscribe;
  };

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (window.currentSessionListener) {
        console.log('🧹 Cleaning up listener');
        window.currentSessionListener();
        window.currentSessionListener = null;
      }
    };
  }, []);

  const handleSurveySubmit = () => {
    if (Object.keys(surveyAnswers).length === initialSurveyQuestions.length) {
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
    
    const success = await createFirebaseSession(code, hostPlayer);
    
    if (success) {
      setSessionCode(code);
      setIsHost(true);
      setPlayers([hostPlayer]);
      setGameState('categorySelection');
      
      // Add delay before listener
      setTimeout(() => {
        console.log('Starting listener after delay');
        listenToSession(code);
      }, 1000);
    } else {
      alert('Failed to create session. Please try again.');
    }
  };

  const handleJoinSession = async () => {
    if (sessionCode.trim()) {
      // Don't add player yet - just check if session exists
      const sessionRef = doc(db, 'sessions', sessionCode.trim().toUpperCase());
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data();
        setPlayers(sessionData.players);
        setSelectedCategories(sessionData.selectedCategories || []);
        setGameState('relationshipSurvey');
        setSessionCode(sessionCode.trim().toUpperCase());
        
        // Start listening to session updates
        listenToSession(sessionCode.trim().toUpperCase());
      } else {
        alert('Session not found. Please check the code and try again.');
      }
    }
  };

  const handleRelationshipSurveySubmit = async () => {
    // Create the player object when relationship survey is complete
    const currentPlayer = {
      id: Date.now().toString(),
      name: playerName,
      isHost: false,
      surveyAnswers,
      relationshipAnswers,
      joinedAt: new Date().toISOString()
    };
    
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data();
        // Add the new player to the session
        const updatedPlayers = [...sessionData.players, currentPlayer];
        
        await updateDoc(sessionRef, {
          players: updatedPlayers
        });
        
        // If categories are already selected, go to waiting room, otherwise go to category selection
        if (sessionData.selectedCategories && sessionData.selectedCategories.length > 0) {
          setGameState('waitingRoom');
        } else {
          setGameState('categorySelection');
        }
      }
    } catch (error) {
      console.error('Error updating player data:', error);
    }
  };

  const handleCategorySelection = async () => {
    if (isHost) {
      await updateSessionCategories(sessionCode, selectedCategories);
    }
    setGameState('waitingRoom');
  };

  const handleStartGame = async () => {
    // Initialize turn-based system
    await updateDoc(doc(db, 'sessions', sessionCode), {
      gameState: 'categoryPicking',
      currentTurnIndex: 0,
      availableCategories: selectedCategories,
      usedCategories: [],
      turnHistory: []
    });
    setGameState('categoryPicking');
  };

  const handleCategoryPicked = async (category) => {
    const currentPlayer = players[currentTurnIndex];
    const question = generatePersonalizedQuestion(players, surveyAnswers, relationshipAnswers, category);
    
    // Update Firebase with the selected category and question
    const newUsedCategories = [...usedCategories, category];
    const newAvailableCategories = availableCategories.filter(c => c !== category);
    const newTurnHistory = [...turnHistory, {
      player: currentPlayer.name,
      category: category,
      question: question
    }];
    
    await updateDoc(doc(db, 'sessions', sessionCode), {
      currentQuestion: question,
      currentCategory: category,
      gameState: 'playing',
      usedCategories: newUsedCategories,
      availableCategories: newAvailableCategories,
      turnHistory: newTurnHistory,
      currentQuestionAsker: currentPlayer.name
    });
    
    setCurrentQuestion(question);
    setGameState('playing');
  };

  const handleNextQuestion = async () => {
    // Move to next player's turn
    const nextTurnIndex = (currentTurnIndex + 1) % players.length;
    
    // Check if we need to reset categories (when all have been used)
    let newAvailableCategories = availableCategories;
    let newUsedCategories = usedCategories;
    
    // If no categories are available, reset them
    if (availableCategories.length === 0) {
      newAvailableCategories = selectedCategories;
      newUsedCategories = [];
    }
    
    await updateDoc(doc(db, 'sessions', sessionCode), {
      gameState: 'categoryPicking',
      currentTurnIndex: nextTurnIndex,
      availableCategories: newAvailableCategories,
      usedCategories: newUsedCategories
    });
    
    setCurrentTurnIndex(nextTurnIndex);
    setAvailableCategories(newAvailableCategories);
    setUsedCategories(newUsedCategories);
    setGameState('categoryPicking');
  };

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
              className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg"
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
    
    if (currentQuestionIndex >= initialSurveyQuestions.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="mb-6">
              <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Perfect, {playerName}!</h2>
              <p className="text-gray-600">We'll use this to create personalized questions for your group.</p>
            </div>
            
            <button
              onClick={handleSurveySubmit}
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
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">Question {currentQuestionIndex + 1} of {initialSurveyQuestions.length}</span>
              <div className="w-16 h-2 bg-gray-200 rounded-full">
                <div 
                  className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                  style={{ width: `${((currentQuestionIndex + 1) / initialSurveyQuestions.length) * 100}%` }}
                ></div>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">{currentSurveyQuestion.question}</h2>
          </div>
          
          <div className="space-y-3">
            {currentSurveyQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => {
                  setSurveyAnswers({
                    ...surveyAnswers,
                    [currentSurveyQuestion.id]: option
                  });
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

  // Create or Join Screen
  if (gameState === 'createOrJoin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Ready to play, {playerName}!</h2>
          
          <div className="space-y-4">
            <button
              onClick={handleCreateSession}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center"
            >
              <Users className="w-5 h-5 mr-2" />
              Create New Game
            </button>
            
            <div className="flex items-center my-4">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="px-4 text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>
            
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Enter session code"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg font-mono"
              />
              <button
                onClick={handleJoinSession}
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

  // Relationship Survey Screen
  if (gameState === 'relationshipSurvey') {
    const currentPlayerIndex = Object.keys(relationshipAnswers).length;
    // Filter out yourself from the players list
    const otherPlayers = players.filter(p => p.name !== playerName);
    const currentPlayer = otherPlayers[currentPlayerIndex];
    
    if (currentPlayerIndex >= otherPlayers.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="mb-6">
              <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Great!</h2>
              <p className="text-gray-600">Now let's choose what types of questions you want to explore.</p>
            </div>
            
            <button
              onClick={handleRelationshipSurveySubmit}
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
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">Player {currentPlayerIndex + 1} of {otherPlayers.length}</span>
              <div className="w-16 h-2 bg-gray-200 rounded-full">
                <div 
                  className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                  style={{ width: `${((currentPlayerIndex + 1) / otherPlayers.length) * 100}%` }}
                ></div>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">How are you connected to {currentPlayer?.name}?</h2>
            <p className="text-gray-600 text-sm">This helps us create better questions for your group.</p>
          </div>
          
          <div className="space-y-3">
            {relationshipOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => {
                  setRelationshipAnswers({
                    ...relationshipAnswers,
                    [currentPlayer.name]: option
                  });
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

  // Category Selection Screen
  if (gameState === 'categorySelection') {
    const recommended = recommendCategories(players, relationshipAnswers);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Choose Your Question Style</h2>
            <p className="text-gray-600">Select the types of questions you want (you can pick multiple)</p>
          </div>
          
          <div className="space-y-3 mb-6">
            {Object.entries(questionCategories).map(([key, category]) => {
              const IconComponent = category.icon;
              const isRecommended = recommended.includes(key);
              const isSelected = selectedCategories.includes(key);
              
              return (
                <button
                  key={key}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedCategories(selectedCategories.filter(c => c !== key));
                    } else {
                      setSelectedCategories([...selectedCategories, key]);
                    }
                  }}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category.color}`}>
                      <IconComponent className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-gray-800">{category.name}</h3>
                        {isRecommended && (
                          <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handleCategorySelection}
              disabled={selectedCategories.length === 0}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue with {selectedCategories.length} {selectedCategories.length === 1 ? 'Category' : 'Categories'}
            </button>
            
            <button
              onClick={() => {
                setSelectedCategories(recommended);
                handleCategorySelection();
              }}
              className="w-full bg-white border-2 border-purple-500 text-purple-500 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 transition-all"
            >
              Use Recommended Categories
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Room Screen
  if (gameState === 'waitingRoom') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Session {sessionCode}</h2>
            <p className="text-gray-600">Share this code with others to join</p>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Players ({players.length})</h3>
            <div className="space-y-2">
              {players.map((player, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="font-medium">{player.name}</span>
                  {player.isHost && <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">Host</span>}
                </div>
              ))}
            </div>
          </div>

          {selectedCategories.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Question Categories</h3>
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map(categoryKey => {
                  const category = questionCategories[categoryKey];
                  const IconComponent = category.icon;
                  return (
                    <div
                      key={categoryKey}
                      className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r ${category.color} text-white text-sm`}
                    >
                      <IconComponent className="w-4 h-4" />
                      <span>{category.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Game
            </button>
          )}
          
          {!isHost && (
            <p className="text-gray-500">Waiting for host to start the game...</p>
          )}
        </div>
      </div>
    );
  }

  // Category Picking Screen (Turn-based)
  if (gameState === 'categoryPicking') {
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.name === playerName;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            {isMyTurn ? (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Turn!</h2>
                <p className="text-gray-600">Choose a category for the next question</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{currentPlayer?.name}'s Turn</h2>
                <p className="text-gray-600">{currentPlayer?.name} is choosing a category...</p>
              </>
            )}
            <p className="text-sm text-gray-500 mt-2">Round {Math.floor(turnHistory.length / players.length) + 1}</p>
          </div>
          
          {isMyTurn ? (
            <div className="space-y-3">
              {availableCategories.length > 0 ? (
                availableCategories.map((categoryKey) => {
                  const category = questionCategories[categoryKey];
                  const IconComponent = category.icon;
                  
                  return (
                    <button
                      key={categoryKey}
                      onClick={() => handleCategoryPicked(categoryKey)}
                      className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category.color}`}>
                          <IconComponent className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{category.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                        </div>
                      </div>
                    </button>
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
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-500">Waiting for {currentPlayer?.name} to choose...</p>
            </div>
          )}
          
          {usedCategories.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Already Used:</h3>
              <div className="flex flex-wrap gap-2">
                {usedCategories.map(categoryKey => {
                  const category = questionCategories[categoryKey];
                  return (
                    <span
                      key={categoryKey}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full"
                    >
                      {category.name}
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

  // Playing Screen
  if (gameState === 'playing') {
    const currentCategoryData = questionCategories[currentCategory];
    const IconComponent = currentCategoryData?.icon || MessageCircle;
    const currentPlayer = players[currentTurnIndex] || players[0];

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
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
            
            <h2 className="text-lg font-semibold text-gray-800 mb-2">{currentPlayer?.name}'s Question</h2>
            <p className="text-sm text-gray-500 mb-4">Round {Math.floor(turnHistory.length / players.length) + 1} • Turn {(turnHistory.length % players.length) + 1} of {players.length}</p>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border-l-4 border-purple-500">
              <p className="text-gray-800 text-lg leading-relaxed">{currentQuestion}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {isHost && (
              <button
                onClick={handleNextQuestion}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
              >
                Next Player's Turn ({players[(currentTurnIndex + 1) % players.length]?.name})
              </button>
            )}
            
            <button
              onClick={() => setGameState('waitingRoom')}
              className="w-full bg-white border-2 border-gray-300 text-gray-600 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-all"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
