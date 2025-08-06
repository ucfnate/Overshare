// Category Picking Screen
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
                      className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-left"
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

  // Playing Screen
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
                setGameState('waitingRoom');
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

  // Waiting for Others Screen
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

  // Default return for unhandled states
  return null;
}  // Relationship Survey Screen
  if (gameState === 'relationshipSurvey') {
    const currentPlayerIndex = Object.keys(relationshipAnswers).length;
    const otherPlayers = players.filter(p => p.name !== playerName);
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

  // Category Voting Screen
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
                      setGameState('waitingForHost');
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
                        setGameState('waitingForHost');
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

  // Waiting for Host Screen
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
                      className={`flex items-center justify-between p-3 rounded-xl transition-all ${
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
                const topCategories = calculateTopCategories(categoryVotes);
                
                await updateDoc(doc(db, 'sessions', sessionCode), {
                  gameState: 'relationshipSurvey',
                  selectedCategories: topCategories,
                  availableCategories: topCategories
                });
                playSound('success');
                setGameState('relationshipSurvey');
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all transform hover:scale-105"
            >
              Let's See How You Know Each Other
            </button>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Waiting for {players.find(p => p.isHost)?.name} to continue...</p>
          )}
        </div>
      </div>
    );
  }

  // Waiting Room Screen
  if (gameState === 'waitingRoom') {
    const isNewPlayer = !players.find(p => p.name === playerName);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 flex items-center justify-center p-4">
        <ToastContainer />
        <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Session {sessionCode}</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-3">Share this code with others to join</p>
            
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
                await updateDoc(doc(db, 'sessions', sessionCode), {
                  gameState: 'categoryVoting'
                });
                playSound('success');
                setGameState('categoryVoting');
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
  }'use client';

import React, { useState, useEffect } from 'react';
import { Users, MessageCircle, Heart, Sparkles, Lightbulb, Target, Flame, Copy, Check, Volume2, VolumeX, X, Bell, Clock, History } from 'lucide-react';
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
        "If you could make one rule that everyone had to follow, what would it be?",
        "What's the most ridiculous thing you've convinced someone was true?",
        "If you could eliminate one minor inconvenience from daily life, what would it be?",
        "What's your most irrational fear that you're secretly embarrassed about?",
        "If you had to wear a warning label, what would it say?",
        "What's the weirdest dream you remember having?",
        "If you could add a 13th month to the year, what would you name it?",
        "What's something you do when you're alone that you'd never do in front of others?",
        "If you could make any activity an Olympic sport, what would you win gold in?",
        "What's the most unusual thing you find attractive?",
        "If you had to live in a world made of one food, what food would you choose?"
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
        "What's the most valuable piece of advice you've received but initially ignored?",
        "What's a hard truth about yourself that you've recently accepted?",
        "What's the biggest sacrifice you've made that no one knows about?",
        "What childhood wound still affects how you show up in relationships today?",
        "What's something you need to hear but no one has told you?",
        "What part of your personality do you think people misunderstand the most?",
        "What's a dream you've given up on and why?",
        "What would your life look like if you weren't afraid of judgment?",
        "What's the most honest thing you've never said to someone you love?",
        "What do you think you'll regret not doing when you're 80?",
        "What's a pattern in your life that you're finally ready to break?"
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
        "If you could redesign the concept of money, what would the new system look like?",
        "If you could create a new emotion that doesn't exist, what would it feel like?",
        "You can merge any two companies. Which merger would create the most chaos?",
        "If you had to design hell for someone you dislike, what would their personal hell be?",
        "You can make one conspiracy theory actually true. Which one do you choose?",
        "If you could add a new mandatory subject to all schools, what would teach kids?",
        "You can make one body part detachable. Which would be most convenient?",
        "If you could create a new sport using items from your kitchen, what would it be?",
        "You can make one animal as intelligent as humans. Which causes the most drama?",
        "If you could add a new day between Saturday and Sunday, how would people spend it?",
        "You can make one fictional technology real. What do you choose and why?"
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
        "If you could switch lives with someone you know for 24 hours, who would you choose?",
        "What's the most inappropriate thing you've laughed at?",
        "What's your most toxic trait that you're lowkey proud of?",
        "If you could see one statistic about everyone you meet, what would you choose?",
        "What's the pettiest thing you've done that you don't regret?",
        "What's a compliment you've received that felt more like an insult?",
        "If you had to expose one person's search history, whose would be most interesting?",
        "What's something you do that you think everyone does, but you're afraid to ask?",
        "What's the most unhinged intrusive thought you've had this week?",
        "If karma is real, what's coming for you?",
        "What's the worst advice you've ever given that someone actually followed?"
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
        "If you could design your ideal typical day five years from now, what would it look like?",
        "What's the biggest change you need to make but keep postponing?",
        "What would you do differently if you truly believed you were enough?",
        "What's a boundary you need to set that you've been avoiding?",
        "If you had unlimited resources, what problem would you solve?",
        "What's one thing you could do tomorrow that your future self would thank you for?",
        "What part of your life needs a complete reimagining?",
        "What would you pursue if you knew your family would support you no matter what?",
        "What's the gap between who you are and who you want to be?",
        "What legacy do you want to leave for the next generation?",
        "If you could guarantee one thing for your future, what would it be?"
      ]
    },
    uncomfortable_truths: {
      name: 'Uncomfortable Truths',
      icon: MessageCircle,
      description: 'Questions that challenge your self-perception',
      color: 'from-gray-600 to-purple-600',
      questions: [
        "What's a harsh reality about yourself that others see but you tend to ignore?",
        "When was the last time you were the villain in someone else's story?",
        "What's something you criticize in others that you're guilty of yourself?",
        "What privilege do you have that you take for granted?",
        "What's a time you were completely wrong but too proud to admit it?",
        "What's the most selfish decision you've made that you still stand by?",
        "What truth about a relationship are you refusing to accept?",
        "What's something you do for others that's actually more about you?",
        "What excuse do you use most often to avoid growth?",
        "What's a way you manipulate situations to get what you want?",
        "What double standard do you hold that benefits you?",
        "What's something you're mediocre at but think you're good at?",
        "What uncomfortable feedback have multiple people given you that's probably true?",
        "What's a time your ego got in the way of doing the right thing?",
        "What pattern do you see in others' lives but are blind to in your own?",
        "What's the gap between how you see yourself and how others see you?",
        "What do you pretend to want but actually fear getting?",
        "What's a truth about your parents that changed how you see yourself?",
        "What part of your identity are you most attached to losing?",
        "What's the story you tell yourself to avoid taking responsibility?",
        "What would change if you stopped needing to be right?",
        "What's something you judge in your past self that you still do?",
        "What uncomfortable truth would set you free if you accepted it?",
        "What do you need to grieve that you've been avoiding?",
        "What's the cost of maintaining the image you project to the world?"
      ]
    }
  };

  // Smart category recommendation based on group composition
  const recommendCategories = (players, relationships) => {
    const intimacyScore = calculateGroupIntimacy(relationships);
    const comfortLevel = getGroupComfortLevel(players);
    const groupSize = players.length;

    let recommended = [];

    if (groupSize > 3 || intimacyScore < 3) {
      recommended.push('icebreakers');
    }

    if (groupSize > 2) {
      recommended.push('creative');
    }

    if (intimacyScore >= 3 && comfortLevel >= 3) {
      recommended.push('deep_dive');
    }

    if (intimacyScore >= 4 || (groupSize === 2 && intimacyScore >= 3)) {
      recommended.push('growth');
    }

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
      if (selectedCategories.length === 0) {
        const recommended = recommendCategories(players, relationships);
        category = recommended[Math.floor(Math.random() * recommended.length)] || 'icebreakers';
      } else {
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
        
        // Update turn-related state
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
        
        // Handle game state transitions
        if (data.gameState === 'playing' && gameState !== 'playing') {
          setGameState('playing');
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
      addToast('Connection lost. Trying to reconnect...', 'error');
    });
    
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
      joinedAt: new Date().toISOString(),
      color: playerColors[0]
    };
    
    const success = await createFirebaseSession(code, hostPlayer);
    
    if (success) {
      setSessionCode(code);
      setIsHost(true);
      setPlayers([hostPlayer]);
      playSound('success');
      setGameState('waitingRoom');
      
      setTimeout(() => {
        console.log('Starting listener after delay');
        listenToSession(code);
      }, 1000);
    }
  };

  const handleJoinSession = async () => {
    if (sessionCode.trim()) {
      const sessionRef = doc(db, 'sessions', sessionCode.trim().toUpperCase());
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data();
        setPlayers(sessionData.players);
        setSelectedCategories(sessionData.selectedCategories || []);
        setSessionCode(sessionCode.trim().toUpperCase());
        
        playSound('success');
        listenToSession(sessionCode.trim().toUpperCase());
        setGameState('waitingRoom');
      } else {
        addToast('Session not found. Please check the code.', 'error');
      }
    }
  };

  const handleRelationshipSurveySubmit = async () => {
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
        
        const allCompleted = updatedPlayers.every(p => p.relationshipAnswers);
        
        if (allCompleted) {
          const topCategories = sessionData.selectedCategories || [];
          
          await updateDoc(sessionRef, {
            gameState: 'categoryPicking',
            currentTurnIndex: 0,
            availableCategories: topCategories,
            usedCategories: [],
            turnHistory: []
          });
          playSound('success');
          setGameState('categoryPicking');
        } else {
          setGameState('waitingForOthers');
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
        
        currentVotes[playerName] = selectedCats;
        
        await updateDoc(sessionRef, {
          categoryVotes: currentVotes
        });
        
        setMyVotedCategories(selectedCats);
        playSound('success');
        
        if (sessionData.players.length > 1) {
          const allPlayersVoted = sessionData.players.every(player => 
            currentVotes[player.name] && currentVotes[player.name].length > 0
          );
          
          if (allPlayersVoted) {
            await updateDoc(sessionRef, {
              gameState: 'waitingForHost'
            });
            setGameState('waitingForHost');
          }
        }
      }
    } catch (error) {
      console.error('Error submitting category votes:', error);
      addToast('Failed to submit votes', 'error');
    }
  };

  const calculateTopCategories = (votes) => {
    const voteCount = {};
    
    Object.values(votes).forEach(playerVotes => {
      playerVotes.forEach(category => {
        voteCount[category] = (voteCount[category] || 0) + 1;
      });
    });
    
    const sortedCategories = Object.entries(voteCount)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);
    
    return sortedCategories.slice(0, Math.min(4, Math.max(3, sortedCategories.length)));
  };

  const handleStartGame = async () => {
    const sessionRef = doc(db, 'sessions', sessionCode);
    const sessionSnap = await getDoc(sessionRef);
    
    if (sessionSnap.exists()) {
      const sessionData = sessionSnap.data();
      const topCategories = sessionData.selectedCategories || calculateTopCategories(categoryVotes);
      
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
      setGameState('categoryPicking');
    }
  };

  const handleCategoryPicked = async (category) => {
    const currentPlayer = players[currentTurnIndex];
    const question = generatePersonalizedQuestion(players, surveyAnswers, relationshipAnswers, category);
    
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
    setGameState('playing');
  };



  // Welcome Screen
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
            <span className="ml-2 text-sm">{soundEnabled ? 'Sound On' : 'Sound Off'}</span>
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
