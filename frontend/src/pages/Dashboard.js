import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FaUsers, FaChalkboardTeacher, FaUserGraduate, FaBriefcase, FaAward, FaBullhorn, FaClipboardCheck,
  FaUserShield, FaFileAlt, FaFlag, FaUserPlus, FaPalette, FaBookOpen, FaTrophy, FaChild, FaSearch,
  FaRobot, FaChartLine, FaPercent, FaClock, FaUserClock, FaLayerGroup, FaQuestionCircle, FaArrowRight, FaComments, FaCalendarCheck, FaCalendarAlt } from 'react-icons/fa';
import { useAuthStore } from '../store/authStore';
import { useSiteStore } from '../store/siteStore';
const useWidget = (k) => useSiteStore((st) => st.site.widgets?.[k] !== false); // admin switches in System Builder > Dashboard
import api from '../services/api';
import PromoBanner from '../components/PromoBanner';
import SiteImg from '../components/SiteImg';
import VideoGallery from '../components/VideoGallery';
import { Card, CardHeader, StatCard, Badge, ProgressBar, BarChart, StackedBar, Avatar, EmptyState, Skeleton, PRIORITY, btnPrimary, btnGhost } from '../components/ui';
import { timeAgo, fmtDate, dueLabel, greeting, ROLE_LABEL } from '../services/format';

const TAGS = { ADMIN: ['Learn', 'Teach', 'Assess', 'Certify', 'Succeed'], TRAINER: ['Teach', 'Inspire', 'Empower'], STUDENT: ['Learn', 'Practice', 'Achieve'] };
const FADE = 'linear-gradient(to right, transparent 0%, #000 45%)';
const Hero = ({ user, slot, subtitle }) => {
  const on = useWidget('heroBanner');
  if (!on) return null;
  const tags = TAGS[user?.role] || ['Learn', 'Practice', 'Achieve'];
  const trainerPic = user?.role === 'TRAINER';
  return (
    <div className="relative mb-6 min-h-[10rem] overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-blue-800 to-blue-600 shadow-lg fade-in sm:min-h-[12rem]">
      {trainerPic
        ? <img src="/images/v6-teacher.webp" alt="" className="absolute right-0 top-0 h-full w-3/5 object-cover sm:w-1/2" style={{ WebkitMaskImage: FADE, maskImage: FADE }} />
        : <SiteImg slot={slot} alt="NTS - Learn, Practice, Excel" className="absolute right-0 top-0 h-full w-3/5 object-cover sm:w-1/2" style={{ WebkitMaskImage: FADE, maskImage: FADE }} />}
      <div className="relative flex h-full min-h-[inherit] flex-col justify-center px-6 py-5 text-white sm:px-10">
        <p className="text-xs font-semibold text-blue-100">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · {ROLE_LABEL[user?.role] || user?.role}</p>
        <h1 className="mt-1 max-w-[70%] text-2xl font-extrabold tracking-tight drop-shadow sm:text-4xl">Welcome, <span className="text-yellow-300">{user?.fullName?.split(' ')[0] || 'there'}!</span> <span aria-hidden="true">👋</span></h1>
        <p className="mt-1 max-w-[70%] text-sm text-white/90 sm:text-base">{subtitle}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 text-sm font-semibold text-white/95">{tags.map((t) => <span key={t}>✔ {t}</span>)}</p>
      </div>
    </div>
  );
};

