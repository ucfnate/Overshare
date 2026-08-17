import { fillInPrompts } from './fillin';
import { nhiePrompts } from './nhie';
import { superlativesPrompts } from './superlatives';

const prompts = (type, values) => values.map((value, index) => ({
  id: `party-${type}-${String(index + 1).padStart(3, '0')}`,
  type,
  ...(typeof value === 'string' ? { prompt: value } : value),
}));

const FILL = prompts('fill', fillInPrompts);
const MOST_LIKELY = prompts('most_likely', superlativesPrompts);
const NEVER_HAVE_I_EVER = prompts('never_have_i_ever', nhiePrompts);

const MAJORITY = prompts('majority', [
  { prompt: 'The group gets one completely free vacation. Where are we going?', options: ['Big city', 'Beach', 'Mountains', 'Road trip'] },
  { prompt: 'Which minor inconvenience would this group eliminate forever?', options: ['Traffic', 'Laundry', 'Passwords', 'Waiting in lines'] },
  { prompt: 'What is the superior way to spend a surprise day off?', options: ['Go somewhere', 'Stay in', 'See friends', 'Finish a project'] },
  { prompt: 'Which shared purchase would cause the most chaos?', options: ['Boat', 'Vacation house', 'Food truck', 'Karaoke machine'] },
  { prompt: 'Which quality matters most in a great friend?', options: ['Honesty', 'Reliability', 'Humor', 'Empathy'] },
  { prompt: 'The group has to compete on a reality show. What kind?', options: ['Survival', 'Cooking', 'Trivia', 'Talent'] },
  { prompt: 'Which era would be the most fun to visit together?', options: ['1920s', '1970s', '1990s', 'The future'] },
  { prompt: 'What deserves the biggest comeback?', options: ['Physical photos', 'Arcades', 'Handwritten letters', 'Theme parties'] },
  { prompt: 'What is the most important part of a party?', options: ['People', 'Music', 'Food', 'Location'] },
  { prompt: 'Which skill should every adult have?', options: ['Cooking', 'Budgeting', 'First aid', 'Conflict resolution'] },
]);

const WOULD_RATHER = prompts('would_rather', [
  { prompt: 'Would you rather always know when someone is lying or always get away with your own lies?', options: ['Know every lie', 'Get away with mine'] },
  { prompt: 'Would you rather relive one perfect day or erase one terrible day?', options: ['Relive the perfect day', 'Erase the terrible day'] },
  { prompt: 'Would you rather be famous for something embarrassing or anonymous for something extraordinary?', options: ['Embarrassingly famous', 'Extraordinarily anonymous'] },
  { prompt: 'Would you rather have unlimited travel or never pay for food again?', options: ['Unlimited travel', 'Free food forever'] },
  { prompt: 'Would you rather hear everyone’s thoughts for one hour or let everyone hear yours?', options: ['Hear theirs', 'They hear mine'] },
  { prompt: 'Would you rather give up your phone for a month or let the group read your last 100 searches?', options: ['Lose my phone', 'Reveal my searches'] },
  { prompt: 'Would you rather know exactly how you die or exactly when?', options: ['Know how', 'Know when'] },
  { prompt: 'Would you rather be the funniest or the smartest person in every room?', options: ['Funniest', 'Smartest'] },
  { prompt: 'Would you rather redo one decision or preview one future decision?', options: ['Redo the past', 'Preview the future'] },
  { prompt: 'Would you rather be deeply understood by a few people or admired by many?', options: ['Understood by a few', 'Admired by many'] },
]);

const HOT_SEAT = prompts('hot_seat', [
  'What is the funniest first impression you could invent about the person in the Hot Seat?',
  'Give the person in the Hot Seat a new job title based only on their personality.',
  'What would the person in the Hot Seat be famous for in an alternate universe?',
  'Pitch the person in the Hot Seat as the hero of a ridiculous action movie.',
  'What warning label should come with the person in the Hot Seat?',
  'Name the person in the Hot Seat’s imaginary signature cocktail.',
  'What harmless conspiracy theory about the person in the Hot Seat sounds believable?',
  'Write the person in the Hot Seat’s unauthorized memoir title.',
  'What reality show would the person in the Hot Seat secretly dominate?',
  'Describe the person in the Hot Seat’s villain origin story in one sentence.',
]);

const ANONYMOUS = prompts('anonymous', [
  'What is a harmless opinion you defend with unreasonable passion?',
  'What is the pettiest thing that can instantly ruin your mood?',
  'What is something you pretend to understand but absolutely do not?',
  'What is the weirdest thing currently in your notes app?',
  'What is a habit you would deny if this answer were not anonymous?',
  'What is your most irrational social fear?',
  'What is a compliment you desperately want to receive?',
  'What is the funniest lie you believed for far too long?',
  'What is something you judge people for even though you know you should not?',
  'What is your most chaotic “this seemed like a good idea” story?',
]);

