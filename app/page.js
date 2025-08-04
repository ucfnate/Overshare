'use client';

import React, { useState, useEffect } from 'react';
import { Users, MessageCircle, Heart, Sparkles, Lightbulb, Target, Flame } from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';

export default function Overshare() {
  const [gameState, setGameState] = useState('welcome');
  const [playerName, setPlayerName] = useState('');
  const [surveyAnswers, setSurveyAnswers] = useState({});
  const [relationshipAnswers, setRelationshipAnswers] = useState({});
  const [sessionCode, setSessionCode] = useState('');
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentCategory, setCurrentCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [sessionListener, setSessionListener] = useState(null);

  const initialSurveyQuestions = [
    {
      id: 'personality',
      question: 'How would you describe yourself in social settings?',
      options: ['Outgoing & Love being center of attention', 'Friendly but prefer smaller groups', 'Thoughtful listener who observes first', 'Quiet but warm up over time']
    },
    {
      id: 'comfort_level',
      question: 'In conversations, you prefer:',
      options: ['Light, fun topics that make everyone laugh', 'Mix of light and meaningful discussions', 'Deep, personal conversations', 'Thought-provoking questions about life']
    },
    {
      id: 'sharing_style',
      question: 'When sharing personal things, you:',
      options: ['Share openly and easily', 'Share when others share first', 'Prefer to listen more than share', 'Share deeply with close people only']
    },
    {
      id: 'group_energy',
      question: 'You contribute best to group conversations when:',
      options: ['Everyone is laughing and having fun', 'There\'s a good mix of personalities', 'People are being real and authentic', 'The conversation has depth and meaning']
    }
  ];

  const relationshipOptions = [
    'Romantic partner/spouse',
    'Close friend (know each other well)',
    'Friend (hang out regularly)',
    'Family member',
    'Coworker/colleague', 
    'Acquaintance (don\'t know well)',
    'Just met/new friend'
  ];

  const questionCategories = {
    icebreakers: {
      name: 'Icebreakers',
      icon: Sparkles,
      description: 'Light, fun questions to get everyone talking',
      color: 'from-blue-400 to-cyan-400',
      questions: [
        "If you could have any superpower for just one day, what would you do with it?",
        "What's the weirdest food combination you actually enjoy?",
        "If you could instantly become an expert at any skill, what would you choose?",
        "What's something you believed as a kid that makes you laugh now?",
        "If you could have dinner with any fictional character, who would it be?",
        "What's the most useless talent you have?",
        "If you could rename yourself, what name would you choose?",
        "What's the strangest compliment you've ever received?",
        "If you could live in any TV show universe, which would you pick?",
        "What's something everyone seems to love that you just don't get?",
        "If you could ask your pet one question, what would it be?",
        "What's the most embarrassing thing you've googled?",
        "If you could swap lives with anyone for a week, who would it be?",
        "What's a skill you wish was taught in school but wasn't?",
        "If you could make one rule that everyone had to follow, what would it be?"
      ]
    },
    deep_dive: {
      name: 'Deep Dive',
      icon: Heart,
      description: 'Meaningful questions for genuine connection',
      color: 'from-purple-400 to-pink-400',
      questions: [
        "What's a belief you held strongly as a child that you've completely changed your mind about?",
        "What's the most important lesson you've learned about yourself in the past year?",
        "If you could send a message to your past self, what age would you choose and what would you say?",
        "What's something you're secretly proud of but rarely talk about?",
        "What fear have you overcome that you're most grateful for conquering?",
        "What's a conversation you've been avoiding that you know you need to have?",
        "What's something about yourself that you hope never changes?",
        "If you knew you couldn't fail, what would you attempt?",
        "What's the kindest thing someone has ever done for you?",
        "What do you wish people understood about you without you having to explain it?",
        "What's a moment when you felt most proud of who you are?",
        "What's something you've forgiven yourself for that was hard to let go?",
        "What would you want to be remembered for?",
        "What's a risk you took that taught you something important about yourself?",
        "What's the most valuable piece of advice you've received but initially ignored?"
      ]
    },
    creative: {
      name: 'Creative & Imaginative',
      icon: Lightbulb,
      description: 'Fun hypotheticals and creative scenarios',
      color: 'from-yellow-400 to-orange-400',
      questions: [
        "If you could design a new holiday, what would it celebrate and how would people observe it?",
        "You can time travel but only to observe, not change anything. Where/when do you go?",
        "If you could add one feature to the human body, what would make life better?",
        "You're designing a theme park. What's your signature ride or attraction?",
        "If you could make any two animals swap sounds, which would be the funniest combination?",
        "You can give everyone in the world one book to read. Which book changes everything?",
        "If you could redesign how humans sleep, what would you change?",
        "You're creating a new planet. What's one unique feature that makes it special?",
        "If you could make one everyday object sentient, what would be most interesting?",
        "You can add background music to real life. What plays during different activities?",
        "If you could change one law of physics temporarily, what chaos would you create?",
        "You're founding a new country. What's your national motto and why?",
        "If you could give everyone a new sense (beyond the five we have), what would it be?",
        "You can make one extinct animal come back to life. What's your choice and why?",
        "If you could redesign the concept of money, what would the new system look like?"
      ]
    },
    spicy: {
      name: 'Spicy',
      icon: Flame,
      description: 'Bold questions for adventurous groups',
      color: 'from-red-400 to-pink-400',
      questions: [
        "What's something you've never told anyone but would feel relieved to share?",
        "What's the most embarrassing thing you've done when you had a crush on someone?",
        "If you could read minds for one day, whose thoughts would you be most curious about?",
        "What's a secret skill or talent you have that would surprise people?",
        "What's the most rebellious thing you've ever done?",
        "If you could anonymously tell someone exactly what you think of them, who would it be?",
        "What's something you judge people for but probably shouldn't?",
        "What's the biggest lie you've told to avoid hurting someone's feelings?",
        "If you could erase one memory from your life, what would it be?",
        "What's something you pretend to like but actually can't stand?",
        "What's the most awkward misunderstanding you've been part of?",
        "If you could know the honest answer to any question about yourself, what would you ask?",
        "What's something you've done that you'd never want your parents to find out about?",
        "What's your most unpopular opinion that you'd defend?",
        "If you could switch lives with someone you know for 24 hours, who would you choose?"
      ]
    },
    growth: {
      name: 'Goals & Growth',
      icon: Target,
      description: 'Future-focused and aspirational questions',
      color: 'from-green-400 to-blue-400',
      questions: [
        "What's something you want to be brave enough to do in the next year?",
        "If you could master one area of your life completely, which would have the biggest impact?",
        "What's a habit you want to build that would change your daily life for the better?",
        "What's something you used to dream about that you've stopped pursuing? Why?",
        "If you could give your future self one piece of advice, what would it be?",
        "What's a skill you want to develop that would make you feel more confident?",
        "What's something you want to stop caring so much about?",
        "If you could change one thing about how you spend your time, what would it be?",
        "What's a fear you want to face head-on this year?",
        "What's something you want to create or build in your lifetime?",
        "If you could develop one character trait overnight, what would serve you best?",
        "What's a relationship in your life you want to invest more energy in?",
        "What's something you want to experience before you turn [next milestone age]?",
        "What's a way you want to challenge yourself that excites and scares you?",
        "If you could design your ideal typical day five years from now, what would it look like?"
      ]
    }
  };

  // Firebase and game logic functions would go here...
  // (Keeping this shorter for now due to the error)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Overshare</h1>
          <p className="text-gray-600">Personalized conversation games that bring people closer together</p>
        </div>
        
        <div className="mb-6">
          <input
            type="text"
            placeholder="Enter your name"
            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-center text-lg"
          />
        </div>
        
        <button
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg transition-all"
        >
          Coming Soon - Fixing Deployment
        </button>
      </div>
    </div>
  );
}
