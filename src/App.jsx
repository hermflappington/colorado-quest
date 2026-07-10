import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CATEGORIES, SENSITIVE, CONFIDENCE, STATUS, LAND_ACCESS,
  autoTitle, formatGps, entryPoints, gameStats, normalizeEntry, pickAdventureCategories,
} from './game.js';

const STORAGE_KEY = 'coquest.v1';

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const starterAdult = { id: crypto.randomUUID(), name: 'Adult', role: 'adult' };
const blank = { profiles: [starterAdult], activeProfileId: starterAdult.id, entries: [], safetyAck: false, activeAdventure: null };

// Re-encodes photo through canvas: strips EXIF (including GPS), resizes to max 1200px, compresses.
// Resolves null if the browser cannot decode the file (e.g. HEIC on non-Safari, corrupt file).
async function processPhoto(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

async function processPhotos(files) {
  const results = await Promise.all(Array.from(files).map(processPhoto));
  const ok = results.filter(Boolean);
  if (ok.length < results.length) {
    alert(`${results.length - ok.length} photo(s) could not be read. If they are iPhone HEIC photos, try converting them to JPEG first.`);
  }
  return ok;
}

const initialForm = {
  title: '', notes: '', category: CATEGORIES[0], profileIds: [], photos: [], lat: '', lng: '',
  confidence: CONFIDENCE[0], status: STATUS[0], generalLocationName: '', landAccess: LAND_ACCESS[2], gratitude: '',
};

function sanitizeDb(merged, fallbackProfileId) {
  if (!merged.profiles.find((p) => p.id === merged.activeProfileId)) {
    merged.activeProfileId = merged.profiles[0]?.id ?? fallbackProfileId;
  }
  merged.entries = Array.isArray(merged.entries) ? merged.entries.map(normalizeEntry) : [];
  const adv = merged.activeAdventure;
  if (adv && (!Array.isArray(adv.categories) || !Array.isArray(adv.found) || adv.categories.some((c) => !CATEGORIES.includes(c)))) {
    merged.activeAdventure = null;
  }
  return merged;
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return sanitizeDb({ ...blank, ...saved }, blank.activeProfileId);
  } catch {
    return blank;
  }
}

