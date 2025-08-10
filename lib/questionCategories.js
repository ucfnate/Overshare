'use client';

// lib/questionCategories.js
// - Named exports: questionCategories, categories, getRandomQuestion
// - Default export includes the same
// - getRandomQuestion supports `exclude` to help the Skip button avoid repeats

/* ------------------------ Existing (from your file) ----------------------- */
const EXISTING = {
  icebreakers: [
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
    "If you could make one rule that everyone had to follow, what would it be?",
    "What's the most ridiculous thing you've convinced someone was true?",
    "If you could eliminate one minor inconvenience from daily life, what would it be?",
    "What's your most irrational fear that you're secretly embarrassed about?",
    "If you had to wear a warning label, what would it say?",
    "What's the weirdest dream you remember having?",
    "If you could add a 13th month to the year, what would you name it?",
    "What's something you do when you're alone that you'd never do in front of others?",
    "If you could make any activity an Olympic sport, what would you win gold in?",
    "What's the most unusual thing you find attractive?",
    "If you had to live in a world made of one food, what food would you choose?"
  ],
  deep_dive: [
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
    "What's the most valuable piece of advice you've received but initially ignored?",
    "What's a hard truth about yourself that you've recently accepted?",
    "What's the biggest sacrifice you've made that no one knows about?",
    "What childhood wound still affects how you show up in relationships today?",
    "What's something you need to hear but no one has told you?",
    "What part of your personality do you think people misunderstand the most?",
    "What's a dream you've given up on and why?",
    "What would your life look like if you weren't afraid of judgment?",
    "What's the most honest thing you've never said to someone you love?",
    "What do you think you'll regret not doing when you're 80?",
    "What's a pattern in your life that you're finally ready to break?"
  ],
  creative: [
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
    "If you could redesign the concept of money, what would the new system look like?",
    "If you could create a new emotion that doesn't exist, what would it feel like?",
    "You can merge any two companies. Which merger would create the most chaos?",
    "If you had to design hell for someone you dislike, what would their personal hell be?",
    "You can make one conspiracy theory actually true. Which one do you choose?",
    "If you could add a new mandatory subject to all schools, what would teach kids?",
    "You can make one body part detachable. Which would be most convenient?",
    "If you could create a new sport using items from your kitchen, what would it be?",
    "You can make one animal as intelligent as humans. Which causes the most drama?",
    "If you could add a new day between Saturday and Sunday, how would people spend it?",
    "You can make one fictional technology real. What do you choose and why?"
  ],
  spicy: [
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
    "If you could switch lives with someone you know for 24 hours, who would you choose?",
    "What's the most inappropriate thing you've laughed at?",
    "What's your most toxic trait that you're lowkey proud of?",
    "If you could see one statistic about everyone you meet, what would you choose?",
    "What's the pettiest thing you've done that you don't regret?",
    "What's a compliment you've received that felt more like an insult?",
    "If you had to expose one person's search history, whose would be most interesting?",
    "What's something you do that you think everyone does, but you're afraid to ask?",
    "What's the most unhinged intrusive thought you've had this week?",
    "If karma is real, what's coming for you?",
    "What's the worst advice you've ever given that someone actually followed?"
  ],
  growth: [
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
    "If you could design your ideal typical day five years from now, what would it look like?",
    "What's the biggest change you need to make but keep postponing?",
    "What would you do differently if you truly believed you were enough?",
    "What's a boundary you need to set that you've been avoiding?",
    "If you had unlimited resources, what problem would you solve?",
    "What's one thing you could do tomorrow that your future self would thank you for?",
    "What part of your life needs a complete reimagining?",
    "What would you pursue if you knew your family would support you no matter what?",
    "What's the gap between who you are and who you want to be?",
    "What legacy do you want to leave for the next generation?",
    "If you could guarantee one thing for your future, what would it be?"
  ],
  uncomfortable_truths: [
    "What's a harsh reality about yourself that others see but you tend to ignore?",
    "When was the last time you were the villain in someone else's story?",
    "What's something you criticize in others that you're guilty of yourself?",
    "What privilege do you have that you take for granted?",
    "What's a time you were completely wrong but too proud to admit it?",
    "What's the most selfish decision you've made that you still stand by?",
    "What truth about a relationship are you refusing to accept?",
    "What's something you do for others that's actually more about you?",
    "What excuse do you use most often to avoid growth?",
    "What's a way you manipulate situations to get what you want?",
    "What double standard do you hold that benefits you?",
    "What's something you're mediocre at but think you're good at?",
    "What uncomfortable feedback have multiple people given you that's probably true?",
    "What's a time your ego got in the way of doing the right thing?",
    "What pattern do you see in others' lives but are blind to in your own?",
    "What's the gap between how you see yourself and how others see you?",
    "What do you pretend to want but actually fear getting?",
    "What's a truth about your parents that changed how you see yourself?",
    "What part of your identity are you most attached to losing?",
    "What's the story you tell yourself to avoid taking responsibility?",
    "What would change if you stopped needing to be right?",
    "What's something you judge in your past self that you still do?",
    "What uncomfortable truth would set you free if you accepted it?",
    "What do you need to grieve that you've been avoiding?",
    "What's the cost of maintaining the image you project to the world?"
  ]
};

