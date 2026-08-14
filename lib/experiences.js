export const EXPERIENCE_IDS = Object.freeze({
  GENERAL: 'general',
  FAMILY: 'family',
  DATE: 'date',
  PARTY: 'party',
});

export const EXPERIENCES = Object.freeze({
  general: {
    id: 'general',
    name: 'General Conversation',
    eyebrow: 'For almost any group',
    description: 'Relationship-aware questions for friends, coworkers, new people, and mixed groups.',
    minPlayers: 2,
    maxPlayers: null,
    scored: false,
    quickplay: true,
    questionnaire: true,
  },
  family: {
    id: 'family',
    name: 'Family Night',
    eyebrow: 'Stories worth keeping',
    description: 'Warm, funny, and meaningful questions for relatives of every generation.',
    minPlayers: 2,
    maxPlayers: null,
    scored: false,
    quickplay: true,
    questionnaire: true,
  },
  date: {
    id: 'date',
    name: 'Date Night',
    eyebrow: 'Just the two of you',
    description: 'Meaningful conversation for two romantic partners, with optional genuine spice.',
    minPlayers: 2,
    maxPlayers: 2,
    scored: false,
    quickplay: true,
    questionnaire: true,
  },
  party: {
    id: 'party',
    name: 'Party Mode',
    eyebrow: 'Compete, vote, reveal',
    description: 'Scored group games with round results and a live leaderboard.',
    minPlayers: 3,
    maxPlayers: null,
    scored: true,
    quickplay: false,
    questionnaire: false,
  },
});

export const QUICKPLAY_EXPERIENCES = Object.freeze(['general', 'family', 'date']);
export const MULTIPLAYER_EXPERIENCES = Object.freeze(['general', 'family', 'date', 'party']);

export function isExperienceAvailable(experienceId, playerCount, playFormat = 'multi') {
  const experience = EXPERIENCES[experienceId];
  if (!experience) return false;
  if (playFormat === 'quickplay' && !experience.quickplay) return false;
  if (playerCount < experience.minPlayers) return false;
  if (experience.maxPlayers && playerCount > experience.maxPlayers) return false;
  return true;
}
