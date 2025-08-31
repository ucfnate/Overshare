// lib/nhie.js
export const nhiePrompts = [
  "Never have I ever re-read an ex’s texts.",
  "Never have I ever fallen asleep on a video call.",
  "Never have I ever pretended to know a reference.",
  "Never have I ever cried at work.",
  "Never have I ever sent a risky text and turned off my phone.",
  "Never have I ever lurked someone’s LinkedIn too many times.",
  "Never have I ever eaten dessert for breakfast.",
  "Never have I ever lied about my age.",
  "Never have I ever forgotten a close friend’s birthday.",
  "Never have I ever Googled myself.",
  "Never have I ever stayed up all night to finish a show.",
  "Never have I ever used a fake name at a restaurant.",
  "Never have I ever laughed so hard I cried.",
  "Never have I ever snooped through someone’s bathroom cabinet.",
  "Never have I ever accidentally liked an old photo.",
  "Never have I ever cried during a cartoon.",
  "Never have I ever pretended to be on a call to avoid someone.",
  "Never have I ever made a burner account.",
  "Never have I ever eaten something off the floor.",
  "Never have I ever ghosted a group chat.",
  "Never have I ever DM’d a celeb.",
  "Never have I ever bought something I saw on TikTok immediately.",
  "Never have I ever binged an entire season in a day.",
  "Never have I ever kissed on the first date.",
  "Never have I ever gone to bed before 9pm on a Friday.",
  "Never have I ever posted and deleted within 1 minute.",
  "Never have I ever cried at a concert.",
  "Never have I ever faked liking a friend’s hobby.",
  "Never have I ever accidentally sent a text to the wrong person.",
  "Never have I ever stalked my old teacher online.",
  "Never have I ever double-texted.",
  "Never have I ever fallen in love with a city.",
  "Never have I ever worn sunglasses indoors.",
  "Never have I ever had an embarrassing ringtone.",
  "Never have I ever lied about watching a classic movie.",
  "Never have I ever made a playlist for someone and never sent it.",
  "Never have I ever made up a fact in a debate.",
  "Never have I ever used the wrong name… mid-story.",
  "Never have I ever ugly cried on a plane."
];

export function getRandomNHIE(exclude = new Set()) {
  const pool = nhiePrompts.filter(p => !exclude.has(p));
  if (pool.length === 0) return nhiePrompts[Math.floor(Math.random()*nhiePrompts.length)];
  return pool[Math.floor(Math.random()*pool.length)];
}
