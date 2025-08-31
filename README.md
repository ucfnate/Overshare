heck yeah—congrats on shipping! here’s a clean, copy-paste **README.md** you can drop into the repo.

---

# Overshare

Personalized, turn-based conversation game for groups. Players vote on categories, answer vibe checks, and take turns asking tailored questions. Built with Next.js + Firebase + Tailwind.

## ✨ Features

* Guided flow: Survey → Lobby → Category Voting → Relationship Survey → Category Picking → Playing
* Smart category recs based on group size/comfort
* Skip (repeat-safe) once per turn
* Real-time sync via Firestore
* Dark mode support (no more white-on-white)
* Tiny status pill shows if the app is using the **Library** or **Fallback** question set

## 🧱 Tech Stack

* **Next.js / React** (client component for the game screen)
* **Firebase Firestore** (sessions + real-time updates)
* **Tailwind CSS**
* **lucide-react** icons

---

## 🚀 Quick Start

```bash
# 1) install deps
npm install
# or: yarn / pnpm

# 2) set environment variables (see .env example below)

# 3) run locally
npm run dev

# 4) build (optional)
npm run build && npm run start
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔑 Environment Variables

Create `.env.local` in the project root:

```env
# Firebase (client-safe, prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=0000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:0000000000:web:abc123
```

### `lib/firebase.(js|ts)` (reference)

```js
// lib/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

---

## 🗄️ Firestore

* Collection: `sessions/{code}` (documents created on host start)
* The game reads/writes fields like:
  `players, gameState, currentQuestion, currentCategory, currentTurnIndex, selectedCategories, availableCategories, usedCategories, turnHistory, categoryVotes, currentQuestionAsker, createdAt`

### ⚠️ Minimal dev rules (relax for local/dev only)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{code} {
      allow read: if true;
      allow write: if true; // DEV ONLY. Lock this down before production.
    }
  }
}
```

> For production, add auth and stricter writes (out of scope here, but don’t ship permissive rules).

---

## 🧩 Question Library

The game uses `lib/questionCategories.js`.
We merged your existing lists + 20 new questions per category and export both:

* `questionCategories` (named export)
* `getRandomQuestion(categoryKey, exclude=[])`
* default export `{ questionCategories, categories: questionCategories, getRandomQuestion }`

**Note:** No `"use client"` in this file (it’s data-only). The page auto-detects the library and shows a **Library** pill in the top bar when loaded correctly.

### Add or edit categories

* Add to `questionCategories` with shape:

```js
my_category_key: {
  name: 'Display Name',
  icon: 'Sparkles' | 'Heart' | 'Lightbulb' | 'Target' | 'Flame' | 'MessageCircle',
  description: 'Short blurb',
  color: 'from-xxx to-yyy', // Tailwind gradient
  questions: [ 'Question 1', 'Question 2', ... ]
}
```

* Icons must match those imported in the page (lucide-react).
* If you add a brand new category key, it will appear in **Category Voting** automatically.

---

## 🕹️ Game Flow (States)

* `welcome` → name entry + intro
* `survey` → quick vibe survey
* `createOrJoin` → host or join with code
* `waitingRoom` → players accumulate; host starts voting
* `categoryVoting` → each player selects up to 3 categories
* `waitingForHost` → results summary; host advances
* `relationshipSurvey` → “how are you connected?” per-other-player
* `waitingForOthers` → waiting screen while others complete
* `categoryPicking` → current player chooses category
* `playing` → current question shown; **Skip** (1/use) or **Pass**

---

## 🎛️ Controls & UX

* **Skip**: Guarantees a different question in the **same** category. One use per turn (UI shows `1/1`).
* **Library/Fallback pill**:

  * **Library** = using your `lib/questionCategories.js`
  * **Fallback** = using internal tiny backup list (fix import path/exports if you see this)
* **Help**: top-right modal
* **Sound**: toggle in top-right menu

---

## 🌙 Dark Mode Notes

We fixed dark mode on:

* Help modal
* Voting results
* All major screens use dark-aware classes

If you add new screens, follow the pattern:

* Surfaces: `bg-white dark:bg-gray-800`
* Text: `text-gray-800 dark:text-gray-100` (or `text-gray-600 dark:text-gray-300` for muted)
* Borders: `border-gray-200 dark:border-gray-600`

---

## 🧪 Troubleshooting

* **“Fallback” pill shows:**
  Wrong import or export shape. Ensure your page imports from `lib/questionCategories.js` and that file exports `questionCategories` + `getRandomQuestion` (named or default).
* **Skip doesn’t change the question:**
  Your library function must accept `exclude` or the page will handle repeat-avoidance; ensure you’re using the provided `getRandomQuestion`.
* **Nothing happens when starting a game:**
  Check Firestore rules, environment variables, and console logs for write errors.
* **Dark text on dark backgrounds:**
  Add `dark:` variants to text/surface/border on the component (see Dark Mode Notes).

---

## 📦 Deploying (Vercel suggested)

1. Push to GitHub
2. Import the repo in Vercel
3. Add the `NEXT_PUBLIC_FIREBASE_*` env vars in Vercel Project Settings
4. Deploy 🎉

---

## 🧭 Roadmap ideas (optional)

* Authenticated sessions (anonymous or magic link)
* Better Firestore rules per-field
* Session persistence / resume
* Timer / round length options
* Export turn history

---

## 📄 License

Add your preferred license (MIT recommended).

---

if you want me to tailor this to your exact repo structure (scripts, directories, screenshots), toss me your package.json and I’ll tune the commands + badges.
