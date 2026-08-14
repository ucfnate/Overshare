export function addRoundScores(totalScores = {}, roundScores = {}) {
  const next = { ...totalScores };
  Object.entries(roundScores).forEach(([playerName, points]) => {
    next[playerName] = (next[playerName] || 0) + (Number(points) || 0);
  });
  return next;
}
export function scoreMajorityVotes(votes = {}) {
  const counts = {};
  Object.values(votes).forEach(choice => {
    if (choice) counts[choice] = (counts[choice] || 0) + 1;
  });
  const max = Math.max(0, ...Object.values(counts));
  const winners = new Set(Object.entries(counts).filter(([, count]) => count === max).map(([choice]) => choice));
  return Object.fromEntries(Object.entries(votes).map(([playerName, choice]) => [playerName, winners.has(choice) ? 1 : 0]));
}

export function scoreCorrectGuesses(guesses = {}, correctAnswer) {
  return Object.fromEntries(Object.entries(guesses).map(([playerName, guess]) => [playerName, guess === correctAnswer ? 1 : 0]));
}

export function scoreAnonymousGuesses(guessesByPlayer = {}, submissions = []) {
  const authors = Object.fromEntries(submissions.map(submission => [submission.id, submission.by]));
  return Object.fromEntries(Object.entries(guessesByPlayer).map(([playerName, guesses]) => [
    playerName,
    Object.entries(guesses || {}).reduce((points, [submissionId, guessedAuthor]) => points + (authors[submissionId] === guessedAuthor ? 1 : 0), 0),
  ]));
}
