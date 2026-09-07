import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Flame, Target, Compass, BookOpen, ShieldAlert, FileText, Users, LogOut } from 'lucide-react';

export default function SidebarLayout({ user, logout, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Flame },
    { name: 'Companies', path: '/companies', icon: Compass },
    { name: 'Practice', path: '/practice', icon: Target },
    { name: 'Mock Interview', path: '/interview', icon: ShieldAlert },
    { name: 'Resume Analyzer', path: '/resume', icon: FileText },
    { name: 'Peer Board', path: '/experiences', icon: Users },
  ];

  const handleNavClick = (path) => {
    setMobileOpen(false);
    navigate(path);
  };

  return (
    <div className="h-screen w-screen flex bg-cream-100 overflow-hidden font-sans">
      
      {/* 1. Desktop Sidebar (Left side, fixed layout) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-cream-200 border-r border-cream-300 flex-shrink-0">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 border-b border-cream-300">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <span className="font-serif font-bold text-sm text-sage-700 tracking-tight">
              THE_<span className="text-terracotta-500">PlacementGRID</span>
            </span>
          </Link>
        </div>

        {/* Sidebar Menu Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-sage-500 text-white shadow-paper'
                    : 'text-charcoal-900 hover:bg-cream-300'
                }`}
              >
                <Icon size={16} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer (User details & Logout) */}
        <div className="p-4 border-t border-cream-300 flex flex-col gap-3">
          {user && (
            <div className="flex flex-col gap-2">
              {/* Target badge */}
              {user.targetCompany && (
                <div className="flex items-center gap-1.5 bg-terracotta-100 text-terracotta-700 text-[10px] px-2.5 py-1 rounded-full border border-terracotta-500/20 font-medium">
                  <Target size={11} />
                  <span className="truncate">Target: {user.targetCompany}</span>
                </div>
              )}
              {/* Streak badge */}
              <div className="flex items-center gap-1.5 bg-sage-100 text-sage-700 text-[10px] px-2.5 py-1 rounded-full border border-sage-500/20 font-medium">
                <Flame size={11} className="text-terracotta-500 fill-terracotta-500" />
                <span>{user.streakCount || 0} Day Streak</span>
              </div>
            </div>
          )}
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-charcoal-500 hover:text-terracotta-500 hover:bg-cream-300 rounded-lg transition-colors font-semibold"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* 2. Mobile Nav Header & Slide-out drawer */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        
        {/* Mobile Header bar */}
        <header className="lg:hidden h-16 bg-cream-200 border-b border-cream-300 flex items-center justify-between px-4 flex-shrink-0">
          <Link to="/" className="flex items-center gap-1.5">
            <span className="text-lg">🎓</span>
            <span className="font-serif font-bold text-sm text-sage-700">
              THE_<span className="text-terracotta-500">PlacementGRID</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-1 bg-sage-100 text-sage-700 text-[10px] px-2 py-0.5 rounded-full border border-sage-500/20 font-bold">
                <Flame size={10} className="text-terracotta-500 fill-terracotta-500" />
                <span>{user.streakCount}</span>
              </div>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-charcoal-900 focus:outline-none"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Mobile Nav Drawer Overlay */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-charcoal-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>

            {/* Drawer Body */}
            <div className="relative flex flex-col w-64 bg-cream-200 h-full max-w-xs shadow-paper border-r border-cream-300 animate-slide-in">
              <div className="h-16 flex items-center justify-between px-6 border-b border-cream-300">
                <span className="font-serif font-bold text-sm text-sage-700">GRID Navigation</span>
                <button onClick={() => setMobileOpen(false)} className="p-2 text-charcoal-900">
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                  const isActive = location.pathname.startsWith(item.path);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavClick(item.path)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-sage-500 text-white shadow-paper'
                          : 'text-charcoal-900 hover:bg-cream-300'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-cream-300">
                <button
                  onClick={() => { logout(); navigate('/'); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-charcoal-500 hover:text-terracotta-500 hover:bg-cream-300 rounded-lg transition-colors font-semibold"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Main Content Viewport (Independently scrollable) */}
        <main className="flex-1 overflow-y-auto focus:outline-none p-4 sm:p-6 lg:p-8 journal-grid">
          {children}
        </main>
      </div>

    </div>
  );
}
