import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { entryPoints, currentLevel, gameStats, pickAdventureCategories, normalizeEntry, CATEGORIES } from './game.js';

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

// ─── entryPoints ──────────────────────────────────────────────────────────────

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

// ─── currentLevel ─────────────────────────────────────────────────────────────

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

// ─── gameStats badges ─────────────────────────────────────────────────────────

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

// ─── pickAdventureCategories ──────────────────────────────────────────────────

describe('pickAdventureCategories', () => {
  it('returns 5 distinct real categories', () => {
    const picked = pickAdventureCategories();
    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
    picked.forEach((c) => expect(CATEGORIES).toContain(c));
  });
});

// ─── normalizeEntry ───────────────────────────────────────────────────────────

describe('normalizeEntry', () => {
  it('repairs missing photos and profileIds arrays', () => {
    const fixed = normalizeEntry({ id: 'x', title: 'old backup entry' });
    expect(fixed.photos).toEqual([]);
    expect(fixed.profileIds).toEqual([]);
  });

  it('leaves valid arrays untouched', () => {
    const entry = makeEntry({ photos: ['a'], profileIds: ['p1', 'p2'] });
    const fixed = normalizeEntry(entry);
    expect(fixed.photos).toEqual(['a']);
    expect(fixed.profileIds).toEqual(['p1', 'p2']);
  });
});

// ─── load() validation (via App render with seeded localStorage) ─────────────

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
    const select = await screen.findByRole('combobox', { name: /active profile/i });
    expect(select.value).toBe('real-id');
  });

  it('keeps an adventure with non-category items (free-text quest items are valid)', async () => {
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [],
      activeAdventure: {
        id: 'adv1',
        categories: ['Renamed old category', 'Rock / mineral'],
        found: [],
        createdAt: Date.now(),
      },
    }));
    render(<App />);
    // Since quests allow free-text items, unknown names stay checkable instead
    // of the whole adventure being discarded.
    expect(await screen.findByText(/renamed old category/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /found it/i })).toHaveLength(2);
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

  it('renders Entry Detail for an entry missing photos/profileIds arrays', async () => {
    const user = userEvent.setup();
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [{ id: 'e1', title: 'Legacy entry', category: 'Landform', lat: 40, lng: -108, createdAt: 1, confidence: 'Low', status: 'New', landAccess: 'unknown' }],
      activeAdventure: null,
    }));
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^Journal$/i }));
    await user.click(screen.getByRole('button', { name: /legacy entry/i }));
    expect(await screen.findByRole('heading', { name: /legacy entry/i })).toBeInTheDocument();
  });
});

// ─── Safety acknowledgement gate ──────────────────────────────────────────────

describe('safety gate', () => {
  it('shows safety screen before ack', async () => {
    render(<App />);
    expect(await screen.findByText(/Colorado Quest Safety/i)).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows main app after acknowledging', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /i acknowledge/i }));
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
  });
});

// ─── IndexedDB persistence & migration ────────────────────────────────────────

describe('storage', () => {
  it('migrates legacy localStorage data into IndexedDB on first load', async () => {
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Migrated', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [makeEntry({ title: 'Old localStorage entry' })],
      activeAdventure: null,
    }));
    render(<App />);
    // Legacy data is visible in the app…
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^Journal$/i }));
    expect(screen.getByRole('button', { name: /old localstorage entry/i })).toBeInTheDocument();
    // …and has been copied into IndexedDB.
    const { loadState } = await import('./storage.js');
    await waitFor(async () => {
      const stored = await loadState();
      expect(stored?.entries?.length).toBe(1);
    });
  });

  it('persists changes to IndexedDB (debounced)', async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /i acknowledge/i }));
    const { loadState } = await import('./storage.js');
    await waitFor(async () => {
      const stored = await loadState();
      expect(stored?.safetyAck).toBe(true);
    }, { timeout: 2000 });
  });

  it('converts a legacy adventure shape (categories) to items', async () => {
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [],
      activeAdventure: { id: 'adv1', categories: ['Rock / mineral', 'Landform'], found: ['Rock / mineral'], createdAt: 1 },
    }));
    render(<App />);
    // The old adventure still renders, with its progress intact.
    expect(await screen.findByText(/landform/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /found it/i })).toHaveLength(1);
  });
});

