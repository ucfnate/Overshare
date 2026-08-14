import { QUESTION_CATALOG, getTopicsForExperience } from './questionCatalog';

export const DEPTH_LEVELS = Object.freeze(['light', 'thoughtful', 'deep', 'vulnerable']);
export const SPICE_LEVELS = Object.freeze(['none', 'flirty', 'suggestive', 'explicit']);

const rank = (levels, value, fallback = 0) => {
  const index = levels.indexOf(value);
  return index >= 0 ? index : fallback;
};

export function relationshipContextFrom(values = []) {
  const relationships = new Set(Object.values(values).filter(Boolean));
  if (!relationships.size) return 'mixed';
  if ([...relationships].every(value => value === 'friend' || value === 'close_friend')) {
    return relationships.has('friend') ? 'friend' : 'close_friend';
  }
  if (relationships.size > 1) return 'mixed';
  const [only] = relationships;
  if (only) return only;
  return 'mixed';
}

export function mergeGroupProfile(current = {}, contribution = {}) {
  const first = !current.contributionCount;
  const currentDepth = first ? contribution.depth : current.depth;
  const currentSpice = first ? contribution.spice : current.spice;
  const depth = DEPTH_LEVELS[Math.min(
    rank(DEPTH_LEVELS, currentDepth, 1),
    rank(DEPTH_LEVELS, contribution.depth, 1)
  )];
  const spice = SPICE_LEVELS[Math.min(
    rank(SPICE_LEVELS, currentSpice, 0),
    rank(SPICE_LEVELS, contribution.spice, 0)
  )];

  return {
    depth,
    spice,
    topics: [...new Set([...(current.topics || []), ...(contribution.styles || contribution.topics || [])])],
    excludedTopics: [...new Set([...(current.excludedTopics || []), ...(contribution.excludedTopics || [])])],
    contributionCount: (current.contributionCount || 0) + 1,
  };
}

export function selectQuestion({
  experience = 'general',
  topics = [],
  depth = 'thoughtful',
  spice = 'none',
  excludedTopics = [],
  relationshipContext = 'mixed',
  usedQuestionIds = [],
  random = Math.random,
} = {}) {
  const requestedDepth = rank(DEPTH_LEVELS, depth, 1);
  const contextDepthCaps = { just_met: 1, acquaintance: 1, coworker: 1, mixed: 1, friend: 2 };
  const allowedDepth = experience === 'general'
    ? Math.min(requestedDepth, contextDepthCaps[relationshipContext] ?? requestedDepth)
    : requestedDepth;
  const allowedSpice = experience === 'family' ? 0 : rank(SPICE_LEVELS, spice, 0);
  const selectedTopics = new Set(topics);
  const exclusions = new Set(excludedTopics);
  const used = new Set(usedQuestionIds);

  let candidates = QUESTION_CATALOG.filter(question => {
    if (!question.experiences.includes(experience)) return false;
    if (exclusions.has(question.topic)) return false;
    if (rank(DEPTH_LEVELS, question.depth, 1) > allowedDepth) return false;
    if (rank(SPICE_LEVELS, question.spice, 0) > allowedSpice) return false;
    if (question.relationshipContexts?.length && !question.relationshipContexts.includes(relationshipContext)) return false;
    return true;
  });

  if (!candidates.length) {
    candidates = QUESTION_CATALOG.filter(question =>
      question.experiences.includes(experience)
      && question.spice === 'none'
      && rank(DEPTH_LEVELS, question.depth, 1) <= allowedDepth
    );
  }

  const unused = candidates.filter(question => !used.has(question.id));
  if (unused.length) candidates = unused;

  const scored = candidates.map(question => {
    let score = 0;
    if (selectedTopics.size && selectedTopics.has(question.topic)) score += 5;
    if (question.relationshipContexts?.includes(relationshipContext)) score += 7;
    if (rank(DEPTH_LEVELS, question.depth, 1) === allowedDepth) score += 3;
    if (rank(SPICE_LEVELS, question.spice, 0) === allowedSpice && allowedSpice > 0) score += 2;
    score += random() * 2;
    return { question, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.question || null;
}

export function validateQuestionCatalog(catalog = QUESTION_CATALOG) {
  const errors = [];
  const ids = new Set();
  catalog.forEach((question, index) => {
    if (!question.id || ids.has(question.id)) errors.push(`Question ${index} has a missing or duplicate id.`);
    ids.add(question.id);
    if (!question.text?.trim()) errors.push(`${question.id || index} has no text.`);
    if (!question.experiences?.length) errors.push(`${question.id || index} has no experience.`);
    if (!question.topic) errors.push(`${question.id || index} has no topic.`);
    if (!DEPTH_LEVELS.includes(question.depth)) errors.push(`${question.id || index} has invalid depth.`);
    if (!SPICE_LEVELS.includes(question.spice)) errors.push(`${question.id || index} has invalid spice.`);
  });
  return errors;
}

export { getTopicsForExperience };
