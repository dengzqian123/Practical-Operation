import { useState } from 'react';
import {
  Clapperboard, LayoutDashboard, MessageSquare, Film,
  FolderOpen, User, LogOut, Settings, ChevronLeft,
  ChevronRight, Bell, Menu, X, Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Page = 'dashboard' | 'generate' | 'works' | 'projects' | 'explore' | 'apikeys' | 'settings' | 'profile';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

const navItems = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'generate' as Page, label: 'Generate', icon: MessageSquare },
  { id: 'works' as Page, label: 'My Works', icon: Film },
  { id: 'projects' as Page, label: 'Projects', icon: FolderOpen },
];

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const { profile, signOut, isAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const avatarText = (profile?.display_name || profile?.username || 'U')[0].toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Clapperboard className="w-4 h-4 text-white" />
        </div>
        {!collapsed && <span className="text-base font-bold text-white tracking-tight">FrameForge AI</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => { onNavigate(id); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${active
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'}
                ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 pb-4 pt-2 border-t border-gray-800 space-y-1">
        {isAdmin && (
          <button
            onClick={() => { onNavigate('apikeys'); setMobileOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
              ${currentPage === 'apikeys' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'}
              ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'API Keys' : undefined}
          >
            <Key size={18} />
            {!collapsed && <span>API Keys</span>}
          </button>
        )}

        <button
          onClick={() => { onNavigate('settings'); setMobileOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
            ${currentPage === 'settings' ? 'bg-cyan-500/15 text-cyan-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'}
            ${collapsed ? 'justify-center' : ''}`}
        >
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </button>

        <button
          onClick={() => { onNavigate('profile'); setMobileOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
            ${currentPage === 'profile' ? 'bg-cyan-500/15 text-cyan-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'}
            ${collapsed ? 'justify-center' : ''}`}
        >
          <User size={18} />
          {!collapsed && <span>Profile</span>}
        </button>

        <button
          onClick={signOut}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-gray-900 border-r border-gray-800 flex-shrink-0 transition-all duration-300 relative
          ${collapsed ? 'w-16' : 'w-60'}`}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-gray-700 border border-gray-600 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-600 transition-colors z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Menu size={18} />
          </button>

          <div className="flex-1" />

          {isAdmin && (
            <button
              onClick={() => onNavigate('apikeys')}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                ${currentPage === 'apikeys'
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
                  : 'text-gray-400 border-gray-700 hover:text-white hover:bg-gray-800'}`}
            >
              <Key size={13} />
              API Keys
            </button>
          )}

          <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors relative">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-cyan-500 rounded-full" />
          </button>

          <button
            onClick={() => onNavigate('profile')}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">
              {avatarText}
            </div>
            <span className="text-sm text-gray-300 hidden sm:block">
              {profile?.display_name || profile?.username || 'User'}
            </span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
