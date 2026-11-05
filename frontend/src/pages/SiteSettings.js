import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FaPalette, FaImage, FaImages, FaBullhorn, FaVideo, FaShareAlt, FaFont, FaSlidersH,
  FaPlus, FaTrash, FaArrowUp, FaArrowDown, FaSave, FaUndo, FaArrowLeft, FaEye, FaBars, FaThLarge, FaUserLock, FaLifeRing, FaCode, FaMagic,
} from 'react-icons/fa';
import api from '../services/api';
import defaults from '../services/siteDefaults.json';
import MediaField from '../components/MediaField';
import { useSiteStore, deepMerge } from '../store/siteStore';
import { MENU, ALL_ROLES, CUSTOM_ICONS } from '../services/menu';

const SECTIONS = [
  { id: 'brand', label: 'Branding & colours', icon: FaPalette },
  { id: 'images', label: 'Page images', icon: FaImage },
  { id: 'auth', label: 'Login slideshow', icon: FaSlidersH },
  { id: 'promo', label: 'Promotions (ads)', icon: FaBullhorn },
  { id: 'gallery', label: 'Gallery', icon: FaImages },
  { id: 'videos', label: 'Videos', icon: FaVideo },
  { id: 'social', label: 'Social media & contact', icon: FaShareAlt },
  { id: 'texts', label: 'Welcome page texts', icon: FaFont },
  { id: 'style', label: 'Layout & style', icon: FaMagic },
  { id: 'menu', label: 'Menu & pages', icon: FaBars },
  { id: 'widgets', label: 'Dashboard widgets', icon: FaThLarge },
  { id: 'access', label: 'Registration access', icon: FaUserLock },
  { id: 'help', label: 'Help centre (FAQ)', icon: FaLifeRing },
  { id: 'css', label: 'Advanced CSS', icon: FaCode },
];

const IMAGE_SLOTS = [
  ['welcomeHero', 'Welcome page: main hero'],
  ['welcomeStory', 'Welcome page: "How it works" photo'],
  ['welcomeCta', 'Welcome page: bottom call-to-action background'],
  ['dashboardHero', 'Student / trainer dashboard banner'],
  ['dashboardAdminHero', 'Admin dashboard banner'],
  ['coursesHero', 'Courses page banner'],
  ['internshipsHero', 'Internships page banner'],
  ['learningHero', 'Learning Studio banner'],
  ['communityHero', 'Community banner'],
  ['profileCover', 'Profile cover'],
  ['adminHero', 'Admin panel banner'],
  ['verificationHero', 'Student verification banner'],
  ['libraryHero', 'Library banner'],
  ['bankHero', 'Question Bank banner'],
  ['helpHero', 'Help & Support banner'],
  ['usersHero', 'Users management banner'],
];

const PALETTES = [
  ['NTS Blue', '#18378a', '#f2b01e'], ['Forest', '#166534', '#f59e0b'], ['Royal Purple', '#5b21b6', '#f59e0b'],
  ['Crimson', '#9f1239', '#facc15'], ['Teal', '#0f766e', '#f97316'], ['Slate', '#334155', '#38bdf8'],
];

const Check = ({ label, checked, onChange, hint }) => (
  <label className="flex items-start gap-3 py-2">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-blue-700" />
    <span><span className="block text-sm font-semibold text-gray-700">{label}</span>{hint && <span className="block text-xs text-gray-400">{hint}</span>}</span>
  </label>
);

const Select = ({ label, value, onChange, options }) => (
  <label className="block mb-3">
    <span className="text-sm font-semibold text-gray-700">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </label>
);

// role checkboxes stored as "ADMIN,TRAINER"
const RoleChecks = ({ value, onChange }) => {
  const list = String(value || '').split(',').filter(Boolean);
  const toggle = (r) => onChange((list.includes(r) ? list.filter((x) => x !== r) : [...list, r]).join(','));
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_ROLES.map((r) => (
        <button key={r} type="button" onClick={() => toggle(r)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${list.includes(r) ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500'}`}>{r.charAt(0) + r.slice(1).toLowerCase()}</button>
      ))}
    </div>
  );
};

