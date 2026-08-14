
'use client';

/* =========================================================
   Imports
========================================================= */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users,
  MessageCircle,
  Heart,
  Sparkles,
  Lightbulb,
  Target,
  Flame,
  Volume2,
  VolumeX,
  SkipForward,
  HelpCircle,
  X,
  Crown,
  Trophy,
  CheckCircle2,
  Wand2,
} from 'lucide-react';

// Firebase helpers (your /lib/firebase must export these)
import { db, ensureSignedIn, listenToAlerts, pushAlert } from '../lib/firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  runTransaction,
} from 'firebase/firestore';
import PreferenceQuestionnaire from '../components/PreferenceQuestionnaire';
import RelationshipQuestionnaire from '../components/RelationshipQuestionnaire';
import ExperiencePicker from '../components/ExperiencePicker';
import QuickplaySetup from '../components/QuickplaySetup';
import { DEFAULT_PREFERENCES, normalizePreferences } from '../lib/preferences';
import { MULTIPLAYER_EXPERIENCES, QUICKPLAY_EXPERIENCES } from '../lib/experiences';
import {
  getTopicsForExperience,
  mergeGroupProfile,
  relationshipContextFrom,
  selectQuestion,
} from '../lib/questionEngine';
import { DEFAULT_PARTY_ROTATION, PARTY_GAME_DEFINITIONS, choosePartyPrompt } from '../lib/partyGames';
import { addRoundScores, scoreAnonymousGuesses, scoreCorrectGuesses, scoreMajorityVotes } from '../lib/partyScoring';

// External prompt libraries (in /lib)
import { nhiePrompts } from '../lib/nhie.js';
import { superlativesPrompts } from '../lib/superlatives.js';
import { fillInPrompts } from '../lib/fillin.js';

// Category library (in /lib) — used for Classic mode
import {
  questionCategories as qcImport,
  getRandomQuestion as getRandomQImport,
} from '../lib/questionCategories.js';

/* =========================================================
   External prompt normalization
========================================================= */
const EXT_NHI = Array.isArray(nhiePrompts) ? nhiePrompts : [];
const EXT_SUPER = Array.isArray(superlativesPrompts) ? superlativesPrompts : [];
const EXT_FILL = Array.isArray(fillInPrompts) ? fillInPrompts : [];

// Remote-friendly filter (removes “on your left/right”, etc.)
const remoteSafe = (s) => typeof s === 'string' && !/on your (left|right)/i.test(s);
const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

function readStoredTheme() {
  if (typeof window === 'undefined') return 'sunset';
  try { return localStorage.getItem('bgTheme') || 'sunset'; } catch { return 'sunset'; }
}

function readStoredProfile() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('overshare-profile') || 'null'); } catch { return null; }
}

/* =========================================================
   Small shared UI
========================================================= */
const ProgressIndicator = ({ current, total, className = '' }) => (
  <div className={`w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full ${className}`}>
    <div
      className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
      style={{ width: `${total ? Math.min(100, Math.max(0, (current / total) * 100)) : 0}%` }}
    />
  </div>
);

const Scoreboard = ({ scores = {}, inline = false }) => {
  const entries = Object.entries(scores || {});
  const sorted = entries.sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, 3);

  if (inline) {
    return (
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-500" />
        <span className="text-sm">
          Top: {sorted.map(([n, s]) => `${n} (${s})`).join(' · ') || '—'}
        </span>
      </div>
    );
  }
  return (
    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
      <div className="flex items-center gap-2 mb-2">
        <Crown className="w-5 h-5 text-yellow-500" />
        <h4 className="font-semibold">Leaderboard</h4>
      </div>
      <ul className="space-y-1">
        {sorted.length ? (
          sorted.map(([n, s], i) => (
            <li key={n} className="flex justify-between">
              <span>{i + 1}. {n}</span>
              <span className="font-semibold">{s}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-gray-500 dark:text-gray-300">No scores yet</li>
        )}
      </ul>
    </div>
  );
};

const RoundScoreboard = ({ players = [], scores = {} }) => (
  <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 text-left mb-4">
    <h4 className="font-semibold mb-2">Points this round</h4>
    <ul className="space-y-1">
      {players.map(player => (
        <li key={player.id} className="flex justify-between">
          <span>{player.name}</span>
          <span className="font-bold">+{scores[player.name] || 0}</span>
        </li>
      ))}
    </ul>
  </div>
);

function ThemePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed left-3 top-1/2 -translate-y-1/2 z-50">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="px-3 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow hover:bg-white"
        title="Background theme"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        🎨
      </button>

      {open && (
        <div className="mt-2 w-44 rounded-xl bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 shadow-lg p-2">
          <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1" htmlFor="multiplayer-theme">Background</label>
          <select
            id="multiplayer-theme"
            value={value}
            onChange={(event) => { onChange(event.target.value); setOpen(false); }}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm p-2"
          >
            <option value="sunset">Sunset</option>
            <option value="ocean">Ocean</option>
            <option value="dusk">Dusk</option>
            <option value="vapor">Vapor</option>
            <option value="slate">Slate</option>
            <option value="plain">Plain</option>
          </select>
        </div>
      )}
    </div>
  );
}

function ConfirmReturnModal({ open, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="overshare-panel w-full max-w-sm p-6" role="alertdialog" aria-modal="true" aria-labelledby="return-title" aria-describedby="return-description">
        <h2 id="return-title" className="text-xl font-extrabold mb-2">Return everyone to the lobby?</h2>
        <p id="return-description" className="text-gray-600 dark:text-gray-300 mb-6">The current round will end for everyone in this room.</p>
        <div className="flex gap-3">
          <button type="button" className="overshare-button-secondary flex-1" onClick={onCancel}>Stay here</button>
          <button type="button" className="overshare-button-primary flex-1" onClick={onConfirm}>Return</button>
        </div>
      </div>
    </div>
  );
}

function TopBar({
  libraryOK,
  audioEnabled,
  onToggleAudio,
  onShowHelp,
  bgTheme,
  onThemeChange,
  showReturnConfirmation,
  onCancelReturn,
  onConfirmReturn,
}) {
  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <span
          title={libraryOK ? 'Using external question library' : 'Using built-in fallback questions'}
          className={`hidden sm:inline-flex px-2 py-1 rounded-lg text-xs font-medium ${libraryOK ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`}
        >
          {libraryOK ? 'Library' : 'Fallback'}
        </span>
        <button type="button" onClick={onToggleAudio} className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-all" aria-label={audioEnabled ? 'Disable sound' : 'Enable sound'} title={audioEnabled ? 'Sound: on' : 'Sound: off'}>
          {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
        <button type="button" onClick={onShowHelp} className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 dark:hover:bg-white/20 transition-all" aria-label="Help" title="Help">
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>
      <ThemePicker value={bgTheme} onChange={onThemeChange} />
      <ConfirmReturnModal open={showReturnConfirmation} onCancel={onCancelReturn} onConfirm={onConfirmReturn} />
    </>
  );
}

function HelpModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-2xl p-6 relative" role="dialog" aria-modal="true" aria-labelledby="multiplayer-help-title">
        <button type="button" className="absolute top-3 right-3 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100" onClick={onClose} aria-label="Close help">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <h3 id="multiplayer-help-title" className="text-xl font-semibold">How to Play Overshare</h3>
        </div>
        <div className="space-y-3 text-gray-700 dark:text-gray-200">
          <p>Create a room and share its code, or enter a code to join your group.</p>
          <p>Conversation experiences focus on meaningful prompts. Party Mode mixes votes, predictions, anonymous reveals, and scoring.</p>
          <p className="text-sm text-gray-500 dark:text-gray-300">Pro tip: the more you share, the better the stories get.</p>
        </div>
        <div className="mt-6 border-t border-gray-200 dark:border-gray-600 pt-4 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-300">Enjoying the game?</span>
          <a href="https://venmo.com/ucfnate" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:shadow-md">
            💜 Donate
          </a>
        </div>
      </div>
    </div>
  );
}

function NotificationToast({ notification }) {
  if (!notification) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-4 z-50" role="status">
      <div className="flex items-center space-x-2">
        <span className="text-2xl">{notification.emoji}</span>
        <span className="font-medium text-gray-800 dark:text-gray-100">{notification.message}</span>
      </div>
    </div>
  );
}

