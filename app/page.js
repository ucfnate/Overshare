'use client';

import { QrCode, Volume2, VolumeX, SkipForward } from 'lucide-react';
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

// Import the external question categories library
import { questionCategories, getRandomQuestion, getCategoryKeys, getCategoryInfo } from '../lib/questionCategories';

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
  // Turn system state
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [usedCategories, setUsedCategories] = useState([]);
  const [turnHistory, setTurnHistory] = useState([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categoryVotes, setCategoryVotes] = useState({});
  const [myVotedCategories, setMyVotedCategories] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [showQR, setShowQR] = useState(false);

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

    const question = getRandomQuestion(category);
    setCurrentCategory(category);
    return question;
  };
    const playSound = (type) => {
  if (isMuted) return;
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // ... (sound implementation from the demo)
     } catch (error) {
    console.log('Audio not supported');
     }
  };

  // Firebase functions
  const createFirebaseSession = async (sessionCode, hostPlayer) => {
    try {
      await setDoc(doc(db, 'sessions', sessionCode), {
        hostId: hostPlayer.id,
        players: [hostPlayer],
        currentQuestion: '',
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
        setCategoryVotes(data.categoryVotes || {});
        
        // Handle game state transitions
        if (data.gameState === 'playing' && gameState !== 'playing') {
          ('playing');
        } else if (data.gameState === 'categoryPicking' && gameState !== 'categoryPicking') {
          setGameState('categoryPicking');
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
      setGameState('waitingRoom');
      
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
      } else {
        alert('Session not found. Please check the code and try again.');
      }
    }
  };

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
        } else {
          // Wait for others
          setGameState('waitingForOthers');
        }
      }
    } catch (error) {
      console.error('Error updating player data:', error);
    }
  };

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
    }
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
      question: question,
 try {
  await updateDoc(doc(db, 'sessions', sessionCode), {
    // ... your existing updates
  });
} catch (error) {
  console.error("Error updating document:", error);
  // Handle the error appropriately, perhaps display an error message to the user
}

  
  setCurrentQuestion(question);
  setGameState('playing'); // Make sure this runs AFTER Firebase update
} catch (error) {
  console.error('Error in handleCategoryPicked:', error);
  // Still try to set state locally
  setGameState('playing'); 
}
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
      // Add this function after handleNextQuestion and before the game screens
  const handleSkipQuestion = async () => {
    const newQuestion = generatePersonalizedQuestion(players, surveyAnswers, relationshipAnswers, currentCategory, currentQuestion);
    setCurrentQuestion(newQuestion);
    if (sessionCode) {
      await updateDoc(doc(db, 'sessions', sessionCode), { currentQuestion: newQuestion });
    }
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
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg font-mono bg-white text-gray-900"
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

  // Category Voting Screen (All players vote)
  if (gameState === 'categoryVoting') {
    const recommended = recommendCategories(players, relationshipAnswers);
    const hasVoted = myVotedCategories.length > 0;
    const allVotes = Object.values(categoryVotes);
    const totalVotes = allVotes.length;
    const waitingFor = players.filter(p => !categoryVotes[p.name]).map(p => p.name);
    const allPlayersVoted = players.every(p => categoryVotes[p.name] && categoryVotes[p.name].length > 0);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {hasVoted ? 'Waiting for Others' : 'Vote for Categories'}
            </h2>
            <p className="text-gray-600">
              {hasVoted 
                ? `${totalVotes} of ${players.length} players have voted`
                : 'Select 2-3 categories you\'d like to play with'
              }
            </p>
            {hasVoted && (
              <p className="text-sm text-gray-500 mt-2">Session Code: {sessionCode}</p>
            )}
          </div>
          
          {!hasVoted ? (
            <>
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
                        } else if (selectedCategories.length < 3) {
                          setSelectedCategories([...selectedCategories, key]);
                        }
                      }}
                      disabled={!isSelected && selectedCategories.length >= 3}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        isSelected 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-purple-300'
                      } ${!isSelected && selectedCategories.length >= 3 ? 'opacity-50' : ''}`}
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
                    onClick={() => {
                      updateDoc(doc(db, 'sessions', sessionCode), {
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
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-600 mb-2">Waiting for:</p>
                  <p className="text-sm text-gray-500">{waitingFor.join(', ')}</p>
                  
                  {isHost && (
                    <button
                      onClick={() => {
                        updateDoc(doc(db, 'sessions', sessionCode), {
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

  // Waiting for Host Screen (After Category Voting)
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
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">All Votes Are In!</h2>
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
                        <span className="font-medium">{category.name}</span>
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

  // Waiting Room Screen
  if (gameState === 'waitingRoom') {
    const isNewPlayer = !players.find(p => p.name === playerName);
    
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
          
          {isNewPlayer && (
            <button
              onClick={async () => {
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
    const isMyTurn = currentPlayer?.name === playerName;

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
            {isMyTurn ? (
              <button
                onClick={handleNextQuestion}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
              >
                Pass to {players[(currentTurnIndex + 1) % players.length]?.name}
              </button>
            ) : (
              <div className="text-center">
                <p className="text-gray-600">Waiting for {currentPlayer?.name} to finish their turn...</p>
              </div>
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

  // Waiting for Others Screen (After Relationship Survey)
  if (gameState === 'waitingForOthers') {
    const playersWithRelationships = players.filter(p => p.relationshipAnswers);
    const waitingFor = players.filter(p => !p.relationshipAnswers).map(p => p.name);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
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
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-600 mb-2">Still waiting for:</p>
              <p className="text-sm text-gray-500">{waitingFor.join(', ')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
