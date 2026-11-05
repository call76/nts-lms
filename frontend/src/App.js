import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Welcome from './pages/Welcome';
import SiteSettings from './pages/SiteSettings';
import AnnouncementBar from './components/AnnouncementBar';
import SiteFooter from './components/SiteFooter';
import { useSiteStore } from './store/siteStore';
import { asset } from './services/assets';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOTP from './pages/VerifyOTP';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Feed from './pages/Feed';
import Messages from './pages/Messages';
import Internships from './pages/Internships';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel';
import Courses from './pages/Courses';
import Community from './pages/Community';
import StudentVerification from './pages/StudentVerification';
import LearningStudio from './pages/LearningStudio';
import CertificateCenter from './pages/CertificateCenter';
import GuestAI from './pages/GuestAI';
import AdminCertificates from './pages/AdminCertificates';
import Announcements from './pages/Announcements';
import ParentPortal from './pages/ParentPortal';
import Talent from './pages/Talent';
import Campus from './pages/Campus';
import FamilyChat from './pages/FamilyChat';
import Attendance from './pages/Attendance';
import Events from './pages/Events';
import Meetings from './pages/Meetings';
import AdminTeaching from './pages/AdminTeaching';
import VerifyCertificate from './pages/VerifyCertificate';
import Library from './pages/Library';
import QuestionBank from './pages/QuestionBank';
import Help from './pages/Help';
import { applySystem } from './services/theme';

export const ThemeContext = createContext({ darkMode: false, toggleDarkMode: () => {} });

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

function App() {
  const { isAuthenticated, user } = useAuthStore();
  const site = useSiteStore((st) => st.site);
  const loadSite = useSiteStore((st) => st.load);

  // Load logo, colours, images and texts chosen by the admin, then apply them
  useEffect(() => { loadSite(); }, [loadSite]);
  useEffect(() => {
    document.title = `${site.brand.shortName || 'NTS'} - ${site.brand.name}`;
    const icon = asset(site.brand.faviconUrl || site.brand.logoUrl);
    let link = document.querySelector("link[rel='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    if (icon) link.href = icon;
  }, [site.brand.name, site.brand.shortName, site.brand.faviconUrl, site.brand.logoUrl]);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => { localStorage.setItem('darkChosen', '1'); return !prev; });

  // System Builder: font, corner style, custom CSS, and the default light/dark mode for people who never chose one
  useEffect(() => { applySystem(site.system); }, [site.system]);
  useEffect(() => {
    const chosen = localStorage.getItem('darkChosen') || localStorage.getItem('darkMode') === 'true';
    if (!chosen) setDarkMode(Boolean(site.system?.defaultDark));
  }, [site.system?.defaultDark]);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <Router>
        <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-900' : 'bg-slate-50'} ${isAuthenticated ? 'lg:pl-64' : ''}`}>
          {isAuthenticated && <Sidebar />}
          {isAuthenticated && <Navbar />}
          <AnnouncementBar />
          <div className={isAuthenticated ? 'pt-16 pb-16 md:pb-0' : ''}>
            <Routes>
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
              <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
              <Route path="/verify-otp" element={!isAuthenticated ? <VerifyOTP /> : <Navigate to="/" />} />
              <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/" />} />
              <Route path="/" element={isAuthenticated ? <Dashboard /> : <Welcome />} />
              <Route path="/feed" element={isAuthenticated ? <Feed /> : <Navigate to="/login" />} />
              <Route path="/messages" element={isAuthenticated ? <Messages /> : <Navigate to="/login" />} />
              <Route path="/internships" element={isAuthenticated ? <Internships /> : <Navigate to="/login" />} />
              <Route path="/courses" element={isAuthenticated ? <Courses /> : <Navigate to="/login" />} />
              <Route path="/community" element={isAuthenticated ? <Community /> : <Navigate to="/login" />} />
              <Route path="/learning" element={isAuthenticated ? <LearningStudio /> : <Navigate to="/login" />} />
              <Route path="/certificates" element={isAuthenticated ? <CertificateCenter /> : <Navigate to="/login" />} />
              <Route path="/announcements" element={isAuthenticated ? <Announcements /> : <Navigate to="/login" />} />
              <Route path="/parent" element={isAuthenticated && ['PARENT', 'ADMIN'].includes(user?.role) ? <ParentPortal /> : <Navigate to="/" />} />
              <Route path="/family" element={isAuthenticated && ['PARENT', 'TRAINER', 'STUDENT', 'ADMIN'].includes(user?.role) ? <FamilyChat /> : <Navigate to="/" />} />
              <Route path="/attendance" element={isAuthenticated && ['PARENT', 'TRAINER', 'STUDENT', 'ADMIN'].includes(user?.role) ? <Attendance /> : <Navigate to="/" />} />
              <Route path="/verify/:code" element={<VerifyCertificate />} />
              <Route path="/meetings" element={isAuthenticated && ['STUDENT', 'TRAINER', 'ADMIN'].includes(user?.role) ? <Meetings /> : <Navigate to="/" />} />
              <Route path="/admin/teaching" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminTeaching /> : <Navigate to="/" />} />
              <Route path="/campus" element={isAuthenticated && ['ADMIN', 'TRAINER', 'STUDENT', 'PARENT', 'EMPLOYER'].includes(user?.role) ? <Campus /> : <Navigate to="/" />} />
              <Route path="/library" element={isAuthenticated ? <Library /> : <Navigate to="/login" />} />
              <Route path="/question-bank" element={isAuthenticated && ['ADMIN', 'TRAINER'].includes(user?.role) ? <QuestionBank /> : <Navigate to="/" />} />
              <Route path="/help" element={isAuthenticated ? <Help /> : <Navigate to="/login" />} />
              <Route path="/events" element={isAuthenticated ? <Events /> : <Navigate to="/login" />} />
              <Route path="/talent" element={isAuthenticated && ['EMPLOYER', 'ADMIN'].includes(user?.role) ? <Talent /> : <Navigate to="/" />} />
              <Route path="/guest-ai" element={isAuthenticated && user?.role === 'GUEST' ? <GuestAI /> : <Navigate to="/" />} />
              <Route path="/profile/:userId?" element={isAuthenticated ? <Profile /> : <Navigate to="/login" />} />
              <Route path="/admin" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminPanel /> : <Navigate to="/" />} />
              <Route path="/admin/site" element={isAuthenticated && user?.role === 'ADMIN' ? <SiteSettings /> : <Navigate to="/" />} />
              <Route path="/admin/certificates" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminCertificates /> : <Navigate to="/" />} />
              <Route path="/admin/verifications" element={isAuthenticated && user?.role === 'ADMIN' ? <StudentVerification /> : <Navigate to="/" />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            {isAuthenticated && <SiteFooter />}
          </div>
          {isAuthenticated && <BottomNav />}
        </div>
      </Router>
    </ThemeContext.Provider>
  );
}

export default App;