const KNOW_ME = prompts('know_me', [
  { prompt: 'Which kind of surprise would I enjoy most?', options: ['A trip', 'A party', 'A meaningful gift', 'A totally free day'] },
  { prompt: 'When I am stressed, what do I want first?', options: ['Advice', 'Comfort', 'Space', 'A distraction'] },
  { prompt: 'Which compliment means the most to me?', options: ['Funny', 'Kind', 'Smart', 'Attractive'] },
  { prompt: 'What would I protect first during a move?', options: ['Photos', 'Clothes', 'Technology', 'Keepsakes'] },
  { prompt: 'What kind of plan am I most likely to say yes to?', options: ['Spontaneous adventure', 'Cozy night', 'Big group event', 'One-on-one catch-up'] },
  { prompt: 'Which motivates me most?', options: ['Recognition', 'Curiosity', 'Competition', 'Helping someone'] },
  { prompt: 'What do I notice first in a new place?', options: ['People', 'Design', 'Food', 'Energy'] },
  { prompt: 'Which risk would I be most willing to take?', options: ['Career', 'Travel', 'Creative', 'Romantic'] },
  { prompt: 'What kind of memory do I treasure most?', options: ['Funny', 'Peaceful', 'Adventurous', 'Emotional'] },
  { prompt: 'Which form of support do I value most?', options: ['Showing up', 'Listening', 'Problem-solving', 'Encouragement'] },
]);

const FAMILY_TRIVIA = prompts('family_trivia', [
  { prompt: 'Which family tradition would the person in the Hot Seat protect first?', options: ['Holiday meal', 'Annual trip', 'Family jokes', 'Photos and stories'] },
  { prompt: 'Which childhood treat would the person in the Hot Seat choose right now?', options: ['Homemade favorite', 'Candy', 'Fast food', 'Ice cream'] },
  { prompt: 'Who would the person in the Hot Seat call first with big news?', options: ['Parent', 'Sibling', 'Partner', 'Whole group chat'] },
  { prompt: 'Which role does the person in the Hot Seat usually play at gatherings?', options: ['Organizer', 'Storyteller', 'Peacemaker', 'Late arrival'] },
  { prompt: 'Which family keepsake would matter most to the person in the Hot Seat?', options: ['Recipe', 'Photograph', 'Letter', 'Piece of jewelry'] },
  { prompt: 'Which relative’s personality is the person in the Hot Seat most similar to?', options: ['Older generation', 'Parent generation', 'Sibling/cousin', 'Completely their own'] },
  { prompt: 'What kind of family story does the person in the Hot Seat tell most often?', options: ['Embarrassing', 'Sweet', 'Chaotic', 'Legendary'] },
  { prompt: 'What family responsibility would the person in the Hot Seat volunteer for?', options: ['Cooking', 'Planning', 'Driving', 'Entertainment'] },
]);

export const PARTY_GAME_DEFINITIONS = Object.freeze({
  fill: { name: 'Fill-in-the-Blank', mechanic: 'favorite', description: 'Write punchlines; the Hot Seat picks a winner.' },
  most_likely: { name: 'Most Likely To', mechanic: 'player_vote', description: 'Vote for the player who best fits the prompt.' },
  never_have_i_ever: { name: 'Never Have I Ever', mechanic: 'knowledge', description: 'The Hot Seat predicts who has done it.' },
  majority: { name: 'Majority Rules', mechanic: 'choice_vote', description: 'Match the room’s most popular answer.' },
  would_rather: { name: 'Would You Rather', mechanic: 'choice_vote', description: 'Choose a side and score with the majority.' },
  hot_seat: { name: 'Hot Seat', mechanic: 'favorite', description: 'Write about one player; they pick their favorite.' },
  anonymous: { name: 'Anonymous Answers', mechanic: 'anonymous_guess', description: 'Write honestly, then guess who said what.' },
  know_me: { name: 'Know Me Best', mechanic: 'owner_choice', description: 'Predict the Hot Seat player’s private answer.' },
  family_trivia: { name: 'Family Trivia', mechanic: 'owner_choice', description: 'How well do you know your family?' },
});

export const PARTY_PROMPTS = Object.freeze({
  fill: FILL,
  most_likely: MOST_LIKELY,
  never_have_i_ever: NEVER_HAVE_I_EVER,
  majority: MAJORITY,
  would_rather: WOULD_RATHER,
  hot_seat: HOT_SEAT,
  anonymous: ANONYMOUS,
  know_me: KNOW_ME,
  family_trivia: FAMILY_TRIVIA,
});

export const DEFAULT_PARTY_ROTATION = Object.freeze(Object.keys(PARTY_GAME_DEFINITIONS));

export function choosePartyPrompt({ round = 1, enabledTypes = DEFAULT_PARTY_ROTATION, usedPromptIds = [], random = Math.random } = {}) {
  const types = enabledTypes.filter(type => PARTY_PROMPTS[type]?.length);
  const type = types[((round || 1) - 1) % types.length];
  const all = PARTY_PROMPTS[type];
  const unused = all.filter(item => !usedPromptIds.includes(item.id));
  const pool = unused.length ? unused : all;
  return pool[Math.floor(random() * pool.length)];
}