// Every menu item: show/hide, rename, move, choose which roles see it.
const MenuEditor = ({ items, onChange }) => {
  const rows = useMemo(() => {
    const by = new Map(items.map((o, i) => [o.id, { o, i }]));
    return MENU.map((m, k) => ({ m, o: by.get(m.id)?.o, rank: by.has(m.id) ? by.get(m.id).i : 1000 + k }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ m, o }) => ({ id: m.id, def: m.label, label: (o && o.label) || '', visible: o ? o.visible !== false : true, roles: (o && o.roles) || m.roles.join(',') }));
  }, [items]);
  const commit = (next) => onChange(next.map(({ id, label, visible, roles }) => ({ id, label, visible, roles })));
  const patch = (i, ch) => commit(rows.map((r, k) => (k === i ? { ...r, ...ch } : r)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= rows.length) return; const c = [...rows]; [c[i], c[j]] = [c[j], c[i]]; commit(c); };
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.id} className={`border rounded-xl p-3 ${r.visible ? 'bg-white' : 'bg-gray-50 opacity-70'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <input type="checkbox" checked={r.visible} onChange={(e) => patch(i, { visible: e.target.checked })} className="h-4 w-4 accent-blue-700" aria-label={`Show ${r.def}`} />
            <input value={r.label} onChange={(e) => patch(i, { label: e.target.value })} placeholder={r.def} className="flex-1 min-w-[140px] px-3 py-1.5 border rounded-lg text-sm" />
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-2 rounded hover:bg-gray-100 disabled:opacity-30" aria-label="Move up"><FaArrowUp size={12} /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="p-2 rounded hover:bg-gray-100 disabled:opacity-30" aria-label="Move down"><FaArrowDown size={12} /></button>
          </div>
          <div className="mt-2"><RoleChecks value={r.roles} onChange={(v) => patch(i, { roles: v })} /></div>
        </div>
      ))}
    </div>
  );
};


// immutable set by path: set(obj, 'a.b.c', value)
const setIn = (obj, path, value) => {
  const keys = path.split('.');
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = copy;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value;
    else { cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...cur[k] }; cur = cur[k]; }
  });
  return copy;
};

const Card = ({ title, desc, children }) => (
  <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 mb-5">
    {title && <h2 className="text-lg font-bold text-nts-green-900">{title}</h2>}
    {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
    <div className={title ? 'mt-4' : ''}>{children}</div>
  </section>
);

const Text = ({ label, value, onChange, placeholder, multiline, type = 'text', hint }) => (
  <label className="block mb-3">
    <span className="text-sm font-semibold text-gray-700">{label}</span>
    {multiline
      ? <textarea rows={3} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-nts-green-500 outline-none" />
      : <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-nts-green-500 outline-none" />}
    {hint && <span className="text-xs text-gray-400">{hint}</span>}
  </label>
);

const ColorField = ({ label, value, onChange }) => (
  <label className="block mb-3">
    <span className="text-sm font-semibold text-gray-700">{label}</span>
    <div className="mt-1 flex items-center gap-3">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-32 px-3 py-2 border rounded-lg text-sm font-mono" />
    </div>
  </label>
);

// Generic add / remove / reorder list
const ListEditor = ({ items, onChange, newItem, addLabel, max = 30, children }) => {
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-nts-green-700">#{i + 1}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-2 rounded hover:bg-gray-200 disabled:opacity-30" aria-label="Move up"><FaArrowUp size={12} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-2 rounded hover:bg-gray-200 disabled:opacity-30" aria-label="Move down"><FaArrowDown size={12} /></button>
              <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} className="p-2 rounded hover:bg-red-100 text-red-600" aria-label="Remove"><FaTrash size={12} /></button>
            </div>
          </div>
          {children(item, (next) => onChange(items.map((x, k) => (k === i ? next : x))), i)}
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, newItem()])} className="px-4 py-2 rounded-lg bg-nts-green-700 text-white text-sm font-bold flex items-center gap-2 hover:bg-nts-green-800">
          <FaPlus size={12} /> {addLabel}
        </button>
      )}
    </div>
  );
};

export default function SiteSettings() {
  const { site, setSite } = useSiteStore();
  const [draft, setDraft] = useState(site);
  const [section, setSection] = useState('brand');
  const [saving, setSaving] = useState(false);
  const [fresh, setFresh] = useState(false);

  // Always start from the server copy (another admin may have changed it)
  useEffect(() => {
    api.get('/settings').then((r) => { const s = deepMerge(defaults, r.data); setDraft(s); setSite(s); }).catch(() => {}).finally(() => setFresh(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(site), [draft, site]);
  const set = (path, value) => setDraft((d) => setIn(d, path, value));

  // warn before leaving with unsaved edits
  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put('/settings', { settings: draft });
      const s = deepMerge(defaults, r.data);
      setSite(s);
      setDraft(s);
      toast.success('Saved. The whole system now uses these settings.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetAll = async () => {
    if (!window.confirm('Reset logo, images, videos, texts and colours to the original NTS defaults? This cannot be undone.')) return;
    try {
      await api.post('/settings/reset');
      const s = deepMerge(defaults, {});
      setSite(s);
      setDraft(s);
      toast.success('Everything is back to the defaults');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Reset failed');
    }
  };

  const d = draft;
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <Link to="/admin" className="text-sm text-nts-green-700 font-semibold flex items-center gap-1.5 hover:underline"><FaArrowLeft size={11} /> Admin panel</Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-nts-green-900 mt-1">Site settings</h1>
          <p className="text-sm text-gray-500">Change the logo, colours, images, videos, social media and texts of the whole system.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/welcome" target="_blank" className="px-4 py-2 rounded-lg bg-white border text-sm font-bold text-gray-700 flex items-center gap-2 hover:bg-gray-50"><FaEye /> Preview welcome page</Link>
          <button onClick={resetAll} className="px-4 py-2 rounded-lg bg-white border border-red-200 text-red-600 text-sm font-bold flex items-center gap-2 hover:bg-red-50"><FaUndo /> Reset all</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[250px_1fr] gap-6">
        <nav className="lg:sticky lg:top-20 self-start bg-white rounded-2xl shadow-sm border border-gray-100 p-2 flex lg:flex-col gap-1 overflow-x-auto">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setSection(id)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition ${section === id ? 'bg-nts-green-700 text-white' : 'text-gray-600 hover:bg-nts-green-50'}`}>
              <Icon /> {label}
            </button>
          ))}
        </nav>

        <div>
          {!fresh && <p className="text-sm text-gray-400 mb-3">Loading current settings…</p>}

          {section === 'brand' && (
            <>
              <Card title="Logo & identity" desc="The logo appears in the menu bar, login pages, welcome page and as the browser icon.">
                <div className="grid md:grid-cols-2 gap-x-4">
                  <Text label="Organisation name" value={d.brand.name} onChange={(v) => set('brand.name', v)} />
                  <Text label="Short name" value={d.brand.shortName} onChange={(v) => set('brand.shortName', v)} hint="Shown in the browser tab" />
                  <Text label="Tagline" value={d.brand.tagline} onChange={(v) => set('brand.tagline', v)} />
                  <Text label="Slogan" value={d.brand.slogan} onChange={(v) => set('brand.slogan', v)} />
                </div>
                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  <MediaField label="Logo" value={d.brand.logoUrl} defaultValue={defaults.brand.logoUrl} onChange={(v) => set('brand.logoUrl', v)} hint="PNG with transparent background works best." />
                  <MediaField label="Browser icon (favicon)" value={d.brand.faviconUrl} defaultValue={defaults.brand.faviconUrl} onChange={(v) => set('brand.faviconUrl', v)} hint="Small square image." />
                </div>
              </Card>
              <Card title="Colours" desc="Two colours restyle buttons, banners, menus and headings across the entire system.">
                <div className="flex flex-wrap gap-8">
                  <ColorField label="Main colour" value={d.theme.primary} onChange={(v) => set('theme.primary', v)} />
                  <ColorField label="Accent colour" value={d.theme.accent} onChange={(v) => set('theme.accent', v)} />
                </div>
                <div className="flex gap-2 mt-2 items-center flex-wrap">
                  <span className="text-xs text-gray-500">Preview:</span>
                  <span className="px-4 py-2 rounded-lg text-white text-sm font-bold" style={{ background: d.theme.primary }}>Main</span>
                  <span className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: d.theme.accent }}>Accent</span>
                  <button type="button" onClick={() => setDraft((x) => setIn(setIn(x, 'theme.primary', defaults.theme.primary), 'theme.accent', defaults.theme.accent))} className="text-xs font-bold text-nts-green-700 underline ml-2">Use NTS colours</button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Colours are applied to the whole site after you press Save.</p>
              </Card>
              <Card title="Announcement bar" desc="A notice shown at the bottom of every page (events, new courses, deadlines).">
                <label className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
                  <input type="checkbox" checked={!!d.announcement.enabled} onChange={(e) => set('announcement.enabled', e.target.checked)} className="w-4 h-4" /> Show the announcement
                </label>
                <Text label="Message" value={d.announcement.text} onChange={(v) => set('announcement.text', v)} placeholder="New courses start on Monday!" />
                <Text label="Link (optional)" value={d.announcement.link} onChange={(v) => set('announcement.link', v)} placeholder="/courses or https://…" />
              </Card>
            </>
          )}

          {section === 'images' && (
            <Card title="Page images" desc="Each banner of the system can have its own image. Upload a new file, paste a link or pick one from the library.">
              <div className="grid xl:grid-cols-2 gap-4">
                {IMAGE_SLOTS.map(([key, label]) => (
                  <MediaField key={key} label={label} value={d.images[key]} defaultValue={defaults.images[key]} onChange={(v) => set(`images.${key}`, v)} />
                ))}
              </div>
            </Card>
          )}

          {section === 'auth' && (
            <Card title="Login / Register slideshow" desc="Images and captions rotating beside the login, register, verify and password-reset forms.">
              <ListEditor items={d.authSlides} onChange={(v) => set('authSlides', v)} addLabel="Add slide" newItem={() => ({ image: '', title: '', subtitle: '' })}>
                {(item, update) => (
                  <>
                    <MediaField value={item.image} onChange={(v) => update({ ...item, image: v })} />
                    <div className="grid md:grid-cols-2 gap-x-4 mt-3">
                      <Text label="Title" value={item.title} onChange={(v) => update({ ...item, title: v })} />
                      <Text label="Subtitle" value={item.subtitle} onChange={(v) => update({ ...item, subtitle: v })} />
                    </div>
                  </>
                )}
              </ListEditor>
            </Card>
          )}

          {section === 'promo' && (
            <Card title="Promotions (ads)" desc="Rotating banners on the dashboard and feed. Use them for courses, events, partners or sponsors.">
              <ListEditor items={d.promoSlides} onChange={(v) => set('promoSlides', v)} addLabel="Add promotion" newItem={() => ({ image: '', tag: '', title: '', text: '', to: '', cta: '', active: true })}>
                {(item, update) => (
                  <>
                    <MediaField value={item.image} onChange={(v) => update({ ...item, image: v })} />
                    <div className="grid md:grid-cols-2 gap-x-4 mt-3">
                      <Text label="Label (small badge)" value={item.tag} onChange={(v) => update({ ...item, tag: v })} placeholder="Online Courses" />
                      <Text label="Headline" value={item.title} onChange={(v) => update({ ...item, title: v })} />
                      <Text label="Short text" value={item.text} onChange={(v) => update({ ...item, text: v })} />
                      <Text label="Button text" value={item.cta} onChange={(v) => update({ ...item, cta: v })} placeholder="Learn more" />
                      <Text label="Button link" value={item.to} onChange={(v) => update({ ...item, to: v })} placeholder="/courses or https://…" />
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mt-6">
                        <input type="checkbox" checked={item.active !== false} onChange={(e) => update({ ...item, active: e.target.checked })} className="w-4 h-4" /> Visible
                      </label>
                    </div>
                  </>
                )}
              </ListEditor>
            </Card>
          )}

          {section === 'gallery' && (
            <Card title="Welcome page gallery" desc="Photos shown in the “Life at NTS” section. The first photo is displayed larger.">
              <ListEditor items={d.gallery} onChange={(v) => set('gallery', v)} addLabel="Add photo" newItem={() => ''}>
                {(item, update) => <MediaField value={item} onChange={update} />}
              </ListEditor>
            </Card>
          )}

          {section === 'videos' && (
            <Card title="Videos" desc="Paste a YouTube or Vimeo link, a direct video link, or upload an MP4/WEBM file. They appear on the welcome page and on every user's dashboard.">
              <ListEditor items={d.videos} onChange={(v) => set('videos', v)} addLabel="Add video" newItem={() => ({ title: '', url: '', description: '' })}>
                {(item, update) => (
                  <>
                    <Text label="Title" value={item.title} onChange={(v) => update({ ...item, title: v })} />
                    <MediaField kind="video" label="Video" value={item.url} onChange={(v) => update({ ...item, url: v })} hint="Example: https://www.youtube.com/watch?v=…" />
                    <div className="mt-3"><Text label="Description (optional)" value={item.description} onChange={(v) => update({ ...item, description: v })} multiline /></div>
                  </>
                )}
              </ListEditor>
              {!d.videos.length && <p className="text-sm text-gray-400 mt-3">No videos yet — the video section stays hidden until you add one.</p>}
            </Card>
          )}

          {section === 'social' && (
            <>
              <Card title="Social media" desc="Only the links you fill in are shown (welcome page footer and every page footer).">
                <div className="grid md:grid-cols-2 gap-x-4">
                  <Text label="Facebook" value={d.social.facebook} onChange={(v) => set('social.facebook', v)} placeholder="https://facebook.com/…" />
                  <Text label="Instagram" value={d.social.instagram} onChange={(v) => set('social.instagram', v)} placeholder="https://instagram.com/…" />
                  <Text label="Twitter / X" value={d.social.twitter} onChange={(v) => set('social.twitter', v)} placeholder="https://x.com/…" />
                  <Text label="YouTube" value={d.social.youtube} onChange={(v) => set('social.youtube', v)} placeholder="https://youtube.com/@…" />
                  <Text label="LinkedIn" value={d.social.linkedin} onChange={(v) => set('social.linkedin', v)} placeholder="https://linkedin.com/company/…" />
                  <Text label="TikTok" value={d.social.tiktok} onChange={(v) => set('social.tiktok', v)} placeholder="https://tiktok.com/@…" />
                  <Text label="WhatsApp" value={d.social.whatsapp} onChange={(v) => set('social.whatsapp', v)} placeholder="250788123456 or link" hint="A phone number with country code, or a WhatsApp link" />
                  <Text label="Website" value={d.social.website} onChange={(v) => set('social.website', v)} placeholder="https://…" />
                </div>
              </Card>
              <Card title="Contact & footer">
                <div className="grid md:grid-cols-2 gap-x-4">
                  <Text label="Email" value={d.contact.email} onChange={(v) => set('contact.email', v)} />
                  <Text label="Phone" value={d.contact.phone} onChange={(v) => set('contact.phone', v)} />
                </div>
                <Text label="Address" value={d.contact.address} onChange={(v) => set('contact.address', v)} />
                <Text label="Footer text" value={d.footer.text} onChange={(v) => set('footer.text', v)} placeholder="© 2026 Nezerwa Tech Solution. All rights reserved." hint="Leave empty to use the default copyright line." />
              </Card>
            </>
          )}

          {section === 'texts' && (
            <Card title="Welcome page texts" desc="The words visitors read first.">
              <Text label="Badge" value={d.welcome.badge} onChange={(v) => set('welcome.badge', v)} />
              <div className="grid md:grid-cols-2 gap-x-4">
                <Text label="Headline" value={d.welcome.headline} onChange={(v) => set('welcome.headline', v)} />
                <Text label="Highlighted words (gold)" value={d.welcome.headlineAccent} onChange={(v) => set('welcome.headlineAccent', v)} />
              </div>
              <Text label="Introduction" value={d.welcome.subtitle} onChange={(v) => set('welcome.subtitle', v)} multiline />
              <div className="grid md:grid-cols-2 gap-x-4">
                <Text label="Main button" value={d.welcome.primaryCta} onChange={(v) => set('welcome.primaryCta', v)} />
                <Text label="Second button" value={d.welcome.secondaryCta} onChange={(v) => set('welcome.secondaryCta', v)} />
              </div>
              <Text label="Videos section title" value={d.welcome.videosTitle} onChange={(v) => set('welcome.videosTitle', v)} />
              <Text label="Bottom section title" value={d.welcome.ctaTitle} onChange={(v) => set('welcome.ctaTitle', v)} />
              <Text label="Bottom section text" value={d.welcome.ctaText} onChange={(v) => set('welcome.ctaText', v)} />
            </Card>
          )}

          {section === 'style' && (
            <>
              <Card title="Colour theme" desc="Pick a ready palette or choose your own colours in Branding & colours.">
                <div className="flex flex-wrap gap-3">
                  {PALETTES.map(([name, p, a]) => (
                    <button key={name} type="button" onClick={() => { set('theme.primary', p); set('theme.accent', a); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold ${d.theme.primary === p ? 'ring-2 ring-blue-600' : ''}`}>
                      <span className="h-5 w-5 rounded-full" style={{ background: p }} /><span className="h-5 w-5 rounded-full" style={{ background: a }} />{name}
                    </button>
                  ))}
                </div>
              </Card>
              <Card title="Look & feel">
                <div className="grid md:grid-cols-3 gap-x-4">
                  <Select label="Font" value={d.system.font} onChange={(v) => set('system.font', v)} options={[['system', 'Modern (default)'], ['humanist', 'Humanist'], ['rounded', 'Rounded'], ['serif', 'Classic serif'], ['mono', 'Technical mono']]} />
                  <Select label="Corners" value={d.system.radius} onChange={(v) => set('system.radius', v)} options={[['round', 'Round (default)'], ['soft', 'Soft'], ['sharp', 'Sharp']]} />
                  <Select label="Sidebar style" value={d.system.sidebar} onChange={(v) => set('system.sidebar', v)} options={[['navy', 'Navy blue (default)'], ['brand', 'Follow brand colour'], ['dark', 'Dark'], ['light', 'Light']]} />
                </div>
                <Check label="Start in dark mode" checked={d.system.defaultDark} onChange={(v) => set('system.defaultDark', v)} hint="Only for people who have not chosen light/dark themselves." />
                <Check label="Show the promo card at the bottom of the sidebar" checked={d.system.sidebarPromo} onChange={(v) => set('system.sidebarPromo', v)} />
                <div className="grid md:grid-cols-2 gap-x-4">
                  <Text label="Sidebar card: first line" value={d.system.sidebarPromoTitle} onChange={(v) => set('system.sidebarPromoTitle', v)} />
                  <Text label="Sidebar card: highlighted line" value={d.system.sidebarPromoAccent} onChange={(v) => set('system.sidebarPromoAccent', v)} />
                </div>
              </Card>
            </>
          )}

          {section === 'menu' && (
            <>
              <Card title="Menu items" desc="Tick to show, rename, move up/down, and choose which roles see each page. Leave the name empty to keep the default.">
                <MenuEditor items={d.menu.items} onChange={(v) => set('menu.items', v)} />
              </Card>
              <Card title="Custom links" desc="Add your own links to the menu (a page inside the system like /library, or a website).">
                <ListEditor items={d.menu.custom} onChange={(v) => set('menu.custom', v)} newItem={() => ({ label: '', to: '/', icon: 'link', roles: ALL_ROLES.join(','), newTab: false })} addLabel="Add link" max={15}>
                  {(item, upd) => (
                    <>
                      <div className="grid md:grid-cols-3 gap-x-4">
                        <Text label="Name" value={item.label} onChange={(v) => upd({ ...item, label: v })} />
                        <Text label="Address" value={item.to} onChange={(v) => upd({ ...item, to: v })} placeholder="/library or https://…" />
                        <Select label="Icon" value={item.icon} onChange={(v) => upd({ ...item, icon: v })} options={Object.keys(CUSTOM_ICONS).map((k) => [k, k])} />
                      </div>
                      <RoleChecks value={item.roles} onChange={(v) => upd({ ...item, roles: v })} />
                      <Check label="Open in a new tab" checked={item.newTab} onChange={(v) => upd({ ...item, newTab: v })} />
                    </>
                  )}
                </ListEditor>
              </Card>
            </>
          )}

          {section === 'widgets' && (
            <Card title="Dashboard widgets" desc="Choose what appears on every dashboard.">
              <Check label="Welcome banner" checked={d.widgets.heroBanner} onChange={(v) => set('widgets.heroBanner', v)} />
              <Check label="Announcements" checked={d.widgets.announcements} onChange={(v) => set('widgets.announcements', v)} />
              <Check label="Quick actions" checked={d.widgets.quickActions} onChange={(v) => set('widgets.quickActions', v)} />
              <Check label="Promotion banners (ads)" checked={d.widgets.promo} onChange={(v) => set('widgets.promo', v)} />
              <Check label="Videos (Watch and learn)" checked={d.widgets.videos} onChange={(v) => set('widgets.videos', v)} />
            </Card>
          )}

          {section === 'access' && (
            <Card title="Who can register" desc="Closed account types disappear from the Register page and the server refuses them. Admin can still create any account in Users & Management.">
              <Check label="Students" checked={d.system.allowStudentSignup} onChange={(v) => set('system.allowStudentSignup', v)} />
              <Check label="Parents" checked={d.system.allowParentSignup} onChange={(v) => set('system.allowParentSignup', v)} />
              <Check label="Employers" checked={d.system.allowEmployerSignup} onChange={(v) => set('system.allowEmployerSignup', v)} />
              <Check label="Guests" checked={d.system.allowGuestSignup} onChange={(v) => set('system.allowGuestSignup', v)} />
            </Card>
          )}

          {section === 'help' && (
            <Card title="Help centre" desc="The Help & Support page shows these questions. Leave roles empty to show a question to everyone.">
              <Text label="Page title" value={d.help.title} onChange={(v) => set('help.title', v)} />
              <Text label="Intro line" value={d.help.intro} onChange={(v) => set('help.intro', v)} />
              <ListEditor items={d.help.faqs} onChange={(v) => set('help.faqs', v)} newItem={() => ({ q: '', a: '', roles: '' })} addLabel="Add question" max={50}>
                {(item, upd) => (
                  <>
                    <Text label="Question" value={item.q} onChange={(v) => upd({ ...item, q: v })} />
                    <Text label="Answer" value={item.a} onChange={(v) => upd({ ...item, a: v })} multiline />
                    <RoleChecks value={item.roles} onChange={(v) => upd({ ...item, roles: v })} />
                  </>
                )}
              </ListEditor>
            </Card>
          )}

          {section === 'css' && (
            <Card title="Advanced CSS" desc="For admins who know CSS: styles added here apply to the whole system. @import and scripts are removed for safety. Max 8000 characters.">
              <textarea rows={14} value={d.system.customCss} onChange={(e) => set('system.customCss', e.target.value)} spellCheck={false} placeholder={'/* example */\n.rounded-2xl { box-shadow: 0 6px 18px rgba(0,0,0,.08); }'} className="w-full px-3 py-2 border rounded-lg text-xs font-mono" />
            </Card>
          )}
        </div>
      </div>

      {/* Save bar */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t shadow-[0_-4px_14px_rgba(0,0,0,.08)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <p className={`text-sm font-semibold ${dirty ? 'text-nts-gold-700' : 'text-gray-400'}`}>{dirty ? '● You have unsaved changes' : 'All changes saved'}</p>
          <div className="flex gap-2">
            {dirty && <button onClick={() => setDraft(site)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-bold">Discard</button>}
            <button onClick={save} disabled={!dirty || saving} className="px-6 py-2 rounded-lg bg-nts-green-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50 hover:bg-nts-green-800">
              <FaSave /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
