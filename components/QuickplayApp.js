'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ExperiencePicker from './ExperiencePicker'
import QuickplaySetup from './QuickplaySetup'
import { QUICKPLAY_EXPERIENCES } from '../lib/experiences'
import { getTopicsForExperience, selectQuestion } from '../lib/questionEngine'

const THEMES = {
  sunset: 'bg-gradient-to-br from-[#302044] via-[#70408b] to-[#c75278]',
  ocean: 'bg-gradient-to-br from-[#12364a] via-[#176b77] to-[#39a58a]',
  dusk: 'bg-gradient-to-br from-[#171b3d] via-[#41316f] to-[#8a3c77]',
  vapor: 'bg-gradient-to-br from-[#733f67] via-[#a8567b] to-[#e48273]',
  slate: 'bg-gradient-to-br from-[#111827] via-[#25283a] to-[#3d354c]',
  plain: 'bg-[#eee8df] dark:bg-[#17121c]',
}

function readStoredTheme() {
  if (typeof window === 'undefined') return 'sunset'
  try {
    const saved = localStorage.getItem('bgTheme')
    return saved && THEMES[saved] ? saved : 'sunset'
  } catch {
    return 'sunset'
  }
}

function QuickplayChrome({ audioEnabled, onToggleAudio, theme, onThemeChange, showHelp, onToggleHelp }) {
  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button type="button" onClick={onToggleAudio} className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full" aria-label={audioEnabled ? 'Disable sound' : 'Enable sound'}>
          {audioEnabled ? '🔊' : '🔇'}
        </button>
        <button type="button" onClick={onToggleHelp} className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full" aria-label="Help">?</button>
      </div>
      <div className="fixed left-3 top-1/2 -translate-y-1/2 z-50">
        <label className="sr-only" htmlFor="quickplay-theme">Background theme</label>
        <select id="quickplay-theme" value={theme} onChange={event => onThemeChange(event.target.value)} className="rounded-full bg-white/85 dark:bg-gray-800/85 border border-white/30 p-2 text-sm shadow">
          {Object.keys(THEMES).map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
        </select>
      </div>
      {showHelp && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4" role="presentation" onClick={event => { if (event.target === event.currentTarget) onToggleHelp() }}>
          <div className="overshare-panel w-full max-w-md p-6" role="dialog" aria-modal="true" aria-labelledby="quickplay-help-title">
            <h2 id="quickplay-help-title" className="text-xl font-extrabold mb-3">Quickplay</h2>
            <p className="text-gray-600 dark:text-gray-300">Choose an experience and topics, then pass this device around. Quickplay never creates an online room.</p>
            <button type="button" onClick={onToggleHelp} className="overshare-button-primary w-full mt-5">Got it</button>
          </div>
        </div>
      )}
    </>
  )
}

export default function QuickplayApp({ onExit }) {
  const [screen, setScreen] = useState('experience')
  const [experience, setExperience] = useState(null)
  const [config, setConfig] = useState(null)
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState('')
  const [question, setQuestion] = useState(null)
  const [asked, setAsked] = useState([])
  const [skips, setSkips] = useState(0)
  const [notification, setNotification] = useState('')
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [theme, setTheme] = useState(readStoredTheme)
  const audioRef = useRef(null)
  const topics = useMemo(() => getTopicsForExperience(experience || 'general'), [experience])

  useEffect(() => {
    try { localStorage.setItem('bgTheme', theme) } catch {}
  }, [theme])

  useEffect(() => () => {
    try { audioRef.current?.close?.() } catch {}
  }, [])

  const playSound = useCallback(type => {
    if (!audioEnabled) return
    try {
      const Context = window.AudioContext || window.webkitAudioContext
      if (!Context) return
      const audio = audioRef.current || new Context()
      audioRef.current = audio
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.connect(gain)
      gain.connect(audio.destination)
      const start = audio.currentTime + 0.001
      oscillator.frequency.setValueAtTime(type === 'success' ? 659 : 523, start)
      gain.gain.setValueAtTime(0.08, start)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14)
      oscillator.start(start)
      oscillator.stop(start + 0.15)
    } catch {}
  }, [audioEnabled])

  const pickQuestion = useCallback((topic, used = asked, nextConfig = config) => selectQuestion({
    experience: experience || 'general',
    topics: topic ? [topic] : (nextConfig?.topics || []),
    depth: nextConfig?.depth || 'thoughtful',
    spice: nextConfig?.spice || 'none',
    excludedTopics: nextConfig?.excludedTopics || [],
    relationshipContext: nextConfig?.relationshipContext || 'friend',
    usedQuestionIds: used,
  }), [asked, config, experience])

  const showMessage = message => {
    setNotification(message)
    window.setTimeout(() => setNotification(''), 2500)
  }

  if (screen === 'experience') {
    return <ExperiencePicker experienceIds={QUICKPLAY_EXPERIENCES} playerCount={2} playFormat="quickplay" onBack={onExit} onSelect={value => { setExperience(value); setScreen('setup') }} title="What kind of conversation?" />
  }

  if (screen === 'setup' && experience) {
    return <QuickplaySetup experience={experience} onBack={() => setScreen('experience')} onStart={nextConfig => {
      const firstCategory = nextConfig.topics[0]
      const firstQuestion = pickQuestion(firstCategory, [], nextConfig)
      setConfig(nextConfig)
      setCategories(nextConfig.topics)
      setCategory(firstCategory)
      setQuestion(firstQuestion)
      setAsked(firstQuestion ? [firstQuestion.id] : [])
      setSkips(0)
      setScreen('play')
      playSound('success')
    }} />
  }

  const nextQuestion = (topic = category, isSkip = false) => {
    if (isSkip && skips >= 3) {
      showMessage('Skip limit reached (3).')
      return
    }
    const next = pickQuestion(topic)
    if (!next) return
    setCategory(topic)
    setQuestion(next)
    setAsked(previous => [...previous, next.id])
    setSkips(isSkip ? value => value + 1 : 0)
    playSound(isSkip ? 'click' : 'success')
  }

  return (
    <div className={`min-h-screen ${THEMES[theme] || THEMES.sunset} overshare-app-shell flex items-center justify-center p-4`}>
      <QuickplayChrome audioEnabled={audioEnabled} onToggleAudio={() => setAudioEnabled(value => !value)} theme={theme} onThemeChange={setTheme} showHelp={showHelp} onToggleHelp={() => setShowHelp(value => !value)} />
      {notification && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-xl" role="status">{notification}</div>}
      <main className="overshare-panel p-7 sm:p-8 max-w-md w-full">
        <div className="mb-4">
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Topic</div>
          <div className="flex flex-wrap gap-2">
            {categories.map(key => (
              <button key={key} type="button" onClick={() => { setSkips(0); nextQuestion(key) }} className={`px-3 py-1 rounded-lg border text-sm ${key === category ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 text-purple-700 dark:text-purple-200' : 'border-gray-300 dark:border-gray-600'}`}>
                {topics[key]?.label || key}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-l-4 border-purple-500 dark:border-purple-400 mb-3">
          <p className="text-lg leading-relaxed">{question?.text || 'Choose another topic to keep talking.'}</p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Skips: {skips}/3</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => nextQuestion(category, true)} className="overshare-button-secondary flex-1">Skip</button>
          <button type="button" onClick={() => nextQuestion()} className="overshare-button-primary flex-1">Next</button>
        </div>
        <button type="button" onClick={() => setScreen('setup')} className="overshare-button-secondary w-full mt-4">Back</button>
      </main>
    </div>
  )
}
