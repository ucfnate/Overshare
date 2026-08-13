import { describe, expect, it } from 'vitest';
import { buildGroupProfile, togglePreference } from './preferences';

describe('buildGroupProfile', () => {
  it('uses majority preferences and unions every hard exclusion', () => {
    const result = buildGroupProfile({
      a: { depth: 'balanced', energy: ['playful'], styles: ['stories'], excludedTopics: ['money'], duration: 'quick' },
      b: { depth: 'balanced', energy: ['playful', 'reflective'], styles: ['stories'], excludedTopics: ['work'], duration: 'quick' },
      c: { depth: 'deep', energy: ['reflective'], styles: ['memories'], excludedTopics: [], duration: 'long' },
    });
    expect(result.depth).toBe('balanced');
    expect(result.energy).toEqual(['playful', 'reflective']);
    expect(result.styles).toEqual(['stories']);
    expect(result.excludedTopics).toEqual(['money', 'work']);
    expect(result.duration).toBe('quick');
    expect(result.participantCount).toBe(3);
  });

  it('returns safe defaults for an empty room', () => {
    expect(buildGroupProfile({})).toMatchObject({ depth: 'balanced', participantCount: 0 });
  });
});

describe('togglePreference', () => {
  it('adds and removes a selection without mutating the source', () => {
    const source = ['stories'];
    expect(togglePreference(source, 'memories')).toEqual(['stories', 'memories']);
    expect(togglePreference(source, 'stories')).toEqual([]);
    expect(source).toEqual(['stories']);
  });
});
