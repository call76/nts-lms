// ============================================
// components/BottomNav.js - Mobile Bottom Navigation
// ============================================
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { FaHome, FaNewspaper, FaComment, FaBriefcase, FaUser, FaBook, FaUsers, FaGraduationCap, FaComments } from 'react-icons/fa';

const BottomNav = () => {
  const location = useLocation();
  const { unreadCount, user } = useAuthStore();
  
  const isActive = (path) => location.pathname === path;
  
  const familyRole = ['PARENT', 'TRAINER', 'STUDENT'].includes(user?.role);
  const baseItems = [
    { path: '/', icon: FaHome, label: 'Home' },
    { path: '/feed', icon: FaNewspaper, label: 'Feed' },
    { path: '/learning', icon: FaGraduationCap, label: 'Learn' },
    { path: '/courses', icon: FaBook, label: 'Courses' },
    { path: '/community', icon: FaUsers, label: 'Class' },
    { path: '/messages', icon: FaComment, label: 'Chat', badge: unreadCount },
    { path: '/internships', icon: FaBriefcase, label: 'Jobs' },
    { path: '/profile', icon: FaUser, label: 'Profile' },
  ];
  // Parents, teachers and students get the Parents & Teachers page in place of Courses (courses are inside Learn)
  const raw = familyRole ? baseItems.map((i) => (i.path === '/courses' ? { path: '/family', icon: FaComments, label: 'Family' } : i)) : baseItems;
  // Parents do not use courses, jobs or certificates
  const navItems = user?.role === 'PARENT' ? raw.filter((i) => !['/learning', '/internships'].includes(i.path)) : raw;
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 md:hidden">
      <div className="flex justify-around items-center px-2 py-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`relative flex flex-col items-center py-1 px-3 rounded-lg transition ${
              isActive(item.path) 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-gray-500 dark:text-gray-400 hover:text-green-500'
            }`}
          >
            <item.icon size={20} />
            <span className="text-xs mt-1">{item.label}</span>
            {item.badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;