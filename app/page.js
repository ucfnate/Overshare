'use client';

import React, { useState, useEffect } from 'react';
import { Users, MessageCircle, Heart, Sparkles, Lightbulb, Target, Flame, Volume2, VolumeX, SkipForward } from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';

// Import the external question categories library
import { questionCategories, getRandomQuestion, getCategoryKeys, getCategoryInfo } from '../lib/questionCategories';

export default function Overshare() {
  // ====================================================================
  // STATE MANAGEMENT - Core Game State
  // ====================================================================
  const [gameState, setGameState] = useState('welcome');
  const [playerName, setPlayerName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  
  // ====================================================================
  // STATE MANAGEMENT - Player Data
  // ====================================================================
  const [players, setPlayers] = useState([]);
  const [surveyAnswers, setSurveyAnswers] = useState({});
  const [relationshipAnswers, setRelationshipAnswers] = useState({});
  
  // ====================================================================
  // STATE MANAGEMENT - Game Content
  // ====================================================================
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentCategory, setCurrentCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  
  // ====================================================================
  // STATE MANAGEMENT - Turn System
  // ====================================================================
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [usedCategories, setUsedCategories] = useState([]);
  const [turnHistory, setTurnHistory] = useState([]);
  const [currentQuestionAsker, setCurrentQuestionAsker] = useState('');
  
  // ====================================================================
  // STATE MANAGEMENT - Category Voting System
  // ====================================================================
  const [categoryVotes, setCategoryVotes] = useState({});
  const [myVotedCategories, setMyVotedCategories] = useState([]);
  const [hasVotedCategories, setHasVotedCategories] = useState(false);
  
  // ====================================================================
  // STATE MANAGEMENT - Audio & UI
  // ====================================================================
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  // ====================================================================
  // CONFIGURATION - Survey Questions
  // ====================================================================
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

  // ====================================================================
  // CONFIGURATION - Relationship Options
  // ====================================================================
  const relationshipOptions = [
    'Romantic partner/spouse',
    'Close friend (know each other well)',
    'Friend (hang out regularly)',
    'Family member',
    'Coworker/colleague', 
    'Acquaintance (don\'t know well)',
    'Just met/new friend'
  ];

  // ====================================================================
  // AUDIO SYSTEM - Sound Effects and Music
  // ====================================================================
  const playSound = (type) => {
    if (!audioEnabled) return;
    
    // Create audio context for sound effects
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const sounds = {
      click: () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      },
      success: () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      },
      turnTransition: () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(554, audioContext.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      }
    };
    
    if (sounds[type]) {
      sounds[type]();
    }
  };

  // ====================================================================
  // ALGORITHM - Smart Category Recommendation System
  // ====================================================================
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

  // ====================================================================
  // ALGORITHM - Enhanced Question Generation
  // ====================================================================
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

    const question = getRandomQuestion(category);
    setCurrentCategory(category);
    return question;
  };

  // ====================================================================
  // ALGORITHM - Category Voting System
  // ====================================================================
  const calculateTopCategories = (votes) => {
    const voteCount = {};
    
    // Count votes for each category
    Object.values(votes).forEach(playerVotes => {
      playerVotes.forEach(category => {
        voteCount[category] = (voteCount[category] || 0) + 1;
      });
    });
    
    // Sort categories by vote count
    const sortedCategories = Object.entries(voteCount)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);
    
    // Return top 3-4 categories, or all if less than 3
    return sortedCategories.slice(0, Math.min(4, Math.max(3, sortedCategories.length)));
  };
  // ====================================================================
  // FIREBASE - Session Management Functions
  // ====================================================================
  const createFirebaseSession = async (sessionCode, hostPlayer) => {
    try {
      await setDoc(doc(db, 'sessions', sessionCode), {
        hostId: hostPlayer.id,
        players: [hostPlayer],
        currentQuestion: '',
        currentCategory: '',
        currentQuestionAsker: '',
        gameState: 'waiting',
        selectedCategories: [],
        // Turn system data
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

  const updateGameQuestion = async (sessionCode, question, category, askerName) => {
    try {
      await updateDoc(doc(db, 'sessions', sessionCode), {
        currentQuestion: question,
        currentCategory: category,
        currentQuestionAsker: askerName,
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

  // ====================================================================
  // FIREBASE - Real-time Session Listener
  // ====================================================================
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
        setCurrentQuestionAsker(data.currentQuestionAsker || '');
        setSelectedCategories([...data.selectedCategories || []]);
        
        // Update new turn-related state
        setCurrentTurnIndex(data.currentTurnIndex || 0);
        setAvailableCategories([...data.availableCategories || []]);
        setUsedCategories([...data.usedCategories || []]);
        setTurnHistory([...data.turnHistory || []]);
        setCategoryVotes(data.categoryVotes || {});
        
        // Handle game state transitions with audio feedback
        if (data.gameState === 'playing' && gameState !== 'playing') {
          setGameState('playing');
          playSound('success');
        } else if (data.gameState === 'categoryPicking' && gameState !== 'categoryPicking') {
          setGameState('categoryPicking');
          playSound('turnTransition');
        } else if (data.gameState === 'categoryVoting' && gameState !== 'categoryVoting') {
          setGameState('categoryVoting');
        } else if (data.gameState === 'relationshipSurvey' && gameState !== 'relationshipSurvey') {
          setGameState('relationshipSurvey');
        } else if (data.gameState === 'waitingForHost' && gameState !== 'waitingForHost') {
          setGameState('waitingForHost');
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

  // ====================================================================
  // LIFECYCLE - Cleanup listener on unmount
  // ====================================================================
  useEffect(() => {
    return () => {
      if (window.currentSessionListener) {
        console.log('🧹 Cleaning up listener');
        window.currentSessionListener();
        window.currentSessionListener = null;
      }
    };
  }, []);

  // ====================================================================
  // EVENT HANDLERS - Survey and Initial Setup
  // ====================================================================
  const handleSurveySubmit = () => {
    if (Object.keys(surveyAnswers).length === initialSurveyQuestions.length) {
      playSound('success');
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
      setGameState('waitingRoom');
      playSound('success');
      
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
        setSessionCode(sessionCode.trim().toUpperCase());
        
        // Start listening to session updates
        listenToSession(sessionCode.trim().toUpperCase());
        
        // Go to waiting room first, not relationship survey
        setGameState('waitingRoom');
        playSound('success');
      } else {
        alert('Session not found. Please check the code and try again.');
      }
    }
  };

  // ====================================================================
  // EVENT HANDLERS - Relationship Survey System
  // ====================================================================
  const handleRelationshipSurveySubmit = async () => {
    // Don't create a new player - they already exist
    // Just update with relationship data
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data();
        const updatedPlayers = sessionData.players.map(p => 
          p.name === playerName 
            ? { ...p, relationshipAnswers } 
            : p
        );
        
        await updateDoc(sessionRef, {
          players: updatedPlayers
        });
        
        // Check if all players have completed relationship survey
        const allCompleted = updatedPlayers.every(p => p.relationshipAnswers);
        
        if (allCompleted) {
          // Get the selected categories and start the game
          const sessionData = sessionSnap.data();
          const topCategories = sessionData.selectedCategories || [];
          
          // Move to category picking for first player
          await updateDoc(sessionRef, {
            gameState: 'categoryPicking',
            currentTurnIndex: 0,
            availableCategories: topCategories,
            usedCategories: [],
            turnHistory: []
          });
          setGameState('categoryPicking');
          playSound('success');
        } else {
          // Wait for others
          setGameState('waitingForOthers');
        }
      }
    } catch (error) {
      console.error('Error updating player data:', error);
    }
  };

  // ====================================================================
  // EVENT HANDLERS - Category Voting System (FIXED)
  // ====================================================================
  const handleCategoryVote = async (selectedCats) => {
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data();
        const currentVotes = sessionData.categoryVotes || {};
        
        // Update votes for this player
        currentVotes[playerName] = selectedCats;
        
        await updateDoc(sessionRef, {
          categoryVotes: currentVotes
        });
        
        setMyVotedCategories(selectedCats);
        setHasVotedCategories(true); // FIXED: Set local vote status
        playSound('success');
        
        // Only check if all players have voted when there are multiple players
        if (sessionData.players.length > 1) {
          const allPlayersVoted = sessionData.players.every(player => 
            currentVotes[player.name] && currentVotes[player.name].length > 0
          );
          
          if (allPlayersVoted) {
            // Move to waiting room automatically
            await updateDoc(sessionRef, {
              gameState: 'waitingForHost'
            });
            setGameState('waitingForHost');
          }
        }
        // If only one player (host), just stay in voting screen to show their votes
      }
    } catch (error) {
      console.error('Error submitting category votes:', error);
    }
  };
  // ====================================================================
  // EVENT HANDLERS - Game Flow Control
  // ====================================================================
  const handleStartGame = async () => {
    // Get the selected categories from Firebase (they were already calculated during voting)
    const sessionRef = doc(db, 'sessions', sessionCode);
    const sessionSnap = await getDoc(sessionRef);
    
    if (sessionSnap.exists()) {
      const sessionData = sessionSnap.data();
      const topCategories = sessionData.selectedCategories || calculateTopCategories(categoryVotes);
      
      // Initialize turn-based system with voted categories
      await updateDoc(sessionRef, {
        gameState: 'categoryPicking',
        currentTurnIndex: 0,
        selectedCategories: topCategories,
        availableCategories: topCategories,
        usedCategories: [],
        turnHistory: []
      });
      
      setSelectedCategories(topCategories);
      setAvailableCategories(topCategories);
      setGameState('categoryPicking');
      playSound('success');
    }
  };

  // ====================================================================
  // EVENT HANDLERS - Category Picking System (FIXED)
  // ====================================================================
  const handleCategoryPicked = async (category) => {
    try {
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
      
      console.log('🎯 FIXING: Updating Firebase with question and state change');
      
      await updateDoc(doc(db, 'sessions', sessionCode), {
        currentQuestion: question,
        currentCategory: category,
        gameState: 'playing', // FIXED: Ensure state changes to playing
        usedCategories: newUsedCategories,
        availableCategories: newAvailableCategories,
        turnHistory: newTurnHistory,
        currentQuestionAsker: currentPlayer.name
      });
      
      // FIXED: Also update local state immediately for responsiveness
      setCurrentQuestion(question);
      setCurrentCategory(category);
      setCurrentQuestionAsker(currentPlayer.name);
      setUsedCategories(newUsedCategories);
      setAvailableCategories(newAvailableCategories);
      setTurnHistory(newTurnHistory);
      setGameState('playing');
      
      playSound('success');
      console.log('✅ FIXED: Category picked, moving to playing state');
      
    } catch (error) {
      console.error('❌ Error in handleCategoryPicked:', error);
    }
  };

  // ====================================================================
  // EVENT HANDLERS - Skip Question System (NEW FEATURE)
  // ====================================================================
  const handleSkipQuestion = async () => {
    try {
      const currentPlayer = players[currentTurnIndex];
      
      // Generate a new question from the same category
      const newQuestion = generatePersonalizedQuestion(players, surveyAnswers, relationshipAnswers, currentCategory);
      
      console.log('⏭️ Skipping question, generating new one');
      
      await updateDoc(doc(db, 'sessions', sessionCode), {
        currentQuestion: newQuestion,
        // Keep same category and state
      });
      
      setCurrentQuestion(newQuestion);
      playSound('click');
      
    } catch (error) {
      console.error('❌ Error skipping question:', error);
    }
  };

  // ====================================================================
  // EVENT HANDLERS - Turn Management System
  // ====================================================================
  const handleNextQuestion = async () => {
    try {
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
        usedCategories: newUsedCategories,
        currentQuestion: '', // Clear current question
        currentCategory: '',
        currentQuestionAsker: ''
      });
      
      setCurrentTurnIndex(nextTurnIndex);
      setAvailableCategories(newAvailableCategories);
      setUsedCategories(newUsedCategories);
      setCurrentQuestion('');
      setCurrentCategory('');
      setCurrentQuestionAsker('');
      setGameState('categoryPicking');
      
      playSound('turnTransition');
      
    } catch (error) {
      console.error('❌ Error in handleNextQuestion:', error);
    }
  };

  // ====================================================================
  // UI COMPONENTS - Audio Control
  // ====================================================================
  const AudioControl = () => (
    <button
      onClick={() => {
        setAudioEnabled(!audioEnabled);
        playSound('click');
      }}
      className="fixed top-4 right-4 bg-white/20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 transition-all z-50"
    >
      {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
    </button>
  );

  // ====================================================================
  // UI COMPONENTS - Progress Indicator
  // ====================================================================
  const ProgressIndicator = ({ current, total, className = "" }) => (
    <div className={`w-full h-2 bg-gray-200 rounded-full ${className}`}>
      <div 
        className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
        style={{ width: `${(current / total) * 100}%` }}
      />
    </div>
  );

  // ====================================================================
  // UI COMPONENTS - Category Card
  // ====================================================================
  const CategoryCard = ({ categoryKey, category, isSelected, isRecommended, onClick, disabled = false }) => {
    const IconComponent = category.icon;
    
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
          isSelected 
            ? 'border-purple-500 bg-purple-50' 
            : 'border-gray-200 hover:border-purple-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
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
  };

  // ====================================================================
  // UI COMPONENTS - Player List
  // ====================================================================
  const PlayerList = ({ players, title, showProgress = false, currentPlayerName = null }) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">{title} ({players.length})</h3>
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

  // ====================================================================
  // UI COMPONENTS - Loading Spinner
  // ====================================================================
  const LoadingSpinner = ({ size = "w-8 h-8" }) => (
    <div className="inline-flex items-center justify-center">
      <div className={`${size} border-4 border-purple-500 border-t-transparent rounded-full animate-spin`}></div>
    </div>
  );
// ====================================================================
  // SCREEN COMPONENTS - Welcome Screen
  // ====================================================================
  if (gameState === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <AudioControl />
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
              if (playerName.trim()) {
                playSound('click');
                setGameState('survey');
              }
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

  // ====================================================================
  // SCREEN COMPONENTS - Survey Screen
  // ====================================================================
  if (gameState === 'survey') {
    const currentQuestionIndex = Object.keys(surveyAnswers).length;
    const currentSurveyQuestion = initialSurveyQuestions[currentQuestionIndex];
    
    if (currentQuestionIndex >= initialSurveyQuestions.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <AudioControl />
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="mb-6">
              <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Perfect, {playerName}!</h2>
              <p className="text-gray-600">We'll use this to create personalized questions for your group.</p>
            </div>
            
            <button
              onClick={() => {
                playSound('success');
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
        <AudioControl />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">Question {currentQuestionIndex + 1} of {initialSurveyQuestions.length}</span>
              <ProgressIndicator 
                current={currentQuestionIndex + 1} 
                total={initialSurveyQuestions.length}
                className="w-16"
              />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">{currentSurveyQuestion.question}</h2>
          </div>
          
          <div className="space-y-3">
            {currentSurveyQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => {
                  playSound('click');
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

  // ====================================================================
  // SCREEN COMPONENTS - Create or Join Screen
  // ====================================================================
  if (gameState === 'createOrJoin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <AudioControl />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Ready to play, {playerName}!</h2>
          
          <div className="space-y-4">
            <button
              onClick={() => {
                playSound('click');
                handleCreateSession();
              }}
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
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg font-mono bg-white text-gray-900"
              />
              <button
                onClick={() => {
                  playSound('click');
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

  // ====================================================================
  // SCREEN COMPONENTS - Waiting Room Screen
  // ====================================================================
  if (gameState === 'waitingRoom') {
    const isNewPlayer = !players.find(p => p.name === playerName);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <AudioControl />
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
          
          {isNewPlayer && (
            <button
              onClick={async () => {
                playSound('click');
                // Add player to session
                const newPlayer = {
                  id: Date.now().toString(),
                  name: playerName,
                  isHost: false,
                  surveyAnswers,
                  joinedAt: new Date().toISOString()
                };
                
                const sessionRef = doc(db, 'sessions', sessionCode);
                const sessionSnap = await getDoc(sessionRef);
                
                if (sessionSnap.exists()) {
                  const sessionData = sessionSnap.data();
                  const updatedPlayers = [...sessionData.players, newPlayer];
                  
                  await updateDoc(sessionRef, {
                    players: updatedPlayers
                  });
                  
                  setPlayers(updatedPlayers);
                  playSound('success');
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
                playSound('click');
                // Move everyone to category voting after all players joined
                await updateDoc(doc(db, 'sessions', sessionCode), {
                  gameState: 'categoryVoting'
                });
                setGameState('categoryVoting');
              }}
              disabled={players.length < 2}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Game
            </button>
          )}
          
          {!isHost && !isNewPlayer && (
            <p className="text-gray-500">Waiting for host to continue...</p>
          )}
        </div>
      </div>
    );
  }

  // ====================================================================
  // SCREEN COMPONENTS - Category Voting Screen (FIXED)
  // ====================================================================
  if (gameState === 'categoryVoting') {
    const recommended = recommendCategories(players, relationshipAnswers);
    const allVotes = Object.values(categoryVotes);
    const totalVotes = allVotes.length;
    const waitingFor = players.filter(p => !categoryVotes[p.name]).map(p => p.name);
    const allPlayersVoted = players.every(p => categoryVotes[p.name] && categoryVotes[p.name].length > 0);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <AudioControl />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {hasVotedCategories ? 'Waiting for Others' : 'Vote for Categories'}
            </h2>
            <p className="text-gray-600">
              {hasVotedCategories 
                ? `${totalVotes} of ${players.length} players have voted`
                : 'Select 2-3 categories you\'d like to play with'
              }
            </p>
            {hasVotedCategories && (
              <p className="text-sm text-gray-500 mt-2">Session Code: {sessionCode}</p>
            )}
          </div>
          
          {/* FIXED: Only show voting interface if player hasn't voted */}
          {!hasVotedCategories ? (
            <>
              <div className="space-y-3 mb-6">
                {Object.entries(questionCategories).map(([key, category]) => {
                  const isRecommended = recommended.includes(key);
                  const isSelected = selectedCategories.includes(key);
                  const disabled = !isSelected && selectedCategories.length >= 3;
                  
                  return (
                    <CategoryCard
                      key={key}
                      categoryKey={key}
                      category={category}
                      isSelected={isSelected}
                      isRecommended={isRecommended}
                      disabled={disabled}
                      onClick={() => {
                        playSound('click');
                        if (isSelected) {
                          setSelectedCategories(selectedCategories.filter(c => c !== key));
                        } else if (selectedCategories.length < 3) {
                          setSelectedCategories([...selectedCategories, key]);
                        }
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
            /* FIXED: Show voted categories and waiting status */
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Your Votes:</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {myVotedCategories.map(categoryKey => {
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
              
              {allPlayersVoted && isHost ? (
                <div className="space-y-3">
                  <p className="text-center text-gray-600 mb-4">All players have voted!</p>
                  <button
                    onClick={async () => {
                      playSound('click');
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
                  <p className="text-gray-600 mb-2 mt-4">Waiting for:</p>
                  <p className="text-sm text-gray-500">{waitingFor.join(', ')}</p>
                  
                  {isHost && (
                    <button
                      onClick={async () => {
                        playSound('click');
                        await updateDoc(doc(db, 'sessions', sessionCode), {
                          gameState: 'waitingForHost'
                        });
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
// ====================================================================
  // SCREEN COMPONENTS - Waiting for Host Screen (FIXED Dark Mode)
  // ====================================================================
  if (gameState === 'waitingForHost') {
    const voteResults = {};
    Object.values(categoryVotes).forEach(votes => {
      votes.forEach(cat => {
        voteResults[cat] = (voteResults[cat] || 0) + 1;
      });
    });
    
    const topCategories = calculateTopCategories(categoryVotes);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <AudioControl />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">All Votes Are In!</h2>
            <p className="text-gray-600">Top categories based on everyone's votes:</p>
          </div>
          
          <div className="mb-6">
            <div className="space-y-2">
              {Object.entries(voteResults)
                .sort((a, b) => b[1] - a[1])
                .map(([categoryKey, voteCount]) => {
                  const category = questionCategories[categoryKey];
                  const IconComponent = category.icon;
                  const isSelected = topCategories.includes(categoryKey);
                  
                  return (
                    <div
                      key={categoryKey}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        isSelected ? 'bg-purple-50 border-2 border-purple-300' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category.color}`}>
                          <IconComponent className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium text-gray-800">{category.name}</span>
                      </div>
                      <span className="text-sm text-gray-600">{voteCount} votes</span>
                    </div>
                  );
                })}
            </div>
          </div>
          
          {isHost ? (
            <button
              onClick={async () => {
                playSound('click');
                // Calculate and save the top categories before moving to relationship survey
                const topCategories = calculateTopCategories(categoryVotes);
                
                await updateDoc(doc(db, 'sessions', sessionCode), {
                  gameState: 'relationshipSurvey',
                  selectedCategories: topCategories,
                  availableCategories: topCategories
                });
                setGameState('relationshipSurvey');
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
            >
              Let's See How You Know Each Other
            </button>
          ) : (
            <p className="text-gray-500">Waiting for {players.find(p => p.isHost)?.name} to continue...</p>
          )}
        </div>
      </div>
    );
  }

  // ====================================================================
  // SCREEN COMPONENTS - Relationship Survey Screen
  // ====================================================================
  if (gameState === 'relationshipSurvey') {
    const currentPlayerIndex = Object.keys(relationshipAnswers).length;
    // Filter out yourself from the players list
    const otherPlayers = players.filter(p => p.name !== playerName);
    const currentPlayer = otherPlayers[currentPlayerIndex];
    
    if (currentPlayerIndex >= otherPlayers.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <AudioControl />
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="mb-6">
              <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Great!</h2>
              <p className="text-gray-600">Now let's choose what types of questions you want to explore.</p>
            </div>
            
            <button
              onClick={() => {
                playSound('success');
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
        <AudioControl />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">Player {currentPlayerIndex + 1} of {otherPlayers.length}</span>
              <ProgressIndicator 
                current={currentPlayerIndex + 1} 
                total={otherPlayers.length}
                className="w-16"
              />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">How are you connected to {currentPlayer?.name}?</h2>
            <p className="text-gray-600 text-sm">This helps us create better questions for your group.</p>
          </div>
          
          <div className="space-y-3">
            {relationshipOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => {
                  playSound('click');
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

  // ====================================================================
  // SCREEN COMPONENTS - Waiting for Others Screen (After Relationship Survey)
  // ====================================================================
  if (gameState === 'waitingForOthers') {
    const playersWithRelationships = players.filter(p => p.relationshipAnswers);
    const waitingFor = players.filter(p => !p.relationshipAnswers).map(p => p.name);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <AudioControl />
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Thanks!</h2>
            <p className="text-gray-600">Waiting for others to complete their surveys...</p>
          </div>
          
          <div className="mb-4">
            <p className="text-lg text-gray-700">{playersWithRelationships.length} of {players.length} completed</p>
          </div>
          
          {waitingFor.length > 0 && (
            <div className="text-center">
              <LoadingSpinner size="w-16 h-16" />
              <p className="text-gray-600 mb-2 mt-4">Still waiting for:</p>
              <p className="text-sm text-gray-500">{waitingFor.join(', ')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ====================================================================
  // SCREEN COMPONENTS - Category Picking Screen (Turn-based) (FIXED)
  // ====================================================================
  if (gameState === 'categoryPicking') {
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.name === playerName;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <AudioControl />
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
                  
                  return (
                    <CategoryCard
                      key={categoryKey}
                      categoryKey={categoryKey}
                      category={category}
                      isSelected={false}
                      isRecommended={false}
                      onClick={() => {
                        playSound('click');
                        handleCategoryPicked(categoryKey);
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
              <p className="text-gray-500 mt-4">Waiting for {currentPlayer?.name} to choose...</p>
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

  // ====================================================================
  // SCREEN COMPONENTS - Playing Screen (ENHANCED with Skip Feature)
  // ====================================================================
  if (gameState === 'playing') {
    const currentCategoryData = questionCategories[currentCategory];
    const IconComponent = currentCategoryData?.icon || MessageCircle;
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.name === playerName;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <AudioControl />
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
            {isMyTurn ? (
              <>
                {/* NEW FEATURE: Skip Question Button */}
                <button
                  onClick={handleSkipQuestion}
                  className="w-full bg-white border-2 border-orange-400 text-orange-600 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-orange-50 transition-all flex items-center justify-center"
                >
                  <SkipForward className="w-5 h-5 mr-2" />
                  Skip This Question
                </button>
                
                <button
                  onClick={handleNextQuestion}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
                >
                  Pass to {players[(currentTurnIndex + 1) % players.length]?.name}
                </button>
              </>
            ) : (
              <div className="text-center">
                <LoadingSpinner />
                <p className="text-gray-600 mt-4">Waiting for {currentPlayer?.name} to finish their turn...</p>
              </div>
            )}
            
            <button
              onClick={() => {
                playSound('click');
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

  // ====================================================================
  // FALLBACK - Return null for unhandled states
  // ====================================================================
  return null;
}
