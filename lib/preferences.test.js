import { describe, expect, it } from 'vitest';
import { buildGroupProfile, togglePreference } from './preferences';

describe('buildGroupProfile', () => {
  it('uses majority preferences and unions every hard exclusion', () => {
    const result = buildGroupProfile({
      a: { depth: 'thoughtful', spice: 'flirty', energy: ['playful'], styles: ['stories'], excludedTopics: ['money'] },
      b: { depth: 'deep', spice: 'suggestive', energy: ['playful', 'reflective'], styles: ['stories'], excludedTopics: ['work'] },
      c: { depth: 'vulnerable', spice: 'explicit', energy: ['reflective'], styles: ['memories'], excludedTopics: [] },
    });
    expect(result.depth).toBe('thoughtful');
    expect(result.spice).toBe('flirty');
    expect(result.energy).toEqual(['playful', 'reflective']);
    expect(result.styles).toEqual(['stories']);
    expect(result.excludedTopics).toEqual(['money', 'work']);
    expect(result.participantCount).toBe(3);
  });

  it('returns safe defaults for an empty room', () => {
    expect(buildGroupProfile({})).toMatchObject({ depth: 'thoughtful', participantCount: 0 });
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
