import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Overshare - Personalized Conversation Games',
  description: 'Personalized conversation games that bring people closer together',
}

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#7542e8' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
