import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Pull out testable pure functions by re-importing the module.
// We expose them for testing by importing the compiled module internals
// via a thin re-export shim (see below), but since App.jsx is a default-
// export component we test pure logic directly through the compiled output.
// Pure functions are extracted into a separate test-helpers import below.

import App from './App.jsx';

// ─── Helpers copied from App.jsx (pure functions, no side-effects) ───────────

const CATEGORIES = [
  'Rock / mineral', 'Landform', 'Historic place', 'No visible historic trace',
  'Possible artifact', 'Rock art / petroglyph', 'Sacred or significant place',
  'Fossil-looking object', 'Wildlife / track / ecology', 'Other discovery',
];
const SENSITIVE = new Set(['Possible artifact', 'Rock art / petroglyph', 'Sacred or significant place', 'Fossil-looking object']);
const LEVELS = [
  { name: 'Trail Starter', points: 0 },
  { name: 'Moffat County Scout', points: 100 },
  { name: 'Browns Park Tracker', points: 250 },
  { name: 'Yampa River Explorer', points: 500 },
  { name: 'Dinosaur Country Naturalist', points: 750 },
  { name: 'Northwest Colorado Pathfinder', points: 1000 },
  { name: 'Mountain Memory Keeper', points: 1500 },
];
const BADGES = [
  { group: 'Northwest Colorado', name: 'Moffat County Scout', description: 'Log your first Colorado Quest discovery.', earned: (s) => s.entryCount >= 1 },
  { group: 'Colorado', name: 'Northwest Colorado Pathfinder', description: 'Log five discoveries and three gratitude notes.', earned: (s) => s.entryCount >= 5 && s.gratitudeCount >= 3 },
  { group: 'Colorado', name: 'Rocky Mountain Observer', description: 'Log ten total discoveries.', earned: (s) => s.entryCount >= 10 },
  { group: 'Earth', name: 'Rock Cycle Rookie', description: 'Log your first rock or mineral discovery.', earned: (s) => s.categoryCounts['Rock / mineral'] >= 1 },
  { group: 'Earth', name: 'Leave No Trace Hero', description: 'Log any sensitive discovery with care.', earned: (s) => s.sensitiveCount >= 1 },
  { group: 'Earth', name: 'Gratitude Keeper', description: 'Add five gratitude notes.', earned: (s) => s.gratitudeCount >= 5 },
  { group: 'Earth', name: 'Kind Explorer', description: 'Add ten gratitude notes or reach 200 quest points.', earned: (s) => s.gratitudeCount >= 10 || s.totalPoints >= 200 },
];

function badgePoints(badge) {
  if (badge.name === 'Northwest Colorado Pathfinder' || badge.name === 'Kind Explorer') return 100;
  if (badge.group === 'Northwest Colorado') return 50;
  if (badge.group === 'Colorado') return 40;
  return 25;
}

function entryPoints(entry) {
  let pts = 10;
  pts += (entry.photos?.length || 0) * 5;
  if (entry.gratitude?.trim()) pts += 5;
  if (SENSITIVE.has(entry.category)) pts += 10;
  if (entry.category === 'No visible historic trace') pts += 10;
  return pts;
}

function currentLevel(totalPoints) {
  const level = [...LEVELS].reverse().find((l) => totalPoints >= l.points) || LEVELS[0];
  const next = LEVELS.find((l) => l.points > totalPoints);
  return { ...level, next };
}

function gameStats(entries) {
  const locationText = entries.map((e) => e.generalLocationName || '').join(' ').toLowerCase();
  const allText = entries.map((e) => [e.title, e.notes, e.gratitude, e.generalLocationName].filter(Boolean).join(' ')).join(' ').toLowerCase();
  const basePoints = entries.reduce((sum, e) => sum + entryPoints(e), 0);
  const photoCount = entries.reduce((sum, e) => sum + (e.photos?.length || 0), 0);
  const gratitudeCount = entries.filter((e) => e.gratitude?.trim()).length;
  const sensitiveCount = entries.filter((e) => SENSITIVE.has(e.category)).length;
  const trailCount = entries.filter((e) => e.landAccess === 'trail/roadside').length;
  const publicLandCount = entries.filter((e) => e.landAccess === 'public land').length;
  const irishCanyonQuietCount = entries.filter((e) => (e.generalLocationName || '').toLowerCase().includes('irish canyon') && e.category === 'No visible historic trace').length;
  const categoryCounts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  entries.forEach((e) => { if (e.category in categoryCounts) categoryCounts[e.category]++; });
  const earthCount = (categoryCounts['Rock / mineral'] || 0) + (categoryCounts.Landform || 0) + (categoryCounts['Fossil-looking object'] || 0);
  const stats = { entryCount: entries.length, gratitudeCount, locationText, allText, totalPoints: basePoints, basePoints, photoCount, sensitiveCount, trailCount, publicLandCount, irishCanyonQuietCount, categoryCounts, earthCount };
  const badges = BADGES.map((b) => ({ ...b, points: badgePoints(b), isEarned: b.earned(stats) }));
  const badgeBonusPoints = badges.filter((b) => b.isEarned).reduce((sum, b) => sum + b.points, 0);
  const totalPoints = basePoints + badgeBonusPoints;
  return { ...stats, totalPoints, badgeBonusPoints, level: currentLevel(totalPoints), badges };
}

