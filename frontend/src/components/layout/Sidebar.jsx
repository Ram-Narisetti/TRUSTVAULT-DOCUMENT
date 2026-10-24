import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Files,
  Share2,
  Search,
  FolderOpen,
  History,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';
import { UserAvatar } from '../common/UserAvatar';

export const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) => {
  const { user, logout, isAdmin, isViewer } = useAuth();

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'owner', 'viewer'],
    },
    ...(!isViewer
      ? [
          {
            to: '/documents',
            label: 'Documents',
            icon: Files,
            roles: ['admin', 'owner'],
          },
        ]
      : []),
    {
      to: '/shared',
      label: 'Shared with me',
      icon: Share2,
      roles: ['admin', 'owner', 'viewer'],
    },
    {
      to: '/search',
      label: 'Search',
      icon: Search,
      roles: ['admin', 'owner', 'viewer'],
    },
    {
      to: '/categories',
      label: 'Categories',
      icon: FolderOpen,
      roles: ['admin', 'owner', 'viewer'],
    },
    {
      to: '/audit-logs',
      label: isAdmin ? 'Audit logs' : 'Activity',
      icon: History,
      roles: ['admin', 'owner'],
    },
    ...(isAdmin
      ? [
          {
            to: '/users',
            label: 'Users & Access',
            icon: Users,
            roles: ['admin'],
          },
        ]
      : []),
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
      roles: ['admin', 'owner', 'viewer'],
    },
  ];

  const filteredItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#101114] border-r border-[#282A33] text-[#F4F4F6]">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-[#282A33]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1C1E23] border border-[#282A33] flex items-center justify-center text-[#E8DFD8]">
            <Lock className="w-4 h-4 text-[#E8DFD8]" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-base tracking-tight text-[#FFFFFF]">
              TrustVault
            </span>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex p-1.5 rounded-lg text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#1C1E23] transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#1C1E23] text-[#FFFFFF] border border-[#282A33] font-semibold'
                    : 'text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#15161A]'
                }`
              }
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </div>

      {/* User Account / Footer */}
      <div className="p-3 border-t border-[#282A33]">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#15161A] transition-colors">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <UserAvatar user={user} size="sm" />
            {!isCollapsed && (
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-[#FFFFFF] truncate">{user?.full_name}</p>
                <p className="text-[11px] text-[#8E95A5] capitalize truncate">{user?.role}</p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#F87171] hover:bg-[#1C1E23] transition-colors flex-shrink-0"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block transition-all duration-200 ease-in-out h-screen sticky top-0 z-30 ${
          isCollapsed ? 'w-20' : 'w-56'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-[#101114] shadow-2xl z-10 animate-in slide-in-from-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
