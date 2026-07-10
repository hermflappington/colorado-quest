// Pure game logic and constants — no React, no DOM, no storage.
// Imported by App.jsx and tested directly in App.test.jsx.

export const SENSITIVE = new Set([
  'Possible artifact',
  'Rock art / petroglyph',
  'Sacred or significant place',
  'Fossil-looking object',
]);

export const CATEGORIES = [
  'Rock / mineral',
  'Landform',
  'Historic place',
  'No visible historic trace',
  'Possible artifact',
  'Rock art / petroglyph',
  'Sacred or significant place',
  'Fossil-looking object',
  'Wildlife / track / ecology',
  'Other discovery',
];

export const CONFIDENCE = ['Low', 'Medium', 'High', 'Needs expert review'];
export const STATUS = ['New', 'Reviewed', 'Needs follow-up', 'Archived'];
export const LAND_ACCESS = ['public land', 'private land', 'unknown', 'permitted area', 'trail/roadside'];

export const LEVELS = [
  { name: 'Trail Starter', points: 0 },
  { name: 'Moffat County Scout', points: 100 },
  { name: 'Browns Park Tracker', points: 250 },
  { name: 'Yampa River Explorer', points: 500 },
  { name: 'Dinosaur Country Naturalist', points: 750 },
  { name: 'Northwest Colorado Pathfinder', points: 1000 },
  { name: 'Mountain Memory Keeper', points: 1500 },
];

export const PLACE_TALKS = [
  'Who else may have stood near here long before us?',
  'What has this mountain seen that we will never know?',
  'What still looks the same as it might have 1,000 years ago?',
  'What changed here in the last 100 years?',
  'How can we be good guests in this place today?',
  'What would this place teach us if we were quiet for one minute?',
  'What signs of water, wind, fire, or time do you see?',
  'What do you want to remember about standing here?',
  'What might a kid standing here 1,000 years from now notice?',
  'What are we borrowing from this place, and how do we give respect back?',
  'What do you not see here, and what might that still teach us?',
  'How can quiet places be just as important as famous places?',
];

