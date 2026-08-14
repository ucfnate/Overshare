'use client';

import { EXPERIENCES, isExperienceAvailable } from '../lib/experiences';

const ICONS = { general: '💬', family: '🏡', date: '♥', party: '🏆' };

export default function ExperiencePicker({
  experienceIds,
  playerCount,
  playFormat,
  onSelect,
  onBack,
  title = 'What kind of night is this?',
}) {
  return (
    <div className="min-h-screen overshare-backdrop flex items-center justify-center p-4">
      <main className="overshare-panel w-full max-w-2xl p-6 sm:p-8">
        <span className="overshare-kicker">Choose an experience</span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2 mb-2">{title}</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-7">We only ask for setup that makes the experience better.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {experienceIds.map(id => {
            const experience = EXPERIENCES[id];
            const available = isExperienceAvailable(id, playerCount, playFormat);
            const reason = id === 'date' && playerCount !== 2
              ? 'Date Night requires exactly two players.'
              : id === 'party' && playerCount < 3
                ? 'Party Mode requires at least three players.'
                : '';
            return (
              <button
                type="button"
                key={id}
                disabled={!available}
                onClick={() => onSelect(id)}
                className="overshare-mode-card text-left disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <span className="text-2xl" aria-hidden="true">{ICONS[id]}</span>
                <span className="overshare-kicker block mt-3">{experience.eyebrow}</span>
                <span className="block text-xl font-black mt-1">{experience.name}</span>
                <span className="block text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">{experience.description}</span>
                {reason ? <span className="block text-xs text-orange-600 dark:text-orange-300 mt-3">{reason}</span> : null}
              </button>
            );
          })}
        </div>
        <button type="button" className="overshare-button-secondary w-full mt-6" onClick={onBack}>Back</button>
      </main>
    </div>
  );
}
