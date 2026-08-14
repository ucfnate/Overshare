'use client';

import { useState } from 'react';
import { RELATIONSHIP_OPTIONS } from '../lib/preferences';

export default function RelationshipQuestionnaire({ players, currentPlayerId, initialValue = {}, onComplete }) {
  const others = players.filter(player => player.id !== currentPlayerId);
  const [relationships, setRelationships] = useState(initialValue);
  const complete = others.every(player => relationships[player.id]);

  return (
    <div className="min-h-screen overshare-backdrop flex items-center justify-center p-4">
      <main className="overshare-panel w-full max-w-lg p-6 sm:p-8" aria-labelledby="relationships-title">
        <span className="overshare-kicker">Private to you</span>
        <h1 id="relationships-title" className="text-3xl font-extrabold tracking-tight text-gray-950 dark:text-white mt-2 mb-2">How do you know everyone?</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">We use this to avoid awkward prompts. Other players won’t see your answers.</p>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {others.map(player => (
            <label key={player.id} className="flex items-center gap-3 py-4">
              <span className="grid place-items-center w-11 h-11 rounded-2xl overshare-gradient text-white font-extrabold" aria-hidden="true">{player.name.slice(0, 2).toUpperCase()}</span>
              <span className="font-bold flex-1">{player.name}</span>
              <select
                aria-label={`How do you know ${player.name}?`}
                value={relationships[player.id] || ''}
                onChange={event => setRelationships(current => ({ ...current, [player.id]: event.target.value }))}
                className="max-w-[48%] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2.5"
              >
                <option value="">Choose…</option>
                {RELATIONSHIP_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ))}
        </div>
        <button type="button" disabled={!complete} onClick={() => onComplete(relationships)} className="overshare-button-primary w-full mt-7 disabled:opacity-40">Save privately</button>
      </main>
    </div>
  );
}
