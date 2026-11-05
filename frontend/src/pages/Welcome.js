import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaGraduationCap, FaClipboardCheck, FaAward, FaChartLine, FaLaptop, FaUsers, FaBriefcase,
  FaBookOpen, FaLightbulb, FaTrophy, FaCode, FaDatabase, FaNetworkWired, FaGlobe, FaBars, FaTimes,
  FaShieldAlt, FaMobileAlt, FaArrowRight,
} from 'react-icons/fa';
import BrandLogo from '../components/BrandLogo';
import SiteImg from '../components/SiteImg';
import SocialLinks from '../components/SocialLinks';
import VideoGallery from '../components/VideoGallery';
import { useSite } from '../store/siteStore';

const FEATURES = [
  { icon: FaGraduationCap, title: 'Online Courses', text: 'Learn at your own pace with lessons prepared by verified trainers.' },
  { icon: FaClipboardCheck, title: 'Quizzes & Assessments', text: 'Test your knowledge with quizzes and graded assignments.' },
  { icon: FaAward, title: 'Certificates', text: 'Complete a module and get a certificate you can verify with a QR code.' },
  { icon: FaChartLine, title: 'Progress Tracking', text: 'Monitor your progress and see how far you have come.' },
  { icon: FaLaptop, title: 'Interactive Learning', text: 'Learn with ease on your phone, tablet or computer.' },
  { icon: FaUsers, title: 'Class Community', text: 'Connect with classmates and trainers, chat and share materials.' },
];

const STEPS = [
  { icon: FaBookOpen, title: 'Learn', text: 'Enrol in a module and follow lessons, notes and videos from expert trainers.' },
  { icon: FaLightbulb, title: 'Practice', text: 'Apply what you learn with assignments, quizzes and hands-on tasks.' },
  { icon: FaTrophy, title: 'Excel', text: 'Earn certificates, apply for internships and build your career.' },
];

const TRACKS = [
  { icon: FaCode, name: 'Programming' },
  { icon: FaDatabase, name: 'Database' },
  { icon: FaNetworkWired, name: 'Networking' },
  { icon: FaGlobe, name: 'Web Development' },
  { icon: FaLaptop, name: 'Digital Skills' },
  { icon: FaBriefcase, name: 'Business Management' },
];