export const BADGES = [
  {
    group: 'Northwest Colorado',
    name: 'Moffat County Scout',
    description: 'Log your first Colorado Quest discovery.',
    earned: (stats) => stats.entryCount >= 1,
  },
  {
    group: 'Northwest Colorado',
    name: 'Browns Park Tracker',
    description: 'Log a discovery with Browns Park in the location name.',
    earned: (stats) => stats.locationText.includes('browns park'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Dinosaur Country Naturalist',
    description: 'Log a discovery with Dinosaur in the location name.',
    earned: (stats) => stats.locationText.includes('dinosaur'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Yampa River Explorer',
    description: 'Log a discovery with Yampa in the location name.',
    earned: (stats) => stats.locationText.includes('yampa'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Irish Canyon Listener',
    description: 'Log a discovery with Irish Canyon in the location name.',
    earned: (stats) => stats.locationText.includes('irish canyon'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Irish Canyon Respectful Guest',
    description: 'At Irish Canyon, log a no visible historic trace observation.',
    earned: (stats) => stats.irishCanyonQuietCount >= 1,
  },
  {
    group: 'Northwest Colorado',
    name: 'Green River Wanderer',
    description: 'Log a discovery with Green River in the location name.',
    earned: (stats) => stats.locationText.includes('green river'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Sand Wash Basin Spotter',
    description: 'Log a discovery with Sand Wash Basin in the location name.',
    earned: (stats) => stats.locationText.includes('sand wash'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Maybell Field Scout',
    description: 'Log a discovery with Maybell in the location name.',
    earned: (stats) => stats.locationText.includes('maybell'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Craig Country Observer',
    description: 'Log a discovery with Craig in the location name.',
    earned: (stats) => stats.locationText.includes('craig'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Little Snake Lookout',
    description: 'Log a discovery with Little Snake in the location name.',
    earned: (stats) => stats.locationText.includes('little snake'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Echo Park Pathfinder',
    description: 'Log a discovery with Echo Park in the location name.',
    earned: (stats) => stats.locationText.includes('echo park'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Deerlodge Discoverer',
    description: 'Log a discovery with Deerlodge in the location name.',
    earned: (stats) => stats.locationText.includes('deerlodge'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Vermillion Basin Adventurer',
    description: 'Log a discovery with Vermillion in the location name.',
    earned: (stats) => stats.locationText.includes('vermillion'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Juniper Canyon Naturalist',
    description: 'Log a discovery with Juniper Canyon in the location name.',
    earned: (stats) => stats.locationText.includes('juniper canyon'),
  },
  {
    group: 'Northwest Colorado',
    name: 'Cedar Mountain Climber',
    description: 'Log a discovery with Cedar Mountain in the location name.',
    earned: (stats) => stats.locationText.includes('cedar mountain'),
  },
  {
    group: 'Colorado',
    name: 'Northwest Colorado Pathfinder',
    description: 'Log five discoveries and three gratitude notes.',
    earned: (stats) => stats.entryCount >= 5 && stats.gratitudeCount >= 3,
  },
  {
    group: 'Colorado',
    name: 'Rocky Mountain Observer',
    description: 'Log ten total discoveries.',
    earned: (stats) => stats.entryCount >= 10,
  },
  {
    group: 'Colorado',
    name: 'Red Rock Reader',
    description: 'Log three rock, mineral, landform, or fossil discoveries.',
    earned: (stats) => stats.earthCount >= 3,
  },
  {
    group: 'Colorado',
    name: 'Trail Steward',
    description: 'Log a discovery on a trail or roadside.',
    earned: (stats) => stats.trailCount >= 1,
  },
  {
    group: 'Colorado',
    name: 'Public Lands Guest',
    description: 'Log a discovery on public land.',
    earned: (stats) => stats.publicLandCount >= 1,
  },
  {
    group: 'Colorado',
    name: 'History Seeker',
    description: 'Log a historic place discovery.',
    earned: (stats) => stats.categoryCounts['Historic place'] >= 1,
  },
  {
    group: 'Colorado',
    name: 'Quiet Place Observer',
    description: 'Log a place where no visible historic trace is found.',
    earned: (stats) => stats.categoryCounts['No visible historic trace'] >= 1,
  },
  {
    group: 'Earth',
    name: 'Rock Cycle Rookie',
    description: 'Log your first rock or mineral discovery.',
    earned: (stats) => stats.categoryCounts['Rock / mineral'] >= 1,
  },
  {
    group: 'Earth',
    name: 'Landform Listener',
    description: 'Log your first landform discovery.',
    earned: (stats) => stats.categoryCounts.Landform >= 1,
  },
  {
    group: 'Earth',
    name: 'Wildlife Witness',
    description: 'Log your first wildlife, track, or ecology discovery.',
    earned: (stats) => stats.categoryCounts['Wildlife / track / ecology'] >= 1,
  },
  {
    group: 'Earth',
    name: 'Fossil Friend',
    description: 'Log a fossil-looking object and leave it undisturbed.',
    earned: (stats) => stats.categoryCounts['Fossil-looking object'] >= 1,
  },
  {
    group: 'Earth',
    name: 'Leave No Trace Hero',
    description: 'Log any sensitive discovery with care.',
    earned: (stats) => stats.sensitiveCount >= 1,
  },
  {
    group: 'Earth',
    name: 'Gratitude Keeper',
    description: 'Add five gratitude notes.',
    earned: (stats) => stats.gratitudeCount >= 5,
  },
  {
    group: 'Earth',
    name: 'Photo Naturalist',
    description: 'Add ten discovery photos.',
    earned: (stats) => stats.photoCount >= 10,
  },
  {
    group: 'Earth',
    name: 'Water Watcher',
    description: 'Mention river, creek, spring, lake, or water in a note or location.',
    earned: (stats) => /\b(river|creek|spring|lake|water)\b/.test(stats.allText),
  },
  {
    group: 'Earth',
    name: 'Sky Noticer',
    description: 'Mention sky, cloud, sunrise, sunset, moon, or stars in a note.',
    earned: (stats) => /\b(sky|cloud|sunrise|sunset|moon|stars)\b/.test(stats.allText),
  },
  {
    group: 'Earth',
    name: 'Kind Explorer',
    description: 'Add ten gratitude notes or reach 200 quest points.',
    earned: (stats) => stats.gratitudeCount >= 10 || stats.totalPoints >= 200,
  },
  {
    group: 'Earth',
    name: 'Careful Noticer',
    description: 'Log three no visible historic trace observations.',
    earned: (stats) => stats.categoryCounts['No visible historic trace'] >= 3,
  },
];

export function pickAdventureCategories() {
  const pool = [...CATEGORIES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 5);
}

export function autoTitle(category, notes, generalLocationName) {
  const loc = generalLocationName.trim();
  if (loc) return `${category} near ${loc}`;
  const n = notes.trim();
  if (!n) return `${category} discovery`;
  return `${category}: ${n.split(/[.!?]/)[0].slice(0, 36)}`;
}

export function formatGps(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function entryPoints(entry) {
  let points = 10;
  points += (entry.photos?.length || 0) * 5;
  if (entry.gratitude?.trim()) points += 5;
  if (SENSITIVE.has(entry.category)) points += 10;
  if (entry.category === 'No visible historic trace') points += 10;
  return points;
}

export function badgePoints(badge) {
  if (badge.name === 'Northwest Colorado Pathfinder' || badge.name === 'Kind Explorer') return 100;
  if (badge.group === 'Northwest Colorado') return 50;
  if (badge.group === 'Colorado') return 40;
  return 25;
}

export function currentLevel(totalPoints) {
  const level = [...LEVELS].reverse().find((item) => totalPoints >= item.points) || LEVELS[0];
  const next = LEVELS.find((item) => item.points > totalPoints);
  return { ...level, next };
}

// Guards against entries from old or hand-edited backups missing array fields.
export function normalizeEntry(entry) {
  return {
    ...entry,
    photos: Array.isArray(entry.photos) ? entry.photos : [],
    profileIds: Array.isArray(entry.profileIds) ? entry.profileIds : [],
  };
}

export function gameStats(entries) {
  const locationText = entries.map((entry) => entry.generalLocationName || '').join(' ').toLowerCase();
  const allText = entries.map((entry) => [entry.title, entry.notes, entry.gratitude, entry.generalLocationName].filter(Boolean).join(' ')).join(' ').toLowerCase();
  const basePoints = entries.reduce((sum, entry) => sum + entryPoints(entry), 0);
  const photoCount = entries.reduce((sum, entry) => sum + (entry.photos?.length || 0), 0);
  const gratitudeCount = entries.filter((entry) => entry.gratitude?.trim()).length;
  const sensitiveCount = entries.filter((entry) => SENSITIVE.has(entry.category)).length;
  const trailCount = entries.filter((entry) => entry.landAccess === 'trail/roadside').length;
  const publicLandCount = entries.filter((entry) => entry.landAccess === 'public land').length;
  const irishCanyonQuietCount = entries.filter((entry) => (entry.generalLocationName || '').toLowerCase().includes('irish canyon') && entry.category === 'No visible historic trace').length;
  const categoryCounts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  entries.forEach((entry) => { if (entry.category in categoryCounts) categoryCounts[entry.category]++; });
  const earthCount = (categoryCounts['Rock / mineral'] || 0) + (categoryCounts.Landform || 0) + (categoryCounts['Fossil-looking object'] || 0);
  const stats = {
    entryCount: entries.length,
    gratitudeCount,
    locationText,
    allText,
    totalPoints: basePoints,
    basePoints,
    photoCount,
    sensitiveCount,
    trailCount,
    publicLandCount,
    irishCanyonQuietCount,
    categoryCounts,
    earthCount,
  };
  const badges = BADGES.map((badge) => ({ ...badge, points: badgePoints(badge), isEarned: badge.earned(stats) }));
  const badgeBonusPoints = badges.filter((badge) => badge.isEarned).reduce((sum, badge) => sum + badge.points, 0);
  const totalPoints = basePoints + badgeBonusPoints;
  return {
    ...stats,
    totalPoints,
    badgeBonusPoints,
    level: currentLevel(totalPoints),
    placeTalk: PLACE_TALKS[(entries.length + badges.filter((badge) => badge.isEarned).length) % PLACE_TALKS.length],
    badges,
  };
}
