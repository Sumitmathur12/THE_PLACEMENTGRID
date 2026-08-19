import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Flame, Target, BookOpen, Compass, Award, ShieldAlert, FileText, Users, LogOut, LogIn } from 'lucide-react';

export default function Header({ user, logout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Award, auth: true },
    { name: 'Companies', path: '/companies', icon: Compass, auth: false },
    { name: 'Practice', path: '/practice', icon: Target, auth: true },
    { name: 'Mock Interview', path: '/interview', icon: ShieldAlert, auth: true },
    { name: 'Resume Analyzer', path: '/resume', icon: FileText, auth: true },
    { name: 'Peer Board', path: '/experiences', icon: Users, auth: false },
  ];

  return (
    <header className="bg-cream-200 border-b border-cream-300 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🎓</span>
              <span className="font-serif font-bold text-lg sm:text-xl tracking-tight text-sage-700">
                THE_<span className="text-terracotta-500">PlacementGRID</span>
              </span>
            </Link>
          </div>

          {/* Navigation Items (Desktop) */}
          <nav className="hidden md:flex space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              if (!user) return null;
              const isActive = location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sage-500 text-white shadow-paper'
                      : 'text-charcoal-900 hover:bg-cream-300'
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile / Auth Area */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Pinned Target Company */}
                {user.targetCompany && (
                  <div className="hidden sm:flex items-center gap-1 bg-terracotta-100 text-terracotta-700 text-xs px-2.5 py-1 rounded-full border border-terracotta-500/20 font-medium">
                    <Target size={12} />
                    <span>Target: {user.targetCompany}</span>
                  </div>
                )}

                {/* Streak Badge */}
                <div className="flex items-center gap-1 bg-sage-100 text-sage-700 text-xs px-2.5 py-1 rounded-full border border-sage-500/20 font-medium" title="Consistent Study Streak">
                  <Flame size={12} className="text-terracotta-500 fill-terracotta-500 animate-pulse" />
                  <span>{user.streakCount || 0} Day Streak</span>
                </div>

                {/* Log Out */}
                <button
                  onClick={() => { logout(); navigate('/'); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-charcoal-500 hover:text-terracotta-500 hover:bg-cream-300 rounded-md transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 bg-sage-500 hover:bg-sage-600 text-white px-4 py-2 rounded-md text-sm font-medium shadow-paper transition-all"
              >
                <LogIn size={16} />
                <span>Log In</span>
              </Link>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Scrollable Sub-nav */}
      {user && (
        <div className="md:hidden flex border-t border-cream-300 bg-cream-50 overflow-x-auto whitespace-nowrap scrollbar-none px-2 py-1.5 space-x-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-sage-500 text-white shadow-paper'
                    : 'text-charcoal-900 hover:bg-cream-200'
                }`}
              >
                <Icon size={12} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
