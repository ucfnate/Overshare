import { questionCategories } from './questionCategories';

const makeQuestions = (prefix, experience, topic, depth, prompts, extra = {}) => prompts.map((text, index) => ({
  id: `${prefix}-${String(index + 1).padStart(3, '0')}`,
  text,
  experiences: [experience],
  topic,
  depth,
  spice: 'none',
  tone: extra.tone || 'thoughtful',
  format: extra.format || 'everyone',
  relationshipContexts: extra.relationshipContexts || [],
  ...extra,
}));

const GENERAL_TOPICS = Object.freeze({
  icebreakers: { label: 'Fun & Unexpected', description: 'Easy openings, laughs, and surprising answers.' },
  stories: { label: 'Stories & Memories', description: 'The moments that made you who you are.' },
  opinions: { label: 'Opinions & Hot Takes', description: 'Low-stakes debates and revealing perspectives.' },
  creative: { label: 'What If?', description: 'Imaginative questions and strange scenarios.' },
  appreciation: { label: 'Connection', description: 'Notice and understand the people around you.' },
  growth: { label: 'Growth & Dreams', description: 'Where you are going and what matters next.' },
  deep: { label: 'Deep & Vulnerable', description: 'Honest questions that deserve a real answer.' },
});

const FAMILY_TOPICS = Object.freeze({
  memories: { label: 'Family Stories', description: 'Memories, traditions, and stories worth keeping.' },
  appreciation: { label: 'Appreciation', description: 'What you value and admire in one another.' },
  childhood: { label: 'Growing Up', description: 'Childhood, change, and different generations.' },
  values: { label: 'Values & Lessons', description: 'What your family taught you—and what you chose yourself.' },
  future: { label: 'The Future', description: 'Hopes, support, and what comes next.' },
  playful: { label: 'Family Fun', description: 'Funny memories and affectionate superlatives.' },
});

const DATE_TOPICS = Object.freeze({
  us: { label: 'Us', description: 'How you see your relationship and one another.' },
  communication: { label: 'Communication', description: 'Needs, understanding, and things left unsaid.' },
  memories: { label: 'Our Story', description: 'The moments that brought you together.' },
  appreciation: { label: 'Affection & Appreciation', description: 'What you love, notice, and value.' },
  future: { label: 'Future & Dreams', description: 'The life you are building and imagining.' },
  intimacy: { label: 'Intimacy', description: 'Emotional closeness, desire, and optional genuine spice.' },
  playful: { label: 'Playful', description: 'Flirty, funny, and unexpected questions.' },
});

const LEGACY_TOPIC_MAP = {
  icebreakers: 'icebreakers',
  creative: 'creative',
  spicy: 'opinions',
  growth: 'growth',
  deep_dive: 'deep',
  uncomfortable_truths: 'deep',
};

const LEGACY_DEPTH_MAP = {
  icebreakers: 'light',
  creative: 'light',
  spicy: 'thoughtful',
  growth: 'deep',
  deep_dive: 'deep',
  uncomfortable_truths: 'vulnerable',
};

const legacyGeneralQuestions = Object.entries(questionCategories).flatMap(([category, value]) =>
  (value.questions || []).map((text, index) => ({
    id: `general-${category}-${String(index + 1).padStart(3, '0')}`,
    text,
    experiences: ['general'],
    topic: LEGACY_TOPIC_MAP[category] || 'stories',
    depth: LEGACY_DEPTH_MAP[category] || 'thoughtful',
    spice: 'none',
    tone: category === 'creative' ? 'playful' : 'thoughtful',
    format: 'everyone',
    relationshipContexts: [],
  }))
);

const generalConnection = makeQuestions('general-connection', 'general', 'appreciation', 'thoughtful', [
  'What is something someone in this group does that makes people feel included?',
  'What quality helps you trust someone more quickly?',
  'What kind of friendship has become more important to you as you have gotten older?',
  'What is a small way someone showed up for you that you still remember?',
  'What makes a conversation feel genuinely meaningful to you?',
  'What is something you appreciate about the way this group spends time together?',
  'When do you feel most understood by other people?',
  'What is one thing you wish new people knew about you sooner?',
  'What makes someone easy for you to be yourself around?',
  'What is a compliment you remember because it felt especially true?',
]);

const generalStories = makeQuestions('general-stories', 'general', 'stories', 'thoughtful', [
  'What ordinary day from your life would you happily experience one more time?',
  'What is a story your friends have heard too many times—but you still love telling?',
  'When did a stranger unexpectedly make your day better?',
  'What is a small decision that ended up changing your life?',
  'What is the funniest misunderstanding you have ever been part of?',
  'What phase of your life feels like a completely different version of you?',
  'What is a memory that instantly changes your mood?',
  'What is the most spontaneous thing you are glad you said yes to?',
  'Who taught you something important without realizing it?',
  'What is a place that feels tied to a very specific version of you?',
]);

