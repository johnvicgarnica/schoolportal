import React, { useState, useMemo } from 'react';
import { UserProfile } from '../types';
import { UserPresence, isPresenceOnline, FacultyDoc, AdminDoc } from '../lib/firebase';
import {
  Users,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Laptop,
  Smartphone,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  Activity,
  User,
  GraduationCap,
  Sparkles,
  Radio,
  Eye,
  AlertCircle,
} from 'lucide-react';

interface AdminOnlineUsersMonitorProps {
  currentUser: UserProfile;
  presences: UserPresence[];
  facultyList: FacultyDoc[];
  adminList: AdminDoc[];
  onForceLogoutUser?: (email: string) => Promise<void>;
}

export const AdminOnlineUsersMonitor: React.FC<AdminOnlineUsersMonitorProps> = ({
  currentUser,
  presences,
  facultyList,
  adminList,
  onForceLogoutUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Faculty' | 'Admin'>('all');
  const [viewScope, setViewScope] = useState<'online-only' | 'all-registered'>('online-only');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [terminatingEmail, setTerminatingEmail] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [confirmLogoutUser, setConfirmLogoutUser] = useState<{ email: string; name: string } | null>(null);

  // Derive online users (presence within 2 minutes and not marked offline)
  const onlinePresences = useMemo(() => {
    return presences.filter((p) => isPresenceOnline(p));
  }, [presences]);

  const onlineFacultyCount = useMemo(() => {
    return onlinePresences.filter((p) => p.role === 'Faculty').length;
  }, [onlinePresences]);

  const onlineAdminCount = useMemo(() => {
    return onlinePresences.filter((p) => p.role === 'Admin').length;
  }, [onlinePresences]);

  const totalRegisteredUsers = (facultyList.length || 0) + (adminList.length || 0);

  // Map of presences by normalized email
  const presenceMap = useMemo(() => {
    const map = new Map<string, UserPresence>();
    presences.forEach((p) => {
      if (p.email) {
        map.set(p.email.toLowerCase().trim(), p);
      }
    });
    return map;
  }, [presences]);

  // Combined registered users list for "all-registered" view
  const allUsersUnified = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      email: string;
      role: 'Faculty' | 'Admin';
      department: string;
      designation?: string;
      advisoryRole?: 'Class Adviser' | 'Non-Adviser';
      presence?: UserPresence;
      isOnline: boolean;
    }> = [];

    // Admins
    adminList.forEach((a) => {
      const cleanEmail = (a.email || '').toLowerCase().trim();
      const p = presenceMap.get(cleanEmail);
      list.push({
        id: a.id || `admin-${cleanEmail}`,
        name: a.name || 'Administrator',
        email: cleanEmail,
        role: 'Admin',
        department: 'School Administration',
        designation: a.designation || 'Administrator',
        presence: p,
        isOnline: p ? isPresenceOnline(p) : false,
      });
    });

    // Faculty
    facultyList.forEach((f) => {
      const cleanEmail = (f.email || '').toLowerCase().trim();
      const p = presenceMap.get(cleanEmail);
      list.push({
        id: f.id || `faculty-${cleanEmail}`,
        name: f.name || 'Faculty Member',
        email: cleanEmail,
        role: 'Faculty',
        department: f.department || 'Senior High School Department',
        advisoryRole: f.advisoryRole || 'Non-Adviser',
        presence: p,
        isOnline: p ? isPresenceOnline(p) : false,
      });
    });

    return list;
  }, [adminList, facultyList, presenceMap]);

  // Filtered dataset
  const displayedItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    if (viewScope === 'online-only') {
      return onlinePresences.filter((p) => {
        const matchesRole = roleFilter === 'all' || p.role === roleFilter;
        const matchesSearch =
          !term ||
          p.name.toLowerCase().includes(term) ||
          p.email.toLowerCase().includes(term) ||
          (p.designation || '').toLowerCase().includes(term) ||
          (p.department || '').toLowerCase().includes(term);
        return matchesRole && matchesSearch;
      });
    } else {
      return allUsersUnified.filter((u) => {
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        const matchesSearch =
          !term ||
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          (u.designation || '').toLowerCase().includes(term) ||
          (u.department || '').toLowerCase().includes(term);
        return matchesRole && matchesSearch;
      });
    }
  }, [viewScope, onlinePresences, allUsersUnified, roleFilter, searchTerm]);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  const executeForceLogout = async (email: string, name: string) => {
    setTerminatingEmail(email);
    setConfirmLogoutUser(null);
    try {
      if (onForceLogoutUser) {
        await onForceLogoutUser(email);
      }
      setActionNotice(`Successfully terminated active session for ${name}`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch {
      setActionNotice(`Failed to terminate session for ${name}.`);
    } finally {
      setTerminatingEmail(null);
    }
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
      if (diffSecs < 10) return 'Just now';
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  const formatTabName = (tab?: string) => {
    switch (tab) {
      case 'my-workspace':
        return 'Personal Faculty Workspace';
      case 'files':
        return 'School Repository Files';
      case 'announcements':
        return 'School Bulletins & Memorandums';
      case 'admin':
        return 'Master Admin Dashboard';
      case 'submission-report':
        return 'Faculty Submission Report';
      case 'copilot':
        return 'AI Assistant';
      default:
        return 'Active in Portal';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn font-sans">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div className="bg-emerald-600 text-white font-mono text-xs font-bold px-4 py-3 rounded-2xl shadow-lg border border-emerald-400 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="p-1 hover:bg-emerald-700 rounded-lg cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Main Header Card with Live Status Indicator */}
      <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-400 shadow-xs">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl sm:text-2xl font-bold font-mono text-slate-100 tracking-tight">
                    Live Active & Logged-In Users
                  </h2>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] px-2 py-0.5 rounded-full font-mono font-extrabold uppercase flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Live Firestore Stream</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Real-time telemetry showing verified DepEd users currently active or logged into the SVNHS repository.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-stretch md:self-auto justify-end">
            <div className="bg-[#0c1320] border border-[#24334b] px-4 py-2.5 rounded-2xl flex items-center space-x-3 text-xs font-mono">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Network Heartbeat</div>
                <div className="text-emerald-400 font-extrabold">Active (30s Tick)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
          {/* Card 1: Total Online Now */}
          <div className="bg-[#0c1320] border border-emerald-500/30 rounded-2xl p-4 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                Active Users Now
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="text-3xl font-mono font-black text-white mt-2 flex items-baseline space-x-1">
              <span>{onlinePresences.length}</span>
              <span className="text-xs text-slate-400 font-normal">users</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Currently connected & browsing
            </p>
          </div>

          {/* Card 2: Online Faculty */}
          <div className="bg-[#0c1320] border border-blue-500/30 rounded-2xl p-4 relative overflow-hidden group hover:border-blue-500/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wider">
                Faculty Online
              </span>
              <GraduationCap className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-mono font-black text-white mt-2 flex items-baseline space-x-1">
              <span>{onlineFacultyCount}</span>
              <span className="text-xs text-slate-400 font-normal">of {facultyList.length}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Teaching staff with active session
            </p>
          </div>

          {/* Card 3: Online Administrators */}
          <div className="bg-[#0c1320] border border-amber-500/30 rounded-2xl p-4 relative overflow-hidden group hover:border-amber-500/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                Admins Online
              </span>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-mono font-black text-white mt-2 flex items-baseline space-x-1">
              <span>{onlineAdminCount}</span>
              <span className="text-xs text-slate-400 font-normal">of {adminList.length}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Administrators in dashboard
            </p>
          </div>

          {/* Card 4: Total Registered Accounts */}
          <div className="bg-[#0c1320] border border-purple-500/30 rounded-2xl p-4 relative overflow-hidden group hover:border-purple-500/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-purple-400 uppercase tracking-wider">
                Total Registered
              </span>
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-mono font-black text-white mt-2 flex items-baseline space-x-1">
              <span>{totalRegisteredUsers}</span>
              <span className="text-xs text-slate-400 font-normal">accounts</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              School faculty & admin registry
            </p>
          </div>
        </div>
      </div>

      {/* Filter and View Controls Bar */}
      <div className="bg-[#141c2c] border border-[#24334b] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, @deped.gov.ph email, department, role..."
            className="w-full bg-[#0c1320] border border-[#24334b] rounded-xl pl-9 pr-8 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* View Scope Toggle */}
        <div className="flex items-center gap-1.5 bg-[#0c1320] p-1 rounded-xl border border-[#24334b] shrink-0">
          <button
            type="button"
            onClick={() => setViewScope('online-only')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              viewScope === 'online-only'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Online ({onlinePresences.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewScope('all-registered')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              viewScope === 'all-registered'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Registered ({totalRegisteredUsers})</span>
          </button>
        </div>

        {/* Role Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#0c1320] p-1 rounded-xl border border-[#24334b] shrink-0">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Roles
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('Faculty')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              roleFilter === 'Faculty'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Faculty
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('Admin')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              roleFilter === 'Admin'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Admin
          </button>
        </div>
      </div>

      {/* Main Content Area: Users List */}
      <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#24334b] pb-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-mono font-bold text-slate-100 uppercase tracking-wider">
              {viewScope === 'online-only' ? 'Live Logged-In Sessions' : 'All Registered School Personnel Status'}
            </h3>
            <span className="text-xs font-mono text-slate-400">
              ({displayedItems.length} {displayedItems.length === 1 ? 'user' : 'users'})
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Online = Heartbeat &lt; 2m</span>
          </div>
        </div>

        {displayedItems.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-[#0c1320] border border-dashed border-[#24334b] rounded-2xl">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold font-mono text-slate-200">
              {searchTerm
                ? 'No matching users found'
                : viewScope === 'online-only'
                ? 'No Other Users Currently Online'
                : 'No registered accounts found'}
            </h4>
            <p className="text-xs text-slate-400 font-mono max-w-md mx-auto">
              {searchTerm
                ? `No user records matched "${searchTerm}". Try resetting your search filters.`
                : viewScope === 'online-only'
                ? 'Only you are currently connected to the SVNHS Portal. Other teachers or administrators will automatically appear here once they log in.'
                : 'The account directory is currently empty.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#0c1320] border-b border-[#24334b] text-slate-400 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">User Identity</th>
                  <th className="p-3.5">DepEd Email</th>
                  <th className="p-3.5">Role & Title</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Current Screen / Tab</th>
                  <th className="p-3.5">Last Active</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                {displayedItems.map((item: any) => {
                  const isUserActive =
                    viewScope === 'online-only' ? true : Boolean(item.isOnline);
                  const isCurrentMasterAdmin =
                    item.email.toLowerCase() === currentUser.email.toLowerCase();

                  const lastSeenTime =
                    viewScope === 'online-only' ? item.lastSeen : item.presence?.lastSeen;
                  const loginTime =
                    viewScope === 'online-only' ? item.loginTime : item.presence?.loginTime;
                  const currentTab =
                    viewScope === 'online-only' ? item.currentTab : item.presence?.currentTab;
                  const deviceInfo =
                    viewScope === 'online-only' ? item.deviceInfo : item.presence?.deviceInfo;

                  return (
                    <tr
                      key={item.id || item.email}
                      className={`hover:bg-[#1a2436] transition-colors ${
                        isCurrentMasterAdmin ? 'bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* Status Column */}
                      <td className="p-3.5 whitespace-nowrap">
                        {isUserActive ? (
                          <div className="flex items-center space-x-2">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                            </span>
                            <span className="text-[10px] font-black font-mono text-emerald-400 uppercase tracking-wide bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              Online
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="h-2 w-2 rounded-full bg-slate-600 inline-block" />
                            <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wide bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 rounded-full">
                              Offline
                            </span>
                          </div>
                        )}
                      </td>

                      {/* User Identity Column */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0 ${
                              item.role === 'Admin'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            }`}
                          >
                            {(item.name || 'U').charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 flex items-center space-x-1.5">
                              <span>{item.name}</span>
                              {isCurrentMasterAdmin && (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase">
                                  You (Master)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1 mt-0.5">
                              {deviceInfo === 'Mobile Device' ? (
                                <>
                                  <Smartphone className="w-3 h-3 text-slate-400" />
                                  <span>Mobile Web</span>
                                </>
                              ) : (
                                <>
                                  <Laptop className="w-3 h-3 text-slate-400" />
                                  <span>Desktop Web</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* DepEd Email Column */}
                      <td className="p-3.5 whitespace-nowrap font-mono text-slate-300">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-300 font-medium select-all">{item.email}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyEmail(item.email)}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Copy email to clipboard"
                          >
                            {copiedEmail === item.email ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role & Title */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div>
                          <span
                            className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                              item.role === 'Admin'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            }`}
                          >
                            {item.role}
                          </span>
                          <div className="text-[11px] text-slate-300 font-semibold mt-1">
                            {item.designation || (item.advisoryRole === 'Class Adviser' ? 'Class Adviser' : 'Subject Teacher')}
                          </div>
                        </div>
                      </td>

                      {/* Department Column */}
                      <td className="p-3.5 whitespace-nowrap text-slate-300 text-xs">
                        {item.department || 'Senior High School Dept.'}
                      </td>

                      {/* Current Screen / Tab */}
                      <td className="p-3.5 whitespace-nowrap">
                        {isUserActive ? (
                          <div className="inline-flex items-center space-x-1.5 bg-[#0c1320] border border-[#24334b] px-2.5 py-1 rounded-lg text-emerald-300 text-[11px] font-medium">
                            <Eye className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{formatTabName(currentTab)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Not browsing</span>
                        )}
                      </td>

                      {/* Last Active Heartbeat */}
                      <td className="p-3.5 whitespace-nowrap text-slate-300 text-xs">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatTimeAgo(lastSeenTime)}</span>
                        </div>
                        {loginTime && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            In since {new Date(loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="p-3.5 whitespace-nowrap text-right">
                        {!isCurrentMasterAdmin && isUserActive && onForceLogoutUser && (
                          <button
                            type="button"
                            disabled={terminatingEmail === item.email}
                            onClick={() => setConfirmLogoutUser({ email: item.email, name: item.name })}
                            className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer inline-flex items-center space-x-1 hover:border-rose-500"
                            title="Force logout this active user session"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>{terminatingEmail === item.email ? 'Ending...' : 'End Session'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IN-APP CONFIRMATION MODAL TO AVOID WINDOW.CONFIRM */}
      {confirmLogoutUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#141c2c] border border-rose-500/40 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp text-slate-100">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/20 rounded-2xl border border-rose-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold font-mono">Terminate User Session?</h3>
                <p className="text-xs text-slate-400 font-sans">Master Admin Access Control</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Are you sure you want to force log out <span className="font-bold text-slate-100">"{confirmLogoutUser.name}"</span> (<span className="text-emerald-400 font-mono">{confirmLogoutUser.email}</span>)? Their active connection will be terminated immediately.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmLogoutUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeForceLogout(confirmLogoutUser.email, confirmLogoutUser.name)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shadow-sm flex items-center space-x-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect User</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