function exportBackup(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `colorado-quest-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackupFile(file, currentDb, setDb) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(String(reader.result || '{}'));
      if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.entries) || !Array.isArray(incoming.profiles)) {
        alert('Invalid backup file.');
        return;
      }
      if (!window.confirm('Restore backup and replace current local data?')) return;
      setDb(sanitizeDb({ ...currentDb, ...incoming }, currentDb.activeProfileId));
    } catch {
      alert('Unable to import backup file.');
    }
  };
  reader.readAsText(file);
}

export default function App() {
  const [db, setDb] = useState(load);
  const [screen, setScreen] = useState('Home');
  const [selectedId, setSelectedId] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [form, setForm] = useState(initialForm);
  const [editForm, setEditForm] = useState(null);
  const [storageFull, setStorageFull] = useState(false);

  const saveTimer = useRef(null);
  const dbRef = useRef(db);
  const holdTimer = useRef(null);

  useEffect(() => { dbRef.current = db; }, [db]);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        setStorageFull(false);
      } catch {
        setStorageFull(true);
      }
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [db]);

  useEffect(() => {
    // beforeunload alone is unreliable on mobile Safari; pagehide/visibilitychange
    // cover the app being backgrounded on a phone, which is the common case here.
    const flush = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dbRef.current)); } catch { /* quota; debounced path shows the warning */ }
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (screen !== 'Entry Detail') {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      setRevealed({});
    }
  }, [screen]);

  const sortedEntries = useMemo(() => [...db.entries].sort((a, b) => b.createdAt - a.createdAt), [db.entries]);
  const stats = useMemo(() => gameStats(db.entries), [db.entries]);
  const activeProfile = db.profiles.find((p) => p.id === db.activeProfileId);
  const selected = useMemo(() => db.entries.find((e) => e.id === selectedId) ?? null, [db.entries, selectedId]);

  const addProfile = (name, role) => setDb((d) => ({ ...d, profiles: [...d.profiles, { id: crypto.randomUUID(), name, role }] }));

  const canSave = !!form.category && form.profileIds.length > 0 && form.photos.length > 0 && form.lat && form.lng;

  const createEntry = () => {
    const title = form.title.trim() || autoTitle(form.category, form.notes, form.generalLocationName);
    const entry = { ...form, id: crypto.randomUUID(), title, createdAt: Date.now(), lat: Number(form.lat), lng: Number(form.lng) };
    setDb((d) => {
      const adventure = d.activeAdventure;
      const activeAdventure = adventure && adventure.categories.includes(entry.category) && !adventure.found.includes(entry.category)
        ? { ...adventure, found: [...adventure.found, entry.category] }
        : adventure;
      return { ...d, entries: [entry, ...d.entries], activeAdventure };
    });
    setForm(initialForm);
    setScreen('Journal');
  };

  const startAdventure = () => setDb((d) => ({ ...d, activeAdventure: { id: crypto.randomUUID(), categories: pickAdventureCategories(), found: [], createdAt: Date.now() } }));
  const endAdventure = () => setDb((d) => ({ ...d, activeAdventure: null }));
  const markFound = (category) => setDb((d) => {
    const adventure = d.activeAdventure;
    if (!adventure || adventure.found.includes(category)) return d;
    return { ...d, activeAdventure: { ...adventure, found: [...adventure.found, category] } };
  });

  const startEditEntry = (entry) => {
    setEditForm({
      ...entry,
      lat: String(entry.lat || ''),
      lng: String(entry.lng || ''),
      gratitude: entry.gratitude || '',
      profileIds: entry.profileIds || [],
      photos: entry.photos || [],
    });
    setScreen('Edit Entry');
  };

  const saveEditEntry = () => {
    const title = editForm.title.trim() || autoTitle(editForm.category, editForm.notes, editForm.generalLocationName);
    const updated = { ...editForm, title, lat: Number(editForm.lat), lng: Number(editForm.lng) };
    setDb((d) => ({ ...d, entries: d.entries.map((entry) => entry.id === updated.id ? updated : entry) }));
    setScreen('Entry Detail');
  };

  const captureGps = () => navigator.geolocation.getCurrentPosition(
    (p) => setForm((f) => ({ ...f, lat: p.coords.latitude, lng: p.coords.longitude })),
    () => alert('Unable to get GPS. Please check location permissions.'),
  );

  const captureEditGps = () => navigator.geolocation.getCurrentPosition(
    (p) => setEditForm((f) => ({ ...f, lat: p.coords.latitude, lng: p.coords.longitude })),
    () => alert('Unable to get GPS. Please check location permissions.'),
  );

  const onPhoto = async (files) => {
    const next = await processPhotos(files);
    setForm((f) => ({ ...f, photos: [...f.photos, ...next] }));
  };

  const onEditPhoto = async (files) => {
    const next = await processPhotos(files);
    setEditForm((f) => ({ ...f, photos: [...f.photos, ...next] }));
  };

  const canRevealSensitive = activeProfile?.role === 'adult';
  const beginRevealHold = (id) => {
    // The holdTimer guard also absorbs keyboard auto-repeat: without it, each
    // repeated keydown would orphan a timer that reveals GPS after release.
    if (!canRevealSensitive || holdTimer.current) return;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setRevealed((r) => ({ ...r, [id]: true }));
    }, 2000);
  };
  const cancelRevealHold = () => {
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  if (!db.safetyAck) {
    return <div className="shell"><h1>Colorado Quest Safety</h1><p>Observe. Photograph. Document. Leave undisturbed.</p><ul><li>Do not collect.</li><li>Do not dig.</li><li>Do not touch rock art.</li><li>Do not disturb sites.</li><li>Do not trespass.</li><li>Do not publicize sensitive locations.</li></ul><p>Colorado Quest records observations and does not confirm archaeological, geological, fossil, historical, or cultural identification.</p><button onClick={() => setDb((d) => ({ ...d, safetyAck: true }))}>I Acknowledge</button></div>;
  }

  return <div className="shell">
    <header>
      <h1>Colorado Quest</h1>
      {storageFull && <p className="warning">Device storage is full — recent changes are NOT being saved. Export a backup now, then delete old photos or entries.</p>}
      <label>Active profile
        <select value={db.activeProfileId} onChange={(e) => setDb((d) => ({ ...d, activeProfileId: e.target.value }))}>
          {db.profiles.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
        </select>
      </label>
      <nav>{['Home', 'New Discovery', 'Journal', 'Badges', 'Map', 'Profiles', 'Settings'].map((s) => <button key={s} aria-current={screen === s ? 'page' : undefined} onClick={() => setScreen(s)}>{s}</button>)}</nav>
    </header>

    {screen === 'Home' && <section><h2>Colorado Quest Progress</h2>
      <div className="adventure-card">
        {db.activeAdventure ? <>
          <h3>Find These 5 Things</h3>
          <ul className="find-list">
            {db.activeAdventure.categories.map((c) => {
              const found = db.activeAdventure.found.includes(c);
              return <li key={c} className={found ? 'found' : ''}>
                <span><span aria-hidden="true">{found ? '✅' : '🔍'}</span> {c}</span>
                {!found && <button onClick={() => markFound(c)}>Found it!</button>}
              </li>;
            })}
          </ul>
          {db.activeAdventure.found.length === db.activeAdventure.categories.length
            ? <><p className="celebrate"><span aria-hidden="true">🎉</span> Adventure complete! Great job!</p><button className="cta" onClick={startAdventure}>Start a New Adventure</button></>
            : <button onClick={endAdventure}>End Adventure</button>}
        </> : <>
          <h3>Ready for an adventure?</h3>
          <p>Roll 5 things to find on your next hike or outing.</p>
          <button className="cta" onClick={startAdventure}>Start New Adventure</button>
        </>}
      </div>
      <div className="level-card">
        <span>Current level</span>
        <strong>{stats.level.name}</strong>
        <p>{stats.level.next ? `${stats.level.next.points - stats.totalPoints} points until ${stats.level.next.name}` : 'Highest level reached'}</p>
      </div>
      <div className="place-talk"><strong>Place Talk</strong><p>{stats.placeTalk}</p></div>
      <div className="stats">
        <div><strong>{stats.entryCount}</strong><span>discoveries</span></div>
        <div><strong>{stats.totalPoints}</strong><span>quest points</span></div>
        <div><strong>{stats.badges.filter((badge) => badge.isEarned).length}</strong><span>badges earned</span></div>
      </div>
      <p className="points-preview">{stats.basePoints} discovery points + {stats.badgeBonusPoints} badge bonus points</p>
      <h3>Local badges</h3>
      <div className="badges">{stats.badges.filter((badge) => badge.isEarned).slice(0, 6).map((badge) => <div className="badge earned" key={badge.name}><strong>{badge.name}</strong><span>Earned +{badge.points} bonus points</span></div>)}</div>
      <button onClick={() => setScreen('Badges')}>See all badges</button>
    </section>}

    {screen === 'Badges' && <section><h2>Badges</h2>
      <p>{stats.badges.filter((badge) => badge.isEarned).length} of {stats.badges.length} earned. Badge bonuses: {stats.badgeBonusPoints} points.</p>
      {['Northwest Colorado', 'Colorado', 'Earth'].map((group) => <div key={group}>
        <h3>{group}</h3>
        <div className="badges">{stats.badges.filter((badge) => badge.group === group).map((badge) => <div className={`badge ${badge.isEarned ? 'earned' : ''}`} key={badge.name}><strong>{badge.name}</strong><span>{badge.isEarned ? `Earned +${badge.points} bonus points` : `${badge.description} +${badge.points} pts`}</span></div>)}</div>
      </div>)}
    </section>}

    {screen === 'Profiles' && <section><h2>Profiles</h2><ProfileForm addProfile={addProfile} /><ul>{db.profiles.map((p) => <li key={p.id}>{p.name} — {p.role}</li>)}</ul></section>}

    {screen === 'New Discovery' && <section><h2>New Discovery</h2>
      <div className="place-talk"><strong>Place Talk</strong><p>{stats.placeTalk}</p></div>
      <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      {form.category === 'No visible historic trace' && <p className="quiet-note">Quiet observation counts. You can earn points for noticing a place respectfully, even when you do not find obvious history.</p>}
      {SENSITIVE.has(form.category) && <p className="warning">Do not disturb, collect, touch, dig, or publicize this location. Exact GPS will stay private.</p>}
      <fieldset><legend>People credited (required)</legend>{db.profiles.map((p) => <label key={p.id}><input type="checkbox" checked={form.profileIds.includes(p.id)} onChange={(e) => setForm((f) => ({ ...f, profileIds: e.target.checked ? [...f.profileIds, p.id] : f.profileIds.filter((id) => id !== p.id) }))} />{p.name} ({p.role})</label>)}</fieldset>
      <label>Photos (required)<input type="file" accept="image/*" multiple onChange={(e) => { onPhoto(e.target.files); e.target.value = ''; }} /></label>
      <div className="photos">{form.photos.map((p, i) => <div className="photo-edit" key={`${p.slice(0, 24)}-${i}`}><img src={p} alt={`Discovery photo ${i + 1}`} /><button onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_, index) => index !== i) }))}>Remove</button></div>)}</div>
      <button onClick={captureGps}>Capture GPS</button>
      <p>{form.lat && form.lng ? formatGps(Number(form.lat), Number(form.lng)) : 'No GPS yet (required)'}</p>
      <details>
        <summary>Add more details (optional)</summary>
        <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <label>What are you thankful for here?<textarea value={form.gratitude} onChange={(e) => setForm({ ...form, gratitude: e.target.value })} /></label>
        <label>General location name<input value={form.generalLocationName} onChange={(e) => setForm({ ...form, generalLocationName: e.target.value })} /></label>
        <label>Confidence<select value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })}>{CONFIDENCE.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Land access<select value={form.landAccess} onChange={(e) => setForm({ ...form, landAccess: e.target.value })}>{LAND_ACCESS.map((v) => <option key={v}>{v}</option>)}</select></label>
      </details>
      <p className="points-preview">This discovery can earn {entryPoints(form)} quest points.</p>
      <button disabled={!canSave} onClick={createEntry}>Save Discovery</button>
    </section>}

    {screen === 'Journal' && <section><h2>Journal</h2>{sortedEntries.map((e) => <article key={e.id}><button onClick={() => { setSelectedId(e.id); setScreen('Entry Detail'); }}>{new Date(e.createdAt).toLocaleString()} - {e.title} ({entryPoints(e)} pts)</button></article>)}</section>}

    {screen === 'Entry Detail' && selected && <section><h2>{selected.title}</h2><p>{selected.category}</p><p>Quest points: {entryPoints(selected)}</p><p>General location: {selected.generalLocationName || 'Not set'}</p><p>Confidence: {selected.confidence}</p><p>Status: {selected.status}</p><p>Land access: {selected.landAccess}</p><p>{selected.notes || 'No notes.'}</p><p>Gratitude: {selected.gratitude || 'Not added yet.'}</p><p>Credits: {selected.profileIds.map((id) => db.profiles.find((p) => p.id === id)?.name).filter(Boolean).join(', ') || 'None'}</p><div className="photos">{selected.photos.map((p, i) => <img key={i} src={p} alt={`Photo ${i + 1} for ${selected.title}`} />)}</div>
      {SENSITIVE.has(selected.category) && !revealed[selected.id] ? <div><p>Exact GPS hidden (sensitive category).</p>{canRevealSensitive ? <button onMouseDown={() => beginRevealHold(selected.id)} onMouseUp={cancelRevealHold} onMouseLeave={cancelRevealHold} onTouchStart={() => beginRevealHold(selected.id)} onTouchEnd={cancelRevealHold} onTouchCancel={cancelRevealHold} onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); beginRevealHold(selected.id); } }} onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') cancelRevealHold(); }} onBlur={cancelRevealHold}>Hold 2s to reveal (adult only)</button> : <p>Active profile is kid; only approximate location is visible.</p>}</div> : <p>GPS: {formatGps(selected.lat, selected.lng)}</p>}
      <div className="actions">
        <button onClick={() => startEditEntry(selected)}>Edit Entry</button>
        <button onClick={() => { setDb((d) => ({ ...d, entries: d.entries.filter((x) => x.id !== selected.id) })); setScreen('Journal'); setSelectedId(null); }}>Delete Entry</button>
        <label>Change status<select value={selected.status} onChange={(e) => { const status = e.target.value; setDb((d) => ({ ...d, entries: d.entries.map((x) => x.id === selected.id ? { ...x, status } : x) })); }}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Change confidence<select value={selected.confidence} onChange={(e) => { const confidence = e.target.value; setDb((d) => ({ ...d, entries: d.entries.map((x) => x.id === selected.id ? { ...x, confidence } : x) })); }}>{CONFIDENCE.map((c) => <option key={c}>{c}</option>)}</select></label>
        <button onClick={() => { setDb((d) => ({ ...d, entries: d.entries.map((x) => x.id === selected.id ? { ...x, status: 'Reviewed' } : x) })); }}>Mark Reviewed</button>
      </div>
    </section>}

    {screen === 'Edit Entry' && editForm && <section><h2>Edit Entry</h2>
      <label>Category<select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      {editForm.category === 'No visible historic trace' && <p className="quiet-note">Quiet observation counts. You can earn points for noticing a place respectfully, even when you do not find obvious history.</p>}
      {SENSITIVE.has(editForm.category) && <p className="warning">Do not disturb, collect, touch, dig, or publicize this location. Exact GPS will stay private.</p>}
      <label>Title<input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></label>
      <label>Notes<textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></label>
      <label>What are you thankful for here?<textarea value={editForm.gratitude} onChange={(e) => setEditForm({ ...editForm, gratitude: e.target.value })} /></label>
      <label>General location name<input value={editForm.generalLocationName} onChange={(e) => setEditForm({ ...editForm, generalLocationName: e.target.value })} /></label>
      <label>Confidence<select value={editForm.confidence} onChange={(e) => setEditForm({ ...editForm, confidence: e.target.value })}>{CONFIDENCE.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label>Status<select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Land access<select value={editForm.landAccess} onChange={(e) => setEditForm({ ...editForm, landAccess: e.target.value })}>{LAND_ACCESS.map((v) => <option key={v}>{v}</option>)}</select></label>
      <fieldset><legend>People credited</legend>{db.profiles.map((p) => <label key={p.id}><input type="checkbox" checked={editForm.profileIds.includes(p.id)} onChange={(e) => setEditForm((f) => ({ ...f, profileIds: e.target.checked ? [...f.profileIds, p.id] : f.profileIds.filter((id) => id !== p.id) }))} />{p.name} ({p.role})</label>)}</fieldset>
      <label>Add photos<input type="file" accept="image/*" multiple onChange={(e) => { onEditPhoto(e.target.files); e.target.value = ''; }} /></label>
      <div className="photos">{editForm.photos.map((p, i) => <div className="photo-edit" key={`${p.slice(0, 24)}-${i}`}><img src={p} alt={`Photo ${i + 1}`} /><button onClick={() => setEditForm((f) => ({ ...f, photos: f.photos.filter((_, index) => index !== i) }))}>Remove</button></div>)}</div>
      <button onClick={captureEditGps}>Update GPS to Here</button>
      <p>{editForm.lat && editForm.lng ? formatGps(Number(editForm.lat), Number(editForm.lng)) : 'No GPS saved'}</p>
      <div className="actions">
        <button disabled={!editForm.category || editForm.profileIds.length === 0 || editForm.photos.length === 0 || !editForm.lat || !editForm.lng} onClick={saveEditEntry}>Save Changes</button>
        <button onClick={() => { setEditForm(null); setScreen('Entry Detail'); }}>Cancel</button>
      </div>
    </section>}

    {screen === 'Map' && <section><h2>Map</h2><MapContainer center={[39.7392, -104.9903]} zoom={8} style={{ height: '55vh' }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{db.entries.map((e) => {const hidden = SENSITIVE.has(e.category); const lat = hidden ? Math.round(e.lat * 100) / 100 : e.lat; const lng = hidden ? Math.round(e.lng * 100) / 100 : e.lng; return <Marker key={e.id} position={[lat, lng]} icon={icon}><Popup><strong>{e.title}</strong><br />{e.category}<br />{hidden ? 'Approximate location shown' : formatGps(e.lat, e.lng)}</Popup></Marker>;})}</MapContainer></section>}

    {screen === 'Settings' && <section><h2>Settings</h2><p className="warning">Local browser data can be lost if site data/cache is cleared. Export backups regularly.</p><button onClick={() => { if (!window.confirm('Delete all local data? This cannot be undone.')) return; localStorage.removeItem(STORAGE_KEY); setDb(blank); }}>Reset Local Data</button><button onClick={() => exportBackup(db)}>Export Backup</button><label>Import Backup<input type="file" accept="application/json" onChange={(e) => importBackupFile(e.target.files?.[0], db, setDb)} /></label><p>Data stored on this device only.</p></section>}
  </div>;
}

function ProfileForm({ addProfile }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('kid');
  return <div><input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} /><select value={role} onChange={(e) => setRole(e.target.value)}><option value="adult">adult</option><option value="kid">kid</option></select><button onClick={() => { if (name.trim()) { addProfile(name.trim(), role); setName(''); } }}>Add</button></div>;
}