const generalNewPeople = makeQuestions('general-new-people', 'general', 'icebreakers', 'thoughtful', [
  'What is something you could give a surprisingly good five-minute talk about?',
  'What kind of plan almost always sounds fun to you?',
  'What is a small thing that reliably improves your day?',
  'What is a place you have visited that you would recommend without hesitation?',
  'What is a harmless opinion you hold more strongly than the situation deserves?',
  'What is something you are looking forward to right now?',
  'What is a skill or hobby you would enjoy learning with other people?',
  'What is the best question someone can ask when they are getting to know you?',
], { relationshipContexts: ['just_met', 'acquaintance'], tone: 'welcoming' });

const generalCoworkers = makeQuestions('general-coworkers', 'general', 'growth', 'thoughtful', [
  'What kind of work makes time pass quickly for you?',
  'What is a skill outside your job that influences how you work?',
  'What is the best team you have been part of, and what made it work?',
  'What is something you wish people understood about how you solve problems?',
  'What small workplace ritual makes a bigger difference than people realize?',
  'What is a lesson from an early job that still helps you now?',
  'What kind of recognition feels genuinely meaningful to you?',
  'If this group could solve one everyday frustration together, what should it be?',
], { relationshipContexts: ['coworker'], tone: 'work-safe' });

const generalFriends = makeQuestions('general-friends', 'general', 'appreciation', 'deep', [
  'What is something this friendship gives you that is hard to find elsewhere?',
  'When have you felt especially supported by a friend in this room?',
  'What version of you did these friends know that newer people never met?',
  'What is one thing you hope never changes about this group?',
  'What is something a friend here understands without needing the whole explanation?',
  'When has this group made a difficult season feel lighter?',
  'What do you admire about how someone here has changed?',
  'What kind of memory should this group make more time for?',
], { relationshipContexts: ['friend', 'close_friend'], tone: 'connected' });

const generalCloseFriends = makeQuestions('general-close-friends', 'general', 'deep', 'vulnerable', [
  'What are you carrying right now that you have made look easier than it feels?',
  'What truth about your life would you trust this group to hold carefully?',
  'Where do you need encouragement that is honest rather than automatic?',
  'What part of your life has changed in a way your friends may not fully see yet?',
  'What do you wish the people closest to you checked in about more often?',
  'What fear has been shaping more of your choices than you want it to?',
  'When do you find it hardest to let friends show up for you?',
  'What would feeling less alone look like for you this month?',
], { relationshipContexts: ['close_friend'], tone: 'vulnerable' });

const generalPartners = makeQuestions('general-partners', 'general', 'appreciation', 'deep', [
  'What is one way your partner has helped you become more yourself?',
  'What ordinary moment in your relationship means more than it appears to?',
  'When do you feel most like you and your partner are on the same team?',
  'What have you learned about love from this relationship?',
  'What is something about your partner you appreciate more with time?',
  'What kind of support from a partner is most meaningful to you?',
], { relationshipContexts: ['partner'], tone: 'connected' });

const familyMemories = makeQuestions('family-memories', 'family', 'memories', 'thoughtful', [
  'What family story should never be allowed to disappear?',
  'What smell or food immediately takes you back to a family memory?',
  'What family gathering do you remember most vividly, and why?',
  'What is something an older relative used to say that you understand differently now?',
  'Which family tradition means more to you than people might realize?',
  'What is a moment our family handled better than we give ourselves credit for?',
  'What ordinary family routine do you miss from an earlier time?',
  'Who in the family made childhood feel especially safe or fun?',
  'What family trip or adventure deserves its own movie?',
  'What object in the family carries the best story?',
  'What recipe tastes like a person or a place to you?',
  'What family story changes slightly depending on who tells it?',
]);

const familyChildhood = makeQuestions('family-childhood', 'family', 'childhood', 'thoughtful', [
  'What did adults misunderstand about you when you were young?',
  'What part of your childhood personality is still completely intact?',
  'What rule from your childhood made no sense then but makes sense now?',
  'What did you think being an adult would feel like?',
  'What is something you needed as a child that you learned to give yourself later?',
  'Which childhood interest would you happily pick up again?',
  'What did home mean to you at different ages?',
  'What is one freedom younger generations have that you wish you had?',
  'What is something from your generation you hope never disappears?',
  'When did you first realize your parents or caregivers were figuring life out too?',
]);