// ─── Saved quests ─────────────────────────────────────────────────────────────

describe('saved quests', () => {
  beforeEach(() => {
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Parent', role: 'adult' }, { id: 'p2', name: 'Kiddo', role: 'kid' }],
      activeProfileId: 'p1',
      entries: [],
      activeAdventure: null,
      savedQuests: [{ id: 'q1', name: 'Irish Canyon trip', items: ['A petroglyph viewpoint', 'An animal track', 'A quiet place'], createdAt: 1 }],
    }));
  });

  it('lists saved quests and starts one with its own items', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/irish canyon trip/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Start$/i }));
    expect(screen.getByRole('heading', { name: /irish canyon trip/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /found it/i })).toHaveLength(3);
  });

  it('adults can create a quest', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/ready for an adventure/i);
    await user.click(screen.getByText(/create a quest/i));
    await user.type(screen.getByLabelText(/quest name/i), 'Sand Wash walk');
    await user.type(screen.getByLabelText(/things to find/i), 'A wild horse track{enter}A sagebrush smell');
    await user.click(screen.getByRole('button', { name: /save quest/i }));
    expect(screen.getByText(/sand wash walk/i)).toBeInTheDocument();
  });

  it('kids do not see quest creation or delete', async () => {
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p2', name: 'Kiddo', role: 'kid' }],
      activeProfileId: 'p2',
      entries: [],
      activeAdventure: null,
      savedQuests: [{ id: 'q1', name: 'Irish Canyon trip', items: ['A', 'B'], createdAt: 1 }],
    }));
    render(<App />);
    expect(await screen.findByText(/irish canyon trip/i)).toBeInTheDocument();
    expect(screen.queryByText(/create a quest/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
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

    await user.click(screen.getByRole('checkbox'));

    const mockGeo = { getCurrentPosition: vi.fn((success) => success({ coords: { latitude: 40.1, longitude: -108.2 } })) };
    Object.defineProperty(navigator, 'geolocation', { value: mockGeo, configurable: true });
    await user.click(screen.getByRole('button', { name: /capture gps/i }));

    // Canvas/Image stubs for processPhoto live in test-setup.js
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/photos/i);
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save discovery/i })).not.toBeDisabled();
    });
  });

  it('allows removing a photo before saving', async () => {
    const user = await renderToNewDiscovery();
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/photos/i), file);
    const remove = await screen.findByRole('button', { name: /^remove$/i });
    await user.click(remove);
    expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument();
  });
});

// ─── Adventure mode ───────────────────────────────────────────────────────────

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
    expect(screen.getAllByRole('button', { name: /found it/i })).toHaveLength(5);
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

// ─── GPS reveal hold: keyboard auto-repeat must not defeat the 2s gate ────────

describe('sensitive GPS reveal hold', () => {
  async function renderToSensitiveDetail() {
    const user = userEvent.setup();
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [makeEntry({ id: 'e1', title: 'Sensitive find', category: 'Possible artifact', lat: 40.12345, lng: -108.54321 })],
      activeAdventure: null,
    }));
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^Journal$/i }));
    await user.click(screen.getByRole('button', { name: /sensitive find/i }));
    return user;
  }

  it('hides GPS behind hold button for sensitive category', async () => {
    await renderToSensitiveDetail();
    expect(screen.getByText(/exact gps hidden/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hold 2s to reveal/i })).toBeInTheDocument();
  });

  it('a short key tap does NOT reveal GPS after release (no orphaned timers)', async () => {
    // Navigate under real timers (findByRole polls with real timers),
    // then fake timers only around the hold interaction itself.
    await renderToSensitiveDetail();
    const holdBtn = screen.getByRole('button', { name: /hold 2s to reveal/i });
    vi.useFakeTimers();
    try {
      // Simulate key auto-repeat: initial press + repeated keydowns, release before 2s.
      fireEvent.keyDown(holdBtn, { key: ' ', repeat: false });
      fireEvent.keyDown(holdBtn, { key: ' ', repeat: true });
      fireEvent.keyDown(holdBtn, { key: ' ', repeat: true });
      act(() => { vi.advanceTimersByTime(500); });
      fireEvent.keyUp(holdBtn, { key: ' ' });
      act(() => { vi.advanceTimersByTime(5000); });

      expect(screen.getByText(/exact gps hidden/i)).toBeInTheDocument();
      expect(screen.queryByText(/40\.12345/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a full 2s hold reveals GPS', async () => {
    await renderToSensitiveDetail();
    const holdBtn = screen.getByRole('button', { name: /hold 2s to reveal/i });
    vi.useFakeTimers();
    try {
      fireEvent.mouseDown(holdBtn);
      act(() => { vi.advanceTimersByTime(2100); });
      expect(screen.getByText(/40\.12345/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('kid profile cannot reveal at all', async () => {
    const user = userEvent.setup();
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Kiddo', role: 'kid' }],
      activeProfileId: 'p1',
      entries: [makeEntry({ id: 'e1', title: 'Sensitive find', category: 'Possible artifact' })],
      activeAdventure: null,
    }));
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^Journal$/i }));
    await user.click(screen.getByRole('button', { name: /sensitive find/i }));
    expect(screen.getByText(/active profile is kid/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hold 2s to reveal/i })).not.toBeInTheDocument();
  });
});

