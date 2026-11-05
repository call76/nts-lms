// Small formatting helpers shared by the dashboards and new pages.
export const timeAgo = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const fmtDate = (iso, withTime = false) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
};

// "Due today", "Due tomorrow", "Due in 5 days" + a tone used for the colour of the chip
export const dueLabel = (iso) => {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days <= 0) return { text: 'Due today', tone: 'rose' };
  if (days === 1) return { text: 'Due tomorrow', tone: 'rose' };
  if (days <= 3) return { text: `Due in ${days} days`, tone: 'amber' };
  return { text: `Due in ${days} days`, tone: 'slate' };
};

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export const ROLE_LABEL = { ADMIN: 'Administrator', TRAINER: 'Trainer', STUDENT: 'Student', EMPLOYER: 'Employer', PARENT: 'Parent', GUEST: 'Guest' };
