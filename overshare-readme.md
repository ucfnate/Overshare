# Overshare 🎯

**Personalized conversation games that bring people closer together**

Overshare creates AI-powered conversation questions tailored to your group's personalities and relationships. Perfect for date nights, friend gatherings, and getting to know people better.

## Features

- 🎨 **Personalized Questions** - AI generates questions based on your group's survey responses
- 👥 **Real-time Multiplayer** - Share session codes and play together on any device
- 📱 **Mobile-First** - Designed for phones, perfect for restaurants and social settings
- 🔗 **Relationship-Aware** - Questions adapt based on how players know each other
- ⚡ **Instant Setup** - No accounts needed, just names and session codes

## Tech Stack

- **Frontend**: Next.js 14 with React 18
- **Database**: Firebase Firestore (real-time)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Vercel

## Quick Start

### 1. Clone & Install
```bash
git clone <your-repo>
cd overshare
npm install
```

### 2. Firebase Setup
- Go to [Firebase Console](https://console.firebase.google.com/)
- Create new project or use existing `overshare-239ef`
- Enable Firestore Database in test mode
- Your config is already set in `lib/firebase.js`

### 3. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy to Vercel
```bash
npm run build
```
Then deploy via Vercel CLI or connect your GitHub repo to Vercel.

## How It Works

1. **Personal Survey** - Players answer 4 quick questions about personality and interests
2. **Session Creation** - Host creates a room with a shareable code
3. **Relationship Mapping** - New players describe how they know existing players
4. **AI Questions** - Personalized questions generated based on group dynamics
5. **Real-time Sync** - Everyone sees the same questions simultaneously

## Project Structure

```
overshare/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.js           # Root layout
│   └── page.js             # Main app component
├── lib/
│   └── firebase.js         # Firebase configuration
├── package.json            # Dependencies
├── tailwind.config.js      # Tailwind setup
└── next.config.js          # Next.js config
```

## Customization

### Survey Questions
Edit the `initialSurveyQuestions` array in `app/page.js`:
```javascript
const initialSurveyQuestions = [
  {
    id: 'personality',
    question: 'Your custom question?',
    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4']
  },
  // Add more questions...
];
```

### Relationship Types
Modify `relationshipOptions` in `app/page.js`:
```javascript
const relationshipOptions = [
  'Custom relationship type',
  'Another type',
  // Add more options...
];
```

### AI Questions
Replace the `generatePersonalizedQuestion` function with Claude API integration for truly dynamic questions.

## Firebase Security Rules

For production, update Firestore rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{sessionId} {
      allow read, write: if true; // Temporary - implement proper auth
    }
  }
}
```

## Environment Variables

For production, consider adding:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Future Enhancements

- [ ] Claude API integration for dynamic question generation
- [ ] User accounts and game history
- [ ] Custom question packs
- [ ] Group analytics and insights
- [ ] Progressive Web App (PWA) features
- [ ] Voice input for questions
- [ ] Timer-based rounds
- [ ] Question difficulty levels

---

**Built with ❤️ for bringing people closer together**