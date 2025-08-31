// lib/fillin.js
export const fillInPrompts = [
  "New reality show title:",
  "The sequel nobody asked for:",
  "Worst place to propose:",
  "A slogan that absolutely shouldn’t be a slogan:",
  "Unhinged advice that low-key works:",
  "A new law that would cause chaos:",
  "Rejected horoscope prediction:",
  "This group’s band name:",
  "A dating app red flag:",
  "The last text you should never send:",
  "A movie that needs to be a musical:",
  "Startup pitch in five words:",
  "The world’s most mid superpower:",
  "Fortune cookie message from hell:",
  "An oddly specific fear:",
  "Product name for a ridiculous invention:",
  "Award you would actually win:",
  "Most cursed recipe idea:",
  "Unnecessary feature for a toothbrush:",
  "A niche holiday we deserve:",
  "The Wi-Fi password at villain HQ:",
  "What aliens would think of Earth:",
  "A perfume that should not exist:",
  "The app feature you’d ban:",
  "The worst team-building exercise:",
  "A conspiracy theory that would slap:",
  "A petty hill worth dying on:",
  "A TED talk you could give:",
  "A crime that sounds legal:",
  "A note for your future self:",
  "A niche Olympic sport you’d create:",
  "The next viral challenge:",
  "A CEO apology headline:",
  "A text that ends a group chat:",
  "An emoji we desperately need:",
  "A very specific playlist name:",
  "A tattoo idea you’ll regret:",
  "A rule that would fix airports:",
  "A suspiciously specific product review:",
  "A children's book that shouldn't exist:"
];

export function getRandomFillIn(exclude = new Set()) {
  const pool = fillInPrompts.filter(p => !exclude.has(p));
  if (pool.length === 0) return fillInPrompts[Math.floor(Math.random()*fillInPrompts.length)];
  return pool[Math.floor(Math.random()*pool.length)];
}