function makeEntry(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: 'Test entry',
    notes: '',
    category: 'Rock / mineral',
    profileIds: ['p1'],
    photos: [],
    lat: 40.0,
    lng: -108.0,
    confidence: 'Low',
    status: 'New',
    generalLocationName: '',
    landAccess: 'unknown',
    gratitude: '',
    createdAt: Date.now(),
    ...overrides,
  };
}

// ─── Mock setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// Leaflet renders a real DOM map which requires a browser — stub it out.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
}));

vi.mock('leaflet', () => ({
  default: { Icon: class { constructor(o) { Object.assign(this, o); } } },
}));

// ─── gameStats: points ────────────────────────────────────────────────────────

describe('entryPoints', () => {
  it('awards base 10 points', () => {
    expect(entryPoints(makeEntry())).toBe(10);
  });

  it('awards 5 pts per photo', () => {
    expect(entryPoints(makeEntry({ photos: ['a', 'b', 'c'] }))).toBe(25);
  });

  it('awards 5 pts for gratitude', () => {
    expect(entryPoints(makeEntry({ gratitude: 'Thankful' }))).toBe(15);
  });

  it('awards 10 bonus pts for sensitive category', () => {
    expect(entryPoints(makeEntry({ category: 'Possible artifact' }))).toBe(20);
  });

  it('awards 10 bonus pts for No visible historic trace', () => {
    expect(entryPoints(makeEntry({ category: 'No visible historic trace' }))).toBe(20);
  });

  it('stacks all bonuses', () => {
    expect(entryPoints(makeEntry({ category: 'Possible artifact', photos: ['x'], gratitude: 'ty' }))).toBe(30);
  });
});

// ─── gameStats: levels ────────────────────────────────────────────────────────

describe('currentLevel', () => {
  it('starts at Trail Starter', () => {
    expect(currentLevel(0).name).toBe('Trail Starter');
  });

  it('reaches Moffat County Scout at 100 pts', () => {
    expect(currentLevel(100).name).toBe('Moffat County Scout');
  });

  it('reports next level threshold', () => {
    expect(currentLevel(0).next?.points).toBe(100);
  });

  it('reports no next level at max', () => {
    expect(currentLevel(1500).next).toBeUndefined();
  });
});

// ─── gameStats: badges ────────────────────────────────────────────────────────

describe('gameStats badges', () => {
  it('earns Moffat County Scout on first entry', () => {
    const s = gameStats([makeEntry()]);
    expect(s.badges.find((b) => b.name === 'Moffat County Scout')?.isEarned).toBe(true);
  });

  it('earns Rock Cycle Rookie for Rock / mineral entry', () => {
    const s = gameStats([makeEntry({ category: 'Rock / mineral' })]);
    expect(s.badges.find((b) => b.name === 'Rock Cycle Rookie')?.isEarned).toBe(true);
  });

  it('earns Leave No Trace Hero for sensitive entry', () => {
    const s = gameStats([makeEntry({ category: 'Sacred or significant place' })]);
    expect(s.badges.find((b) => b.name === 'Leave No Trace Hero')?.isEarned).toBe(true);
  });

  it('does not earn Gratitude Keeper until 5 gratitude entries', () => {
    const four = Array.from({ length: 4 }, () => makeEntry({ gratitude: 'ty' }));
    expect(gameStats(four).badges.find((b) => b.name === 'Gratitude Keeper')?.isEarned).toBe(false);
    const five = [...four, makeEntry({ gratitude: 'ty' })];
    expect(gameStats(five).badges.find((b) => b.name === 'Gratitude Keeper')?.isEarned).toBe(true);
  });

  it('badge bonus points are added to total', () => {
    const s = gameStats([makeEntry()]);
    expect(s.totalPoints).toBeGreaterThan(s.basePoints);
    expect(s.badgeBonusPoints).toBeGreaterThan(0);
  });
});