// ─── Field guide cards ────────────────────────────────────────────────────────

describe('field guide', () => {
  beforeEach(() => {
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [makeEntry({ id: 'e1', title: 'A neat rock', category: 'Rock / mineral' })],
      activeAdventure: null,
    }));
  });

  it('shows a learn card on New Discovery matching the selected category', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^New Discovery$/i }));
    expect(screen.getByText(/learn about this/i)).toBeInTheDocument();
    expect(screen.getByText(/morrison formation/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/category/i), 'Rock art / petroglyph');
    expect(screen.getByText(/petroglyphs are pecked or carved/i)).toBeInTheDocument();
  });

  it('shows the learn card on Entry Detail', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^Journal$/i }));
    await user.click(screen.getByRole('button', { name: /a neat rock/i }));
    expect(screen.getByText(/learn about this/i)).toBeInTheDocument();
  });
});

// ─── Yearbook ─────────────────────────────────────────────────────────────────

describe('yearbook', () => {
  it('filters entries by year and keeps sensitive locations private', async () => {
    const user = userEvent.setup();
    const y2025 = new Date('2025-06-15T12:00:00').getTime();
    const y2026 = new Date('2026-07-04T12:00:00').getTime();
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [
        makeEntry({ id: 'e1', title: 'Old year find', createdAt: y2025 }),
        makeEntry({ id: 'e2', title: 'Secret artifact spot', category: 'Possible artifact', createdAt: y2026, lat: 40.12345, lng: -108.54321 }),
      ],
      activeAdventure: null,
    }));
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^Yearbook$/i }));

    // All years: both entries, cover stats
    expect(screen.getByText(/old year find/i)).toBeInTheDocument();
    expect(screen.getByText(/secret artifact spot/i)).toBeInTheDocument();
    expect(screen.getByText(/2 discoveries/i)).toBeInTheDocument();

    // Sensitive entry never prints exact GPS
    expect(screen.getByText(/exact location kept private/i)).toBeInTheDocument();
    expect(screen.queryByText(/40\.12345/)).not.toBeInTheDocument();

    // Filter to 2025 only
    await user.selectOptions(screen.getByLabelText(/year/i), '2025');
    expect(screen.getByText(/old year find/i)).toBeInTheDocument();
    expect(screen.queryByText(/secret artifact spot/i)).not.toBeInTheDocument();
  });

  it('shows an empty state and disables print with no entries', async () => {
    const user = userEvent.setup();
    localStorage.setItem('coquest.v1', JSON.stringify({
      safetyAck: true,
      profiles: [{ id: 'p1', name: 'Tester', role: 'adult' }],
      activeProfileId: 'p1',
      entries: [],
      activeAdventure: null,
    }));
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^Yearbook$/i }));
    expect(screen.getByText(/no discoveries/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print/i })).toBeDisabled();
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
    expect(await screen.findByText(/Colorado Quest Safety/i)).toBeInTheDocument();
  });
});
