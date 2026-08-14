'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const LoadingGame = () => (
  <div className="min-h-screen overshare-backdrop overshare-app-shell grid place-items-center p-4">
    <main className="overshare-panel w-full max-w-md p-8 text-center" aria-live="polite">
      <div className="overshare-brand-mark mb-5" aria-hidden="true">💬</div>
      <h1 className="text-2xl font-black">Getting the room ready…</h1>
    </main>
  </div>
)

const QuickplayApp = dynamic(() => import('./QuickplayApp'), {
  ssr: false,
  loading: LoadingGame,
})

const MultiplayerApp = dynamic(() => import('./MultiplayerApp'), {
  ssr: false,
  loading: LoadingGame,
})

export default function OvershareLauncher() {
  const [screen, setScreen] = useState('welcome')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('overshare-session') || 'null')
        if (saved?.code) setScreen('multiplayer')
      } catch {}
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  if (screen === 'quickplay') return <QuickplayApp onExit={() => setScreen('format')} />
  if (screen === 'multiplayer') return <MultiplayerApp onExit={() => setScreen('format')} />

  if (screen === 'format') {
    return (
      <div className="min-h-screen overshare-backdrop overshare-app-shell flex items-center justify-center p-4">
        <main className="overshare-panel p-7 sm:p-8 max-w-md w-full text-center">
          <span className="overshare-kicker block mb-3">Choose your format</span>
          <h1 className="text-3xl font-black tracking-tight mb-2">How is everyone playing?</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-7">Quickplay stays on this device. Rooms keep everyone in sync.</p>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setScreen('quickplay')}
              className="overshare-mode-card w-full bg-white/80 dark:bg-white/5 text-purple-700 dark:text-purple-200 font-extrabold text-lg"
            >
              Quickplay · One device
            </button>
            <button
              type="button"
              onClick={() => setScreen('multiplayer')}
              className="overshare-button-primary w-full text-lg"
            >
              Everyone uses a device
            </button>
          </div>

          <button type="button" onClick={() => setScreen('welcome')} className="overshare-button-secondary w-full mt-4">Back</button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen overshare-backdrop overshare-app-shell flex items-center justify-center p-4">
      <main className="overshare-panel p-7 sm:p-9 max-w-md w-full text-center">
        <div className="mb-8">
          <div className="overshare-brand-mark mb-6" aria-hidden="true">💬</div>
          <span className="overshare-kicker block mb-3">Conversation, remixed</span>
          <h1 className="overshare-display mb-4">Overshare</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">The right question for the people actually in the room.</p>
        </div>
        <button type="button" onClick={() => setScreen('format')} className="overshare-button-primary w-full text-lg">
          Choose how to play
        </button>
      </main>
    </div>
  )
}
