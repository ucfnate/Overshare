'use client';

import React, { useState, useEffect } from 'react';
import { Users, MessageCircle, Heart, Sparkles, Lightbulb, Target, Flame, Copy, Check, Volume2, VolumeX, X, Bell, History } from 'lucide-react';
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
  
  // New state for enhancements
  const [questionHistory, setQuestionHistory] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);


  // Waiting Room Screen with copy button and player colors
  if (gameState === 'waitingRoom') {
    const isNewPlayer = !players.find(p => p.name === playerName);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
        <ToastContainer />
        <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Session {sessionCode}</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-3">Share this code with others to join</p>
            
            {/* Copy Code Button */}
            <button
              onClick={copySessionCode}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all"
            >
              {copiedCode ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Players ({players.length})</h3>
            <div className="space-y-2">
              {players.map((player, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getPlayerColor(index)}`}></div>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{player.name}</span>
                  </div>
                  {player.isHost && <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-full">Host</span>}
                </div>
              ))}
            </div>
          </div>

          {selectedCategories.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Question Categories</h3>
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
                  joinedAt: new Date().toISOString(),
                  color: getPlayerColor(players.length)
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
                  playSound('join');
                }
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all mb-4 transform hover:scale-105"
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
                playSound('success');
                transitionToState('categoryVoting');
              }}
              disabled={players.length < 2}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
            >
              Start Game
            </button>
          )}
          
          {!isHost && !isNewPlayer && (
            <p className="text-gray-500 dark:text-gray-400">Waiting for host to continue...</p>
          )}
        </div>
      </div>
    );
  }

  // Category Picking Screen (Turn-based) with animations
  if (gameState === 'categoryPicking') {
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.name === playerName;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
        <ToastContainer />
        <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            {isMyTurn ? (
              <>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Your Turn!</h2>
                <p className="text-gray-600 dark:text-gray-300">Choose a category for the next question</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{currentPlayer?.name}'s Turn</h2>
                <p className="text-gray-600 dark:text-gray-300">{currentPlayer?.name} is choosing a category...</p>
              </>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Round {Math.floor(turnHistory.length / players.length) + 1}</p>
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
                      className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-left transform hover:scale-105"
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category.color}`}>
                          <IconComponent className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 dark:text-gray-100">{category.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{category.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <p className="text-gray-600 dark:text-gray-300">All categories have been used! Categories will reset for the next round.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-500 dark:text-gray-400">Waiting for {currentPlayer?.name} to choose...</p>
            </div>
          )}
          
          {usedCategories.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Already Used:</h3>
              <div className="flex flex-wrap gap-2">
                {usedCategories.map(categoryKey => {
                  const category = questionCategories[categoryKey];
                  return (
                    <span
                      key={categoryKey}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full"
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

  // Playing Screen with question history
  if (gameState === 'playing') {
    const currentCategoryData = questionCategories[currentCategory];
    const IconComponent = currentCategoryData?.icon || MessageCircle;
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.name === playerName;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
        <ToastContainer />
        <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
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
            
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
              {currentPlayer?.name}'s Question
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Round {Math.floor(turnHistory.length / players.length) + 1} • Turn {(turnHistory.length % players.length) + 1} of {players.length}
            </p>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500">
              <p className="text-gray-800 dark:text-gray-100 text-lg leading-relaxed">{currentQuestion}</p>
            </div>
          </div>
          
          {/* Question History */}
          {questionHistory.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                <History className="w-4 h-4" />
                <span>Recent Questions ({questionHistory.length})</span>
              </button>
              
              {showHistory && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {questionHistory.slice(-5).reverse().map((item, index) => (
                    <div key={index} className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="font-medium">{item.askedBy}:</span> {item.question.substring(0, 50)}...
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-4">
            {isMyTurn ? (
              <button
                onClick={handleNextQuestion}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all transform hover:scale-105"
              >
                Pass to {players[(currentTurnIndex + 1) % players.length]?.name}
              </button>
            ) : (
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-300">Waiting for {currentPlayer?.name} to finish their turn...</p>
              </div>
            )}
            
            <button
              onClick={() => {
                playSound('click');
                transitionToState('waitingRoom');
              }}
              className="w-full bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
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
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
        <ToastContainer />
        <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
          <div className="mb-6">
            <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Thanks!</h2>
            <p className="text-gray-600 dark:text-gray-300">Waiting for others to complete their surveys...</p>
          </div>
          
          <div className="mb-4">
            <p className="text-lg text-gray-700 dark:text-gray-200">{playersWithRelationships.length} of {players.length} completed</p>
          </div>
          
          {waitingFor.length > 0 && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-2">Still waiting for:</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{waitingFor.join(', ')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;

  // Survey Screen with dark mode
  if (gameState === 'survey') {
    const currentQuestionIndex = Object.keys(surveyAnswers).length;
    const currentSurveyQuestion = initialSurveyQuestions[currentQuestionIndex];
    
    if (currentQuestionIndex >= initialSurveyQuestions.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
          <ToastContainer />
          <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
            <div className="mb-6">
              <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Perfect, {playerName}!</h2>
              <p className="text-gray-600 dark:text-gray-300">We'll use this to create personalized questions for your group.</p>
            </div>
            
            <button
              onClick={handleSurveySubmit}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all transform hover:scale-105"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
        <ToastContainer />
        <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">Question {currentQuestionIndex + 1} of {initialSurveyQuestions.length}</span>
              <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div 
                  className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                  style={{ width: `${((currentQuestionIndex + 1) / initialSurveyQuestions.length) * 100}%` }}
                ></div>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-6">{currentSurveyQuestion.question}</h2>
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
                  playSound('click');
                }}
                className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-gray-800 dark:text-gray-200"
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
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
        <ToastContainer />
        <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Ready to play, {playerName}!</h2>
          
          <div className="space-y-4">
            <button
              onClick={handleCreateSession}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center transform hover:scale-105"
            >
              <Users className="w-5 h-5 mr-2" />
              Create New Game
            </button>
            
            <div className="flex items-center my-4">
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
              <span className="px-4 text-gray-500 dark:text-gray-400 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
            </div>
            
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Enter session code"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={handleJoinSession}
                disabled={!sessionCode.trim()}
                className="w-full bg-white dark:bg-gray-700 border-2 border-purple-500 text-purple-500 dark:text-purple-400 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
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
    
    // Skip directly if playing alone
    if (otherPlayers.length === 0) {
      handleRelationshipSurveySubmit();
      return null;
    }
    
    const currentPlayer = otherPlayers[currentPlayerIndex];
    
    if (currentPlayerIndex >= otherPlayers.length) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
          <ToastContainer />
          <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
            <div className="mb-6">
              <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Great!</h2>
              <p className="text-gray-600 dark:text-gray-300">Now let's choose what types of questions you want to explore.</p>
            </div>
            
            <button
              onClick={handleRelationshipSurveySubmit}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all transform hover:scale-105"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
        <ToastContainer />
        <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">Player {currentPlayerIndex + 1} of {otherPlayers.length}</span>
              <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div 
                  className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                  style={{ width: `${((currentPlayerIndex + 1) / otherPlayers.length) * 100}%` }}
                ></div>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">How are you connected to {currentPlayer?.name}?</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">This helps us create better questions for your group.</p>
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
                  playSound('click');
                }}
                className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-gray-800 dark:text-gray-200"
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
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
        <ToastContainer />
        <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              {hasVoted ? 'Waiting for Others' : 'Vote for Categories'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {hasVoted 
                ? `${totalVotes} of ${players.length} players have voted`
                : 'Select 2-3 categories you\'d like to play with'
              }
            </p>
            {hasVoted && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Session Code: {sessionCode}</p>
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
                        playSound('click');
                      }}
                      disabled={!isSelected && selectedCategories.length >= 3}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        isSelected 
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                          : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                      } ${!isSelected && selectedCategories.length >= 3 ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category.color}`}>
                          <IconComponent className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">{category.name}</h3>
                            {isRecommended && (
                              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{category.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handleCategoryVote(selectedCategories)}
                disabled={selectedCategories.length === 0}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
              >
                Submit My Votes ({selectedCategories.length}/3)
              </button>
            </>
          ) : (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Your Votes:</h3>
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
                  <p className="text-center text-gray-600 dark:text-gray-300 mb-4">All players have voted!</p>
                  <button
                    onClick={() => {
                      updateDoc(doc(db, 'sessions', sessionCode), {
                        gameState: 'waitingForHost'
                      });
                      transitionToState('waitingForHost');
                    }}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all transform hover:scale-105"
                  >
                    View Results & Start Game
                  </button>
                </div>
              ) : waitingFor.length > 0 ? (
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-2">Waiting for:</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{waitingFor.join(', ')}</p>
                  
                  {isHost && (
                    <button
                      onClick={() => {
                        updateDoc(doc(db, 'sessions', sessionCode), {
                          gameState: 'waitingForHost'
                        });
                        transitionToState('waitingForHost');
                      }}
                      className="mt-4 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 underline"
                    >
                      Continue without waiting
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-300">All players have voted!</p>
                  {!isHost && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Waiting for host to start the game...</p>}
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
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
        <ToastContainer />
        <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">All Votes Are In!</h2>
            <p className="text-gray-600 dark:text-gray-300">Top categories based on everyone's votes:</p>
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
                        isSelected ? 'bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-300 dark:border-purple-700' : 'bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category.color}`}>
                          <IconComponent className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{category.name}</span>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{voteCount} votes</span>
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
                
                // Skip relationship survey if single player
                if (players.length === 1) {
                 try {
  // ... some code ...
  await updateDoc(doc(db, 'sessions', sessionCode), {
    currentTurnIndex: 0,
    selectedCategories: topCategories,
    availableCategories: topCategories,
    usedCategories: [],
    turnHistory: []
  });
  // ... maybe more code ...
} catch (error) {
  console.error('Error submitting category votes:', error);
  addToast('Failed to submit votes', 'error');
}
    } catch (error) {
      console.error('Error submitting category votes:', error);
      addToast('Failed to submit votes', 'error');
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
      playSound('success');
      transitionToState('categoryPicking');
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
      question: question
    }];
    
    // Add to question history
    setQuestionHistory(prev => [...prev.slice(-4), {
      question,
      category,
      askedBy: currentPlayer.name,
      timestamp: Date.now()
    }]);
    
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
    playSound('click');
    transitionToState('playing');
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
    playSound('click');
    transitionToState('categoryPicking');
  };

  // Welcome Screen with dark mode support
  if (gameState === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
        <ToastContainer />
        <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Overshare</h1>
            <p className="text-gray-600 dark:text-gray-300">Personalized conversation games that bring people closer together</p>
          </div>
          
          <div className="mb-6">
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
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
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
          >
            Let's Get Started
          </button>
          
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="mt-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 inline" /> : <VolumeX className="w-5 h-5 inline" />}
            <span className="ml-2 text-sm">{soundEnabled ? 'Soun'use client';

import React, { useState, useEffect } from 'react';
import { Users, MessageCircle, Heart, Sparkles, Lightbulb, Target, Flame, Copy, Check, Volume2, VolumeX, X, Bell, History } from 'lucide-react';
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
  
  // New state for enhancements
  const [questionHistory, setQuestionHistory] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Player colors for visual distinction
  const playerColors = [
    'from-blue-400 to-blue-600',
    'from-green-400 to-green-600',
    'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600',
    'from-yellow-400 to-yellow-600',
    'from-red-400 to-red-600',
    'from-indigo-400 to-indigo-600',
    'from-teal-400 to-teal-600'
  ];

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

  // Sound effects helper
  const playSound = (type) => {
    if (!soundEnabled) return;
    
    const sounds = {
      join: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE',
      success: 'data:audio/wav;base64,UklGRqAGAABXQVZFZm10IBAAAAABAAEAiBUAAIgVAAABAAgAZGF0YXwGAABYWF1hZGZpam1ub3Fxb25ubmxqamdmZGNjYmJhYmFhYWFhYWFhYWFhYWJiY2RlZ2lrbG5wcnN1d3h5ent8fH5+f4CAgYGCgoKCgoKCgoKCgYGAgH9+fXx7enl4d3Z1dHNycXBvbm1sa2pqaWhnZmVkY2JhYGBfX19fX19fX19fX19fX19gYGFiYmNkZWdpam1vcHN1d3l7fH5/gYGCg4SEhYWFhYWFhYWFhYWEhIOCgYB/fn18e3p5eHd2dXRzcnFwb25tbGtqaWhnZmVkY2NiYmFhYWFhYWFhYWFhYWFhYWFhYWFiYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fX5/gIGBgoODhISFhYWFhYWFhYWFhYWFhYWFhISEg4KCgYB/fn18e3p5eHd2dXRzcnFwb25tbGtqaWhnZ2ZlZGNiYmFhYWBgYGBgYGBgYGBgYGBgYGBgYGBhYWFiY2RlZmdpamttbm9wcnN0dXZ3eHl6e3x9fn+AgYKDhISFhYWGhoaGhoaGhoaGhoaGhoaGhYWFhISCgoF/fn17enl3dnR0cnBvbWxqaWhnaWVkYmFhYWBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGFhYmNkZWZnaGlrbG5vcHFyc3R1d3h5ent8fX5/gIGCg4SEhYWGhoaGh4eHh4eHh4eHh4eHh4eHh4eGhoaGhYSEg4KBgH9+fXt6eXh3dnV0c3JxcG9ubGtqaGdnZmVkY2JiYWFhYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGFhYmJjZGVmaGlqam1ucHFyc3R1dnd4eXp7fH1+f4CBgoOEhIWFhoaGh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4aGhoaFhISCgoGAf359fHt6eXh3dnV0c3JxcG9ubWxramlnZ2ZlZGNjYmFhYWBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGFhYmJjZGVmaGhpamxtbm9wcXJzdHV2d3h5ent8fX5+f4CBgoOEhIWFhoaGh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eGhoaGhYSEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sq2ppaGdmZWRjYmJhYWFgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGFhYmJjZGVmZ2hpamxtbm9wcXJzdHV2d3h5ent8fX5/gIGCg4OEhYWGhoaHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4aGhoWFhISCgoGAf359fHt6eXh3dnV0c3JxcG9ubWxramlnZ2ZlZGRjYmJhYWFgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYWFiYmNkZWZnaGlqbG1ub3Bxc3N0dXZ3eHl6e3x9fn+AgYKDhISFhoaGh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHhoaGhYWEg4KCgYB/fn18e3p5eHd2dXRzcnFwb25tbGtqaWhnZmVkY2NiYmFhYWBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBhYWFiYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fX5/gIGCg4SEhYWGhoaHh4eHh4eHh4eHhw==',
      click: 'data:audio/wav;base64,UklGRiQCAABXQVZFZm10IBAAAAABAAEAiBUAAIgVAAABAAgAZGF0YQACAAB7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3uAfYB9gH2AfYB9gH2AfYB9gH2AfYB9gH2AfYB9gH2AfYiEiISIhIiEiISIhIiEiISIhIiEiISIhIiEiISIhIiElpCWkJaQlpCWkJaQlpCWkJaQlpCWkJaQlpCWkJaQlpCWkJaQlpCWkJaQlpCWkJaQlpCWkJaQlpCWkJaQlpCWkJaQlpCWkJaQlpDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAiIaIhoiGiIaIhoiGiIaIhoiGiIaIhoiGiIaIhoiGiIaIhoiGiIZ6hHqEeoR6hHqEeoR6hHqEeoR6hHqEeoR6hHqEeoR6hHqEeoR6hHqEeoR6hHqEeoR6hHqEeoR6hHqEeoR6hHqEeoR6hHqEeoQYMBgwGDAYMBgwGDAYMBgwGDAYMBgwGDAYMBgwGDAYMBgwGDAYMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    };
    
    try {
      const audio = new Audio(sounds[type] || sounds.click);
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {
      // Silently fail if audio doesn't work
    }
  };

  // Toast notification system
  const addToast = (message, type = 'info') => {
    const id = Date.now();
    const newToast = { id, message, type };
    setToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  // Copy to clipboard function
  const copySessionCode = async () => {
    try {
      await navigator.clipboard.writeText(sessionCode);
      setCopiedCode(true);
      playSound('success');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      addToast('Failed to copy code', 'error');
    }
  };

  // Animation helper for transitions
  const transitionToState = (newState) => {
    setIsAnimating(true);
    setTimeout(() => {
      setGameState(newState);
      setIsAnimating(false);
    }, 300);
  };

  // Get player color
  const getPlayerColor = (playerIndex) => {
    return playerColors[playerIndex % playerColors.length];
  };

  // Toast container component
  const ToastContainer = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`animate-slide-in bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 flex items-center space-x-3 transition-all ${
            toast.type === 'error' ? 'border-l-4 border-red-500' : 
            toast.type === 'success' ? 'border-l-4 border-green-500' : 
            'border-l-4 border-blue-500'
          }`}
        >
          {toast.type === 'success' && <Check className="w-5 h-5 text-green-500" />}
          {toast.type === 'error' && <X className="w-5 h-5 text-red-500" />}
          {toast.type === 'info' && <Bell className="w-5 h-5 text-blue-500" />}
          <span className="text-gray-800 dark:text-gray-200">{toast.message}</span>
        </div>
      ))}
    </div>
  );

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

  // Enhanced question generation with history tracking
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
    
    // Filter out recently asked questions
    const recentQuestions = questionHistory.slice(-5).map(h => h.question);
    const availableQuestions = categoryQuestions.filter(q => !recentQuestions.includes(q));
    
    // Pick from available questions, or from all if we've exhausted non-recent ones
    const questionPool = availableQuestions.length > 0 ? availableQuestions : categoryQuestions;
    const question = questionPool[Math.floor(Math.random() * questionPool.length)];
    
    setCurrentCategory(category);
    return question;
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
      addToast('Failed to create session', 'error');
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
      addToast('Failed to join session', 'error');
      return null;
    }
  };

  const updateGameQuestion = async (sessionCode, question, category) => {
    try {
      // Add to question history
      const newHistoryItem = {
        question,
        category,
        askedBy: players[currentTurnIndex]?.name,
        timestamp: Date.now()
      };
      
      setQuestionHistory(prev => [...prev.slice(-4), newHistoryItem]);
      
      await updateDoc(doc(db, 'sessions', sessionCode), {
        currentQuestion: question,
        currentCategory: category,
        gameState: 'playing'
      });
    } catch (error) {
      console.error('Error updating question:', error);
      addToast('Failed to update question', 'error');
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
        
        // Check for new players
        const prevPlayerCount = players.length;
        
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
        
        // Show toast for new players
        if (data.players.length > prevPlayerCount && prevPlayerCount > 0) {
          const newPlayer = data.players[data.players.length - 1];
          addToast(`${newPlayer.name} joined the game!`, 'success');
          playSound('join');
        }
        
        // Handle game state transitions with animations
        if (data.gameState === 'playing' && gameState !== 'playing') {
          transitionToState('playing');
        } else if (data.gameState === 'categoryPicking' && gameState !== 'categoryPicking') {
          transitionToState('categoryPicking');
        } else if (data.gameState === 'categoryVoting' && gameState !== 'categoryVoting') {
          transitionToState('categoryVoting');
        } else if (data.gameState === 'relationshipSurvey' && gameState !== 'relationshipSurvey') {
          transitionToState('relationshipSurvey');
        } else if (data.gameState === 'waitingForHost' && gameState !== 'waitingForHost') {
          transitionToState('waitingForHost');
        }
      } else {
        console.log('❌ Session document does not exist');
      }
    }, (error) => {
      console.error('❌ Firebase listener error:', error);
      addToast('Connection lost. Trying to reconnect...', 'error');
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
      playSound('success');
      transitionToState('createOrJoin');
    }
  };

  const handleCreateSession = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostPlayer = {
      id: Date.now().toString(),
      name: playerName,
      isHost: true,
      surveyAnswers,
      joinedAt: new Date().toISOString(),
      color: playerColors[0]
    };
    
    const success = await createFirebaseSession(code, hostPlayer);
    
    if (success) {
      setSessionCode(code);
      setIsHost(true);
      setPlayers([hostPlayer]);
      playSound('success');
      transitionToState('waitingRoom');
      
      // Add delay before listener
      setTimeout(() => {
        console.log('Starting listener after delay');
        listenToSession(code);
      }, 1000);
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
        
        playSound('success');
        // Start listening to session updates
        listenToSession(sessionCode.trim().toUpperCase());
        
        // Go to waiting room first, not relationship survey
        transitionToState('waitingRoom');
      } else {
        addToast('Session not found. Please check the code.', 'error');
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
          const topCategories = sessionData.selectedCategories || [];
          
          // Move to category picking for first player
          await updateDoc(sessionRef, {
            gameState: 'categoryPicking',
            currentTurnIndex: 0,
            availableCategories: topCategories,
            usedCategories: [],
            turnHistory: []
          });
          playSound('success');
          transitionToState('categoryPicking');
        } else {
          // Wait for others
          transitionToState('waitingForOthers');
        }
      }
    } catch (error) {
      console.error('Error updating player data:', error);
      addToast('Failed to submit survey', 'error');
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
            transitionToState('waitingForHost');
          }
        }
        // If only one player (host), just stay in voting screen to show their votes
      }
    } catch (
