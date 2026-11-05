import { create } from 'zustand';
import api from '../services/api';
import defaults from '../services/siteDefaults.json';
import { asset } from '../services/assets';
import { applyTheme } from '../services/theme';

const CACHE_KEY = 'nts-site';

export const deepMerge = (base, over) => {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined || over === null ? base : over;
  const out = { ...base };
  if (over && typeof over === 'object') for (const k of Object.keys(over)) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  return out;
};

const cached = () => {
  try { return deepMerge(defaults, JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')); } catch (e) { return defaults; }
};

export const useSiteStore = create((set) => ({
  site: cached(),
  loaded: false,
  load: async () => {
    try {
      const res = await api.get('/settings');
      const site = deepMerge(defaults, res.data);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(site)); } catch (e) { /* storage full / blocked */ }
      applyTheme(site.theme);
      set({ site, loaded: true });
    } catch (e) {
      set({ loaded: true }); // keep defaults / cached copy if the API is unreachable
    }
  },
  setSite: (site) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(site)); } catch (e) { /* ignore */ }
    applyTheme(site.theme);
    set({ site });
  },
}));

// Convenience hook: site settings + helpers that fall back to the built-in default image
export const useSite = () => {
  const site = useSiteStore((s) => s.site);
  const pic = (slot) => asset(site.images?.[slot] || defaults.images[slot]);
  const logo = asset(site.brand?.logoUrl || defaults.brand.logoUrl);
  return { site, asset, pic, logo };
};