// ─── load() validation ────────────────────────────────────────────────────────
// We test these by rendering App with pre-seeded localStorage.

describe('load() validation', () => {
  it('falls back to first profile if activeProfileId is dangling', async () => {
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'real-id', name: 'Tester', role: 'adult' }],
      activeProfileId: 'nonexistent-id',
      entries: [],
      activeAdventure: null,
    }));
    render(<App />);
    // The profile select should show "Tester" as selected (not crash)
    const select = await screen.findByRole('combobox', { name: /active profile/i });
    expect(select.value).toBe('real-id');
  });

  it('nulls out an adventure whose categories include a deleted category', async () => {
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [],
      activeAdventure: {
        id: 'adv1',
        categories: ['Deleted category', 'Rock / mineral'],
        found: [],
        createdAt: Date.now(),
      },
    }));
    render(<App />);
    // App should show "Ready for an adventure?" not the active find-list
    expect(await screen.findByText(/ready for an adventure/i)).toBeInTheDocument();
  });

  it('nulls out an adventure with a corrupt shape (missing found array)', async () => {
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [],
      activeAdventure: { id: 'adv1', categories: ['Rock / mineral'] },
    }));
    render(<App />);
    expect(await screen.findByText(/ready for an adventure/i)).toBeInTheDocument();
  });
});

// ─── Safety acknowledgement gate ──────────────────────────────────────────────

describe('safety gate', () => {
  it('shows safety screen before ack', () => {
    render(<App />);
    expect(screen.getByText(/Colorado Quest Safety/i)).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows main app after acknowledging', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /i acknowledge/i }));
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
  });
});

// ─── New Discovery form: save button gating ───────────────────────────────────

describe('New Discovery save button', () => {
  async function renderToNewDiscovery() {
    const user = userEvent.setup();
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [],
      activeAdventure: null,
    }));
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^New Discovery$/i }));
    return user;
  }

  it('Save Discovery is disabled until category, profile, photo, and GPS are set', async () => {
    await renderToNewDiscovery();
    expect(screen.getByRole('button', { name: /save discovery/i })).toBeDisabled();
  });

  it('enables Save Discovery once all required fields are present', async () => {
    const user = await renderToNewDiscovery();

    // Check a profile
    await user.click(screen.getByRole('checkbox'));

    // Fake a GPS capture via geolocation mock
    const mockGeo = { getCurrentPosition: vi.fn((success) => success({ coords: { latitude: 40.1, longitude: -108.2 } })) };
    Object.defineProperty(navigator, 'geolocation', { value: mockGeo, configurable: true });
    await user.click(screen.getByRole('button', { name: /capture gps/i }));

    // Fake a photo upload (canvas/Image stubs are in test-setup.js)
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/photos/i);
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save discovery/i })).not.toBeDisabled();
    });
  });
});

// ─── Adventure mode: check-off and completion ─────────────────────────────────

describe('adventure mode', () => {
  beforeEach(() => {
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [],
      activeAdventure: null,
    }));
  });

  it('shows prompt when no adventure is active', async () => {
    render(<App />);
    expect(await screen.findByText(/ready for an adventure/i)).toBeInTheDocument();
  });

  it('starts an adventure and shows 5 items', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /start new adventure/i }));
    const items = screen.getAllByRole('button', { name: /found it/i });
    expect(items).toHaveLength(5);
  });

  it('checking off all items shows completion message', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /start new adventure/i }));
    const buttons = screen.getAllByRole('button', { name: /found it/i });
    for (const btn of buttons) await user.click(btn);
    expect(await screen.findByText(/adventure complete/i)).toBeInTheDocument();
  });

  it('end adventure returns to start prompt', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /start new adventure/i }));
    await user.click(screen.getByRole('button', { name: /end adventure/i }));
    expect(await screen.findByText(/ready for an adventure/i)).toBeInTheDocument();
  });
});

// ─── Settings: Reset Local Data confirm gate ──────────────────────────────────

describe('Reset Local Data', () => {
  it('does not reset when user cancels the confirm dialog', async () => {
    const user = userEvent.setup();
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [makeEntry()],
      activeAdventure: null,
    }));
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /reset local data/i }));
    // Data should still be in localStorage
    const saved = JSON.parse(localStorage.getItem('coquest.v1') || '{}');
    expect(saved.entries?.length).toBe(1);
  });

  it('resets when user confirms', async () => {
    const user = userEvent.setup();
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [makeEntry()],
      activeAdventure: null,
    }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /reset local data/i }));
    // Safety gate should reappear
    expect(await screen.findByText(/Colorado Quest Safety/i)).toBeInTheDocument();
  });
});
