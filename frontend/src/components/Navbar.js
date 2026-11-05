import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useMenu } from '../services/menu';
import { useAuthStore } from '../store/authStore';
import BrandLogo from './BrandLogo';
import NotificationBell from './NotificationBell';
import { Avatar } from './ui';
import { ROLE_LABEL, greeting as greetingText } from '../services/format';
import { useTheme } from '../App';
import { FaHome, FaNewspaper, FaComment, FaBriefcase, FaUser, FaSignOutAlt, FaCrown, FaBars, FaTimes, FaBook, FaMoon, FaSun, FaGraduationCap, FaAward, FaBullhorn, FaChild, FaUserTie, FaComments, FaCalendarCheck, FaCalendarAlt, FaVideo, FaChalkboardTeacher, FaThLarge } from 'react-icons/fa';

const Navbar = () => {
  const { user, logout, unreadCount, setUnreadCount, token } = useAuthStore();
  const menuItems = useMenu();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const api = (await import('../services/api')).default;
      const res = await api.get('/chat');
      const chats = res.data || [];
      const totalUnread = chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Failed to fetch unread count', error.message);
    }
  };
  
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);
  
  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMenuOpen(false);
  };
  
  const isActive = (path) => location.pathname === path;
  
  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md fixed top-0 left-0 right-0 lg:left-64 z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2 lg:hidden" onClick={() => setIsMenuOpen(false)}>
            <BrandLogo className="h-10 bg-white rounded-md px-1" />
            <span className="font-bold text-xl text-gray-800 dark:text-white hidden sm:inline">NTS</span>
          </Link>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex lg:hidden items-center space-x-6">
            <Link to="/" className={isActive('/') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'}>
              <FaHome size={20} />
            </Link>
            <Link to="/feed" className={isActive('/feed') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'}>
              <FaNewspaper size={20} />
            </Link>
            <Link to="/messages" className={`relative ${isActive('/messages') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'}`}>
              <FaComment size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            {user?.role !== 'PARENT' && <Link to="/internships" className={isActive('/internships') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'}>
              <FaBriefcase size={20} />
            </Link>}
            {user?.role !== 'PARENT' && <Link to="/learning" className={isActive('/learning') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'} title="Learning Studio">
              <FaGraduationCap size={20} />
            </Link>}
            {user?.role !== 'PARENT' && <Link to="/certificates" className={isActive('/certificates') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'} title="Certificates"><FaAward size={20} /></Link>}
            {user?.role === 'GUEST' && <Link to="/guest-ai" className={isActive('/guest-ai') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'} title="Guest AI">AI</Link>}
            <Link to="/courses" className={isActive('/courses') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'}>
              <FaBook size={20} />
            </Link>
            <Link to="/profile" className={isActive('/profile') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'}>
              <FaUser size={20} />
            </Link>
            {user?.role === 'ADMIN' && (
              <Link to="/admin" className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700">
                <FaCrown size={20} />
              </Link>
            )}
            <Link to="/announcements" className={isActive('/announcements') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'} title="Announcements"><FaBullhorn size={20} /></Link>
            {user?.role === 'PARENT' && <Link to="/parent" className={isActive('/parent') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'} title="Parent Portal"><FaChild size={20} /></Link>}
            {user?.role === 'EMPLOYER' && <Link to="/talent" className={isActive('/talent') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'} title="Certified students"><FaUserTie size={20} /></Link>}
            {['PARENT', 'TRAINER', 'STUDENT', 'ADMIN'].includes(user?.role) && <Link to="/family" className={isActive('/family') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'} title="Parents & Teachers"><FaComments size={20} /></Link>}
            {['PARENT', 'TRAINER', 'STUDENT', 'ADMIN'].includes(user?.role) && <Link to="/attendance" className={isActive('/attendance') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'} title="Attendance"><FaCalendarCheck size={20} /></Link>}
            <Link to="/events" className={isActive('/events') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'} title="Calendar"><FaCalendarAlt size={20} /></Link>
            {['STUDENT', 'TRAINER', 'ADMIN'].includes(user?.role) && <Link to="/meetings" className={isActive('/meetings') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'} title="Meetings"><FaVideo size={20} /></Link>}
            {['ADMIN', 'TRAINER', 'STUDENT', 'PARENT', 'EMPLOYER'].includes(user?.role) && <Link to="/campus" className={isActive('/campus') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400'} title="Campus tools"><FaThLarge size={20} /></Link>}
            <NotificationBell />
            <button onClick={toggleDarkMode} className="text-gray-600 dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-400">
              {darkMode ? <FaSun size={20} /> : <FaMoon size={20} />}
            </button>
            <button onClick={handleLogout} className="text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400">
              <FaSignOutAlt size={20} />
            </button>
          </div>
          
          {/* V6 desktop top bar (the main menu lives in the sidebar) */}
          <div className="hidden lg:flex flex-1 items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{greetingText()}, {user?.fullName?.split(' ')[0]}</p>
              <p className="text-xs text-slate-500">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-4">
              {['ADMIN', 'TRAINER', 'STUDENT', 'PARENT', 'EMPLOYER'].includes(user?.role) && <Link to="/campus" className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200" title="Campus tools">Campus tools</Link>}
              <NotificationBell />
              <button onClick={toggleDarkMode} className="text-gray-600 hover:text-yellow-500 dark:text-gray-300" title="Dark mode">{darkMode ? <FaSun size={18} /> : <FaMoon size={18} />}</button>
              <Link to="/profile" className="flex items-center gap-2 border-l border-slate-200 pl-4 dark:border-gray-700">
                <Avatar name={user?.fullName} src={user?.avatar} size={36} />
                <span className="leading-tight"><span className="block text-sm font-bold text-slate-800 dark:text-white">{user?.fullName}</span><span className="block text-[11px] text-slate-500">{ROLE_LABEL[user?.role] || user?.role}</span></span>
              </Link>
              <button onClick={handleLogout} className="text-gray-600 hover:text-red-500 dark:text-gray-300" title="Logout"><FaSignOutAlt size={18} /></button>
            </div>
          </div>
          <NotificationBell className="ml-auto mr-2 md:hidden" />
          {/* Mobile Menu Button */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            {isMenuOpen ? <FaTimes size={20} className="text-gray-800 dark:text-white" /> : <FaBars size={20} className="text-gray-800 dark:text-white" />}
          </button>
        </div>
        
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col space-y-3">
              {menuItems.map((i) => {
                const cls = 'flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-white';
                const inner = (<><span className="flex items-center space-x-3"><i.icon size={18} /><span>{i.label}</span></span>{i.badge && unreadCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{unreadCount}</span>}</>);
                return i.external
                  ? <a key={i.id} href={i.to} target={i.newTab ? '_blank' : undefined} rel="noreferrer" onClick={() => setIsMenuOpen(false)} className={cls}>{inner}</a>
                  : <Link key={i.id} to={i.to} onClick={() => setIsMenuOpen(false)} className={cls}>{inner}</Link>;
              })}
              <button onClick={toggleDarkMode} className="flex items-center space-x-3 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-white">
                {darkMode ? <FaSun size={18} /> : <FaMoon size={18} />}<span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button onClick={handleLogout} className="flex items-center space-x-3 px-2 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900">
                <FaSignOutAlt size={18} /><span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;