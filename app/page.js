'use client';

import React, { useState, useEffect } from 'react';
import { Users, MessageCircle, Heart, Sparkles } from 'lucide-react';
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
  const [isHost, setIsHost] = useState(false);
  const [sessionListener, setSessionListener] = useState(null);

  const initialSurveyQuestions = [
    {
      id: 'personality',
      question: 'How would you describe yourself?',
      options: ['Outgoing & Social', 'Thoughtful & Introspective', 'Adventurous & Spontaneous', 'Practical & Grounded']
    },
    {
      id: 'interests',
      question: 'What energizes you most?',
      options: ['Creative projects', 'Physical activities', 'Learning new things', 'Spending time with people']
    },
    {
      id: 'communication',
      question: 'In conversations, you prefer:',
      options: ['Deep, meaningful discussions', 'Light, fun exchanges', 'Sharing stories & experiences', 'Asking lots of questions']
    },
    {
      id: 'topics',
      question: 'Topics that fascinate you:',
      options: ['Future dreams & goals', 'Past experiences & memories', 'Current events & ideas', 'Personal growth & values']
    }
  ];

  const relationshipOptions = [
    'Romantic partner/spouse',
    'Close friend',
    'Family member',
    'Coworker/colleague',
    'Acquaintance',
    'Just met/new friend'
  ];

  // AI question generation (placeholder - you can replace with Claude API later)
  const generatePersonalizedQuestion = (players, surveyData, relationships) => {
    const sampleQuestions = [
      "If you could have dinner with anyone from history, who would it be and what would you ask them?",
      "What's a belief you held strongly as a child that you've completely changed your mind about?",
      "If you had to teach a class on something you're passionate about, what would it be?",
      "What's the most spontaneous thing you've ever done, and do you regret it?",
      "If you could know the absolute truth about one thing in your life, what would you choose?",
      "What's a small act of kindness someone did for you that you still remember?",
      "If you could master any skill instantly, what would it be and why?",
      "What's something you've learned about yourself in the past year?",
      "If you could send a message to your past self, what age would you choose and what would you say?",
      "What's a question you wish people would ask you more often?",
      "What's a risk you've taken that taught you something important about yourself?",
      "If you could redesign one aspect of society, what would it be?",
      "What's something you're secretly proud of but rarely talk about?",
      "If you had to pick a theme song for your life right now, what would it be?",
      "What's a conversation you've been avoiding that you know you need to have?"
    ];
    
    return sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)];
  };

  // Firebase functions
  const createFirebaseSession = async (sessionCode, hostPlayer) => {
    try {
      await setDoc(doc(db, 'sessions', sessionCode), {
        hostId: hostPlayer.id,
        players: [hostPlayer],
        currentQuestion: '',
        gameState: 'waiting',
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

  const updateGameQuestion = async (sessionCode, question) => {
    try {
      await updateDoc(doc(db, 'sessions', sessionCode), {
        currentQuestion: question,
        gameState: 'playing'
      });
    } catch (error) {
      console.error('Error updating question:', error);
    }
  };

  const listenToSession = (sessionCode) => {
    const sessionRef = doc(db, 'sessions', sessionCode);
    const unsubscribe = onSnapshot(sessionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setPlayers(data.players || []);
        setCurrentQuestion(data.currentQuestion || '');
        
        if (data.gameState === 'playing' && gameState !== 'playing') {
          setGameState('playing');
        }
      }
    });
    
    setSessionListener(unsubscribe);
    return unsubscribe;
  };

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (sessionListener) {
        sessionListener();
      }
    };
  }, [sessionListener]);

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
      
      // Start listening to session updates
      listenToSession(code);
    } else {
      alert('Failed to create session. Please try again.');
    }
  };

  const handleJoinSession = async () => {
    if (sessionCode.trim()) {
      const player = {
        id: Date.now().toString(),
        name: playerName,
        isHost: false,
        surveyAnswers,
        joinedAt: new Date().toISOString()
      };
      
      const sessionData = await joinFirebaseSession(sessionCode.trim().toUpperCase(), player);
      
      if (sessionData) {
        setPlayers(sessionData.players);
        setGameState('relationshipSurvey');
        
        // Start listening to session updates
        listenToSession(sessionCode.trim().toUpperCase());
      } else {
        alert('Session not found. Please check the code and try again.');
      }
    }
  };

  const handleRelationshipSurveySubmit = async () => {
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
        const updatedPlayers = sessionData.players.map(p => 
          p.name === playerName ? currentPlayer : p
        );
        
        await updateDoc(sessionRef, {
          players: updatedPlayers
        });
        
        setGameState('waitingRoom');
      }
    } catch (error) {
      console.error('Error updating player data:', error);
    }
  };

  const handleStartGame = async () => {
    const question = generatePersonalizedQuestion(players, surveyAnswers, relationshipAnswers);
    await updateGameQuestion(sessionCode, question);
    setCurrentQuestion(question);
    setGameState('playing');
  };

  const handleNextQuestion = async () => {
    const question = generatePersonalizedQuestion(players, surveyAnswers, relationshipAnswers);
    await updateGameQuestion(sessionCode, question);
    setCurrentQuestion(question);
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
    const currentPlayer = players[currentPlayerIndex];
    
    if (currentPlayerIndex >= players.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="mb-6">
              <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Great!</h2>
              <p className="text-gray-600">Now we can create questions perfect for your group dynamic.</p>
            </div>
            
            <button
              onClick={handleRelationshipSurveySubmit}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
            >
              Join the Game
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
              <span className="text-sm text-gray-500">Player {currentPlayerIndex + 1} of {players.length}</span>
              <div className="w-16 h-2 bg-gray-200 rounded-full">
                <div 
                  className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                  style={{ width: `${((currentPlayerIndex + 1) / players.length) * 100}%` }}
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

  // Playing Screen
  if (gameState === 'playing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <MessageCircle className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Question for Everyone</h2>
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
                Next Question
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