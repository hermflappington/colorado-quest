import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const STORAGE_KEY = 'coquest.v1';
const SENSITIVE = new Set([
  'Possible artifact',
  'Rock art / petroglyph',
  'Sacred or significant place',
  'Fossil-looking object',
]);
const CATEGORIES = [
  'Rock / mineral',
  'Landform',
  'Historic place',
  'Possible artifact',
  'Rock art / petroglyph',
  'Sacred or significant place',
  'Fossil-looking object',
  'Wildlife / track / ecology',
  'Other discovery',
];
const CONFIDENCE = ['Low', 'Medium', 'High', 'Needs expert review'];
const STATUS = ['New', 'Reviewed', 'Needs follow-up', 'Archived'];
const LAND_ACCESS = ['public land', 'private land', 'unknown', 'permitted area', 'trail/roadside'];

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const starterAdult = { id: crypto.randomUUID(), name: 'Adult', role: 'adult' };
const blank = { profiles: [starterAdult], activeProfileId: starterAdult.id, entries: [], safetyAck: false };

const initialForm = {
  title: '', notes: '', category: CATEGORIES[0], profileIds: [], photos: [], lat: '', lng: '',
  confidence: CONFIDENCE[0], status: STATUS[0], generalLocationName: '', landAccess: LAND_ACCESS[2],
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...blank, ...saved };
  } catch {
    return blank;
  }
}

function autoTitle(category, notes, generalLocationName) {
  const loc = generalLocationName.trim();
  if (loc) return `${category} near ${loc}`;
  const n = notes.trim();
  if (!n) return `${category} discovery`;
  return `${category}: ${n.split(/[.!?]/)[0].slice(0, 36)}`;
}

function formatGps(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
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
      const next = { ...currentDb, ...incoming };
      setDb(next);
    } catch {
      alert('Unable to import backup file.');
    }
  };
  reader.readAsText(file);
}