const Welcome = () => {
  const { site, asset } = useSite();
  const w = site.welcome || {};
  const gallery = (site.gallery || []).filter(Boolean);
  const hasVideos = (site.videos || []).some((v) => v.url);
  const [open, setOpen] = useState(false);
  const links = [['Features', '#features'], ['How it works', '#how'], ['Courses', '#tracks'], ...(hasVideos ? [['Videos', '#videos']] : []), ['Gallery', '#gallery']];

  return (
    <div className="bg-white text-gray-800">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2"><BrandLogo className="h-11" /></a>
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-gray-600">
            {links.map(([l, h]) => <a key={h} href={h} className="hover:text-nts-green-700">{l}</a>)}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="px-4 py-2 text-sm font-bold text-nts-green-700 hover:bg-nts-green-50 rounded-lg">Login</Link>
            <Link to="/register" className="px-5 py-2 text-sm font-bold bg-nts-green-700 text-white rounded-lg hover:bg-nts-green-800 shadow">Get Started</Link>
          </div>
          <button className="md:hidden text-2xl text-nts-green-800" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <FaTimes /> : <FaBars />}</button>
        </div>
        {open && (
          <div className="md:hidden bg-white border-t px-4 py-3 space-y-3">
            {links.map(([l, h]) => <a key={h} href={h} onClick={() => setOpen(false)} className="block font-semibold text-gray-700">{l}</a>)}
            <div className="flex gap-3 pt-2">
              <Link to="/login" className="flex-1 text-center py-2 font-bold border border-nts-green-700 text-nts-green-700 rounded-lg">Login</Link>
              <Link to="/register" className="flex-1 text-center py-2 font-bold bg-nts-green-700 text-white rounded-lg">Get Started</Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="top" className="relative pt-16">
        <SiteImg slot="welcomeHero" alt="NTS e-learning workspace" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-nts-green-950/95 via-nts-green-900/80 to-nts-green-900/30" />
        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:py-28 lg:py-36">
          <span className="inline-block text-xs font-bold uppercase tracking-widest bg-nts-gold-500 text-nts-green-950 rounded-full px-4 py-1.5">{w.badge}</span>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight max-w-3xl">
            {w.headline} <span className="text-nts-gold-400">{w.headlineAccent}</span>
          </h1>
          <p className="mt-5 text-lg text-white/85 max-w-2xl">{w.subtitle}</p>
          <p className="mt-3 text-nts-gold-300 font-semibold tracking-wide">{site.brand.tagline}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/register" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold bg-nts-gold-500 text-nts-green-950 hover:bg-nts-gold-400 shadow-lg transition">
              {w.primaryCta} <FaArrowRight />
            </Link>
            <Link to="/login" className="inline-flex items-center px-7 py-3.5 rounded-xl font-bold text-white border-2 border-white/60 hover:bg-white/10 transition">{w.secondaryCta}</Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/80">
            <span className="flex items-center gap-2"><FaShieldAlt className="text-nts-gold-400" /> Verified students & trainers</span>
            <span className="flex items-center gap-2"><FaAward className="text-nts-gold-400" /> Verifiable certificates</span>
            <span className="flex items-center gap-2"><FaMobileAlt className="text-nts-gold-400" /> Works on any device</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-nts-green-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-bold tracking-widest uppercase text-nts-gold-700">Why NTS</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-nts-green-900">Everything you need to learn and grow</h2>
            <p className="mt-3 text-gray-600">A complete learning platform built for TVET, university and high-school students in Rwanda.</p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-nts-green-100 hover:shadow-lg hover:-translate-y-1 transition">
                <div className="w-12 h-12 rounded-xl bg-nts-green-700 text-nts-gold-400 grid place-items-center text-xl"><Icon /></div>
                <h3 className="mt-4 text-lg font-bold text-nts-green-900">{title}</h3>
                <p className="mt-1 text-sm text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <SiteImg slot="welcomeStory" alt="Student learning with NTS" loading="lazy" className="rounded-3xl shadow-2xl w-full object-cover" />
            <div className="absolute -bottom-5 -right-3 sm:right-6 bg-nts-gold-500 text-nts-green-950 rounded-2xl px-5 py-3 shadow-lg font-extrabold">{site.brand.tagline}</div>
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-nts-gold-700">How it works</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-nts-green-900">Three simple steps to success</h2>
            <div className="mt-8 space-y-6">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <div key={title} className="flex gap-4">
                  <div className="shrink-0 w-14 h-14 rounded-2xl bg-nts-green-700 text-white grid place-items-center text-2xl relative">
                    <Icon /><span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-nts-gold-500 text-nts-green-950 text-xs font-extrabold grid place-items-center">{i + 1}</span>
                  </div>
                  <div><h3 className="text-xl font-bold text-nts-green-900">{title}</h3><p className="text-gray-600 mt-1">{text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section id="tracks" className="py-20 bg-gradient-to-br from-nts-green-900 to-nts-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-nts-gold-300">Learning areas</p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold">Skills for the jobs of tomorrow</h2>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {TRACKS.map(({ icon: Icon, name }) => (
              <div key={name} className="bg-white/10 border border-white/20 rounded-2xl p-5 hover:bg-white/20 transition">
                <Icon className="text-3xl text-nts-gold-400 mx-auto" />
                <p className="mt-3 font-semibold text-sm">{name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {hasVideos && (
        <section id="videos" className="py-20 bg-nts-green-50">
          <div className="max-w-7xl mx-auto px-4"><VideoGallery title={w.videosTitle} /></div>
        </section>
      )}

      {/* Gallery */}
      <section id="gallery" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-bold tracking-widest uppercase text-nts-gold-700">Life at NTS</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-nts-green-900">A community that learns together</h2>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 gap-5">
            {gallery.map((src, i) => (
              <div key={src} className={`overflow-hidden rounded-2xl shadow-md ${i === 0 ? 'sm:col-span-2' : ''}`}>
                <img src={asset(src)} alt="NTS students and learning" loading="lazy" className={`w-full object-cover hover:scale-105 transition duration-700 ${i === 0 ? 'h-72 sm:h-96' : 'h-60 sm:h-72'}`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative">
        <SiteImg slot="welcomeCta" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-nts-green-950/85" />
        <div className="relative max-w-3xl mx-auto px-4 py-20 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold">{w.ctaTitle}</h2>
          <p className="mt-3 text-white/80">{w.ctaText}</p>
          <div className="mt-8 flex justify-center gap-4 flex-wrap">
            <Link to="/register" className="px-8 py-3.5 rounded-xl font-bold bg-nts-gold-500 text-nts-green-950 hover:bg-nts-gold-400 shadow-lg">Get Started</Link>
            <Link to="/login" className="px-8 py-3.5 rounded-xl font-bold border-2 border-white/60 hover:bg-white/10">I already have an account</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-nts-green-950 text-white/70">
        <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8 items-start">
          <div className="flex items-center gap-3">
            <span className="bg-white rounded-lg p-1"><BrandLogo className="h-12" /></span>
            <div><p className="font-bold text-white">{site.brand.name}</p><p className="text-xs text-nts-gold-300">{site.brand.tagline}</p></div>
          </div>
          <div className="text-sm space-y-1.5 text-white/80">
            {site.contact?.email && <p><a href={`mailto:${site.contact.email}`} className="hover:text-white">✉ {site.contact.email}</a></p>}
            {site.contact?.phone && <p><a href={`tel:${site.contact.phone.replace(/\s/g, '')}`} className="hover:text-white">☎ {site.contact.phone}</a></p>}
            {site.contact?.address && <p>⌖ {site.contact.address}</p>}
            <div className="flex gap-5 pt-1">
              <Link to="/login" className="hover:text-white">Login</Link>
              <Link to="/register" className="hover:text-white">Register</Link>
            </div>
          </div>
          <div className="md:text-right md:flex md:flex-col md:items-end gap-3">
            <SocialLinks className="md:justify-end text-white" />
            <p className="text-xs mt-3">{site.footer?.text || `© ${new Date().getFullYear()} ${site.brand.name}. All rights reserved.`}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Welcome;