const familyValues = makeQuestions('family-values', 'family', 'values', 'deep', [
  'What value did our family give you that you want to carry forward?',
  'What family pattern are you grateful someone chose to change?',
  'What does loyalty mean to you when family relationships are complicated?',
  'What is a lesson you learned from watching someone in this family struggle?',
  'What do you hope younger relatives learn earlier than you did?',
  'What belief from your upbringing have you kept, and which have you reconsidered?',
  'What kind of support is hardest for you to ask family for?',
  'What do you wish our family talked about more honestly?',
  'What responsibility do family members have to one another?',
  'What would healing look like for families in general—not necessarily just ours?',
]);

const familyAppreciation = makeQuestions('family-appreciation', 'family', 'appreciation', 'deep', [
  'What strength do you see in someone here that they may underestimate?',
  'What sacrifice made by a relative do you understand more deeply now?',
  'When has someone in this family made you feel genuinely supported?',
  'What is something you inherited from this family that is not physical?',
  'Who in the family taught you how to love people well?',
  'What do you hope the people here always know about how you feel about them?',
  'What quality in this family becomes most visible during difficult times?',
  'What is something you have wanted to thank a relative for but never put into words?',
  'How has someone in this family helped you become more yourself?',
  'What is one thing you hope our family remembers about this chapter of life?',
]);

const familyPlayful = makeQuestions('family-playful', 'family', 'playful', 'light', [
  'Who in the family would survive longest on a reality show?',
  'What is the most predictable thing about our family gatherings?',
  'Which family member would be the funniest person to switch lives with for a day?',
  'What harmless family argument could probably continue forever?',
  'If our family had a warning label, what would it say?',
  'Which family habit would confuse an outsider the most?',
  'What would the title of our family sitcom be?',
  'Who is most likely to arrive with exactly the thing everyone forgot?',
  'What is the funniest phrase that only our family understands?',
  'Which relative would make the best—or worst—secret agent?',
]);

const dateUs = makeQuestions('date-us', 'date', 'us', 'thoughtful', [
  'When do you feel most like we are truly on the same team?',
  'What is something about us that feels distinctly ours?',
  'When have you felt especially proud to be my partner?',
  'What do you think we bring out in each other?',
  'What part of our relationship has surprised you in the best way?',
  'What does being chosen by someone mean to you?',
  'What is one way our relationship has changed you?',
  'What do you hope never becomes routine between us?',
  'What do you think we understand about each other better than anyone else does?',
  'What is something we have built together without consciously deciding to?',
]);

const dateCommunication = makeQuestions('date-communication', 'date', 'communication', 'deep', [
  'What do you wish I could understand without you having to explain it perfectly?',
  'When you are overwhelmed, what kind of support actually helps—and what does not?',
  'What conversation between us have you been unsure how to begin?',
  'When do you feel most heard by me?',
  'What makes it difficult for you to say what you need?',
  'What is one assumption we sometimes make about each other that deserves revisiting?',
  'How can I tell when you need comfort instead of solutions?',
  'What is something you have become more honest about during our relationship?',
  'When conflict happens, what are you most afraid it might mean?',
  'What would make hard conversations between us feel safer?',
]);

const dateMemories = makeQuestions('date-memories', 'date', 'memories', 'thoughtful', [
  'What early moment made you realize this might become something important?',
  'What memory of us still makes you smile before you even finish telling it?',
  'When did you first feel completely comfortable around me?',
  'What ordinary moment between us felt unexpectedly romantic?',
  'Which version of us would you like to visit for one evening?',
  'What challenge did we handle together that made us stronger?',
  'What detail from our beginning do you hope you never forget?',
  'What moment made you feel especially understood by me?',
  'What trip, date, or quiet night deserves a sequel?',
  'What is something about our story that sounds small but means a lot to you?',
]);

const dateAppreciation = makeQuestions('date-appreciation', 'date', 'appreciation', 'deep', [
  'What is something I do for you that I may not realize matters?',
  'What quality in me has become more attractive as you have known me longer?',
  'When have you felt especially cared for by me?',
  'What part of yourself feels safest with me?',
  'What is something you admire about how I handle life?',
  'What do I help you believe about yourself?',
  'What is a way I have loved you that changed what love means to you?',
  'What is something about me you never want me to become self-conscious about?',
  'When do you feel closest to me without either of us saying much?',
  'What is one thing you want to appreciate about us more intentionally?',
]);

const dateFuture = makeQuestions('date-future', 'date', 'future', 'deep', [
  'What kind of life would feel meaningful even if it looked unimpressive to everyone else?',
  'What do you hope we become better at together over the next few years?',
  'What future version of us are you most excited to meet?',
  'What dream would you like us to take more seriously?',
  'What does growing together mean without expecting each other to stay the same?',
  'What would make our future feel emotionally rich—not just successful?',
  'What do you hope our home feels like to the people who enter it?',
  'What uncertainty about the future feels easier because we are facing it together?',
  'What promise should partners keep renewing instead of making only once?',
  'What do you want us to protect when life gets busier?',
]);

