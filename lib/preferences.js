export const DEFAULT_PREFERENCES = Object.freeze({
  depth: 'thoughtful',
  spice: 'none',
  energy: ['playful'],
  styles: [],
  excludedTopics: [],
});

export const PREFERENCE_OPTIONS = Object.freeze({
  depth: [
    { value: 'light', label: 'Keep it light', description: 'Easy answers and quick laughs.' },
    { value: 'thoughtful', label: 'Thoughtful', description: 'Meaningful without becoming too vulnerable.' },
    { value: 'deep', label: 'Go deep', description: 'Reflection, honesty, and real conversation.' },
    { value: 'vulnerable', label: 'Be vulnerable', description: 'Questions that deserve courage and time.' },
  ],
  spice: [
    { value: 'none', label: 'No spice', description: 'Keep intimacy emotional rather than sexual.' },
    { value: 'flirty', label: 'Flirty', description: 'Chemistry, attraction, and playful tension.' },
    { value: 'suggestive', label: 'Suggestive', description: 'Sexually honest without becoming fully explicit.' },
    { value: 'explicit', label: 'Truly spicy', description: 'Direct adult questions with no euphemisms.' },
  ],
  energy: [
    { value: 'playful', label: 'Playful' },
    { value: 'reflective', label: 'Reflective' },
    { value: 'competitive', label: 'Competitive' },
  ],
  excludedTopics: [
    { value: 'dating', label: 'Dating' },
    { value: 'family', label: 'Family' },
    { value: 'money', label: 'Money' },
    { value: 'work', label: 'Work' },
    { value: 'intimacy', label: 'Intimacy' },
    { value: 'grief', label: 'Grief / loss' },
    { value: 'politics', label: 'Politics' },
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

const DEPTH_LEVELS = ['light', 'thoughtful', 'deep', 'vulnerable'];
const SPICE_LEVELS = ['none', 'flirty', 'suggestive', 'explicit'];
const mostCautious = (values, levels, fallback) => {
  const valid = values.filter(value => levels.includes(value));
  if (!valid.length) return fallback;
  return valid.slice(1).reduce((result, value) => {
  const nextIndex = levels.indexOf(value);
  const resultIndex = levels.indexOf(result);
  return nextIndex >= 0 && (resultIndex < 0 || nextIndex < resultIndex) ? value : result;
  }, valid[0]);
};

export function normalizePreferences(value = {}) {
  const legacyDepth = value.depth === 'balanced' ? 'thoughtful' : value.depth;
  return {
    ...DEFAULT_PREFERENCES,
    ...value,
    depth: DEPTH_LEVELS.includes(legacyDepth) ? legacyDepth : DEFAULT_PREFERENCES.depth,
    spice: SPICE_LEVELS.includes(value.spice) ? value.spice : DEFAULT_PREFERENCES.spice,
    energy: Array.isArray(value.energy) ? value.energy : DEFAULT_PREFERENCES.energy,
    styles: Array.isArray(value.styles) ? value.styles : DEFAULT_PREFERENCES.styles,
    excludedTopics: Array.isArray(value.excludedTopics) ? value.excludedTopics : DEFAULT_PREFERENCES.excludedTopics,
  };
}

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
    depth: mostCautious(profiles.map(profile => normalizePreferences(profile).depth), DEPTH_LEVELS, DEFAULT_PREFERENCES.depth),
    spice: mostCautious(profiles.map(profile => normalizePreferences(profile).spice), SPICE_LEVELS, DEFAULT_PREFERENCES.spice),
    energy: occurrence('energy'),
    styles: occurrence('styles'),
    excludedTopics: [...new Set(profiles.flatMap(profile => profile.excludedTopics || []))],
    participantCount: profiles.length,
  };
}

export function togglePreference(values, value) {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}
