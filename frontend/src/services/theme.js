// Builds the brand colour scales from the two colours chosen in Site Settings
// and writes them as CSS variables (see tailwind.config.js and index.css).
const hexToRgb = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (c, t, a) => c.map((v, i) => Math.round(v * (1 - a) + t[i] * a));
const W = [255, 255, 255];
const K = [0, 0, 0];

export const primaryScale = (hex) => {
  const c = hexToRgb(hex);
  if (!c) return null;
  return { 50: mix(c, W, 0.93), 100: mix(c, W, 0.85), 200: mix(c, W, 0.7), 300: mix(c, W, 0.52), 400: mix(c, W, 0.32), 500: mix(c, W, 0.17), 600: mix(c, W, 0.07), 700: c, 800: mix(c, K, 0.25), 900: mix(c, K, 0.5), 950: mix(c, K, 0.68) };
};
export const accentScale = (hex) => {
  const c = hexToRgb(hex);
  if (!c) return null;
  return { 50: mix(c, W, 0.92), 100: mix(c, W, 0.82), 200: mix(c, W, 0.65), 300: mix(c, W, 0.45), 400: mix(c, W, 0.22), 500: c, 600: mix(c, K, 0.12), 700: mix(c, K, 0.28), 800: mix(c, K, 0.42), 900: mix(c, K, 0.55) };
};

export function applyTheme(theme = {}) {
  const root = document.documentElement;
  const p = primaryScale(theme.primary);
  const a = accentScale(theme.accent);
  if (p) Object.entries(p).forEach(([k, v]) => root.style.setProperty(`--nts-${k}`, v.join(' ')));
  if (a) Object.entries(a).forEach(([k, v]) => root.style.setProperty(`--gold-${k}`, v.join(' ')));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && theme.primary) meta.setAttribute('content', theme.primary);
}

// V6.2 System Builder: font + corner style as data attributes (see index.css) and the admin's custom CSS.
export function applySystem(system = {}) {
  const root = document.documentElement;
  root.setAttribute('data-font', system.font || 'system');
  root.setAttribute('data-radius', system.radius || 'round');
  let tag = document.getElementById('nts-custom-css');
  const css = (system.customCss || '').trim();
  if (!css) { if (tag) tag.remove(); return; }
  if (!tag) { tag = document.createElement('style'); tag.id = 'nts-custom-css'; document.head.appendChild(tag); }
  tag.textContent = css;
}