/* --------------------------- 20 new per category -------------------------- */
const NEW = {
  icebreakers: [
    "What’s a simple pleasure you’ll never get tired of?",
    "What food could you eat every day and still be excited about?",
    "What song instantly puts you in a good mood?",
    "What was your favorite toy or game growing up?",
    "If today had a theme, what would it be?",
    "What’s a hobby you admire but haven’t tried yet?",
    "Coffee, tea, or something else—what’s your ritual?",
    "What’s the best thing you watched or read recently?",
    "What’s your current comfort show or movie?",
    "If you had a mascot, what would it be?",
    "What’s an app you use way more than you admit?",
    "What’s your go-to karaoke song (or shower song)?",
    "Which season are you most like, and why?",
    "What’s a tiny habit that makes your day better?",
    "What’s a smell that takes you back?",
    "What’s your most-used emoji and what’s the story?",
    "What’s a micro-adventure you’d do this month?",
    "What’s a food combo you swear by?",
    "What’s the best advice you’ve gotten in one sentence?",
    "What’s something you’re curious about right now?"
  ],
  creative: [
    "You get a 48-hour superpower—what is it and how do you use it?",
    "Design a new emoji that the world desperately needs.",
    "Rewrite a fairy tale ending—how does it actually end?",
    "If your week were a comic strip, what’s the caption for today’s panel?",
    "Give a mundane object a dramatic backstory.",
    "Mash up two cuisines into a signature dish—describe it.",
    "What would a museum exhibit about your life include?",
    "Name and pitch your fictional podcast.",
    "If you could rent a skill for a week, which one and why?",
    "Create a slogan for your current mood.",
    "Invent a game the group could play with items on the table.",
    "What’s a new rule you’d add to the universe?",
    "Turn your last text into a movie title—what’s the plot?",
    "If you could collab with any artist (alive or not), who and on what?",
    "Design a micro-utopia—three rules max—what are they?",
    "Pick a color and describe a world where it’s rare.",
    "Give a pep talk from the perspective of a houseplant.",
    "Swap the endings of two books/movies—what chaos ensues?",
    "Describe tomorrow as a weather report for your vibes.",
    "Give a famous quote a mischievous twist."
  ],
  deep_dive: [
    "What’s a boundary you’ve learned to honor?",
    "When do you feel most like yourself?",
    "What’s a lesson you paid “full price” to learn?",
    "What’s a friendship that changed your trajectory?",
    "What’s something you’re still making peace with?",
    "What’s a risk you didn’t take—how do you feel about it now?",
    "Where does your confidence come from lately?",
    "What did your younger self get right about you?",
    "What are you grateful for that surprised you?",
    "How do you want people to feel after spending time with you?",
    "What’s a value you refuse to compromise?",
    "When was the last time you changed your mind meaningfully?",
    "What does support look like for you, practically?",
    "What story do you tell yourself that you might revise?",
    "What’s something you want to unlearn?",
    "What’s a quiet goal you haven’t said out loud yet?",
    "What does “home” mean to you right now?",
    "What kind of old person do you hope to be?",
    "What helps you reconnect when you feel off?",
    "What’s a belief you’re testing this year?"
  ],
  growth: [
    "What’s one tiny upgrade you’ve made to your routine?",
    "What feedback changed you for the better?",
    "What’s your current “learning edge”?",
    "What would a 1% improvement this week look like?",
    "What do you want to get more consistent about—and why?",
    "What’s a helpful constraint you can add for yourself?",
    "Who’s a model for the kind of person you’re becoming?",
    "What’s a goal you paused—what would it take to resume?",
    "What skill do you want future-you to thank you for?",
    "What helps you follow through when motivation dips?",
    "What’s a recent stumble that taught you something?",
    "How do you measure progress when results lag?",
    "What’s your go-to reset after a derailed day?",
    "What’s one task you could automate or drop entirely?",
    "Where are you over-engineering things?",
    "What’s a motto you’re trying on this month?",
    "What are you optimizing for this season of life?",
    "What’s a commitment you want to renew?",
    "What would “enough” look like for a current goal?",
    "What’s one boundary that protects your energy?"
  ],
  spicy: [
    "What’s a belief you hold that most of your friends don’t?",
    "What’s something people romanticize that you think is overrated?",
    "What’s a “green flag” you think is underrated?",
    "What do you think is wildly underpriced in life?",
    "What’s a boundary you enforce that others find extra?",
    "What’s a compliment you wish people gave more often?",
    "What’s a trend you hope disappears soon?",
    "What’s an unpopular opinion about work or careers you have?",
    "What’s a comfortable lie you’ve stopped telling?",
    "What’s a hill you’re willing to die on (for fun)?",
    "What’s a social norm you’d rewrite tomorrow?",
    "What’s a pet peeve that instantly icks you out?",
    "What’s a “guilty pleasure” you refuse to feel guilty about?",
    "What’s a debate you love stirring up at dinner?",
    "What’s a habit you dropped that people still expect of you?",
    "What’s a truth you learned the hard way in relationships (any kind)?",
    "What do you wish people would be braver about?",
    "What’s a personal rule you break more than you keep?",
    "What’s a conversation topic that always gets you fired up?",
    "What’s a common opinion you think needs more nuance?"
  ],
  uncomfortable_truths: [
    "What apology do you owe someone that you haven’t given?",
    "What part of your identity do you perform for approval?",
    "When do you take more than you give in relationships?",
    "What truth would your closest friend say you avoid?",
    "What flaw do you defend instead of addressing?",
    "What do you use busyness to avoid?",
    "When did you last move the goalposts to feel superior?",
    "Where are you settling because it’s comfortable?",
    "What story do you tell that paints you as the victim—how else might it read?",
    "What do you criticize in public but crave in private?",
    "When do you pretend not to know better?",
    "What boundary do you call a standard that’s really fear?",
    "What does your envy point to that you refuse to pursue?",
    "When were you unkind and called it honesty?",
    "What promise to yourself do you break most?",
    "What are you hiding behind humor?",
    "Where are you waiting to be chosen instead of choosing?",
    "What do you keep “researching” to avoid starting?",
    "What do you expect from others that you don’t give?",
    "If someone watched your week, what would they say you value—not what you claim?"
  ]
};

