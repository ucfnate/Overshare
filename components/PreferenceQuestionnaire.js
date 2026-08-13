'use client';

import { useState } from 'react';
import { DEFAULT_PREFERENCES, PREFERENCE_OPTIONS, togglePreference } from '../lib/preferences';

const steps = [
  { key: 'depth', title: 'How deep should the questions go?', subtitle: 'Pick the level that feels right today.', multiple: false },
  { key: 'energy', title: 'What energy sounds good?', subtitle: 'Choose as many as you like.', multiple: true },
  { key: 'styles', title: 'What do you like talking about?', subtitle: 'We’ll favor the group’s shared picks.', multiple: true },
  { key: 'excludedTopics', title: 'Anything you want to avoid?', subtitle: 'Your boundaries stay private. Skipping everything is okay.', multiple: true },
  { key: 'duration', title: 'How much time do you have?', subtitle: 'This helps us pace the session.', multiple: false },
];

export default function PreferenceQuestionnaire({ initialValue = DEFAULT_PREFERENCES, onBack, onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [value, setValue] = useState({ ...DEFAULT_PREFERENCES, ...initialValue });
  const step = steps[stepIndex];
  const options = PREFERENCE_OPTIONS[step.key];

  const select = (option) => setValue(current => ({
    ...current,
    [step.key]: step.multiple ? togglePreference(current[step.key] || [], option) : option,
  }));
  const canContinue = step.key === 'excludedTopics' || (step.multiple ? value[step.key]?.length > 0 : !!value[step.key]);

  return (
    <div className="min-h-screen overshare-backdrop flex items-center justify-center p-4">
      <main className="overshare-panel w-full max-w-lg p-6 sm:p-8" aria-labelledby="preference-title">
        <div className="flex items-center justify-between mb-3">
          <span className="overshare-kicker">Set the vibe</span>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{stepIndex + 1} of {steps.length}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-8" aria-hidden="true">
          <div className="h-full overshare-gradient transition-all" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
        </div>
        <h1 id="preference-title" className="text-3xl font-extrabold tracking-tight text-gray-950 dark:text-white mb-2">{step.title}</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">{step.subtitle}</p>

        <div className="grid sm:grid-cols-2 gap-3">
          {options.map(option => {
            const selected = step.multiple ? value[step.key]?.includes(option.value) : value[step.key] === option.value;
            return (
              <button
                type="button"
                key={option.value}
                aria-pressed={selected}
                onClick={() => select(option.value)}
                className={`preference-choice ${selected ? 'preference-choice-selected' : ''}`}
              >
                <span className="font-bold">{option.label}</span>
                {option.description && <span className="block mt-1 text-sm text-gray-500 dark:text-gray-400">{option.description}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 mt-8">
          <button type="button" className="overshare-button-secondary flex-1" onClick={() => stepIndex ? setStepIndex(index => index - 1) : onBack?.()}>Back</button>
          <button
            type="button"
            disabled={!canContinue}
            className="overshare-button-primary flex-1 disabled:opacity-40"
            onClick={() => stepIndex === steps.length - 1 ? onComplete(value) : setStepIndex(index => index + 1)}
          >
            {stepIndex === steps.length - 1 ? 'Save preferences' : 'Continue'}
          </button>
        </div>
      </main>
    </div>
  );
}
