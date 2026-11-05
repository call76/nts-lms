// One master list of menu items. The admin (System Builder > Menu) can hide, rename, re-order,
// re-assign to roles and add custom links. Sidebar and the mobile menu both read it from here.
import { useMemo } from 'react';
import {
  FaHome, FaBook, FaGraduationCap, FaAward, FaBriefcase, FaChartLine, FaCalendarCheck, FaCalendarAlt, FaMoneyBillWave,
  FaComment, FaBullhorn, FaVideo, FaUsers, FaNewspaper, FaUser, FaCrown, FaChild, FaUserTie, FaComments,
  FaChalkboardTeacher, FaRobot, FaClipboardCheck, FaTools, FaLayerGroup, FaBookReader, FaLifeRing, FaPalette, FaLink, FaStar, FaCog, FaQuestionCircle, FaFileAlt, FaImages,
} from 'react-icons/fa';
import { useAuthStore } from '../store/authStore';
import { useSiteStore } from '../store/siteStore';

export const ALL_ROLES = ['ADMIN', 'TRAINER', 'STUDENT', 'PARENT', 'EMPLOYER', 'GUEST'];
const LEARNERS = ['ADMIN', 'TRAINER', 'STUDENT'];

export const MENU = [
  { id: 'dashboard', to: '/', label: 'Dashboard', icon: FaHome, roles: ALL_ROLES },
  { id: 'users', to: '/admin', label: 'Users & Management', icon: FaCrown, roles: ['ADMIN'] },
  { id: 'builder', to: '/admin/site', label: 'System Builder', icon: FaPalette, roles: ['ADMIN'] },
  { id: 'teaching', to: '/admin/teaching', label: 'Teaching Setup', icon: FaChalkboardTeacher, roles: ['ADMIN'] },
  { id: 'courses', to: '/courses', label: 'Courses & Modules', icon: FaBook, roles: ['ADMIN', 'TRAINER', 'STUDENT', 'GUEST', 'EMPLOYER'] },
  { id: 'learning', to: '/learning', label: 'Learning Studio & Exams', icon: FaGraduationCap, roles: LEARNERS },
  { id: 'bank', to: '/question-bank', label: 'Question Bank', icon: FaQuestionCircle, roles: ['ADMIN', 'TRAINER'] },
  { id: 'library', to: '/library', label: 'Library', icon: FaBookReader, roles: ['ADMIN', 'TRAINER', 'STUDENT', 'PARENT', 'GUEST'] },
  { id: 'certificates', to: '/certificates', label: 'Certificates', icon: FaAward, roles: LEARNERS },
  { id: 'certcontrol', to: '/admin/certificates', label: 'Certificate Control', icon: FaClipboardCheck, roles: ['ADMIN'] },
  { id: 'internships', to: '/internships', label: 'Internship', icon: FaBriefcase, roles: ['ADMIN', 'TRAINER', 'STUDENT', 'GUEST'] },
  { id: 'talent', to: '/talent', label: 'Talent', icon: FaUserTie, roles: ['EMPLOYER', 'ADMIN'] },
  { id: 'reports', to: '/campus#analytics', label: 'Reports & Analytics', icon: FaChartLine, roles: LEARNERS },
  { id: 'skills', to: '/campus#skills', label: 'Practical Skills', icon: FaTools, roles: LEARNERS },
  { id: 'logbook', to: '/campus#logbook', label: 'Internship Logbook', icon: FaLayerGroup, roles: ['ADMIN', 'TRAINER', 'STUDENT', 'EMPLOYER'] },
  { id: 'fees', to: '/campus#fees', label: 'Finance & Fees', icon: FaMoneyBillWave, roles: ['ADMIN', 'STUDENT', 'PARENT'] },
  { id: 'timetable', to: '/campus#timetable', label: 'Timetable', icon: FaCalendarAlt, roles: ['ADMIN', 'TRAINER', 'STUDENT', 'PARENT'] },
  { id: 'ai', to: '/campus#tutor', label: 'AI Assistant', icon: FaRobot, roles: LEARNERS },
  { id: 'parent', to: '/parent', label: 'Parent Portal', icon: FaChild, roles: ['PARENT', 'ADMIN'] },
  { id: 'attendance', to: '/attendance', label: 'Attendance', icon: FaCalendarCheck, roles: ['ADMIN', 'TRAINER', 'STUDENT', 'PARENT'] },
  { id: 'family', to: '/family', label: 'Parents & Teachers', icon: FaComments, roles: ['ADMIN', 'TRAINER', 'STUDENT', 'PARENT'] },
  { id: 'messages', to: '/messages', label: 'Messages', icon: FaComment, roles: ALL_ROLES, badge: true },
  { id: 'announcements', to: '/announcements', label: 'Announcements', icon: FaBullhorn, roles: ALL_ROLES },
  { id: 'calendar', to: '/events', label: 'Calendar', icon: FaCalendarAlt, roles: ALL_ROLES },
  { id: 'meetings', to: '/meetings', label: 'Meetings', icon: FaVideo, roles: LEARNERS },
  { id: 'community', to: '/community', label: 'Community', icon: FaUsers, roles: ALL_ROLES },
  { id: 'feed', to: '/feed', label: 'Social Feed', icon: FaNewspaper, roles: ALL_ROLES },
  { id: 'help', to: '/help', label: 'Help & Support', icon: FaLifeRing, roles: ALL_ROLES },
  { id: 'profile', to: '/profile', label: 'Profile', icon: FaUser, roles: ALL_ROLES },
];

// icons the admin can pick for a custom link
export const CUSTOM_ICONS = { link: FaLink, star: FaStar, book: FaBook, file: FaFileAlt, images: FaImages, cog: FaCog, help: FaQuestionCircle, graduation: FaGraduationCap, briefcase: FaBriefcase };

const splitRoles = (v) => String(v || '').split(',').map((r) => r.trim()).filter(Boolean);

// Applies the admin's overrides: order, visibility, labels, role assignment, custom links.
export function resolveMenu(role, menuCfg = {}) {
  const overrides = Array.isArray(menuCfg.items) ? menuCfg.items : [];
  const byId = new Map(overrides.map((o, i) => [o.id, { ...o, index: i }]));
  const rank = (m, fallback) => (byId.has(m.id) ? byId.get(m.id).index : 1000 + fallback);
  const list = MENU.map((m, i) => {
    const o = byId.get(m.id);
    const roles = o && splitRoles(o.roles).length ? splitRoles(o.roles) : m.roles;
    return { ...m, label: (o && o.label) || m.label, roles, visible: o ? o.visible !== false : true, _rank: rank(m, i) };
  }).sort((a, b) => a._rank - b._rank);
  const custom = (Array.isArray(menuCfg.custom) ? menuCfg.custom : []).map((c, i) => ({
    id: `custom-${i}`, to: c.to, label: c.label, icon: CUSTOM_ICONS[c.icon] || FaLink, roles: splitRoles(c.roles).length ? splitRoles(c.roles) : ALL_ROLES,
    visible: true, external: /^https?:/i.test(c.to), newTab: c.newTab === true || c.newTab === 'true',
  }));
  const keepAdminControls = (m) => !(role === 'ADMIN' && (m.id === 'builder' || m.id === 'dashboard')); // the admin can never lock himself out
  return [...list, ...custom].filter((m) => m.roles.includes(role) && (m.visible || !keepAdminControls(m)));
}

export function useMenu() {
  const role = useAuthStore((s) => s.user?.role);
  const menuCfg = useSiteStore((s) => s.site.menu);
  return useMemo(() => resolveMenu(role, menuCfg), [role, menuCfg]);
}
