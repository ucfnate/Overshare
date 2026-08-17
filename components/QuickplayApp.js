'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ExperiencePicker from './ExperiencePicker'
import QuickplaySetup from './QuickplaySetup'
import { CampfirePalettePicker } from './CampfireAppearance'
import { QUICKPLAY_EXPERIENCES } from '../lib/experiences'
import { getTopicsForExperience, selectQuestion } from '../lib/questionEngine'

function QuickplayChrome({ audioEnabled, onToggleAudio, palette, onPaletteChange, showHelp, onToggleHelp }) {
  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button type="button" onClick={onToggleAudio} className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full" aria-label={audioEnabled ? 'Disable sound' : 'Enable sound'}>
          {audioEnabled ? '🔊' : '🔇'}
        </button>
        <button type="button" onClick={onToggleHelp} className="bg-white/20 dark:bg-white/10 backdrop-blur-sm text-white p-3 rounded-full" aria-label="Help">?</button>
      </div>
      <div className="fixed left-3 top-3 z-50">
        <CampfirePalettePicker compact value={palette} onChange={onPaletteChange} />
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

export default function QuickplayApp({ onExit, palette, onPaletteChange }) {
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
  const audioRef = useRef(null)
  const topics = useMemo(() => getTopicsForExperience(experience || 'general'), [experience])

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
    <div className="min-h-screen overshare-backdrop overshare-app-shell flex items-center justify-center p-4">
      <QuickplayChrome audioEnabled={audioEnabled} onToggleAudio={() => setAudioEnabled(value => !value)} palette={palette} onPaletteChange={onPaletteChange} showHelp={showHelp} onToggleHelp={() => setShowHelp(value => !value)} />
      {notification && <div className="overshare-panel fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl p-4 shadow-xl" role="status">{notification}</div>}
      <main className="overshare-panel p-7 sm:p-8 max-w-md w-full">
        <div className="mb-4">
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">Topic</div>
          <div className="flex flex-wrap gap-2">
            {categories.map(key => (
              <button key={key} type="button" onClick={() => { setSkips(0); nextQuestion(key) }} className={`topic-pill ${key === category ? 'topic-pill-selected' : ''}`}>
                {topics[key]?.label || key}
              </button>
            ))}
          </div>
        </div>
        <div className="campfire-question-card mb-3">
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