function CategoryChip({ categoryKey, topics, iconMap }) {
  const category = topics[categoryKey];
  const IconComponent = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r ${category?.color || 'from-gray-400 to-gray-500'} text-white text-sm`}>
      <IconComponent className="w-4 h-4" />
      <span>{category?.name || categoryKey}</span>
    </div>
  );
}

function PlayerList({ players = [], title, showCheck = false, highlight = null }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{title} ({players.length})</h3>
      <div className="space-y-2">
        {players.map((player, index) => (
          <div key={`${player?.id || 'p'}-${index}`} className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl ${highlight === player?.name ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/30' : ''}`}>
            <span className="font-medium">{player?.name || 'Player'}</span>
            <div className="flex items-center gap-2">
              {player?.isHost && <span className="text-xs bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-200 px-2 py-1 rounded-full">Host</span>}
              {showCheck && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   Party child components (isolated state = fewer hook issues)
========================================================= */

// Fill in the Blank — collect answers & pick favorite
function FillCollectView({
  party,
  players,
  playerName,
  playerId,
  turnOwner,
  turnOwnerId,
  isTurnOwner,
  onSubmitAnswer,
  onMarkDone,
  onPickFavorite,
}) {
  const [draft, setDraft] = useState('');

  const mySubs = (party?.submissions?.[playerId] || []);
  const myDone = !!party?.done?.[playerId];
  const nonTurn = (players || []).filter(p => p.id !== turnOwnerId);
  const allDone = nonTurn.length > 0 && nonTurn.every(p =>
    party?.done?.[p.id] || (party?.submissions?.[p.id] || []).length > 0
  );

  return (
    <>
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 dark:border-purple-400 mb-4">
        <p className="font-medium">{party?.prompt}</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Turn owner: {turnOwner}</p>

      {!isTurnOwner ? (
        <>
          <div className="space-y-2 mb-3">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={mySubs.length >= 2 ? 'You reached 2 answers' : 'Your answer…'}
              disabled={mySubs.length >= 2 || myDone}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-purple-500 bg-white dark:bg-gray-900"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { if (draft.trim()) onSubmitAnswer(draft); setDraft(''); }}
                disabled={mySubs.length >= 2 || myDone || !draft.trim()}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 rounded-xl font-semibold disabled:opacity-50"
              >
                Submit
              </button>
              <button
                onClick={onMarkDone}
                disabled={myDone}
                className="px-3 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600"
              >
                Done submitting
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Your answers: {mySubs.length} of 2 {myDone && '· done'}
          </div>
        </>
      ) : (
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {allDone ? 'Everyone is done — pick your favorite below.' : 'Waiting for answers…'}
        </div>
      )}

      {isTurnOwner && allDone && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Pick your favorite</h3>
          <div className="space-y-2 max-h-60 overflow-auto">
            {Object.values(party?.submissions || {}).flat().map(a => (
              <button
                key={a.id}
                onClick={() => onPickFavorite(a.id)}
                className="w-full p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 text-left hover:border-purple-400"
              >
                {a.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Superlatives — two-step vote (choose -> submit)
function SuperVoteView({ party, players, playerId, onSubmitVote }) {
  const [choice, setChoice] = useState(party?.votes?.[playerId] || '');
  const myVoteSubmitted = !!party?.votes?.[playerId];

  return (
    <>
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 dark:border-purple-400 mb-4">
        <p className="font-medium">{party?.prompt}</p>
      </div>

      <div className="space-y-2">
        {players.map(p => (
          <button
            key={p.id}
            onClick={() => setChoice(p.name)}
            disabled={myVoteSubmitted}
            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
              choice === p.name
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
            } ${myVoteSubmitted ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {!myVoteSubmitted ? (
        <button
          onClick={() => { if (choice) onSubmitVote(choice); }}
          disabled={!choice}
          className="w-full mt-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
        >
          Submit Vote
        </button>
      ) : (
        <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-3">Vote submitted ✓</p>
      )}
    </>
  );
}

// NHI — players submit “I have / I haven’t”
function NhiCollectView({ party, players, playerId, turnOwnerId, turnOwner, isTurnOwner, onSubmitMyAnswer }) {
  const [local, setLocal] = useState(null);
  const myAnsOnServer = party?.nhiAnswers?.[playerId];
  const others = (players || []).filter(p => p.id !== turnOwnerId);
  const allSubmitted = others.length > 0 && others.every(p => party?.nhiAnswers?.[p.id] !== undefined);


  return (
    <>
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 dark:border-purple-400 mb-4">
        <p className="font-medium">{party?.prompt}</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Turn owner: {turnOwner}</p>

      {!isTurnOwner ? (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setLocal(true)}
              disabled={myAnsOnServer !== undefined}
              className={`flex-1 border-2 py-3 rounded-xl font-semibold ${local === true ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600'} ${myAnsOnServer !== undefined ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              I have
            </button>
            <button
              onClick={() => setLocal(false)}
              disabled={myAnsOnServer !== undefined}
              className={`flex-1 border-2 py-3 rounded-xl font-semibold ${local === false ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'} ${myAnsOnServer !== undefined ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              I haven’t
            </button>
          </div>

          {myAnsOnServer === undefined ? (
            <button
              onClick={() => { if (local !== null) onSubmitMyAnswer(local); }}
              disabled={local === null}
              className="w-full mt-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              Submit
            </button>
          ) : (
            <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-3">Answer submitted ✓</p>
          )}
        </>
      ) : (
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          Waiting for everyone to submit…
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
        Submitted: {Object.keys(party?.nhiAnswers || {}).length} / {others.length}
      </div>

      {isTurnOwner && allSubmitted && (
        <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-3">
          Everyone has submitted — proceed to guessing.
        </p>
      )}
    </>
  );
}

// NHI — turn owner guesses for each player
function NhiGuessView({ party, players, turnOwner, isTurnOwner, onConfirmGuesses }) {
  const [guessMap, setGuessMap] = useState({});
  const others = (players || []).filter(p => p.name !== turnOwner);

  return (
    <>
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 dark:border-purple-400 mb-4">
        <p className="font-medium">{party?.prompt}</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Turn owner: {turnOwner}</p>

      {isTurnOwner ? (
        <div className="space-y-2">
          {others.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600">
              <span className="font-medium">{p.name}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setGuessMap(m => ({ ...m, [p.id]: true }))}
                  className={`px-3 py-1 rounded-lg border-2 ${guessMap[p.id] === true ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600'}`}
                >
                  Has
                </button>
                <button
                  onClick={() => setGuessMap(m => ({ ...m, [p.id]: false }))}
                  className={`px-3 py-1 rounded-lg border-2 ${guessMap[p.id] === false ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}`}
                >
                  Hasn’t
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => onConfirmGuesses(guessMap)}
            className="w-full mt-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold"
          >
            Confirm Guesses
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {turnOwner} is guessing…
        </div>
      )}
    </>
  );
}

function ChoiceVoteView({ party, playerId, onSubmit }) {
  const [choice, setChoice] = useState(party?.choiceVotes?.[playerId] || '');
  const submitted = party?.choiceVotes?.[playerId] !== undefined;
  return (
    <>
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 mb-4">
        <p className="font-medium">{party.prompt}</p>
      </div>
      <div className="space-y-2">
        {(party.options || []).map(option => (
          <button key={option} type="button" disabled={submitted} onClick={() => setChoice(option)} className={`w-full p-3 rounded-xl border-2 text-left ${choice === option ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-600'}`}>
            {option}
          </button>
        ))}
      </div>
      <button type="button" disabled={!choice || submitted} onClick={() => onSubmit(choice)} className="w-full mt-3 overshare-button-primary disabled:opacity-50">
        {submitted ? 'Choice submitted ✓' : 'Lock in choice'}
      </button>
    </>
  );
}

function OwnerChoiceView({ party, players, playerId, isTurnOwner, onOwnerAnswer, onGuess }) {
  const [choice, setChoice] = useState('');
  const submitted = isTurnOwner ? !!party.ownerAnswer : party.ownerGuesses?.[playerId] !== undefined;
  return (
    <>
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 mb-4">
        <p className="font-medium">{party.prompt}</p>
      </div>
      {party.state === 'owner_answer' && !isTurnOwner ? (
        <p className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700">The Hot Seat is answering privately…</p>
      ) : (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{isTurnOwner ? 'Choose your real answer.' : `Predict ${players[party.turnIndex]?.name}’s answer.`}</p>
          <div className="space-y-2">
            {(party.options || []).map(option => <button key={option} type="button" disabled={submitted} onClick={() => setChoice(option)} className={`w-full p-3 rounded-xl border-2 text-left ${choice === option ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-600'}`}>{option}</button>)}
          </div>
          <button type="button" disabled={!choice || submitted} onClick={() => isTurnOwner ? onOwnerAnswer(choice) : onGuess(choice)} className="w-full mt-3 overshare-button-primary disabled:opacity-50">{submitted ? 'Submitted ✓' : 'Submit'}</button>
        </>
      )}
    </>
  );
}

function AnonymousView({ party, players, playerId, canStartGuessing, onSubmit, onStartGuessing, onSubmitGuesses }) {
  const [draft, setDraft] = useState('');
  const [guesses, setGuesses] = useState({});
  const mine = party.submissions?.[playerId]?.[0];
  const submissions = Object.values(party.submissions || {}).flat();
  const allSubmitted = players.length > 0 && players.every(player => party.submissions?.[player.id]?.length);
  if (party.state === 'collect_anonymous') {
    return (
      <>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 mb-4"><p className="font-medium">{party.prompt}</p></div>
        <input value={draft} disabled={!!mine} onChange={event => setDraft(event.target.value)} className="overshare-input" placeholder="Your anonymous answer…" />
        <button type="button" disabled={!!mine || !draft.trim()} onClick={() => { onSubmit(draft); setDraft(''); }} className="w-full mt-3 overshare-button-primary disabled:opacity-50">{mine ? 'Answer submitted ✓' : 'Submit anonymously'}</button>
        {allSubmitted && canStartGuessing ? <button type="button" onClick={onStartGuessing} className="w-full mt-3 overshare-button-secondary">Reveal answers and guess</button> : <p className="text-center text-sm mt-3 text-gray-500">{submissions.length} of {players.length} answers submitted</p>}
      </>
    );
  }
  const otherSubmissions = submissions.filter(item => item.by !== playerId);
  const submitted = party.anonymousGuesses?.[playerId] !== undefined;
  return (
    <>
      <div className="space-y-4">
        {otherSubmissions.map(item => (
          <div key={item.id} className="p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600">
            <p className="mb-2">“{item.text}”</p>
            <select disabled={submitted} value={guesses[item.id] || ''} onChange={event => setGuesses(current => ({ ...current, [item.id]: event.target.value }))} className="overshare-input">
              <option value="">Who wrote it?</option>
              {players.filter(player => player.id !== playerId).map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </div>
        ))}
      </div>
      <button type="button" disabled={submitted || otherSubmissions.some(item => !guesses[item.id])} onClick={() => onSubmitGuesses(guesses)} className="w-full mt-3 overshare-button-primary disabled:opacity-50">{submitted ? 'Guesses submitted ✓' : 'Submit guesses'}</button>
    </>
  );
}

/* =========================================================
   Main Component
========================================================= */
export default function MultiplayerApp({ onExit }) {
  /* High-level state */
  const [gameState, setGameState] = useState('playerSetup');
  const [playerName, setPlayerName] = useState(() => readStoredProfile()?.name || '');
  const [sessionCode, setSessionCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [preferences, setPreferences] = useState(() => normalizePreferences(readStoredProfile()?.preferences || DEFAULT_PREFERENCES));
  const [relationships, setRelationships] = useState({});
  const [relationshipsReady, setRelationshipsReady] = useState({});
  const [preferencesReady, setPreferencesReady] = useState({});
  const [experience, setExperience] = useState(null); // general | family | date | party
  const [groupProfile, setGroupProfile] = useState({});

  const [appMode, setAppMode] = useState('multi'); // 'quickplay' | 'multi'
  const [mpMode, setMpMode] = useState(null);   // 'classic' | 'party'

  // Classic
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentQuestionId, setCurrentQuestionId] = useState('');
  const [currentCategory, setCurrentCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]); // session-chosen set
  const [mySelectedCategories, setMySelectedCategories] = useState([]); // local voting picks
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [usedCategories, setUsedCategories] = useState([]);
  const [turnHistory, setTurnHistory] = useState([]);
  const [currentQuestionAsker, setCurrentQuestionAsker] = useState('');
  const [categoryVotes, setCategoryVotes] = useState({});
  const [hasVotedCategories, setHasVotedCategories] = useState(false);

  // Party
  const [party, setParty] = useState(null);
  const [showPartyExplainer, setShowPartyExplainer] = useState(false);

  // Quickplay
  const [soloCategories, setSoloCategories] = useState([]);
  const [quickplayConfig, setQuickplayConfig] = useState(null);
  const [soloAsked, setSoloAsked] = useState([]); // question ids
  const [soloSkipsUsed, setSoloSkipsUsed] = useState(0);
  const soloMaxSkips = 3;

  // UX
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [skipsUsedThisTurn, setSkipsUsedThisTurn] = useState(0);
  const [maxSkipsPerTurn] = useState(1);
  const [notification, setNotification] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [showReturnConfirmation, setShowReturnConfirmation] = useState(false);

  // Background themes
  const BG_THEMES = {
    sunset: 'bg-gradient-to-br from-[#302044] via-[#70408b] to-[#c75278]',
    ocean:  'bg-gradient-to-br from-[#12364a] via-[#176b77] to-[#39a58a]',
    dusk:   'bg-gradient-to-br from-[#171b3d] via-[#41316f] to-[#8a3c77]',
    vapor:  'bg-gradient-to-br from-[#733f67] via-[#a8567b] to-[#e48273]',
    slate:  'bg-gradient-to-br from-[#111827] via-[#25283a] to-[#3d354c]',
    plain:  'bg-[#eee8df] dark:bg-[#17121c]',
  };
  const [bgTheme, setBgTheme] = useState(readStoredTheme);
  const bgClass = BG_THEMES[bgTheme] || BG_THEMES.sunset;
  useEffect(() => { try { localStorage.setItem('bgTheme', bgTheme); } catch {} }, [bgTheme]);

  const persistProfile = useCallback((nextPreferences = preferences) => {
    try { localStorage.setItem('overshare-profile', JSON.stringify({ name: playerName.trim(), preferences: nextPreferences })); } catch {}
  }, [playerName, preferences]);

  // Refs
  const unsubscribeRef = useRef(null);
  const prevTurnIndexRef = useRef(0);
  const audioCtxRef = useRef(null);
  const audioEnabledRef = useRef(audioEnabled);
  const gameStateRef = useRef(gameState);
  const playerIdRef = useRef(playerId);
  const superResolutionRef = useRef('');
  const notificationTimerRef = useRef(null);
  useEffect(() => {
    gameStateRef.current = gameState;
    playerIdRef.current = playerId;
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled, gameState, playerId]);

  /* Category library + fallbacks */
  const iconMap = useMemo(
    () => ({ Sparkles, Heart, Lightbulb, Target, Flame, MessageCircle }),
    []
  );

  const FALLBACK_CATEGORIES = useMemo(
    () => ({
      icebreakers: {
        name: 'Icebreakers',
        description: 'Warm up with easy, fun prompts.',
        icon: 'Sparkles',
        color: 'from-purple-500 to-pink-500',
        questions: [
          'What was a small win you had this week?',
          'What’s your go-to fun fact about yourself?',
        ],
      },
      creative: {
        name: 'Creative',
        description: 'Imagine, riff, and get playful.',
        icon: 'Lightbulb',
        color: 'from-indigo-500 to-purple-500',
        questions: [
          'Invent a wild holiday and describe how we celebrate it.',
          'Merge two movies into one plot — what happens?',
        ],
      },
      deep_dive: {
        name: 'Deep Dive',
        description: 'Thoughtful questions with heart.',
        icon: 'MessageCircle',
        color: 'from-blue-500 to-cyan-500',
        questions: [
          'What belief of yours has changed in the last few years?',
          'What’s a memory that shaped who you are?',
        ],
      },
      growth: {
        name: 'Growth',
        description: 'Reflect, learn, and level up.',
        icon: 'Target',
        color: 'from-emerald-500 to-teal-500',
        questions: [
          'What habit are you trying to build?',
          'What’s a risk you’re glad you took?',
        ],
      },
      spicy: {
        name: 'Spicy',
        description: 'Bold prompts for brave groups.',
        icon: 'Flame',
        color: 'from-orange-500 to-red-500',
        questions: [
          'What’s a “hot take” you stand by?',
          'What’s a topic you wish people were more honest about?',
        ],
      },
    }),
    []
  );

  const CATEGORIES = useMemo(() => {
    const raw =
      qcImport && typeof qcImport === 'object'
        ? (qcImport.default && typeof qcImport.default === 'object'
            ? qcImport.default
            : qcImport)
        : {};
    const keys = Object.keys(raw || {});
    if (keys.length > 0) return raw;
    return FALLBACK_CATEGORIES;
  }, [FALLBACK_CATEGORIES]);

  const TOPICS = useMemo(() => {
    const topics = getTopicsForExperience(experience || 'general');
    return Object.fromEntries(Object.entries(topics).map(([key, topic]) => [key, {
      ...topic,
      name: topic.label,
      icon: topic.icon || 'MessageCircle',
      color: topic.color || 'from-purple-500 to-pink-500',
    }]));
  }, [experience]);

  const libraryOK = useMemo(() => {
    const usingFallback = CATEGORIES === FALLBACK_CATEGORIES;
    return typeof getRandomQImport === 'function' && !usingFallback;
  }, [CATEGORIES, FALLBACK_CATEGORIES]);

  /* Audio + toasts */
  const getAudio = useCallback(() => {
    if (!audioEnabledRef.current) return null;
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioCtxRef.current = new Ctx();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playSound = useCallback((type) => {
    try {
      const audio = getAudio();
      if (!audio) return;

      const tone = (seq) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(audio.destination);
        const t0 = audio.currentTime + 0.001;
        gain.gain.setValueAtTime(0.1, t0);
        osc.start(t0);
        try { seq(osc, gain, t0); } catch { try { osc.stop(t0 + 0.15); } catch {} }
      };

      const sounds = {
        click: () => tone((osc, gain, t0) => {
          osc.frequency.setValueAtTime(800, t0);
          osc.frequency.exponentialRampToValueAtTime(600, t0 + 0.10);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.10);
          osc.stop(t0 + 0.11);
        }),
        success: () => tone((osc, gain, t0) => {
          osc.frequency.setValueAtTime(523.25, t0);
          osc.frequency.setValueAtTime(659.25, t0 + 0.10);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
          osc.stop(t0 + 0.24);
        }),
        turn: () => tone((osc, gain, t0) => {
          osc.frequency.setValueAtTime(440, t0);
          osc.frequency.setValueAtTime(554.37, t0 + 0.15);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.30);
          osc.stop(t0 + 0.32);
        }),
      };

      if (sounds[type]) sounds[type]();
    } catch {}
  }, [getAudio]);

  const showNotification = useCallback((message, emoji = '🎉') => {
    setNotification({ message, emoji });
    window.clearTimeout(notificationTimerRef.current || 0);
    notificationTimerRef.current = window.setTimeout(() => setNotification(null), 3000);
  }, []);

  // Alerts listener (per-player toasts)
  useEffect(() => {
    if (!sessionCode || !playerId || typeof listenToAlerts !== 'function') return;
    const unsub = listenToAlerts(sessionCode, playerId, ({ type, message }) => {
      showNotification(message, type === 'success' ? '✅' : '🔔');
      try { playSound('success'); } catch {}
    });
    return () => unsub && unsub();
  }, [playSound, playerId, sessionCode, showNotification]);

  // Each player records only their own vote. The host advances the shared room
  // after every ballot arrives, which avoids one client's stale map overwriting another's.
  useEffect(() => {
    if (!isHost || gameState !== 'categoryVoting' || !sessionCode || players.length === 0) return;
    if (!players.every(player => (categoryVotes[player.id] || []).length > 0)) return;
    updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'waitingForHost' }).catch(() => {});
  }, [categoryVotes, gameState, isHost, players, sessionCode]);

  /* Questions & prompts (external-first, remote-safe) */
  const SUPERLATIVES = useMemo(() => {
    const fallback = [
      'Most likely to survive a zombie apocalypse',
      'Most likely to forget why they walked into a room',
      'Most likely to go viral accidentally',
      'Best unintentional comedian',
      'Most likely to befriend their barista',
      'Best chaotic good energy',
      'Most likely to bring snacks to everything',
      'Most likely to start a group chat argument',
      'Most likely to wear sunglasses indoors',
      'Most likely to have a secret second life',
    ];
    return (EXT_SUPER.length ? EXT_SUPER : fallback).filter(remoteSafe);
  }, []);

  const FILL_PROMPTS = useMemo(() => {
    const fallback = [
      'Write the worst possible movie tagline for a rom-com.',
      'Give a fake but convincing “fun fact” about a common object.',
      'Invent a new holiday and one cursed tradition.',
      'Name a brand-new dating app and its unhinged slogan.',
      'Give a brutal but fair nickname for a friend.',
      'Write a two-word horror story.',
    ];
    return (EXT_FILL.length ? EXT_FILL : fallback).filter(remoteSafe);
  }, []);

  const NHI_PROMPTS = useMemo(() => {
    const fallback = [
      'Never have I ever eaten an entire pizza alone.',
      'Never have I ever lied to get out of plans.',
      'Never have I ever stalked an ex on social media.',
      'Never have I ever laughed at the wrong moment.',
      'Never have I ever sent a text to the wrong person.',
      'Never have I ever fallen asleep on a video call.',
    ];
    return (EXT_NHI.length ? EXT_NHI : fallback).filter(remoteSafe);
  }, []);

  const getLegacyQuestion = useCallback((categoryKey, exclude = []) => {
    if (typeof getRandomQImport === 'function') {
      try {
        let tries = 8;
        while (tries-- > 0) {
          const q = getRandomQImport(categoryKey, exclude);
          if (q && !exclude.includes(q)) return q;
        }
      } catch {}
    }
    const pool = (CATEGORIES[categoryKey]?.questions || []);
    if (pool.length === 0) return 'Question unavailable — pick a different category.';
    let q = pool[Math.floor(Math.random() * pool.length)];
    let tries = 10;
    while (exclude.includes(q) && tries-- > 0) {
      q = pool[Math.floor(Math.random() * pool.length)];
    }
    return q;
  }, [CATEGORIES]);

  const getQuestionRecord = useCallback((topic, usedIds = [], overrides = {}) => {
    const activeExperience = overrides.experience || experience || 'general';
    const activeProfile = overrides.profile || groupProfile || {};
    const question = selectQuestion({
      experience: activeExperience,
      topics: topic ? [topic] : (activeProfile.topics || []),
      depth: overrides.depth || activeProfile.depth || preferences.depth,
      spice: overrides.spice || activeProfile.spice || preferences.spice,
      excludedTopics: overrides.excludedTopics || activeProfile.excludedTopics || preferences.excludedTopics,
      relationshipContext: overrides.relationshipContext || relationshipContextFrom(relationships),
      usedQuestionIds: usedIds,
    });
    if (question) return question;
    const text = getLegacyQuestion(topic, []);
    return { id: `legacy-${topic}-${text}`, text, topic, depth: 'thoughtful', spice: 'none' };
  }, [experience, getLegacyQuestion, groupProfile, preferences, relationships]);

  /* Firestore: session helpers */
  const createFirebaseSession = async (code, hostPlayer) => {
    try {
      await setDoc(doc(db, 'sessions', code), {
        schemaVersion: 2,
        hostId: hostPlayer.id,
        participantUids: [hostPlayer.id],
        players: [hostPlayer],
        mode: null,
        gameState: 'waitingRoom',
        selectedCategories: [],
        currentTurnIndex: 0,
        currentQuestion: '',
        currentCategory: '',
        currentQuestionAsker: '',
        availableCategories: [],
        usedCategories: [],
        turnHistory: [],
        categoryVotes: {},
        experience: null,
        groupProfile: {},
        preferencesReady: { [hostPlayer.id]: false },
        relationshipsReady: {},
        party: null,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      return true;
    } catch (err) {
      console.error('Error creating session:', err);
      return false;
    }
  };

  const listenToSession = useCallback((code) => {
    if (!code) return () => {};
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    const sessionRef = doc(db, 'sessions', code);
    let prevCount = 0;

    const unsubscribe = onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};

        // join notifications
        const newCount = (data.players || []).length;
        if (prevCount > 0 && newCount > prevCount) {
          const newPlayer = (data.players || [])[newCount - 1];
          if (newPlayer && newPlayer.name !== playerName) {
            showNotification(`${newPlayer.name} joined the game!`, '👋');
            try { playSound('success'); } catch {}
          }
        }
        prevCount = newCount;

        // session state
        setPlayers([...(data.players || [])]);
        setCurrentTurnIndex(typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0);
        setCurrentQuestion(data.currentQuestion || '');
        setCurrentQuestionId(data.currentQuestionId || '');
        setCurrentCategory(data.currentCategory || '');
        setCurrentQuestionAsker(data.currentQuestionAsker || '');
        setAvailableCategories([...(data.availableCategories || [])]);
        setUsedCategories([...(data.usedCategories || [])]);
        setTurnHistory([...(data.turnHistory || [])]);
        setCategoryVotes(data.categoryVotes || {});
        setRelationshipsReady(data.relationshipsReady || {});
        setPreferencesReady(data.preferencesReady || {});
        setExperience(data.experience || null);
        setGroupProfile(data.groupProfile || {});
        setMpMode(data.mode || null);
        setParty(data.party || null);

        // only update selectedCategories from server (not my local voting picks)
        if (Array.isArray(data.selectedCategories)) {
          setSelectedCategories([...(data.selectedCategories || [])]);
        }

        // reset per-turn skip counter
        const incomingTurn = typeof data.currentTurnIndex === 'number' ? data.currentTurnIndex : 0;
        if (incomingTurn !== prevTurnIndexRef.current) {
          setSkipsUsedThisTurn(0);
          prevTurnIndexRef.current = incomingTurn;
        }

        // state transitions
        let incomingRaw = data.gameState || 'waitingRoom';
        if (incomingRaw === 'relationshipSurvey' && data.relationshipsReady?.[playerIdRef.current]) {
          incomingRaw = data.preferencesReady?.[playerIdRef.current] ? 'conversationWaiting' : 'preferenceSurvey';
        }
        const incoming = incomingRaw === 'waiting' ? 'waitingRoom' : incomingRaw;
        if (incoming !== gameStateRef.current) {
          gameStateRef.current = incoming;
          setGameState(incoming);
          if (incoming === 'playing') { try { playSound('success'); } catch {} }
          else if (incoming === 'categoryPicking' || incoming === 'party_setup' || incoming === 'party_active') {
            try { playSound('turn'); } catch {}
          }
        }

        // show explainer when we enter party_setup round 1
        if (incoming === 'party_setup' && (data?.party?.round || 1) === 1) {
          setShowPartyExplainer(true);
        }
      },
      (error) => console.error('Firebase listener error:', error)
    );

    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, [playSound, playerName, showNotification]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
      window.clearTimeout(notificationTimerRef.current || 0);
      try { if (audioCtxRef.current?.close) audioCtxRef.current.close(); } catch {}
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const reconnect = async () => {
      let saved;
      try { saved = JSON.parse(localStorage.getItem('overshare-session') || 'null'); } catch { return; }
      if (!saved?.code) return;
      const user = await ensureSignedIn();
      if (!user || cancelled) return;
      const snapshot = await getDoc(doc(db, 'sessions', saved.code));
      const data = snapshot.exists() ? snapshot.data() : null;
      const player = data?.players?.find(candidate => candidate.id === user.uid);
      if (!player || cancelled) return;
      playerIdRef.current = user.uid;
      setPlayerId(user.uid);
      setPlayerName(player.name);
      setSessionCode(saved.code);
      setIsHost(data.hostId === user.uid);
      setExperience(data.experience || null);
      setGameState(data.gameState || 'waitingRoom');
      listenToSession(saved.code);
    };
    reconnect().catch(() => {});
    return () => { cancelled = true; };
  }, [listenToSession]);

  /* Create / Join / Return */
  const handleCreateSession = async () => {
    const code = Array.from(
      crypto.getRandomValues(new Uint8Array(6)),
      byte => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]
    ).join('');
    const user = await ensureSignedIn();
    if (!user) { showNotification('Could not establish a secure session.', '⚠️'); return; }
    const hostPlayer = {
      id: user.uid,
      name: playerName,
      isHost: true,
      joinedAt: new Date().toISOString(),
    };
    const ok = await createFirebaseSession(code, hostPlayer);
    if (!ok) { showNotification('Failed to create the room. Please try again.', '⚠️'); return; }
    setSessionCode(code);
    try { localStorage.setItem('overshare-session', JSON.stringify({ code })); } catch {}
    playerIdRef.current = user.uid;
    setPlayerId(user.uid);
    setIsHost(true);
    setPlayers([hostPlayer]);
    listenToSession(code);
    setGameState('waitingRoom');
    try { playSound('success'); } catch {}
    showNotification(`Lobby created: ${code}`, '🧩');
  };

  const handleJoinSession = async () => {
    const code = (sessionCode || '').trim().toUpperCase();
    if (!code) return;
    const user = await ensureSignedIn();
    if (!user) { showNotification('Could not establish a secure session.', '⚠️'); return; }
    const sessionRef = doc(db, 'sessions', code);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) { showNotification('Room not found. Check the code and try again.', '⚠️'); return; }
    const data = snap.data() || {};
    const alreadyIn = (data.players || []).some((p) => p?.id === user.uid);
    if (!alreadyIn) {
      const newPlayer = {
        id: user.uid,
        name: playerName,
        isHost: false,
        joinedAt: new Date().toISOString(),
      };
      await updateDoc(sessionRef, {
        players: arrayUnion(newPlayer),
        participantUids: arrayUnion(user.uid),
        [`preferencesReady.${user.uid}`]: false,
        [`relationshipsReady.${user.uid}`]: false,
      });
    }
    playerIdRef.current = user.uid;
    setPlayerId(user.uid);
    try { localStorage.setItem('overshare-session', JSON.stringify({ code })); } catch {}
    setIsHost(false);
    listenToSession(code);
    setGameState('waitingRoom');
    try { playSound('success'); } catch {}
  };

  const returnToLobby = async () => {
    setShowReturnConfirmation(true);
  };

  const confirmReturnToLobby = async () => {
    if (!sessionCode) return;
    await updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'waitingRoom' });
    setShowReturnConfirmation(false);
    setGameState('waitingRoom');
  };

  const saveRelationships = async (nextRelationships) => {
    if (!sessionCode || !playerId) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    await setDoc(doc(db, 'sessions', sessionCode, 'privateProfiles', playerId), {
      relationships: nextRelationships,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await updateDoc(sessionRef, { [`relationshipsReady.${playerId}`]: true });
    setRelationships(nextRelationships);
    setGameState('preferenceSurvey');
  };

  const saveMultiplayerPreferences = async (nextPreferences) => {
    if (!sessionCode || !playerId) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const normalized = normalizePreferences(nextPreferences);
    await setDoc(doc(db, 'sessions', sessionCode, 'privateProfiles', playerId), {
      preferences: normalized,
      relationships,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(sessionRef);
      if (!snapshot.exists()) throw new Error('Session no longer exists.');
      const data = snapshot.data();
      if (data.preferencesReady?.[playerId]) return;
      transaction.update(sessionRef, {
        groupProfile: mergeGroupProfile(data.groupProfile || {}, normalized),
        [`preferencesReady.${playerId}`]: true,
      });
    });
    setPreferences(normalized);
    persistProfile(normalized);
    setGameState('conversationWaiting');
  };

  const startConversationVoting = async () => {
    if (!sessionCode || !isHost) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(sessionRef);
      if (!snapshot.exists()) throw new Error('Session no longer exists.');
      const data = snapshot.data();
      const everyoneReady = (data.players || []).every(player => data.preferencesReady?.[player.id]);
      if (!everyoneReady) throw new Error('Waiting for every player.');
      transaction.update(sessionRef, { mode: 'classic', gameState: 'categoryVoting', categoryVotes: {} });
    });
    setMySelectedCategories([]);
    setHasVotedCategories(false);
  };

  /* Classic helpers */
  const calculateTopCategories = (votes) => {
    const counts = {};
    Object.values(votes || {}).forEach(arr => (arr || []).forEach(cat => {
      counts[cat] = (counts[cat] || 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 4);
  };

  const handleCategoryPicked = async (category) => {
    if (!sessionCode) return;
    const currentPlayer = players[currentTurnIndex] || players[0];
    if (!currentPlayer) return;
    const question = getQuestionRecord(category, turnHistory.map(item => item.questionId).filter(Boolean));
    const newUsed = [...usedCategories, category];
    const newAvail = (availableCategories || []).filter((c) => c !== category);
    const newHistory = [...turnHistory, { player: currentPlayer.name, category, question: question.text, questionId: question.id }];
    await updateDoc(doc(db, 'sessions', sessionCode), {
      currentQuestion: question.text,
      currentQuestionId: question.id,
      currentCategory: category,
      gameState: 'playing',
      usedCategories: newUsed,
      availableCategories: newAvail,
      turnHistory: newHistory,
      currentQuestionAsker: currentPlayer.name,
    });
    try { playSound('success'); } catch {}
  };

  const handleSkipQuestion = async () => {
    if (skipsUsedThisTurn >= maxSkipsPerTurn) {
      showNotification("You've used your skip for this turn!", '⏭️');
      return;
    }
    if (!sessionCode) return;
    const forcedCategory =
      currentCategory ||
      (turnHistory[turnHistory.length - 1]?.category) ||
      (selectedCategories[0]) ||
      'icebreakers';
    const newQuestion = getQuestionRecord(forcedCategory, [currentQuestionId, ...turnHistory.map(item => item.questionId)].filter(Boolean));
    await updateDoc(doc(db, 'sessions', sessionCode), {
      currentQuestion: newQuestion.text,
      currentQuestionId: newQuestion.id,
      currentCategory: forcedCategory,
    });
    setSkipsUsedThisTurn((n) => n + 1);
    try { playSound('click'); } catch {}
  };

  const handleNextQuestion = async () => {
    if (!sessionCode) return;
    const count = players.length || 0; if (!count) return;
    const nextTurn = (currentTurnIndex + 1) % count;
    let newAvailable = availableCategories;
    let newUsed = usedCategories;
    if ((availableCategories || []).length === 0) {
      newAvailable = [...(selectedCategories || [])];
      newUsed = [];
    }
    await updateDoc(doc(db, 'sessions', sessionCode), {
      gameState: 'categoryPicking',
      currentTurnIndex: nextTurn,
      availableCategories: newAvailable,
      usedCategories: newUsed,
      currentQuestion: '',
      currentQuestionId: '',
      currentCategory: '',
      currentQuestionAsker: '',
    });
    try { playSound('turn'); } catch {}
  };

  /* Party helpers */
  // Rotate across the enabled party games while avoiding repeated prompt ids.
  const partyChooseTypeAndPrompt = (roundNum, partyState) => {
    const selected = choosePartyPrompt({
      round: roundNum,
      enabledTypes: partyState?.enabledTypes || DEFAULT_PARTY_ROTATION,
      usedPromptIds: partyState?.usedPromptIds || [],
    });
    return {
      type: selected.type,
      prompt: selected.prompt,
      options: selected.options || [],
      promptId: selected.id,
      nextUsed: [...(partyState?.usedPromptIds || []), selected.id].slice(-500),
    };
  };

  const partyStateForType = type => {
    if (['fill', 'hot_seat'].includes(type)) return 'collect_fill';
    if (type === 'most_likely') return 'vote_super';
    if (type === 'never_have_i_ever') return 'collect_nhi';
    if (['majority', 'would_rather'].includes(type)) return 'vote_choice';
    if (['know_me', 'family_trivia'].includes(type)) return 'owner_answer';
    if (type === 'anonymous') return 'collect_anonymous';
    return 'collect_fill';
  };

  const uidForName = (name) => players.find(player => player.name === name)?.id || '';

  const startPartyMode = async () => {
    if (!sessionCode) return;
    await updateDoc(doc(db, 'sessions', sessionCode), {
      mode: 'party',
      gameState: 'party_setup',
      currentTurnIndex: 0,
      party: {
        state: 'setup', // setup → collect_fill | vote_super | collect_nhi | guessing_nhi → reveal → wait_next
        type: null,
        prompt: '',
        round: 1,
        turnIndex: 0,
        submissions: {},
        done: {},
        votes: {},
        nhiAnswers: {},
        guesses: {},
        scores: {},
        roundScores: {},
        winner: null,
        tiebreak: 0,
        nextTurnIndex: 0,
        enabledTypes: DEFAULT_PARTY_ROTATION,
        usedPromptIds: [],
        promptId: '',
        options: [],
        choiceVotes: {},
        ownerAnswer: '',
        ownerGuesses: {},
        anonymousGuesses: {},
      },
    });
    setMpMode('party');
    setShowPartyExplainer(true);
  };

  const hostStartPartyRound = async () => {
    if (!sessionCode || !party) return;
    const round = party.round || 1;
    const { type, prompt, options, promptId, nextUsed } = partyChooseTypeAndPrompt(round, party);
    const next = {
      ...party,
      state: partyStateForType(type),
      type,
      prompt,
      promptId,
      options,
      submissions: {},
      done: {},
      votes: {},
      nhiAnswers: {},
      guesses: {},
      choiceVotes: {},
      ownerAnswer: '',
      ownerGuesses: {},
      anonymousGuesses: {},
      roundScores: {},
      winner: null,
      tiebreak: type === 'most_likely' ? (party.tiebreak || 0) : 0,
      usedPromptIds: nextUsed,
    };
    await updateDoc(doc(db, 'sessions', sessionCode), { party: next, gameState: 'party_active' });
    setShowPartyExplainer(false);
  };

  // Next-turn-only starter
  const nextOwnerStartNextRound = async () => {
    if (!sessionCode || !party) return;
    const iAmNext = players[party.nextTurnIndex]?.name === playerName;
    if (!iAmNext) return;
    const round = party.round || 2; // already incremented in reveal
    const { type, prompt, options, promptId, nextUsed } = partyChooseTypeAndPrompt(round, party);
    const next = {
      ...party,
      state: partyStateForType(type),
      type,
      prompt,
      promptId,
      options,
      submissions: {},
      done: {},
      votes: {},
      nhiAnswers: {},
      guesses: {},
      choiceVotes: {},
      ownerAnswer: '',
      ownerGuesses: {},
      anonymousGuesses: {},
      roundScores: {},
      winner: null,
      tiebreak: type === 'most_likely' ? (party.tiebreak || 0) : 0,
      turnIndex: party.nextTurnIndex,
      usedPromptIds: nextUsed,
    };
    await updateDoc(doc(db, 'sessions', sessionCode), {
      party: next,
      gameState: 'party_active',
      currentTurnIndex: party.nextTurnIndex,
    });
  };

  // Fill: submit / done / pick favorite (+alert to winner)
  const submitFillAnswer = async (text) => {
    if (!sessionCode || !party) return;
    const me = playerId;
    const turnPlayer = players[party.turnIndex]?.id;
    if (me === turnPlayer) return;
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const mine = [...(party.submissions?.[me] || [])];
    if (mine.length >= 2) return;
    mine.push({ id: crypto.randomUUID(), by: me, text: trimmed });
    await updateDoc(doc(db, 'sessions', sessionCode), { [`party.submissions.${me}`]: mine });
    showNotification('Answer submitted', '✍️');
  };

  const markFillDone = async () => {
    if (!sessionCode || !party) return;
    const me = playerId;
    await updateDoc(doc(db, 'sessions', sessionCode), { [`party.done.${me}`]: true });
  };

  const hostPickFavorite = async (answerId) => {
    if (!sessionCode || !party) return;
    const all = Object.values(party.submissions || {}).flat();
    const picked = all.find(a => a.id === answerId);
    if (!picked) return;

    const winnerPlayer = players.find(player => player.id === picked.by);
    if (!winnerPlayer) return;
    const roundScores = { [winnerPlayer.name]: 1 };
    const scores = addRoundScores(party.scores || {}, roundScores);
    const winnerIndex = Math.max(0, players.findIndex(p => p.id === picked.by));

    // per-player alert (“your answer was picked”)
    if (typeof pushAlert === 'function') {
      try {
        await pushAlert(sessionCode, picked.by, `🎉 ${players[party.turnIndex]?.name} picked your answer! +1`, 'success');
      } catch {}
    }

    const next = {
      ...party,
      state: 'reveal',
      winner: winnerPlayer.name,
      scores,
      roundScores,
      nextTurnIndex: winnerIndex,
      round: (party.round || 1) + 1,
    };
    await updateDoc(doc(db, 'sessions', sessionCode), { party: next });
  };

  // Superlatives: each client writes only its own ballot. The turn owner tallies.
  const submitSuperVote = async (voteForName) => {
    if (!sessionCode || !party) return;
    await updateDoc(doc(db, 'sessions', sessionCode), { [`party.votes.${playerId}`]: voteForName });
  };

  useEffect(() => {
    const votes = party?.votes || {};
    const isTurnOwner = players[party?.turnIndex]?.id === playerId;
    const everyoneVoted = players.length > 0 && players.every(player => votes[player.id]);
    if (!sessionCode || party?.state !== 'vote_super' || !isTurnOwner || !everyoneVoted) return;

    const resolutionKey = `${party.round}:${party.prompt}:${Object.keys(votes).sort().join(',')}`;
    if (superResolutionRef.current === resolutionKey) return;
    superResolutionRef.current = resolutionKey;

    const resolveVotes = async () => {
      const tally = {};
      Object.values(votes).forEach(name => { tally[name] = (tally[name] || 0) + 1; });
      const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
      if (!sorted.length) return;

      const topCount = sorted[0][1];
      const tied = sorted.filter(([_, c]) => c === topCount).map(([n]) => n);

      if (tied.length > 1) {
        // new superlative prompt; keep tiebreak rolling count
        const next = {
          ...party,
          prompt: randomOf(SUPERLATIVES),
          votes: {},
          tiebreak: (party.tiebreak || 0) + 1,
          state: 'vote_super',
        };
        await updateDoc(doc(db, 'sessions', sessionCode), { party: next });
      } else {
        const winner = sorted[0][0];
        const roundScores = { [winner]: 1 };
        const scores = addRoundScores(party.scores || {}, roundScores);
        const winnerIndex = Math.max(0, players.findIndex(p => p.name === winner));

        // alert winner, and optionally voters who picked winner
        if (typeof pushAlert === 'function') {
          try {
            const winnerUid = players.find(player => player.name === winner)?.id || '';
            if (winnerUid) await pushAlert(sessionCode, winnerUid, `🏆 You won “${party.prompt}” +1`, 'success');
            for (const [voterUid, target] of Object.entries(votes)) {
              if (target === winner && voterUid !== winnerUid) {
                await pushAlert(sessionCode, voterUid, `👍 Nice pick — ${winner} won that round.`, 'info');
              }
            }
          } catch {}
        }

        const next = {
          ...party,
          state: 'reveal',
          winner,
          scores,
          roundScores,
          nextTurnIndex: winnerIndex,
          round: (party.round || 1) + 1,
        };
        await updateDoc(doc(db, 'sessions', sessionCode), { party: next });
      }
    };

    resolveVotes().catch(() => { superResolutionRef.current = ''; });
  }, [party, playerId, players, sessionCode, SUPERLATIVES]);

  // NHI: player submit
  const submitNhiAnswer = async (hasDone) => {
    if (!sessionCode || !party) return;
    const me = playerId;
    const turnPlayer = players[party.turnIndex]?.id;
    if (me === turnPlayer) return;
    await updateDoc(doc(db, 'sessions', sessionCode), { [`party.nhiAnswers.${me}`]: !!hasDone });
  };

  const startNhiGuessing = async () => {
    if (!sessionCode || !party) return;
    const next = { ...party, state: 'guessing_nhi' };
    await updateDoc(doc(db, 'sessions', sessionCode), { party: next });
  };

 // NHI: scoring (+alerts)
const hostSubmitNhiGuesses = async (guessesMap) => {
  if (!sessionCode || !party) return;
  const actual = party.nhiAnswers || {};
  const roundScores = {};
  let hostPoints = 0;

  // Use for...of so we can use await safely inside the loop
  for (const [uid, has] of Object.entries(actual)) {
    const guess = guessesMap[uid];
    if (guess === undefined) continue;

    const correct = (guess && has) || (!guess && !has);
    if (correct) {
      hostPoints += 1;
      const participant = players.find(player => player.id === uid);
      if (participant) roundScores[participant.name] = (roundScores[participant.name] || 0) + 1;

      if (typeof pushAlert === 'function') {
        try {
          const owner = players[party.turnIndex]?.name;
          await pushAlert(
            sessionCode,
            uid,
            `✨ ${owner} guessed you ${has ? 'have' : "haven't"} — +1`,
            'success'
          );
        } catch {}
      }
    }
  }

  const owner = players[party.turnIndex]?.name;
  if (owner) {
    roundScores[owner] = (roundScores[owner] || 0) + hostPoints;
    if (typeof pushAlert === 'function') {
      try {
        const ownerUid = uidForName(owner);
        if (ownerUid) await pushAlert(
          sessionCode,
          ownerUid,
          `🧠 You guessed ${hostPoints} correctly (+${hostPoints})`,
          'success'
        );
      } catch {}
    }
  }

  const nextTurn = (party.turnIndex + 1) % (players.length || 1);
  const scores = addRoundScores(party.scores || {}, roundScores);
  const next = {
    ...party,
    state: 'reveal',
    winner: null,
    guesses: guessesMap,
    scores,
    roundScores,
    nextTurnIndex: nextTurn,
    round: (party.round || 1) + 1,
  };
  await updateDoc(doc(db, 'sessions', sessionCode), { party: next });
};

  const submitChoiceVote = async choice => {
    if (!sessionCode || !party || !playerId) return;
    await updateDoc(doc(db, 'sessions', sessionCode), { [`party.choiceVotes.${playerId}`]: choice });
  };

  useEffect(() => {
    if (!isHost || !sessionCode || party?.state !== 'vote_choice') return;
    const votes = party.choiceVotes || {};
    if (!players.length || !players.every(player => votes[player.id] !== undefined)) return;
    const namedVotes = Object.fromEntries(players.map(player => [player.name, votes[player.id]]));
    const roundScores = scoreMajorityVotes(namedVotes);
    const next = {
      ...party,
      state: 'reveal',
      winner: null,
      roundScores,
      scores: addRoundScores(party.scores || {}, roundScores),
      nextTurnIndex: (party.turnIndex + 1) % players.length,
      round: (party.round || 1) + 1,
    };
    updateDoc(doc(db, 'sessions', sessionCode), { party: next }).catch(() => {});
  }, [isHost, party, players, sessionCode]);

  const submitOwnerAnswer = async choice => {
    if (!sessionCode || !party || players[party.turnIndex]?.id !== playerId) return;
    await updateDoc(doc(db, 'sessions', sessionCode), {
      'party.ownerAnswer': choice,
      'party.state': 'guess_owner',
    });
  };

  const submitOwnerGuess = async choice => {
    if (!sessionCode || !party || players[party.turnIndex]?.id === playerId) return;
    await updateDoc(doc(db, 'sessions', sessionCode), { [`party.ownerGuesses.${playerId}`]: choice });
  };

  useEffect(() => {
    if (!isHost || !sessionCode || party?.state !== 'guess_owner' || !party.ownerAnswer) return;
    const guessers = players.filter(player => player.id !== players[party.turnIndex]?.id);
    if (!guessers.length || !guessers.every(player => party.ownerGuesses?.[player.id] !== undefined)) return;
    const namedGuesses = Object.fromEntries(guessers.map(player => [player.name, party.ownerGuesses[player.id]]));
    const roundScores = scoreCorrectGuesses(namedGuesses, party.ownerAnswer);
    const next = {
      ...party,
      state: 'reveal',
      roundScores,
      scores: addRoundScores(party.scores || {}, roundScores),
      nextTurnIndex: (party.turnIndex + 1) % players.length,
      round: (party.round || 1) + 1,
    };
    updateDoc(doc(db, 'sessions', sessionCode), { party: next }).catch(() => {});
  }, [isHost, party, players, sessionCode]);

  const submitAnonymousAnswer = async answer => {
    if (!sessionCode || !party || party.submissions?.[playerId]?.length) return;
    const item = { id: crypto.randomUUID(), by: playerId, text: answer.trim() };
    await updateDoc(doc(db, 'sessions', sessionCode), { [`party.submissions.${playerId}`]: [item] });
  };

  const startAnonymousGuessing = async () => {
    if (!sessionCode || !party || (!isHost && players[party.turnIndex]?.id !== playerId)) return;
    await updateDoc(doc(db, 'sessions', sessionCode), { 'party.state': 'guess_anonymous' });
  };

  const submitAnonymousGuesses = async guesses => {
    if (!sessionCode || !party) return;
    await updateDoc(doc(db, 'sessions', sessionCode), { [`party.anonymousGuesses.${playerId}`]: guesses });
  };

  useEffect(() => {
    if (!isHost || !sessionCode || party?.state !== 'guess_anonymous') return;
    if (!players.length || !players.every(player => party.anonymousGuesses?.[player.id] !== undefined)) return;
    const submissions = Object.values(party.submissions || {}).flat();
    const namedGuesses = Object.fromEntries(players.map(player => [player.name, party.anonymousGuesses[player.id]]));
    const roundScores = scoreAnonymousGuesses(namedGuesses, submissions);
    const next = {
      ...party,
      state: 'reveal',
      roundScores,
      scores: addRoundScores(party.scores || {}, roundScores),
      nextTurnIndex: (party.turnIndex + 1) % players.length,
      round: (party.round || 1) + 1,
    };
    updateDoc(doc(db, 'sessions', sessionCode), { party: next }).catch(() => {});
  }, [isHost, party, players, sessionCode]);

  const topBar = (
    <TopBar
      libraryOK={libraryOK}
      audioEnabled={audioEnabled}
      onToggleAudio={() => { setAudioEnabled(current => !current); try { playSound('click'); } catch {} }}
      onShowHelp={() => setShowHelp(true)}
      bgTheme={bgTheme}
      onThemeChange={setBgTheme}
      showReturnConfirmation={showReturnConfirmation}
      onCancelReturn={() => setShowReturnConfirmation(false)}
      onConfirmReturn={confirmReturnToLobby}
    />
  );
  const helpModal = <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />;
  const notificationToast = <NotificationToast notification={notification} />;

  /* =========================
     Screens
  ========================= */

  // Welcome
  if (gameState === 'welcome') {
    return (
      <div className={`min-h-screen ${bgClass} overshare-app-shell flex items-center justify-center p-4`}>
        {topBar}
        {helpModal}
        {notificationToast}
        <main className="overshare-panel p-7 sm:p-9 max-w-md w-full text-center">
          <div className="mb-8">
            <div className="overshare-brand-mark mb-6">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <span className="overshare-kicker block mb-3">Conversation, remixed</span>
            <h1 className="overshare-display mb-4">Overshare</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">The right question for the people actually in the room.</p>
          </div>

          <button
            onClick={() => { setGameState('modeSelect'); try { playSound('click'); } catch {} }}
            className="overshare-button-primary w-full text-lg"
          >
            Choose how to play
          </button>
        </main>
      </div>
    );
  }

  // Mode select
  if (gameState === 'modeSelect') {
    return (
      <div className={`min-h-screen ${bgClass} overshare-app-shell flex items-center justify-center p-4`}>
        {topBar}
        {helpModal}
        {notificationToast}
        <main className="overshare-panel p-7 sm:p-8 max-w-md w-full text-center">
          <span className="overshare-kicker block mb-3">Choose your format</span>
          <h2 className="text-3xl font-black tracking-tight mb-2">How is everyone playing?</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-7">Quickplay stays on this device. Rooms keep everyone in sync.</p>

          <div className="space-y-4">
            <button
              onClick={() => { setAppMode('quickplay'); setGameState('quickExperienceSelect'); try { playSound('click'); } catch {} }}
              className="overshare-mode-card w-full bg-white/80 dark:bg-white/5 text-purple-700 dark:text-purple-200 font-extrabold text-lg"
            >
              Quickplay · One device
            </button>

            <button
              onClick={() => { setAppMode('multi'); setGameState('playerSetup'); try { playSound('click'); } catch {} }}
              className="overshare-button-primary w-full text-lg flex items-center justify-center"
            >
              <Users className="w-5 h-5 mr-2" />
              Everyone uses a device
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (gameState === 'playerSetup') {
    return (
      <div className={`min-h-screen ${bgClass} overshare-app-shell flex items-center justify-center p-4`}>
        {topBar}
        <main className="overshare-panel p-7 sm:p-8 max-w-md w-full text-center">
          <span className="overshare-kicker">Your player card</span>
          <h2 className="text-3xl font-black tracking-tight mt-2 mb-2">What should we call you?</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Your name is only used inside the room.</p>
          <input type="text" placeholder="Enter your name" value={playerName} onChange={event => setPlayerName(event.target.value)} className="overshare-input text-center text-lg mb-4" />
          <button type="button" disabled={!playerName.trim()} onClick={() => { persistProfile(); setGameState('createOrJoin'); }} className="overshare-button-primary w-full disabled:opacity-40">Continue</button>
          <button type="button" onClick={() => onExit?.()} className="overshare-button-secondary w-full mt-3">Back</button>
        </main>
      </div>
    );
  }

  if (gameState === 'quickExperienceSelect') {
    return (
      <ExperiencePicker
        experienceIds={QUICKPLAY_EXPERIENCES}
        playerCount={2}
        playFormat="quickplay"
        onBack={() => setGameState('modeSelect')}
        onSelect={selectedExperience => { setExperience(selectedExperience); setGameState('quickplaySetup'); }}
        title="What kind of conversation?"
      />
    );
  }

  if (gameState === 'quickplaySetup' && experience) {
    return (
      <QuickplaySetup
        experience={experience}
        onBack={() => setGameState('quickExperienceSelect')}
        onStart={config => {
          const topics = config.topics;
          const question = getQuestionRecord(topics[0], [], { experience, ...config, profile: config });
          setQuickplayConfig(config);
          setSoloCategories(topics);
          setCurrentCategory(topics[0]);
          setCurrentQuestion(question.text);
          setCurrentQuestionId(question.id);
          setSoloAsked([question.id]);
          setSoloSkipsUsed(0);
          setGameState('soloPlay');
          try { playSound('success'); } catch {}
        }}
      />
    );
  }

  // Solo play (skip limited)
  if (gameState === 'soloPlay') {
    const changeCategory = (key) => {
      const q = getQuestionRecord(key, soloAsked, { experience, ...quickplayConfig, profile: quickplayConfig });
      setCurrentCategory(key);
      setCurrentQuestion(q.text);
      setCurrentQuestionId(q.id);
      setSoloAsked((prev) => [...prev, q.id]);
      setSoloSkipsUsed(0); // reset skips per category switch
    };
    const skipSolo = () => {
      if (soloSkipsUsed >= soloMaxSkips) {
        showNotification(`Skip limit reached (${soloMaxSkips}).`, '⏭️');
        return;
      }
      const q = getQuestionRecord(currentCategory, soloAsked, { experience, ...quickplayConfig, profile: quickplayConfig });
      setCurrentQuestion(q.text);
      setCurrentQuestionId(q.id);
      setSoloAsked((prev) => [...prev, q.id]);
      setSoloSkipsUsed(n => n + 1);
      try { playSound('click'); } catch {}
    };

    return (
      <div className={`min-h-screen ${bgClass} overshare-app-shell flex items-center justify-center p-4`}>
        {topBar}
        {notificationToast}
        <main className="overshare-panel p-7 sm:p-8 max-w-md w-full">
          <div className="mb-4">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Topic</div>
            <div className="flex flex-wrap gap-2">
              {soloCategories.map((key) => (
                <button
                  key={key}
                  onClick={() => changeCategory(key)}
                  className={`px-3 py-1 rounded-lg border text-sm ${key === currentCategory ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 text-purple-700 dark:text-purple-200' : 'border-gray-300 dark:border-gray-600'}`}
                >
                  {TOPICS[key]?.name || key}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400 mb-3">
            <p className="text-lg leading-relaxed">{currentQuestion}</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Skips: {soloSkipsUsed}/{soloMaxSkips}</p>

          <div className="flex gap-3">
            <button
              onClick={skipSolo}
              className="flex-1 bg-white dark:bg-gray-900 border-2 border-orange-400 text-orange-600 dark:text-orange-300 py-3 px-6 rounded-xl font-semibold hover:bg-orange-50 dark:hover:bg-orange-900/10"
            >
              Skip
            </button>
            <button
              onClick={() => { const q = getQuestionRecord(currentCategory, soloAsked, { experience, ...quickplayConfig, profile: quickplayConfig }); setSoloAsked(p => [...p, q.id]); setCurrentQuestion(q.text); setCurrentQuestionId(q.id); setSoloSkipsUsed(0); try { playSound('turn'); } catch {} }}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg"
            >
              Next
            </button>
          </div>

          <button
            onClick={() => setGameState('quickplaySetup')}
            className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Back
          </button>
        </main>
      </div>
    );
  }

  // Create / Join (multiplayer)
  if (gameState === 'createOrJoin') {
    return (
      <div className={`min-h-screen ${bgClass} overshare-app-shell flex items-center justify-center p-4`}>
        {topBar}
        {helpModal}
        {notificationToast}
        <main className="overshare-panel p-7 sm:p-8 max-w-md w-full text-center">
          <span className="overshare-kicker block mb-3">Bring your people</span>
          <h2 className="text-3xl font-black tracking-tight mb-7">Start a room or join one.</h2>

          <div className="space-y-4">
            <button
              onClick={() => { try { playSound('click'); } catch {}; handleCreateSession(); }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center"
            >
              <Users className="w-5 h-5 mr-2" />
              Create Multiplayer Lobby
            </button>

            <div className="flex items-center my-4">
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
              <span className="px-4 text-gray-500 dark:text-gray-300 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Enter session code"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="overshare-input text-center text-lg font-mono tracking-[.2em] uppercase"
              />
              <button
                onClick={() => { try { playSound('click'); } catch {}; handleJoinSession(); }}
                disabled={!sessionCode.trim()}
                className="w-full bg-white dark:bg-gray-900 border-2 border-purple-500 text-purple-600 dark:text-purple-300 py-3 px-6 rounded-xl font-semibold text-lg hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join by Code
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Waiting room
  if (gameState === 'waitingRoom') {
    const isNewPlayer = !players.find((p) => p?.id === playerId);
    return (
      <div className={`min-h-screen ${bgClass} overshare-app-shell flex items-center justify-center p-4`}>
        {topBar}
        {notificationToast}
        <main className="overshare-panel p-7 sm:p-8 max-w-md w-full text-center">
          <div className="mb-2">
            <span className="overshare-kicker block mb-2">Your room is ready</span>
            <h2 className="text-4xl font-black tracking-[.12em] mb-2">{sessionCode}</h2>
            <p className="text-gray-600 dark:text-gray-300">Share this code to join</p>
          </div>
          <div className="mb-3">
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(sessionCode); showNotification('Room code copied!', '📋'); }
                catch { showNotification('Could not copy. Select the code manually.', '⚠️'); }
              }}
              className="px-3 py-1 text-sm rounded-lg border bg-white/80 dark:bg-gray-800/80"
            >
              Copy code
            </button>
          </div>

          <PlayerList players={players} title="Players" />

          {isNewPlayer && (
            <button
              onClick={async () => {
                try { playSound('click'); } catch {}
                const user = await ensureSignedIn();
                if (!user) return;
                const newPlayer = {
                  id: user.uid,
                  name: playerName,
                  isHost: false,
                  joinedAt: new Date().toISOString(),
                };
                const sessionRef = doc(db, 'sessions', sessionCode);
                const snap = await getDoc(sessionRef);
                if (snap.exists()) {
                  await updateDoc(sessionRef, {
                    players: arrayUnion(newPlayer),
                    participantUids: arrayUnion(user.uid),
                    [`preferencesReady.${user.uid}`]: false,
                    [`relationshipsReady.${user.uid}`]: false,
                  });
                  playerIdRef.current = user.uid;
                  setPlayerId(user.uid);
                  try { playSound('success'); } catch {}
                }
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all mb-4"
            >
              Join Lobby
            </button>
          )}

          {isHost && !isNewPlayer && (
            <button
              onClick={async () => {
                if (!sessionCode) return;
                try { playSound('click'); } catch {}
                await updateDoc(doc(db, 'sessions', sessionCode), { gameState: 'mpExperienceSelect' });
                setGameState('mpExperienceSelect');
              }}
              disabled={players.length < 2}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Game
            </button>
          )}

          {!isHost && !isNewPlayer && (
            <p className="text-gray-500 dark:text-gray-300">Waiting for host to continue…</p>
          )}
        </main>
      </div>
    );
  }

  if (gameState === 'mpExperienceSelect') {
    if (!isHost) {
      return (
        <div className="min-h-screen overshare-backdrop flex items-center justify-center p-4">
          <main className="overshare-panel w-full max-w-md p-8 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">The host is choosing</h1>
            <p className="text-gray-600 dark:text-gray-300">Your next setup screen will only ask what this experience needs.</p>
          </main>
        </div>
      );
    }
    return (
      <ExperiencePicker
        experienceIds={MULTIPLAYER_EXPERIENCES}
        playerCount={players.length}
        playFormat="multi"
        onBack={() => setGameState('waitingRoom')}
        onSelect={async selectedExperience => {
          setExperience(selectedExperience);
          if (selectedExperience === 'party') {
            await updateDoc(doc(db, 'sessions', sessionCode), { experience: selectedExperience });
            await startPartyMode();
            return;
          }
          const resetReadiness = Object.fromEntries(players.map(player => [player.id, false]));
          await updateDoc(doc(db, 'sessions', sessionCode), {
            experience: selectedExperience,
            mode: 'classic',
            gameState: 'relationshipSurvey',
            relationshipsReady: resetReadiness,
            preferencesReady: resetReadiness,
            groupProfile: {},
            categoryVotes: {},
          });
          setGameState('relationshipSurvey');
        }}
      />
    );
  }

  if (gameState === 'relationshipSurvey') {
    return (
      <RelationshipQuestionnaire
        players={players}
        currentPlayerId={playerId}
        initialValue={relationships}
        onComplete={saveRelationships}
      />
    );
  }

  if (gameState === 'preferenceSurvey') {
    return (
      <PreferenceQuestionnaire
        experience={experience || 'general'}
        initialValue={preferences}
        onBack={() => setGameState('relationshipSurvey')}
        onComplete={saveMultiplayerPreferences}
      />
    );
  }

  if (gameState === 'conversationWaiting') {
    const readyCount = players.filter(player => preferencesReady[player.id]).length;
    const everyoneReady = players.length > 0 && readyCount === players.length;
    return (
      <div className="min-h-screen overshare-backdrop flex items-center justify-center p-4">
        <main className="overshare-panel w-full max-w-md p-8 text-center">
          <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">Building the group mix</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{readyCount} of {players.length} players are ready. Individual answers stay private; only a cautious group profile is shared.</p>
          {isHost && everyoneReady ? (
            <button type="button" onClick={startConversationVoting} className="overshare-button-primary w-full">Choose topics</button>
          ) : (
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className="h-full overshare-gradient transition-all" style={{ width: `${players.length ? (readyCount / players.length) * 100 : 0}%` }} />
            </div>
          )}
        </main>
      </div>
    );
  }

  // Category voting (classic) — uses mySelectedCategories (local) so others' submits don’t clear your picks
  if (gameState === 'categoryVoting') {
    const recommended = Object.keys(TOPICS).slice(0, 3);
    const allVotes = Object.values(categoryVotes || {});
    const totalVotes = allVotes.length;
    const entries = Object.entries(TOPICS || {});

    const CategoryCard = ({ categoryKey, category, isSelected, isRecommended, onClick, disabled = false }) => {
      const IconComponent = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
      return (
        <button
          onClick={onClick}
          disabled={disabled}
          className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
            isSelected ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
        >
          <div className="flex items-start space-x-3">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category?.color || 'from-gray-400 to-gray-500'}`}>
              <IconComponent className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">{category?.name || 'Category'}</h3>
                {isRecommended && (
                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200 px-2 py-1 rounded-full">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{category?.description || ''}</p>
            </div>
          </div>
        </button>
      );
    };

    const handleCategoryVote = async (selectedCats) => {
      if (!sessionCode || !playerId) return;
      const sessionRef = doc(db, 'sessions', sessionCode);
      await updateDoc(sessionRef, { [`categoryVotes.${playerId}`]: selectedCats });
      setHasVotedCategories(true);
      try { playSound('success'); } catch {}
    };

    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        {topBar}
        {notificationToast}
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {hasVotedCategories ? 'Waiting for Others' : 'Vote for Categories'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {hasVotedCategories
                ? `${totalVotes} of ${players.length} players have voted`
                : "Select 2–3 categories you'd like to play"}
            </p>
            {hasVotedCategories && (
              <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">Session Code: {sessionCode}</p>
            )}
          </div>

          {!hasVotedCategories ? (
            <>
              <div className="space-y-3 mb-6">
                {entries.map(([key, category]) => {
                  const isRecommended = (recommended || []).includes(key);
                  const isSelected = (mySelectedCategories || []).includes(key);
                  const disabled = !isSelected && (mySelectedCategories || []).length >= 3;
                  return (
                    <CategoryCard
                      key={key}
                      categoryKey={key}
                      category={category}
                      isSelected={isSelected}
                      isRecommended={isRecommended}
                      disabled={disabled}
                      onClick={() => {
                        try { playSound('click'); } catch {}
                        setMySelectedCategories((prev) => {
                          const has = prev.includes(key);
                          if (has) return prev.filter((c) => c !== key);
                          if (prev.length >= 3) return prev;
                          return [...prev, key];
                        });
                      }}
                    />
                  );
                })}
              </div>
              <button
                onClick={() => handleCategoryVote(mySelectedCategories)}
                disabled={(mySelectedCategories || []).length === 0}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit My Votes ({(mySelectedCategories || []).length}/3)
              </button>

              {isHost && (
                <button
                  onClick={returnToLobby}
                  className="w-full mt-3 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
                >
                  Return to Lobby
                </button>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="mb-4"><ProgressIndicator current={Object.keys(categoryVotes || {}).length} total={players.length} /></div>
              {isHost ? <p className="text-gray-600 dark:text-gray-300">You can continue once everyone votes.</p> : <p className="text-gray-600 dark:text-gray-300">Waiting for host…</p>}
              {isHost && (
                <button
                  onClick={returnToLobby}
                  className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
                >
                  Return to Lobby
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Waiting for Host (classic)
  if (gameState === 'waitingForHost') {
    const topCategories = calculateTopCategories(categoryVotes || {});
    const safeTop = topCategories.length ? topCategories : Object.keys(TOPICS).slice(0, 4);
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        {topBar}
        {notificationToast}
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Votes are in!</h2>
            <p className="text-gray-600 dark:text-gray-300">Top categories:</p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {safeTop.map((k) => <CategoryChip key={k} categoryKey={k} topics={TOPICS} iconMap={iconMap} />)}
          </div>

          {isHost ? (
            <>
              <button
                onClick={async () => {
                  try { playSound('click'); } catch {}
                  await updateDoc(doc(db, 'sessions', sessionCode), {
                    selectedCategories: safeTop,
                    availableCategories: safeTop,
                    gameState: 'categoryPicking',
                  });
                  setGameState('categoryPicking');
                }}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg"
              >
                Start Round 1
              </button>
              <button
                onClick={returnToLobby}
                className="w-full mt-3 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
              >
                Return to Lobby
              </button>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-300">Waiting for host to start…</p>
          )}
        </div>
      </div>
    );
  }

  // Category picking (classic)
  if (gameState === 'categoryPicking') {
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.name === playerName;

    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        {topBar}
        {notificationToast}
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            {isMyTurn ? (
              <>
                <h2 className="text-2xl font-bold mb-2">Your Turn!</h2>
                <p className="text-gray-600 dark:text-gray-300">Choose a category</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-2">{currentPlayer?.name}&apos;s Turn</h2>
                <p className="text-gray-600 dark:text-gray-300">{currentPlayer?.name} is choosing a category…</p>
              </>
            )}
          </div>

          {isMyTurn ? (
            <div className="space-y-3">
              {(availableCategories || []).map((categoryKey) => {
                const category = TOPICS[categoryKey];
                const IconComponent = category && iconMap[category.icon] ? iconMap[category.icon] : MessageCircle;
                return (
                  <button
                    key={categoryKey}
                    onClick={() => { try { playSound('click'); } catch {}; handleCategoryPicked(categoryKey); }}
                    className="w-full p-4 rounded-xl border-2 text-left transition-all border-gray-200 dark:border-gray-600 hover:border-purple-300"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r ${category?.color || 'from-gray-400 to-gray-500'}`}>
                        <IconComponent className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold">{category?.name || categoryKey}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">{category?.description || ''}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-300">Please wait…</div>
          )}

          {(usedCategories || []).length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Used:</h3>
              <div className="flex flex-wrap gap-2">{usedCategories.map((k) => <span key={k} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">{TOPICS[k]?.name || k}</span>)}</div>
            </div>
          )}

          {isHost && (
            <button
              onClick={returnToLobby}
              className="w-full mt-6 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              Return to Lobby
            </button>
          )}
        </div>
      </div>
    );
  }

  // Playing (classic)
  if (gameState === 'playing') {
    const currentCategoryData = TOPICS[currentCategory] || null;
    const IconComponent =
      currentCategoryData && iconMap[currentCategoryData.icon]
        ? iconMap[currentCategoryData.icon]
        : MessageCircle;
    const currentPlayer = players[currentTurnIndex] || players[0];
    const isMyTurn = currentPlayer?.name === playerName;
    const canSkip = skipsUsedThisTurn < maxSkipsPerTurn;

    const round = players.length ? Math.floor((turnHistory.length || 0) / players.length) + 1 : 1;
    const turn = players.length ? ((turnHistory.length || 0) % players.length) + 1 : 1;

    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        {topBar}
        {notificationToast}
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 mx-auto mb-4">
              <IconComponent className="w-6 h-6 text-white" />
            </div>
            {currentCategoryData && (
              <div className="mb-4">
                <span className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-gradient-to-r ${currentCategoryData.color} text-white text-sm`}>
                  <IconComponent className="w-3 h-3" />
                  <span>{currentCategoryData.name}</span>
                </span>
              </div>
            )}

            <h2 className="text-lg font-semibold mb-2">
              {currentPlayer?.name || 'Player'}&apos;s Question
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">
              Round {round} • Turn {turn} of {players.length || 1}
            </p>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400">
              <p className="text-lg leading-relaxed">{currentQuestion}</p>
            </div>
          </div>

          <div className="space-y-4">
            {isMyTurn ? (
              <>
                <button
                  onClick={handleSkipQuestion}
                  disabled={!canSkip}
                  className={`w-full py-3 px-6 rounded-xl font-semibold text-lg transition-all flex items-center justify-center ${
                    canSkip
                      ? 'bg-white dark:bg-gray-900 border-2 border-orange-400 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/10'
                      : 'bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <SkipForward className="w-5 h-5 mr-2" />
                  {canSkip ? 'Skip This Question' : 'Skip Used'}
                  <span className="ml-2 text-sm">({skipsUsedThisTurn}/{maxSkipsPerTurn})</span>
                </button>

                <button
                  onClick={handleNextQuestion}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
                >
                  Pass to {players.length ? players[(currentTurnIndex + 1) % players.length]?.name : '—'}
                </button>
              </>
            ) : (
              <div className="text-center text-gray-600 dark:text-gray-300">
                Waiting for {currentPlayer?.name || 'player'} to finish their turn…
              </div>
            )}

            {isHost && (
              <button
                onClick={returnToLobby}
                className="w-full bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-3 px-6 rounded-xl font-semibold"
              >
                Return to Lobby
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------
     PARTY MODE SCREENS
  -------------------------- */

  // Party setup (explainer shown on round 1)
  if (gameState === 'party_setup' && party) {
    const turnOwner = players[party.turnIndex]?.name;
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        {topBar}
        {notificationToast}

        {/* Explainer modal */}
        {showPartyExplainer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-2xl p-6 relative">
              <button
                className="absolute top-3 right-3 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100"
                onClick={() => setShowPartyExplainer(false)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <Wand2 className="w-6 h-6 text-purple-500" />
                <h3 className="text-xl font-semibold">Party Mode — How it works</h3>
              </div>
              <ul className="text-sm space-y-2">
                <li>• Rounds rotate through nine games: creative answers, votes, predictions, anonymous reveals, and trivia.</li>
                <li>• The current turn owner reads the prompt; others submit/vote.</li>
                <li>• Every result shows points earned that round and the running leaderboard.</li>
                <li>• After results, only the <b>next owner</b> can start the next round.</li>
              </ul>
              <button
                onClick={() => setShowPartyExplainer(false)}
                className="mt-4 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 rounded-xl font-semibold"
              >
                I get it — let’s go!
              </button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Party Mode</h2>
            <Scoreboard scores={party.scores || {}} inline />
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Round {party.round || 1}</p>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 mb-4">
            <p><span className="font-semibold">Turn:</span> {turnOwner}</p>
          </div>

          {isHost ? (
            <button
              onClick={hostStartPartyRound}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg"
            >
              Start Round
            </button>
          ) : (
            <p className="text-gray-500 dark:text-gray-300 text-center">Waiting for host to start the round…</p>
          )}

          <button
            onClick={() => setShowScores(s => !s)}
            className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
          >
            {showScores ? 'Hide' : 'Show'} Scores
          </button>
          {showScores && <div className="mt-3"><Scoreboard scores={party.scores || {}} /></div>}

          {isHost && (
            <button
              onClick={returnToLobby}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              Return to Lobby
            </button>
          )}
        </div>
      </div>
    );
  }

  // Active party round
  if (gameState === 'party_active' && party) {
    const turnOwner = players[party.turnIndex]?.name;
    const turnOwnerId = players[party.turnIndex]?.id;
    const iAmTurnOwner = playerId === turnOwnerId;

    if (party.state === 'vote_choice') {
      return (
        <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>{topBar}{notificationToast}
          <div className="overshare-panel p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-3"><h2 className="text-2xl font-bold">{PARTY_GAME_DEFINITIONS[party.type]?.name}</h2><Scoreboard scores={party.scores || {}} inline /></div>
            <ChoiceVoteView key={party.promptId} party={party} playerId={playerId} onSubmit={submitChoiceVote} />
            <p className="text-center text-sm text-gray-500 mt-3">Choices: {Object.keys(party.choiceVotes || {}).length} / {players.length}</p>
          </div>
        </div>
      );
    }

    if (party.state === 'owner_answer' || party.state === 'guess_owner') {
      const guessers = players.filter(player => player.id !== turnOwnerId);
      return (
        <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>{topBar}{notificationToast}
          <div className="overshare-panel p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-3"><h2 className="text-2xl font-bold">{PARTY_GAME_DEFINITIONS[party.type]?.name}</h2><Scoreboard scores={party.scores || {}} inline /></div>
            <OwnerChoiceView key={`${party.promptId}-${party.state}`} party={party} players={players} playerId={playerId} isTurnOwner={iAmTurnOwner} onOwnerAnswer={submitOwnerAnswer} onGuess={submitOwnerGuess} />
            {party.state === 'guess_owner' && <p className="text-center text-sm text-gray-500 mt-3">Guesses: {Object.keys(party.ownerGuesses || {}).length} / {guessers.length}</p>}
          </div>
        </div>
      );
    }

    if (party.state === 'collect_anonymous' || party.state === 'guess_anonymous') {
      return (
        <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>{topBar}{notificationToast}
          <div className="overshare-panel p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-3"><h2 className="text-2xl font-bold">Anonymous Answers</h2><Scoreboard scores={party.scores || {}} inline /></div>
            <AnonymousView key={`${party.promptId}-${party.state}`} party={party} players={players} playerId={playerId} canStartGuessing={isHost || iAmTurnOwner} onSubmit={submitAnonymousAnswer} onStartGuessing={startAnonymousGuessing} onSubmitGuesses={submitAnonymousGuesses} />
          </div>
        </div>
      );
    }

    // Fill
    if (party.state === 'collect_fill') {
      return (
        <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
          {topBar}
          {notificationToast}
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold">{PARTY_GAME_DEFINITIONS[party.type]?.name || 'Fill in the Blank'}</h2>
              <Scoreboard scores={party.scores || {}} inline />
            </div>

            <FillCollectView
              key={`${party.prompt}-${party.tiebreak || 0}`}
              party={party}
              players={players}
              playerName={playerName}
              playerId={playerId}
              turnOwner={turnOwner}
              turnOwnerId={turnOwnerId}
              isTurnOwner={iAmTurnOwner}
              onSubmitAnswer={submitFillAnswer}
              onMarkDone={markFillDone}
              onPickFavorite={hostPickFavorite}
            />

            <button
              onClick={() => setShowScores(s => !s)}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              {showScores ? 'Hide' : 'Show'} Scores
            </button>
            {showScores && <div className="mt-3"><Scoreboard scores={party.scores || {}} /></div>}

            {isHost && (
              <button
                onClick={returnToLobby}
                className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
              >
                Return to Lobby
              </button>
            )}
          </div>
        </div>
      );
    }

    // Superlatives
    if (party.state === 'vote_super') {
      return (
        <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
          {topBar}
          {notificationToast}
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold">Most Likely To</h2>
              <Scoreboard scores={party.scores || {}} inline />
            </div>

            <SuperVoteView
              key={`${party.prompt}-${party.tiebreak || 0}`}
              party={party}
              players={players}
              playerId={playerId}
              onSubmitVote={submitSuperVote}
            />

            <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-3">
              Votes: {Object.keys(party.votes || {}).length} / {players.length}
            </p>

            <button
              onClick={() => setShowScores(s => !s)}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              {showScores ? 'Hide' : 'Show'} Scores
            </button>
            {showScores && <div className="mt-3"><Scoreboard scores={party.scores || {}} /></div>}

            {isHost && (
              <button
                onClick={returnToLobby}
                className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
              >
                Return to Lobby
              </button>
            )}
          </div>
        </div>
      );
    }

    // NHI collect
    if (party.state === 'collect_nhi') {
      const others = players.filter(p => p.id !== turnOwnerId);
      const allSubmitted = others.length > 0 && others.every(p => party.nhiAnswers?.[p.id] !== undefined);
      return (
        <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
          {topBar}
          {notificationToast}
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold">Never Have I Ever</h2>
              <Scoreboard scores={party.scores || {}} inline />
            </div>

            <NhiCollectView
              key={`${party.prompt}-${party.tiebreak || 0}`}
              party={party}
              players={players}
              playerId={playerId}
              turnOwnerId={turnOwnerId}
              turnOwner={turnOwner}
              isTurnOwner={iAmTurnOwner}
              onSubmitMyAnswer={submitNhiAnswer}
            />

            {iAmTurnOwner && allSubmitted && (
              <button
                onClick={startNhiGuessing}
                className="w-full mt-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold"
              >
                Start Guessing
              </button>
            )}

            <button
              onClick={() => setShowScores(s => !s)}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              {showScores ? 'Hide' : 'Show'} Scores
            </button>
            {showScores && <div className="mt-3"><Scoreboard scores={party.scores || {}} /></div>}

            {isHost && (
              <button
                onClick={returnToLobby}
                className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
              >
                Return to Lobby
              </button>
            )}
          </div>
        </div>
      );
    }

    // NHI guessing
    if (party.state === 'guessing_nhi') {
      return (
        <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
          {topBar}
          {notificationToast}
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold">Never Have I Ever — Guess</h2>
              <Scoreboard scores={party.scores || {}} inline />
            </div>

            <NhiGuessView
              party={party}
              players={players}
              turnOwner={players[party.turnIndex]?.name}
              isTurnOwner={playerId === players[party.turnIndex]?.id}
              onConfirmGuesses={hostSubmitNhiGuesses}
            />

            <button
              onClick={() => setShowScores(s => !s)}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              {showScores ? 'Hide' : 'Show'} Scores
            </button>
            {showScores && <div className="mt-3"><Scoreboard scores={party.scores || {}} /></div>}

            {isHost && (
              <button
                onClick={returnToLobby}
                className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
              >
                Return to Lobby
              </button>
            )}
          </div>
        </div>
      );
    }
  }

  // Reveal + next owner starts next round
  if (gameState === 'party_active' && party && party.state === 'reveal') {
    const iAmNextOwner = players[party.nextTurnIndex]?.name === playerName;
    const nextOwnerName = players[party.nextTurnIndex]?.name || '—';
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        {topBar}
        {notificationToast}
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Wand2 className="w-6 h-6 text-purple-500" />
            <h2 className="text-2xl font-bold">Round Results</h2>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-l-4 border-purple-500 dark:border-purple-400 mb-4 text-left">
            <div className="text-sm text-gray-500 dark:text-gray-300 mb-1">Prompt</div>
            <p className="font-medium">{party.prompt}</p>
          </div>

          {party.winner ? (
            <p className="text-lg mb-2"><strong>{party.winner}</strong> gets the point!</p>
          ) : (
            <p className="text-lg mb-2">Scores updated.</p>
          )}

          <RoundScoreboard players={players} scores={party.roundScores || {}} />
          <Scoreboard scores={party.scores || {}} />

          <div className="mt-6">
            {iAmNextOwner ? (
              <button
                onClick={nextOwnerStartNextRound}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold"
              >
                Start the next round
              </button>
            ) : (
              <p className="text-gray-600 dark:text-gray-300">It’s {nextOwnerName}’s turn — nothing for you to do yet.</p>
            )}
          </div>

          {isHost && (
            <button
              onClick={returnToLobby}
              className="w-full mt-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-xl font-medium"
            >
              Return to Lobby
            </button>
          )}
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
