import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import {
  FolderGit2,
  HardDrive,
  Radio,
  Upload,
  Database,
  Search,
  LogOut,
  Megaphone,
  Bot,
  Clock,
  Menu,
  X,
  ShieldCheck,
  FolderOpen,
  Layers,
  UserCheck,
  FileCheck2,
  BarChart3,
} from 'lucide-react';
import svnhsLogo from '../assets/images/svnhs_school_logo_1784856263175.jpg';

interface HeaderProps {
  activeTab: 'files' | 'my-workspace' | 'announcements' | 'admin' | 'submission-report' | 'copilot';
  setActiveTab: (tab: 'files' | 'my-workspace' | 'announcements' | 'admin' | 'submission-report' | 'copilot') => void;
  totalStorageUsedGb: number;
  totalEgressGbps: number;
  totalFilesCount: number;
  announcementsCount?: number;
  onOpenUploadModal: () => void;
  onPostAnnouncementClick?: () => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalStorageUsedGb,
  totalEgressGbps,
  totalFilesCount,
  announcementsCount = 0,
  onOpenUploadModal,
  onPostAnnouncementClick,
  globalSearchQuery,
  setGlobalSearchQuery,
  currentUser,
  onLogout,
}) => {
  const [timeUtc, setTimeUtc] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isCoordinator =
    currentUser?.designation === 'Coordinator' ||
    (currentUser?.designation?.toLowerCase().includes('coordinator') ?? false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeUtc(now.toISOString().substring(11, 19) + ' UTC');
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-[#141c2c]/95 border-b border-[#24334b] sticky top-0 z-40 backdrop-blur-md shadow-xs transition-colors duration-200">
      {/* Main Header Nav */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5">
        <div className="flex items-center justify-between gap-3">
          {/* Brand & Logo */}
          <div className="flex items-center space-x-3 sm:space-x-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full overflow-hidden border-2 border-blue-500/30 shadow-xs shrink-0 bg-[#0d1524] flex items-center justify-center p-0.5 transition-transform duration-200 hover:scale-105">
              <img
                src={svnhsLogo}
                alt="San Vicente National High School Logo"
                className="w-full h-full object-contain rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-100 tracking-tight font-sans truncate">
                  SVNHS <span className="text-blue-400">Portal</span>
                </h1>
                <span className="hidden xs:inline-block bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded-md uppercase tracking-wider font-extrabold shrink-0 shadow-2xs">
                  CARAGA Region
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-medium truncate">
                Official School Online Portal
              </p>
            </div>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex items-center space-x-2 md:hidden">
            {currentUser && (
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                {currentUser.role === 'Faculty' ? '👨‍🏫' : currentUser.role === 'Student' ? '🎓' : '🛡️'}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2.5 bg-[#1c273a] hover:bg-[#25344d] text-slate-100 rounded-xl border border-[#2d3e57] transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6 text-slate-200" /> : <Menu className="w-6 h-6 text-slate-200" />}
            </button>
          </div>

          {/* Desktop Search & Controls */}
          <div className="hidden md:flex items-center space-x-3.5">
            {/* Desktop Nav Tabs */}
            <nav className="flex items-center space-x-1 bg-[#0d1524] p-1.5 rounded-2xl border border-[#24334b] shadow-2xs">
              {currentUser?.role === 'Faculty' && (
                <button
                  onClick={() => setActiveTab('my-workspace')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap cursor-pointer relative ${
                    activeTab === 'my-workspace'
                      ? 'bg-blue-600 text-white shadow-2xs scale-[1.02]'
                      : 'text-slate-300 hover:text-white hover:bg-[#1a2638] hover:scale-[1.01]'
                  }`}
                >
                  <FolderOpen className={`w-4 h-4 ${activeTab === 'my-workspace' ? 'text-emerald-300' : 'text-emerald-400'}`} />
                  <span>My Workspace</span>
                  <span className="bg-emerald-500 text-slate-950 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                    Personal
                  </span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('announcements')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap cursor-pointer relative ${
                  activeTab === 'announcements'
                    ? 'bg-blue-600 text-white shadow-2xs scale-[1.02]'
                    : 'text-slate-300 hover:text-white hover:bg-[#1a2638] hover:scale-[1.01]'
                }`}
              >
                <Megaphone className={`w-4 h-4 ${activeTab === 'announcements' ? 'text-amber-300' : 'text-amber-400'}`} />
                <span>Announcements</span>
                {announcementsCount !== undefined && announcementsCount > 0 && (
                  <span className="bg-amber-500 text-slate-950 font-mono text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                    {announcementsCount}
                  </span>
                )}
              </button>

              {currentUser?.role === 'Admin' && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap cursor-pointer relative ${
                    activeTab === 'admin'
                      ? 'bg-blue-600 text-white shadow-2xs scale-[1.02]'
                      : 'text-slate-300 hover:text-white hover:bg-[#1a2638] hover:scale-[1.01]'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 ${activeTab === 'admin' ? 'text-amber-300' : 'text-amber-400'}`} />
                  <span>Admin Dashboard</span>
                </button>
              )}

              {/* Submission Report Button next to Admin Dashboard (Hidden for Coordinator) */}
              {!isCoordinator && (
                <button
                  onClick={() => setActiveTab('submission-report')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap cursor-pointer relative ${
                    activeTab === 'submission-report'
                      ? 'bg-blue-600 text-white shadow-2xs scale-[1.02]'
                      : 'text-slate-300 hover:text-white hover:bg-[#1a2638] hover:scale-[1.01]'
                  }`}
                >
                  <FileCheck2 className={`w-4 h-4 ${activeTab === 'submission-report' ? 'text-emerald-300' : 'text-emerald-400'}`} />
                  <span>Submission Report</span>
                </button>
              )}
            </nav>

            {/* Action Buttons */}
            {currentUser?.role === 'Admin' && onPostAnnouncementClick && (
              <button
                onClick={onPostAnnouncementClick}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-mono font-bold rounded-xl transition-all duration-200 shadow-2xs flex items-center space-x-2 shrink-0 cursor-pointer border border-blue-600 hover:scale-[1.02] active:scale-95"
              >
                <Megaphone className="w-4 h-4 text-white" />
                <span>Post</span>
              </button>
            )}

            {currentUser && (
              <div className="flex items-center space-x-2.5 bg-[#0d1524] border border-[#24334b] p-1.5 pl-3 rounded-2xl font-sans text-xs shrink-0 shadow-2xs">
                <div className="text-left">
                  <div className="text-slate-100 font-extrabold text-xs sm:text-sm leading-tight truncate max-w-[130px]">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                    {currentUser.designation || currentUser.role}
                  </div>
                </div>

                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Sign Out"
                    className="p-2 bg-[#1c273a] hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 rounded-xl transition-all duration-200 border border-[#2d3e57] hover:border-rose-500/40 flex items-center cursor-pointer font-bold active:scale-95"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Drawer / Expandable Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-[#24334b] space-y-3 font-sans animate-fadeIn transition-all duration-200">
            {/* Mobile Tabs */}
            <div className={`grid ${currentUser?.role === 'Admin' || currentUser?.role === 'Faculty' ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5 bg-[#0d1524] p-1.5 rounded-2xl border border-[#24334b]`}>
              {currentUser?.role === 'Faculty' && (
                <button
                  onClick={() => {
                    setActiveTab('my-workspace');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-xs font-bold transition-all duration-200 min-h-[44px] cursor-pointer ${
                    activeTab === 'my-workspace'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-300 hover:bg-[#1a2638]'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 mb-1 text-emerald-400" />
                  <span>My Folders</span>
                </button>
              )}

              <button
                onClick={() => {
                  setActiveTab('announcements');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-xs font-bold transition-all duration-200 min-h-[44px] cursor-pointer relative ${
                  activeTab === 'announcements'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:bg-[#1a2638]'
                }`}
              >
                <div className="relative flex items-center">
                  <Megaphone className={`w-4 h-4 mb-1 ${activeTab === 'announcements' ? 'text-amber-300' : 'text-amber-400'}`} />
                  {announcementsCount !== undefined && announcementsCount > 0 && (
                    <span className="absolute -top-1 -right-3 bg-amber-500 text-slate-950 font-mono text-[9px] font-extrabold px-1 rounded-full">
                      {announcementsCount}
                    </span>
                  )}
                </div>
                <span>Announcements</span>
              </button>

              {currentUser?.role === 'Admin' && (
                <button
                  onClick={() => {
                    setActiveTab('admin');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-xs font-bold transition-all duration-200 min-h-[44px] cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-300 hover:bg-[#1a2638]'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 mb-1 ${activeTab === 'admin' ? 'text-amber-300' : 'text-amber-400'}`} />
                  <span>Admin</span>
                </button>
              )}

              {!isCoordinator && (
                <button
                  onClick={() => {
                    setActiveTab('submission-report');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-xs font-bold transition-all duration-200 min-h-[44px] cursor-pointer ${
                    activeTab === 'submission-report'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-300 hover:bg-[#1a2638]'
                  }`}
                >
                  <FileCheck2 className={`w-4 h-4 mb-1 ${activeTab === 'submission-report' ? 'text-emerald-300' : 'text-emerald-400'}`} />
                  <span>Reports</span>
                </button>
              )}
            </div>

            {/* Mobile Action Buttons */}
            {currentUser?.role === 'Admin' && onPostAnnouncementClick && (
              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => {
                    onPostAnnouncementClick();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all duration-200 shadow-2xs flex items-center justify-center space-x-1.5 min-h-[44px] cursor-pointer border border-blue-600"
                >
                  <Megaphone className="w-4 h-4 text-white" />
                  <span>Post Announcement</span>
                </button>
              </div>
            )}

            {/* Mobile User Profile Info & Logout */}
            {currentUser && (
              <div className="flex items-center justify-between bg-[#0d1524] border border-[#24334b] p-2.5 rounded-xl text-xs">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center justify-center font-bold text-sm shrink-0">
                    {currentUser.role === 'Faculty' ? '👨‍🏫' : currentUser.role === 'Student' ? '🎓' : '🛡️'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-100 font-bold truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium truncate">
                      {currentUser.email} • <span className="text-blue-400 font-bold">{currentUser.role}</span>
                    </div>
                  </div>
                </div>

                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="px-3 py-2 bg-[#1c273a] hover:bg-rose-500/20 text-rose-300 rounded-xl transition-all duration-200 border border-[#2d3e57] hover:border-rose-500/40 flex items-center space-x-1 text-xs font-bold cursor-pointer shrink-0 min-h-[40px]"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

