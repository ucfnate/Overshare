import { describe, expect, it } from 'vitest';
import { QUESTION_CATALOG } from './questionCatalog';
import {
  mergeGroupProfile,
  relationshipContextFrom,
  selectQuestion,
  validateQuestionCatalog,
} from './questionEngine';

describe('question catalog', () => {
  it('is valid and substantially expands the structured pool', () => {
    expect(validateQuestionCatalog()).toEqual([]);
    expect(QUESTION_CATALOG.length).toBeGreaterThan(400);
  });

  it('never serves spicy prompts to Family Night', () => {
    const result = selectQuestion({ experience: 'family', topics: ['memories'], depth: 'vulnerable', spice: 'explicit', random: () => 0.5 });
    expect(result.experiences).toContain('family');
    expect(result.spice).toBe('none');
  });

  it('allows truly spicy Date Night prompts only when explicitly enabled', () => {
    const safe = selectQuestion({ experience: 'date', topics: ['intimacy'], depth: 'vulnerable', spice: 'none', random: () => 0.5 });
    const explicit = selectQuestion({ experience: 'date', topics: ['intimacy'], depth: 'vulnerable', spice: 'explicit', random: () => 0.5 });
    expect(safe.spice).toBe('none');
    expect(explicit.spice).toBe('explicit');
  });

  it('avoids used questions when another eligible question exists', () => {
    const first = selectQuestion({ experience: 'family', topics: ['playful'], depth: 'light', random: () => 0.5 });
    const second = selectQuestion({ experience: 'family', topics: ['playful'], depth: 'light', usedQuestionIds: [first.id], random: () => 0.5 });
    expect(second.id).not.toBe(first.id);
  });

  it('prefers prompts written for the relationship in the room', () => {
    const result = selectQuestion({ experience: 'general', relationshipContext: 'coworker', topics: ['growth'], depth: 'deep', random: () => 0.5 });
    expect(result.relationshipContexts).toContain('coworker');
    expect(result.depth).toBe('thoughtful');
  });

  it('caps vulnerable prompts for mixed and newly formed groups', () => {
    const mixed = selectQuestion({ experience: 'general', relationshipContext: 'mixed', topics: ['deep'], depth: 'vulnerable', random: () => 0.5 });
    const newPeople = selectQuestion({ experience: 'general', relationshipContext: 'just_met', topics: ['deep'], depth: 'vulnerable', random: () => 0.5 });
    expect(['light', 'thoughtful']).toContain(mixed.depth);
    expect(['light', 'thoughtful']).toContain(newPeople.depth);
  });
});

describe('group profiles', () => {
  it('uses the most cautious shared depth and spice limits', () => {
    const first = mergeGroupProfile({}, { depth: 'vulnerable', spice: 'explicit', styles: ['intimacy'], excludedTopics: [] });
    const second = mergeGroupProfile(first, { depth: 'thoughtful', spice: 'flirty', styles: ['memories'], excludedTopics: ['money'] });
    expect(second).toMatchObject({ depth: 'thoughtful', spice: 'flirty', excludedTopics: ['money'], contributionCount: 2 });
    expect(second.topics).toEqual(['intimacy', 'memories']);
  });

  it('summarizes relationship context without exposing an individual answer', () => {
    expect(relationshipContextFrom({ a: 'friend', b: 'coworker' })).toBe('mixed');
    expect(relationshipContextFrom({ a: 'partner', b: 'close_friend' })).toBe('mixed');
    expect(relationshipContextFrom({ a: 'close_friend' })).toBe('close_friend');
  });
});