const AnnouncementsCard = ({ items = [] }) => {
  const on = useWidget('announcements');
  if (!on) return null;
  return (
  <Card>
    <CardHeader title="Announcements" subtitle="Latest from your school" action={<Link to="/announcements" className="text-xs font-semibold text-nts-green-600 hover:underline dark:text-nts-green-300">See all</Link>} />
    <div className="space-y-3 px-5 pb-5">
      {items.length === 0 && <EmptyState icon={FaBullhorn} title="No announcements" text="New announcements will appear here." />}
      {items.map((a) => {
        const p = PRIORITY[a.priority] || PRIORITY.NORMAL;
        return (
          <Link to="/announcements" key={a.id} className={`block rounded-xl border border-l-4 border-slate-200 bg-slate-50/60 p-3.5 transition hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:bg-gray-900 ${p.border}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{a.pinned ? '📌 ' : ''}{a.title}</p>
              <Badge tone={p.tone}>{p.label}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-gray-400">{a.body}</p>
            <p className="mt-1.5 text-[11px] text-slate-400">{timeAgo(a.createdAt)}</p>
          </Link>
        );
      })}
    </div>
  </Card>
  );
};

const QuickActions = ({ items }) => {
  const on = useWidget('quickActions');
  if (!on) return null;
  return (
  <Card>
    <CardHeader title="Quick actions" />
    <div className="grid grid-cols-2 gap-3 px-5 pb-5">
      {items.map(({ to, icon: Icon, label }) => (
        <Link key={to + label} to={to} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4 text-center text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-nts-green-300 hover:bg-nts-green-50 hover:shadow-sm dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
          <Icon className="text-xl text-nts-green-600 dark:text-nts-green-300" />{label}
        </Link>
      ))}
    </div>
  </Card>
  );
};

/* ------------------------------ ADMIN ------------------------------ */
const AdminView = ({ d }) => {
  const k = d.kpis;
  const attention = [
    { label: 'Student verifications waiting', value: k.pendingVerifications, to: '/admin/verifications', icon: FaUserClock },
    { label: 'Certificate requests waiting', value: k.pendingCertificates, to: '/admin/certificates', icon: FaAward },
    { label: 'Internship applications to review', value: k.pendingApplications, to: '/admin', icon: FaBriefcase },
    { label: 'Open post reports', value: k.openReports, to: '/admin', icon: FaFlag },
  ];
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FaUsers} label="Total users" value={k.users} hint={`${k.active} active · ${k.inactive} inactive`} to="/admin" />
        <StatCard icon={FaUserGraduate} label="Students" value={k.students} tone="blue" to="/admin" />
        <StatCard icon={FaChalkboardTeacher} label="Trainers" value={k.trainers} tone="violet" to="/admin" />
        <StatCard icon={FaBriefcase} label="Active internships" value={k.activeInternships} hint={`${k.employers} employers · ${k.parents} parents`} tone="amber" to="/admin" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="New registrations" subtitle="Last 14 days" action={<Badge tone="brand">{d.signups.reduce((a, b) => a + b.count, 0)} new</Badge>} />
          <div className="px-5 pb-5"><BarChart items={d.signups.map((s) => ({ label: s.date.slice(8), value: s.count }))} /></div>
        </Card>
        <Card>
          <CardHeader title="Users by role" />
          <div className="px-5 pb-5"><StackedBar items={d.roleBreakdown.map((r) => ({ label: ROLE_LABEL[r.role] || r.role, value: r.count }))} /></div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Needs your attention" />
          <ul className="divide-y divide-slate-100 px-2 pb-3 dark:divide-gray-700">
            {attention.map(({ label, value, to, icon: Icon }) => (
              <li key={label}>
                <Link to={to} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50 dark:hover:bg-gray-700/60">
                  <span className="flex items-center gap-3 text-sm text-slate-700 dark:text-gray-200"><Icon className="text-slate-400" />{label}</span>
                  <Badge tone={value > 0 ? 'amber' : 'slate'}>{value}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Newest users" action={<Link to="/admin" className="text-xs font-semibold text-nts-green-600 hover:underline dark:text-nts-green-300">Manage</Link>} />
          <ul className="space-y-1 px-3 pb-4">
            {d.recentUsers.map((u) => (
              <li key={u.id}>
                <Link to={`/profile/${u.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50 dark:hover:bg-gray-700/60">
                  <Avatar name={u.fullName} size={36} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{u.fullName}</p><p className="truncate text-xs text-slate-500 dark:text-gray-400">{u.email}</p></div>
                  <Badge tone={u.isActive ? 'brand' : 'slate'}>{ROLE_LABEL[u.role] || u.role}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Recent admin activity" />
          <ul className="space-y-3 px-5 pb-5">
            {d.recentActivity.length === 0 && <EmptyState icon={FaClipboardCheck} title="Nothing yet" text="Admin actions will be listed here." />}
            {d.recentActivity.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-nts-green-500" />
                <div className="min-w-0">
                  <p className="text-slate-700 dark:text-gray-200"><b className="font-semibold">{a.actor || 'Admin'}</b> · {a.action.toLowerCase().replace(/_/g, ' ')}{a.target ? <> · <span className="text-slate-500">{a.target}</span></> : null}</p>
                  <p className="text-xs text-slate-400">{timeAgo(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><AnnouncementsCard items={d.announcements} /></div>
        <QuickActions items={[
          { to: '/admin', icon: FaUserPlus, label: 'Add user' },
          { to: '/announcements', icon: FaBullhorn, label: 'Announcement' },
          { to: '/admin/certificates', icon: FaAward, label: 'Certificates' },
          { to: '/admin/site', icon: FaPalette, label: 'Site settings' },
        ]} />
      </div>
    </>
  );
};

/* ------------------------------ TRAINER ------------------------------ */
const TrainerView = ({ d }) => {
  const k = d.kpis;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FaLayerGroup} label="Modules taught" value={k.modules} to="/learning" />
        <StatCard icon={FaUserGraduate} label="Students" value={k.students} tone="blue" to="/community" />
        <StatCard icon={FaClipboardCheck} label="Waiting to grade" value={k.toGrade} tone={k.toGrade ? 'amber' : 'slate'} to="/learning" />
        <StatCard icon={FaQuestionCircle} label="Lessons · Quizzes" value={`${k.lessons} · ${k.quizzes}`} tone="violet" to="/learning" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Submissions to grade" subtitle="Newest first" action={<Link to="/learning" className={btnGhost + ' !py-1.5 !text-xs'}>Open Learning Studio</Link>} />
          <ul className="divide-y divide-slate-100 px-5 pb-3 dark:divide-gray-700">
            {d.toGrade.length === 0 && <EmptyState icon={FaClipboardCheck} title="All caught up" text="No submissions are waiting for a grade." />}
            {d.toGrade.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{s.student?.fullName}</p><p className="truncate text-xs text-slate-500 dark:text-gray-400">{s.assignment?.title}</p></div>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(s.submittedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <QuickActions items={[
          { to: '/learning', icon: FaBookOpen, label: 'Learning Studio' },
          { to: '/announcements', icon: FaBullhorn, label: 'Announcement' },
          { to: '/community', icon: FaUsers, label: 'My classes' },
          { to: '/certificates', icon: FaAward, label: 'Certificates' },
        ]} />
      </div>
      <div className="mt-6"><AnnouncementsCard items={d.announcements} /></div>
    </>
  );
};

/* ------------------------------ STUDENT ------------------------------ */
const StudentView = ({ d, board }) => {
  const k = d.kpis;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FaBookOpen} label="Courses enrolled" value={k.enrolled} to="/courses" />
        <StatCard icon={FaChartLine} label="Average progress" value={`${k.avgProgress}%`} tone="blue" to="/courses" />
        <StatCard icon={FaAward} label="Certificates" value={k.certificates} tone="amber" to="/certificates" />
        <StatCard icon={FaPercent} label="Quiz average" value={k.quizAverage == null ? '–' : `${k.quizAverage}%`} tone="violet" hint={k.quizAverage == null ? 'No quiz taken yet' : undefined} to="/learning" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="My courses" subtitle="Where you left off" action={<Link to="/courses" className="text-xs font-semibold text-nts-green-600 hover:underline dark:text-nts-green-300">Browse courses</Link>} />
          <div className="space-y-4 px-5 pb-5">
            {d.courses.length === 0 && <EmptyState icon={FaBookOpen} title="You have not enrolled yet" text="Pick a trade and module to start learning." action={<Link to="/courses" className={btnPrimary + ' mt-4'}>Find a course</Link>} />}
            {d.courses.map((c) => (
              <div key={c.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <p className="min-w-0 truncate font-semibold text-slate-800 dark:text-white"><span className="mr-2 text-xs font-bold text-slate-400">{c.code}</span>{c.name}</p>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500 dark:text-gray-400">{c.progress}%</span>
                </div>
                <ProgressBar value={c.progress} tone={c.progress >= 100 ? 'brand' : 'blue'} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Upcoming deadlines" />
          <ul className="space-y-2.5 px-5 pb-5">
            {d.upcoming.length === 0 && <EmptyState icon={FaClock} title="Nothing due" text="No open assignments right now." />}
            {d.upcoming.map((a) => {
              const due = dueLabel(a.dueAt);
              return (
                <li key={a.id}>
                  <Link to="/learning" className="block rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{a.title}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2"><span className="truncate text-xs text-slate-500 dark:text-gray-400">{a.module?.code}</span><Badge tone={due.tone}>{due.text}</Badge></div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Recent grades" />
          <ul className="divide-y divide-slate-100 px-5 pb-3 dark:divide-gray-700">
            {d.recentGrades.length === 0 && <EmptyState icon={FaClipboardCheck} title="No grades yet" text="Graded assignments appear here." />}
            {d.recentGrades.map((g) => {
              const pct = Math.round(((g.score || 0) / (g.assignment?.maxScore || 100)) * 100);
              return (
                <li key={g.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{g.assignment?.title}</p><p className="text-xs text-slate-400">{fmtDate(g.gradedAt)}</p></div>
                  <Badge tone={pct >= 70 ? 'brand' : pct >= 50 ? 'amber' : 'rose'}>{g.score}/{g.assignment?.maxScore} · {pct}%</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Leaderboard" subtitle="Average of quizzes and assignments" action={<FaTrophy className="text-nts-gold-500" />} />
          <ul className="space-y-1 px-3 pb-4">
            {(!board || board.top.length === 0) && <EmptyState icon={FaTrophy} title="No ranking yet" text="Take a quiz or submit an assignment to appear here." />}
            {board?.top.slice(0, 5).map((r) => (
              <li key={r.id} className={`flex items-center gap-3 rounded-xl px-2 py-2 ${r.id === board.me?.id ? 'bg-nts-green-50 dark:bg-nts-green-900/30' : ''}`}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${r.rank === 1 ? 'bg-nts-gold-400 text-nts-gold-900' : 'bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-300'}`}>{r.rank}</span>
                <Avatar name={r.fullName} src={r.avatar} size={32} />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-white">{r.fullName}</p>
                <b className="text-sm tabular-nums text-slate-700 dark:text-gray-200">{r.percent}%</b>
              </li>
            ))}
            {board?.me && board.me.rank > 5 && <li className="px-2 pt-2 text-center text-xs text-slate-500">Your rank: <b>#{board.me.rank}</b> of {board.total} ({board.me.percent}%)</li>}
          </ul>
        </Card>
        <AnnouncementsCard items={d.announcements} />
      </div>
    </>
  );
};

/* ------------------------------ PARENT ------------------------------ */
const ParentView = ({ d }) => (
  <>
    <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900 dark:text-white">Your children</h2><Link to="/parent" className={btnPrimary + ' !py-2'}>Open Parent Portal <FaArrowRight /></Link></div>
    {d.children.length === 0 ? (
      <Card><EmptyState icon={FaChild} title="No student linked yet" text="Ask the school administrator to link your account to your child." /></Card>
    ) : (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {d.children.map((c) => (
          <Link key={c.id} to="/parent" className="block rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3"><Avatar name={c.fullName} size={44} /><div className="min-w-0"><p className="truncate font-bold text-slate-900 dark:text-white">{c.fullName}</p><p className="truncate text-xs text-slate-500 dark:text-gray-400">{[c.className, c.department].filter(Boolean).join(' · ') || c.relationship}</p></div></div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-gray-400"><span>{c.courses} courses</span><b className="text-slate-700 dark:text-gray-200">{c.avgProgress}% progress</b></div>
            <ProgressBar value={c.avgProgress} className="mt-1.5" />
          </Link>
        ))}
      </div>
    )}
    <div className="mt-6"><AnnouncementsCard items={d.announcements} /></div>
  </>
);

/* ------------------------------ EMPLOYER ------------------------------ */
const EmployerView = ({ d }) => (
  <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard icon={FaAward} label="Certified students" value={d.kpis.talent} to="/talent" />
      <StatCard icon={FaBriefcase} label="Active internships" value={d.kpis.internships} tone="amber" to="/internships" />
      <StatCard icon={FaUserGraduate} label="Applications" value={d.kpis.applications} tone="blue" to="/internships" />
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Find your next team member" subtitle="Browse students who hold verified certificates" />
        <div className="px-5 pb-6"><Link to="/talent" className={btnPrimary}><FaSearch /> Browse certified students</Link></div>
      </Card>
      <AnnouncementsCard items={d.announcements} />
    </div>
  </>
);

/* ------------------------------ GUEST ------------------------------ */
const GuestView = ({ d }) => (
  <div className="grid gap-6 lg:grid-cols-3">
    <Card className="lg:col-span-2">
      <CardHeader title="Welcome to NTS" subtitle="Explore the platform as a guest" />
      <div className="flex flex-wrap gap-3 px-5 pb-6">
        <Link to="/guest-ai" className={btnPrimary}><FaRobot /> Ask the AI assistant</Link>
        <Link to="/feed" className={btnGhost}>Open the feed</Link>
        <Link to="/internships" className={btnGhost}>See internships</Link>
      </div>
    </Card>
    <AnnouncementsCard items={d.announcements} />
  </div>
);

/* ------------------------------ QUICK LINKS (V5.3) ------------------------------ */
const PromoCard = ({ role }) => (
  <div className="relative mt-6 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-blue-800 to-blue-600 p-6 text-white shadow-lg sm:p-8">
    <img src="/images/v6-girl.webp" alt="" loading="lazy" className="absolute bottom-0 right-2 h-full max-h-56 object-contain sm:right-10" />
    <div className="relative max-w-[62%]">
      <p className="text-xl font-extrabold sm:text-2xl">NTS Professional LMS <span className="text-yellow-300">v6.0</span></p>
      <p className="mt-1 text-sm font-semibold text-blue-100">Complete Learning Management System</p>
      <p className="mt-2 flex flex-wrap gap-x-4 text-xs font-semibold sm:text-sm"><span>✔ Modern</span><span>✔ Secure</span><span>✔ Powerful</span></p>
      <Link to={role === 'ADMIN' ? '/campus' : '/learning'} className="mt-4 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2 text-sm font-extrabold text-blue-950 hover:bg-yellow-300">{role === 'ADMIN' ? 'Open Campus tools' : 'Continue Learning'} <FaArrowRight /></Link>
    </div>
  </div>
);

const QuickLinks = ({ role }) => {
  const items = [
    ['/family', FaComments, role === 'STUDENT' ? 'Parents & Teachers' : 'Talk to teachers', role === 'STUDENT' ? 'Read what your parent and teacher discuss' : 'Parent ↔ teacher conversations', ['PARENT', 'TRAINER', 'STUDENT']],
    ['/attendance', FaCalendarCheck, 'Attendance', role === 'TRAINER' ? 'Mark your class and add remarks' : 'Attendance chart and teacher remarks', ['PARENT', 'TRAINER', 'STUDENT']],
    ['/events', FaCalendarAlt, 'Calendar', 'Meetings, quizzes and open days', ['PARENT', 'TRAINER', 'STUDENT', 'EMPLOYER', 'GUEST', 'ADMIN']],
  ].filter((i) => i[4].includes(role));
  if (!items.length) return null;
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      {items.map(([to, Icon, title, text]) => (
        <Link key={to} to={to} className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-nts-green-50 text-lg text-nts-green-700 dark:bg-nts-green-900/40 dark:text-nts-green-200"><Icon /></div>
          <div className="min-w-0"><p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p><p className="truncate text-xs text-slate-500 dark:text-gray-400">{text}</p></div>
        </Link>
      ))}
    </div>
  );
};


/* ------------------------------ VISUAL FEATURE LAUNCHPAD ------------------------------ */
const FeatureLaunchpad = ({ role }) => {
  const all = [
    { title: 'Learning Studio', text: 'Lessons, video classes, quizzes and notes', to: '/learning', image: '/images/banner-learning.webp', roles: ['ADMIN', 'TRAINER', 'STUDENT'] },
    { title: 'Certificates', text: 'View, issue and verify achievements', to: '/certificates', image: '/images/v6-graduates2.webp', roles: ['ADMIN', 'TRAINER', 'STUDENT', 'EMPLOYER'] },
    { title: 'Campus workspace', text: 'Attendance, timetable and student insights', to: '/campus', image: '/images/banner-workspace.webp', roles: ['ADMIN', 'TRAINER', 'STUDENT', 'PARENT', 'EMPLOYER'] },
    { title: 'Career opportunities', text: 'Explore internships and connect with talent', to: '/internships', image: '/images/v6-school.webp', roles: ['ADMIN', 'STUDENT', 'EMPLOYER'] },
  ];
  const items = all.filter((item) => item.roles.includes(role));
  if (!items.length) return null;
  return (
    <section className="mt-7" aria-label="Explore NTS features">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600 dark:text-blue-300">Explore the platform</p><h2 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">Your NTS workspace</h2></div>
        <span className="text-xs font-semibold text-slate-400">Learn · Grow · Succeed</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <Link key={item.to} to={item.to} className="group relative isolate min-h-[176px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-700">
            <img src={item.image} alt="" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-blue-950 via-blue-950/65 to-blue-900/5" />
            <div className="flex min-h-[176px] flex-col justify-end p-4 text-white">
              <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-xs font-black backdrop-blur">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="text-base font-extrabold">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-blue-100">{item.text}</p>
              <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-yellow-300">Open workspace <FaArrowRight className="transition group-hover:translate-x-1" /></span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

/* ------------------------------ PAGE ------------------------------ */
const Dashboard = () => {
  const { user } = useAuthStore();
  const promoOn = useWidget('promo');
  const videosOn = useWidget('videos');
  const [data, setData] = useState(null);
  const [board, setBoard] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    api.get('/dashboard/overview').then((r) => setData(r.data)).catch(() => setFailed(true));
    if (user?.role === 'STUDENT') api.get('/dashboard/leaderboard').then((r) => setBoard(r.data)).catch(() => {});
  }, [user?.role]);
  useEffect(() => { load(); }, [load]);

  const subtitle = { ADMIN: 'Overview of the whole platform', TRAINER: 'Your classes at a glance', STUDENT: 'Learn • Practice • Excel', PARENT: 'Follow your child’s progress', EMPLOYER: 'Discover certified talent', GUEST: 'Learn • Practice • Excel' }[user?.role] || '';
  const slot = user?.role === 'ADMIN' ? 'dashboardAdminHero' : 'dashboardHero';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <Hero user={user} slot={slot} subtitle={subtitle} />
      {promoOn && <div className="mb-6"><PromoBanner compact={user?.role === 'ADMIN'} /></div>}

      {data && <QuickLinks role={data.role} />}
      {data && <FeatureLaunchpad role={data.role} />}

      {failed && (
        <Card><EmptyState icon={FaFileAlt} title="Could not load your dashboard" text="Check that the backend is running, then try again." action={<button onClick={load} className={btnPrimary + ' mt-4'}>Try again</button>} /></Card>
      )}
      {!data && !failed && (
        <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>
      )}
      {data && (
        <div className="fade-in">
          {data.role === 'ADMIN' && <AdminView d={data} />}
          {data.role === 'TRAINER' && <TrainerView d={data} />}
          {data.role === 'STUDENT' && <StudentView d={data} board={board} />}
          {data.role === 'PARENT' && <ParentView d={data} />}
          {data.role === 'EMPLOYER' && <EmployerView d={data} />}
          {data.role === 'GUEST' && <GuestView d={data} />}
          {['ADMIN', 'STUDENT'].includes(data.role) && <PromoCard role={data.role} />}
          {data.role === 'ADMIN' && <div className="mt-8 flex items-center gap-3 text-sm text-slate-500"><FaUserShield /> Full administrative access · <Link to="/admin" className="font-semibold text-nts-green-600 hover:underline dark:text-nts-green-300">Open Admin Panel</Link></div>}
        </div>
      )}

      {videosOn && data && data.role !== 'ADMIN' && <div className="mt-10"><VideoGallery title="Watch and learn" /></div>}
    </div>
  );
};

export default Dashboard;
