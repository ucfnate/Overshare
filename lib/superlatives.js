// lib/superlatives.js
export const superlativesPrompts = [
  "Most likely to accidentally become a meme",
  "Most likely to forget why they walked into a room",
  "Most likely to cry at a commercial",
  "Most likely to survive a zombie apocalypse",
  "Most likely to text back in 0.2 seconds",
  "Most likely to bring snacks for everyone",
  "Most likely to overshare on a first date",
  "Most likely to talk to their plants",
  "Most likely to start a conspiracy theory",
  "Most likely to win a reality TV show",
  "Most likely to lose their keys twice in one day",
  "Most likely to become famous by accident",
  "Most likely to laugh at the wrong moment",
  "Most likely to befriend a raccoon",
  "Most likely to roast you and hug you after",
  "Most likely to have a burner account",
  "Most likely to start a cult (a nice one)",
  "Most likely to make a spreadsheet for fun",
  "Most likely to go viral for a dance",
  "Most likely to Uber to the gym",
  "Most likely to marry their high school crush",
  "Most likely to bring a portable charger everywhere",
  "Most likely to ghost a group chat",
  "Most likely to have a secret tattoo",
  "Most likely to write a bestselling memoir",
  "Most likely to send a voice note at 2am",
  "Most likely to forget everyone’s birthday (sorry)",
  "Most likely to give elite advice they won’t take",
  "Most likely to own 14 water bottles",
  "Most likely to start a band this weekend",
  "Most likely to say “one more episode” (lies)",
  "Most likely to have a playlist for everything",
  "Most likely to get lost with GPS on",
  "Most likely to adopt 3 dogs",
  "Most likely to eat dessert first",
  "Most likely to fall asleep at the pregame",
  "Most likely to overpack for a day trip",
  "Most likely to cry-laugh",
  "Most likely to become a coffee snob",
  "Most likely to ask for manager (politely)"
];

export function getRandomSuperlative(exclude = new Set()) {
  const pool = superlativesPrompts.filter(p => !exclude.has(p));
  if (pool.length === 0) return superlativesPrompts[Math.floor(Math.random()*superlativesPrompts.length)];
  return pool[Math.floor(Math.random()*pool.length)];
}
