import { describe, expect, it } from 'vitest';
import { addRoundScores, scoreAnonymousGuesses, scoreCorrectGuesses, scoreMajorityVotes } from './partyScoring';

describe('party scoring', () => {
  it('shows round deltas separately before adding them to totals', () => {
    expect(addRoundScores({ Nate: 4, Sam: 2 }, { Nate: 1, Sam: 0, Alex: 2 })).toEqual({ Nate: 5, Sam: 2, Alex: 2 });
  });

  it('awards a point to everyone matching the majority', () => {
    expect(scoreMajorityVotes({ Nate: 'A', Sam: 'B', Alex: 'A' })).toEqual({ Nate: 1, Sam: 0, Alex: 1 });
  });

  it('scores private-answer and anonymous-author guesses', () => {
    expect(scoreCorrectGuesses({ Nate: 'B', Sam: 'A' }, 'B')).toEqual({ Nate: 1, Sam: 0 });
    expect(scoreAnonymousGuesses({ Nate: { one: 'Sam', two: 'Alex' } }, [
      { id: 'one', by: 'Sam' },
      { id: 'two', by: 'Nate' },
    ])).toEqual({ Nate: 1 });
  });
});
