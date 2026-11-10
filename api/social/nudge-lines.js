// What a friend's nudge says, by the tone the person chose for their own reminders
// (Settings → reminder tone: friendly, guilt trip, drill sergeant). Kind even in "drill", never
// about what they did or didn't do, no em dashes. {name} is the sender's first name.
export const NUDGE_LINES = {
  friendly: [
    '{name} is cheering you on. Fancy a session today?',
    '{name} sent you a nudge. A short workout counts too.',
    '{name} thinks today is a good day to train.',
    'A wave from {name}: see you at the gym?',
  ],
  guilt: [
    '{name} trained. Just saying.',
    '{name} wonders where you’ve been. The weights miss you too.',
    '{name} sent a nudge. They’d hate to pull further ahead.',
    'Your spot on the leaderboard is getting cold. Love, {name}.',
  ],
  drill: [
    '{name} says: up and at it. One session today.',
    'Orders from {name}: lace up, warm up, show up.',
    '{name} is calling roll. Report to the gym.',
    'Nudge from {name}. No excuses today, just one set at a time.',
  ],
};

/** The line for a tone, picked by the day so a pair never gets the same one twice in a row. */
export function nudgeLine(tone, name, dayIndex = 0) {
  const lines = NUDGE_LINES[tone] || NUDGE_LINES.friendly;
  const first = String(name || 'A friend').trim().split(/\s+/)[0] || 'A friend';
  return lines[Math.abs(dayIndex) % lines.length].replace('{name}', first);
}