/* ------------------------------ Merge + util ------------------------------ */
const uniq = (arr = []) => {
  const seen = new Set();
  const out = [];
  for (const q of arr) {
    const s = (q ?? '').toString().trim();
    if (!s) continue;
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
};

const mergedQs = (key) => uniq([ ...(EXISTING[key] || []), ...(NEW[key] || []) ]);

const makePicker = (arr = []) => (exclude = []) => {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  const pool = arr.filter((q) => !exclude.includes(q));
  const pickFrom = pool.length > 0 ? pool : arr;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)];
};

/* ------------------------------ Export shape ------------------------------ */
export const questionCategories = {
  icebreakers: {
    name: 'Icebreakers',
    icon: 'Sparkles',
    description: 'Light, fun questions to get everyone talking',
    color: 'from-blue-400 to-cyan-400',
    questions: mergedQs('icebreakers')
  },
  deep_dive: {
    name: 'Deep Dive',
    icon: 'Heart',
    description: 'Meaningful questions for genuine connection',
    color: 'from-purple-400 to-pink-400',
    questions: mergedQs('deep_dive')
  },
  creative: {
    name: 'Creative & Imaginative',
    icon: 'Lightbulb',
    description: 'Fun hypotheticals and creative scenarios',
    color: 'from-yellow-400 to-orange-400',
    questions: mergedQs('creative')
  },
  spicy: {
    name: 'Spicy',
    icon: 'Flame',
    description: 'Bold questions for adventurous groups',
    color: 'from-red-400 to-pink-400',
    questions: mergedQs('spicy')
  },
  growth: {
    name: 'Goals & Growth',
    icon: 'Target',
    description: 'Future-focused and aspirational questions',
    color: 'from-green-400 to-blue-400',
    questions: mergedQs('growth')
  },
  uncomfortable_truths: {
    name: 'Uncomfortable Truths',
    icon: 'MessageCircle',
    description: 'Questions that challenge your self-perception',
    color: 'from-gray-600 to-purple-600',
    questions: mergedQs('uncomfortable_truths')
  }
};

// alias for compatibility with any code that imports `categories`
export const categories = questionCategories;

/**
 * Return a random question from a category, avoiding `exclude` if possible.
 * @param {string} categoryKey
 * @param {string[]} exclude
 */
export function getRandomQuestion(categoryKey, exclude = []) {
  const cat = questionCategories[categoryKey];
  if (!cat?.questions?.length) {
    const keys = Object.keys(questionCategories).filter(k => questionCategories[k]?.questions?.length);
    const any = keys[Math.floor(Math.random() * keys.length)];
    return makePicker(questionCategories[any]?.questions || [])(exclude);
  }
  return makePicker(cat.questions)(exclude);
}

// default export (so namespace/dynamic imports still work)
export default { questionCategories, categories: questionCategories, getRandomQuestion };
