import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Search, UploadCloud } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserAvatar } from '../common/UserAvatar';

export const Header = ({ onOpenMobileMenu, onOpenUploadModal }) => {
  const { user, isViewer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/documents')) return 'Documents';
    if (path.startsWith('/shared')) return 'Shared with me';
    if (path.startsWith('/search')) return 'Search';
    if (path.startsWith('/categories')) return 'Categories';
    if (path.startsWith('/audit-logs')) return user?.role === 'admin' ? 'Audit logs' : 'Activity';
    if (path.startsWith('/users')) return 'Users & Access';
    if (path.startsWith('/settings')) return 'Settings';
    return 'Documents';
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-[#0A0B0D]/90 backdrop-blur-md border-b border-[#282A33] px-4 sm:px-8 flex items-center justify-between">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#1C1E23] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base sm:text-lg font-semibold text-[#FFFFFF] tracking-tight">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search shortcut button */}
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#15161A] border border-[#282A33] text-xs text-[#8E95A5] hover:text-[#FFFFFF] hover:border-[#E8DFD8]/40 transition-all"
        >
          <Search className="w-3.5 h-3.5 text-[#E8DFD8]" />
          <span className="hidden sm:inline">Search documents...</span>
        </button>

        {/* Upload Action */}
        {!isViewer && onOpenUploadModal && (
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl vault-beige-btn text-xs font-semibold shadow-sm transition-all"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        )}

        {/* Profile Avatar */}
        <button
          onClick={() => navigate('/settings')}
          className="rounded-full hover:ring-2 hover:ring-[#E8DFD8]/40 transition-all"
          title="Account settings"
        >
          <UserAvatar user={user} size="sm" />
        </button>
      </div>
    </header>
  );
};
