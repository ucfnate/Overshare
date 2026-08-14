# Overshare

Overshare is a mobile-first conversation game for friends, dates, families, and groups. Players set their preferences, describe how they know one another, and play questions tuned to the group’s shared comfort level.

## Current features

- Solo and real-time multiplayer play
- Short preference questionnaire for depth, energy, styles, exclusions, and duration
- Private-in-interface relationship questionnaire before multiplayer games
- Classic category-based conversation mode
- Party rounds with Fill in the Blank, Superlatives, and Never Have I Ever
- Anonymous Firebase Authentication and Firestore synchronization
- Repetition-aware skips, scoring, sound, themes, and dark mode

## Local development

Requirements: Node.js 22 or newer and a Firebase project with Anonymous Authentication enabled.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

Configure the values in `.env.local` from your Firebase web-app settings. Do not commit `.env.local`.

## Commands

```bash
npm run dev        # local development
npm run lint       # ESLint
npm test           # unit tests
npm run build      # production build
npm run start      # serve the production build
```

## Firebase

The app uses anonymous user IDs as stable participant identifiers. Deploy the included Firestore rules before using a new Firebase project:

```bash
npx firebase-tools deploy --only firestore:rules
```

The current game modes retain some collaborative state in the room document. The rules prevent unauthenticated access and protect host-owned transitions, but sensitive preference storage should move behind trusted server aggregation before an AI-question beta. See [ROADMAP.md](./ROADMAP.md).

## Architecture

- `app/` — Next.js App Router shell and game screens
- `components/` — questionnaire and reusable UI flows
- `lib/firebase.js` — Firebase initialization and authentication
- `lib/preferences.js` — preference schema and group aggregation
- `lib/*Prompts.js` / `lib/questionCategories.js` — curated question libraries
- `firestore.rules` — authenticated room access and host-field protection

## AI question generation

AI-generated questions are intentionally planned as a server-side feature. Raw names, individual preferences, and relationship answers should not be sent to a model. Generation should use an abstract group profile, structured output, validation, moderation, rate limits, caching, and the curated library as a fallback.

## Privacy and safety

- Every question can be skipped without explanation.
- Topic exclusions are treated as hard boundaries when constructing the group profile.
- Questionnaire answers are not shown in the interface to other players.
- Do not collect or retain question answers unless a future feature clearly asks for consent.
- Avoid using real names or sensitive free-form details in future AI prompts.

## Deployment

The repository is ready for Vercel or another Node-compatible host. Add all `NEXT_PUBLIC_FIREBASE_*` values to the deployment environment and keep pull-request CI green before promotion.

## License

MIT — see [LICENSE](./LICENSE).
