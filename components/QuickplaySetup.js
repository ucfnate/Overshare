'use client';

import { useMemo, useState } from 'react';
import { EXPERIENCES } from '../lib/experiences';
import { DEPTH_LEVELS, SPICE_LEVELS, getTopicsForExperience } from '../lib/questionEngine';

const DEPTH_LABELS = {
  light: 'Light',
  thoughtful: 'Thoughtful',
  deep: 'Deep',
  vulnerable: 'Vulnerable',
};

const SPICE_LABELS = {
  none: 'No spice',
  flirty: 'Flirty',
  suggestive: 'Suggestive',
  explicit: 'Truly spicy',
};

export default function QuickplaySetup({ experience, onBack, onStart }) {
  const topics = useMemo(() => getTopicsForExperience(experience), [experience]);
  const [selectedTopics, setSelectedTopics] = useState(() => Object.keys(topics).slice(0, 3));
  const [depth, setDepth] = useState('thoughtful');
  const [spice, setSpice] = useState('none');
  const [relationshipContext, setRelationshipContext] = useState(experience === 'family' ? 'family' : experience === 'date' ? 'partner' : 'friend');

  const toggleTopic = (topic) => setSelectedTopics(current =>
    current.includes(topic) ? current.filter(value => value !== topic) : [...current, topic]
  );

  return (
    <div className="min-h-screen overshare-backdrop flex items-center justify-center p-4">
      <main className="overshare-panel w-full max-w-2xl p-6 sm:p-8">
        <span className="overshare-kicker">Quickplay · {EXPERIENCES[experience]?.name}</span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2 mb-2">Build tonight’s deck.</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-7">One screen, one device, no questionnaire and no room code.</p>

        {experience === 'general' ? (
          <fieldset className="mb-7">
            <legend className="font-black mb-3">Who is in the room?</legend>
            <div className="flex flex-wrap gap-2">
              {[
                ['friend', 'Friends'],
                ['coworker', 'Coworkers'],
                ['just_met', 'New people'],
                ['mixed', 'Mixed group'],
              ].map(([value, label]) => (
                <button type="button" key={value} aria-pressed={relationshipContext === value} onClick={() => setRelationshipContext(value)} className={`topic-pill ${relationshipContext === value ? 'topic-pill-selected' : ''}`}>{label}</button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="mb-7">
          <legend className="font-black mb-3">What do you want to talk about?</legend>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(topics).map(([id, topic]) => {
              const selected = selectedTopics.includes(id);
              return (
                <button type="button" key={id} aria-pressed={selected} onClick={() => toggleTopic(id)} className={`preference-choice ${selected ? 'preference-choice-selected' : ''}`}>
                  <span className="font-bold">{topic.label}</span>
                  <span className="block text-sm text-gray-500 dark:text-gray-400 mt-1">{topic.description}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mb-7">
          <legend className="font-black mb-3">How deep?</legend>
          <div className="flex flex-wrap gap-2">
            {DEPTH_LEVELS.map(value => (
              <button type="button" key={value} aria-pressed={depth === value} onClick={() => setDepth(value)} className={`topic-pill ${depth === value ? 'topic-pill-selected' : ''}`}>{DEPTH_LABELS[value]}</button>
            ))}
          </div>
        </fieldset>

        {experience === 'date' ? (
          <fieldset className="mb-7">
            <legend className="font-black mb-1">How spicy?</legend>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Adults only. “Truly spicy” means direct and explicit.</p>
            <div className="flex flex-wrap gap-2">
              {SPICE_LEVELS.map(value => (
                <button type="button" key={value} aria-pressed={spice === value} onClick={() => setSpice(value)} className={`topic-pill ${spice === value ? 'topic-pill-selected' : ''}`}>{SPICE_LABELS[value]}</button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="flex gap-3">
          <button type="button" className="overshare-button-secondary flex-1" onClick={onBack}>Back</button>
          <button type="button" disabled={!selectedTopics.length} className="overshare-button-primary flex-1 disabled:opacity-40" onClick={() => onStart({ topics: selectedTopics, depth, spice, relationshipContext })}>Start talking</button>
        </div>
      </main>
    </div>
  );
}