const dateVulnerable = makeQuestions('date-vulnerable', 'date', 'communication', 'vulnerable', [
  'What part of yourself are you still learning how to let me love?',
  'What fear about love is hardest for you to admit out loud?',
  'When have you felt lonely even while we were together?',
  'What need do you sometimes minimize because you worry it is too much?',
  'What truth about yourself are you afraid could change how someone loves you?',
  'What have you forgiven me for that we may not have fully talked through?',
  'Where in our relationship do you want to be braver?',
  'What does emotional safety feel like in your body?',
  'What old wound most often shows up in the way you love?',
  'What honest answer could bring us closer even if it is difficult to hear?',
]);

const datePlayful = makeQuestions('date-playful', 'date', 'playful', 'light', [
  'What harmless thing do I do that you find ridiculously attractive?',
  'If our relationship had a secret handshake, what absolutely has to be in it?',
  'Which one of us would be worse at pretending we had never met?',
  'What date idea sounds terrible on paper but would probably be fun with me?',
  'What fictional couple would be exhausting to double-date with?',
  'What is our most lovable shared bad habit?',
  'If we opened a business together, what would it be—and who would get us sued?',
  'What is something completely ordinary that feels more fun when we do it together?',
  'What nickname would a reality show give our relationship?',
  'Which of our disagreements would make the funniest courtroom drama?',
]);

const dateFlirty = makeQuestions('date-flirty', 'date', 'intimacy', 'thoughtful', [
  'What kind of attention from me makes you feel most desired?',
  'What is a moment between us you still think about because the chemistry was undeniable?',
  'What is something I wear—or do—that instantly changes your mood?',
  'What kind of flirting do you wish we did more often?',
  'What is one nonsexual form of touch that makes you feel especially close?',
  'Where is the most unexpected place you have wanted to kiss me?',
  'What makes anticipation exciting for you?',
  'What compliment from me makes you feel irresistible?',
], { spice: 'flirty', tone: 'flirty', format: 'both' });

const dateSuggestive = makeQuestions('date-suggestive', 'date', 'intimacy', 'deep', [
  'What is something intimate you have wanted to ask for but felt shy saying directly?',
  'What makes you feel safest being sexually honest with me?',
  'What is a fantasy you enjoy thinking about even if it never becomes a plan?',
  'What kind of buildup makes intimacy most exciting for you?',
  'What do you wish I understood better about how desire works for you?',
  'What is a boundary that actually helps you feel more free and adventurous?',
  'What is something we have done together that you would enthusiastically repeat?',
  'What would make our intimate connection feel more intentional?',
], { spice: 'suggestive', tone: 'intimate', format: 'both' });

const dateExplicit = makeQuestions('date-explicit', 'date', 'intimacy', 'vulnerable', [
  'What specific touch or position makes it easiest for you to completely lose yourself?',
  'What is something you want me to do to you that you have not asked for clearly enough?',
  'Describe the hottest version of a night together that starts before we reach the bedroom.',
  'What is a sexual yes you would like us to explore more deliberately?',
  'What words, sounds, or reactions from me turn you on the most?',
  'What is one thing you want more of during sex—and one thing you want less of?',
  'Where would you most like me to touch you slowly, and where would you want me to stop being slow?',
  'What fantasy would you trust me to hear without treating it as an obligation?',
], { spice: 'explicit', tone: 'intimate', format: 'both' });

export const QUESTION_TOPICS = Object.freeze({
  general: GENERAL_TOPICS,
  family: FAMILY_TOPICS,
  date: DATE_TOPICS,
});

export const QUESTION_CATALOG = Object.freeze([
  ...legacyGeneralQuestions,
  ...generalConnection,
  ...generalStories,
  ...generalNewPeople,
  ...generalCoworkers,
  ...generalFriends,
  ...generalCloseFriends,
  ...generalPartners,
  ...familyMemories,
  ...familyChildhood,
  ...familyValues,
  ...familyAppreciation,
  ...familyPlayful,
  ...dateUs,
  ...dateCommunication,
  ...dateMemories,
  ...dateAppreciation,
  ...dateFuture,
  ...dateVulnerable,
  ...datePlayful,
  ...dateFlirty,
  ...dateSuggestive,
  ...dateExplicit,
]);

export function getTopicsForExperience(experience) {
  return QUESTION_TOPICS[experience] || QUESTION_TOPICS.general;
}
