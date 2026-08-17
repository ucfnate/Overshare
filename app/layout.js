import './globals.css'
import { Fraunces, Inter } from 'next/font/google'
import Script from 'next/script'
import { SpeedInsights } from '@vercel/speed-insights/next'

const inter = Inter({ subsets: ['latin'], variable: '--font-overshare-sans' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-campfire-display' })

export const metadata = {
  title: 'Overshare - Personalized Conversation Games',
  description: 'Personalized conversation games that bring people closer together',
}

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#3b2a22' }

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable}`}
      data-overshare-theme="campfire"
      data-overshare-palette="ember"
      suppressHydrationWarning
    >
      <body>
        <Script id="overshare-appearance" strategy="beforeInteractive">
          {`try {
            var palette = localStorage.getItem('overshare-campfire-palette');
            var legacyPalette = {
              sunset: 'ember', vapor: 'ember', ocean: 'grove', plain: 'grove',
              dusk: 'moonlight', slate: 'moonlight'
            }[localStorage.getItem('bgTheme')];
            palette = ['ember', 'grove', 'moonlight'].includes(palette)
              ? palette
              : (legacyPalette || 'ember');
            localStorage.setItem('overshare-campfire-palette', palette);
            if (['ember', 'grove', 'moonlight'].includes(palette)) {
              document.documentElement.dataset.oversharePalette = palette;
            }
          } catch (error) {}`}
        </Script>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
