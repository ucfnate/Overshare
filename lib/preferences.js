export const DEFAULT_PREFERENCES = Object.freeze({
  depth: 'balanced',
  energy: ['playful'],
  styles: ['stories'],
  excludedTopics: [],
  duration: 'standard',
});

export const PREFERENCE_OPTIONS = Object.freeze({
  depth: [
    { value: 'light', label: 'Keep it light', description: 'Easy answers and quick laughs.' },
    { value: 'balanced', label: 'A balanced mix', description: 'Playful with a thoughtful edge.' },
    { value: 'deep', label: 'Go deeper', description: 'More reflection and meaningful stories.' },
  ],
  energy: [
    { value: 'playful', label: 'Playful' },
    { value: 'reflective', label: 'Reflective' },
    { value: 'competitive', label: 'Competitive' },
  ],
  styles: [
    { value: 'stories', label: 'Stories' },
    { value: 'memories', label: 'Memories' },
    { value: 'hypotheticals', label: 'What if?' },
    { value: 'opinions', label: 'Hot takes' },
    { value: 'appreciation', label: 'Appreciation' },
  ],
  excludedTopics: [
    { value: 'dating', label: 'Dating' },
    { value: 'family', label: 'Family' },
    { value: 'money', label: 'Money' },
    { value: 'work', label: 'Work' },
    { value: 'intimacy', label: 'Intimacy' },
  ],
  duration: [
    { value: 'quick', label: 'Quick', description: 'About 10 minutes' },
    { value: 'standard', label: 'Standard', description: 'About 25 minutes' },
    { value: 'long', label: 'Long', description: 'Keep going' },
  ],
});

export const RELATIONSHIP_OPTIONS = Object.freeze([
  { value: 'just_met', label: 'Just met' },
  { value: 'acquaintance', label: 'Acquaintance' },
  { value: 'coworker', label: 'Coworker / classmate' },
  { value: 'friend', label: 'Friend' },
  { value: 'close_friend', label: 'Close friend' },
  { value: 'family', label: 'Family' },
  { value: 'partner', label: 'Dating / partner' },
]);

const mostCommon = (values, fallback) => {
  const counts = values.reduce((result, value) => {
    if (value) result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
};

export function buildGroupProfile(preferencesByPlayer = {}) {
  const profiles = Object.values(preferencesByPlayer).filter(Boolean);
  if (!profiles.length) return { ...DEFAULT_PREFERENCES, participantCount: 0 };

  const occurrence = (field) => {
    const counts = {};
    profiles.forEach(profile => (profile[field] || []).forEach(value => {
      counts[value] = (counts[value] || 0) + 1;
    }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .filter(([, count]) => count >= Math.ceil(profiles.length / 2))
      .map(([value]) => value);
  };

  return {
    depth: mostCommon(profiles.map(profile => profile.depth), DEFAULT_PREFERENCES.depth),
    energy: occurrence('energy'),
    styles: occurrence('styles'),
    excludedTopics: [...new Set(profiles.flatMap(profile => profile.excludedTopics || []))],
    duration: mostCommon(profiles.map(profile => profile.duration), DEFAULT_PREFERENCES.duration),
    participantCount: profiles.length,
  };
}

export function togglePreference(values, value) {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}