export default function App() {
  const [db, setDb] = useState(load);
  const [screen, setScreen] = useState('Home');
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [form, setForm] = useState(initialForm);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(db)), [db]);

  const sortedEntries = useMemo(() => [...db.entries].sort((a, b) => b.createdAt - a.createdAt), [db.entries]);
  const activeProfile = db.profiles.find((p) => p.id === db.activeProfileId);

  const addProfile = (name, role) => setDb((d) => ({ ...d, profiles: [...d.profiles, { id: crypto.randomUUID(), name, role }] }));

  const canSave = !!form.category && form.profileIds.length > 0 && form.photos.length > 0 && form.lat && form.lng;

  const createEntry = () => {
    const title = form.title.trim() || autoTitle(form.category, form.notes, form.generalLocationName);
    const entry = { ...form, id: crypto.randomUUID(), title, createdAt: Date.now(), lat: Number(form.lat), lng: Number(form.lng) };
    setDb((d) => ({ ...d, entries: [entry, ...d.entries] }));
    setForm(initialForm);
    setScreen('Journal');
  };

  const captureGps = () => navigator.geolocation.getCurrentPosition((p) => {
    setForm((f) => ({ ...f, lat: p.coords.latitude, lng: p.coords.longitude }));
  });

  const onPhoto = async (files) => {
    const next = [];
    for (const file of files) {
      const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
      next.push(data);
    }
    setForm((f) => ({ ...f, photos: [...f.photos, ...next] }));
  };

  const canRevealSensitive = activeProfile?.role === 'adult';
  const [holdTimer, setHoldTimer] = useState(null);
  const beginRevealHold = (id) => {
    if (!canRevealSensitive) return;
    const timer = setTimeout(() => setRevealed((r) => ({ ...r, [id]: true })), 2000);
    setHoldTimer(timer);
  };
  const cancelRevealHold = () => {
    if (holdTimer) clearTimeout(holdTimer);
    setHoldTimer(null);
  };

  if (!db.safetyAck) {
    return <div className="shell"><h1>Colorado Quest Safety</h1><p>Observe. Photograph. Document. Leave undisturbed.</p><ul><li>Do not collect.</li><li>Do not dig.</li><li>Do not touch rock art.</li><li>Do not disturb sites.</li><li>Do not trespass.</li><li>Do not publicize sensitive locations.</li></ul><p>Colorado Quest records observations and does not confirm archaeological, geological, fossil, historical, or cultural identification.</p><button onClick={() => setDb((d) => ({ ...d, safetyAck: true }))}>I Acknowledge</button></div>;
  }

  return <div className="shell">
    <header>
      <h1>Colorado Quest</h1>
      <label>Active profile
        <select value={db.activeProfileId} onChange={(e) => setDb((d) => ({ ...d, activeProfileId: e.target.value }))}>
          {db.profiles.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
        </select>
      </label>
      <nav>{['Home', 'New Discovery', 'Journal', 'Map', 'Profiles', 'Settings'].map((s) => <button key={s} onClick={() => setScreen(s)}>{s}</button>)}</nav>
    </header>

    {screen === 'Home' && <section><h2>Field Journal MVP</h2><p>Local-only family journal for discoveries.</p><p>{db.entries.length} discoveries logged</p></section>}

    {screen === 'Profiles' && <section><h2>Profiles</h2><ProfileForm addProfile={addProfile} /><ul>{db.profiles.map((p) => <li key={p.id}>{p.name} — {p.role}</li>)}</ul></section>}

    {screen === 'New Discovery' && <section><h2>New Discovery</h2>
      <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      {SENSITIVE.has(form.category) && <p className="warning">Do not disturb, collect, touch, dig, or publicize this location. Exact GPS will stay private.</p>}
      <label>Title (optional)<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label>Notes (optional)<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      <label>General location name<input value={form.generalLocationName} onChange={(e) => setForm({ ...form, generalLocationName: e.target.value })} /></label>
      <label>Confidence<select value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })}>{CONFIDENCE.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Land access<select value={form.landAccess} onChange={(e) => setForm({ ...form, landAccess: e.target.value })}>{LAND_ACCESS.map((v) => <option key={v}>{v}</option>)}</select></label>
      <fieldset><legend>People credited (required)</legend>{db.profiles.map((p) => <label key={p.id}><input type="checkbox" checked={form.profileIds.includes(p.id)} onChange={(e) => setForm((f) => ({ ...f, profileIds: e.target.checked ? [...f.profileIds, p.id] : f.profileIds.filter((id) => id !== p.id) }))} />{p.name} ({p.role})</label>)}</fieldset>
      <label>Photos (required)<input type="file" accept="image/*" multiple onChange={(e) => onPhoto(e.target.files)} /></label>
      <div className="photos">{form.photos.map((p, i) => <img key={i} src={p} alt="discovery" />)}</div>
      <button onClick={captureGps}>Capture GPS</button>
      <p>{form.lat && form.lng ? formatGps(Number(form.lat), Number(form.lng)) : 'No GPS yet (required)'}</p>
      <button disabled={!canSave} onClick={createEntry}>Save Discovery</button>
    </section>}

    {screen === 'Journal' && <section><h2>Journal</h2>{sortedEntries.map((e) => <article key={e.id}><button onClick={() => { setSelected(e); setScreen('Entry Detail'); }}>{new Date(e.createdAt).toLocaleString()} — {e.title}</button></article>)}</section>}

    {screen === 'Entry Detail' && selected && <section><h2>{selected.title}</h2><p>{selected.category}</p><p>General location: {selected.generalLocationName || 'Not set'}</p><p>Confidence: {selected.confidence}</p><p>Status: {selected.status}</p><p>Land access: {selected.landAccess}</p><p>{selected.notes || 'No notes.'}</p><p>Credits: {selected.profileIds.map((id) => db.profiles.find((p) => p.id === id)?.name).filter(Boolean).join(', ') || 'None'}</p><div className="photos">{selected.photos.map((p, i) => <img key={i} src={p} alt="entry" />)}</div>
      {SENSITIVE.has(selected.category) && !revealed[selected.id] ? <div><p>Exact GPS hidden (sensitive category).</p>{canRevealSensitive ? <button onMouseDown={() => beginRevealHold(selected.id)} onMouseUp={cancelRevealHold} onMouseLeave={cancelRevealHold} onTouchStart={() => beginRevealHold(selected.id)} onTouchEnd={cancelRevealHold} onTouchCancel={cancelRevealHold}>Hold 2s to reveal (adult only)</button> : <p>Active profile is kid; only approximate location is visible.</p>}</div> : <p>GPS: {formatGps(selected.lat, selected.lng)}</p>}
      <div className="actions">
        <button onClick={() => { setDb((d) => ({ ...d, entries: d.entries.filter((x) => x.id !== selected.id) })); setScreen('Journal'); setSelected(null); }}>Delete Entry</button>
        <label>Change status<select value={selected.status} onChange={(e) => { const status = e.target.value; setSelected((v) => ({ ...v, status })); setDb((d) => ({ ...d, entries: d.entries.map((x) => x.id === selected.id ? { ...x, status } : x) })); }} >{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Change confidence<select value={selected.confidence} onChange={(e) => { const confidence = e.target.value; setSelected((v) => ({ ...v, confidence })); setDb((d) => ({ ...d, entries: d.entries.map((x) => x.id === selected.id ? { ...x, confidence } : x) })); }} >{CONFIDENCE.map((c) => <option key={c}>{c}</option>)}</select></label>
        <button onClick={() => { const status = 'Reviewed'; setSelected((v) => ({ ...v, status })); setDb((d) => ({ ...d, entries: d.entries.map((x) => x.id === selected.id ? { ...x, status } : x) })); }}>Mark Reviewed</button>
      </div>
    </section>}

    {screen === 'Map' && <section><h2>Map</h2><MapContainer center={[39.7392, -104.9903]} zoom={8} style={{ height: '55vh' }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{db.entries.map((e) => {const hidden = SENSITIVE.has(e.category); const lat = hidden ? Math.round(e.lat * 100) / 100 : e.lat; const lng = hidden ? Math.round(e.lng * 100) / 100 : e.lng; return <Marker key={e.id} position={[lat, lng]} icon={icon}><Popup><strong>{e.title}</strong><br />{e.category}<br />{hidden ? 'Approximate location shown' : formatGps(e.lat, e.lng)}</Popup></Marker>;})}</MapContainer></section>}

    {screen === 'Settings' && <section><h2>Settings</h2><p className="warning">Local browser data can be lost if site data/cache is cleared. Export backups regularly.</p><button onClick={() => { localStorage.removeItem(STORAGE_KEY); setDb(blank); }}>Reset Local Data</button><button onClick={() => exportBackup(db)}>Export Backup</button><label>Import Backup<input type="file" accept="application/json" onChange={(e) => importBackupFile(e.target.files?.[0], db, setDb)} /></label><p>Data stored on this device only.</p></section>}
  </div>;
}

function ProfileForm({ addProfile }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('kid');
  return <div><input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} /><select value={role} onChange={(e) => setRole(e.target.value)}><option value="adult">adult</option><option value="kid">kid</option></select><button onClick={() => { if (name.trim()) { addProfile(name.trim(), role); setName(''); } }}>Add</button></div>;
}
