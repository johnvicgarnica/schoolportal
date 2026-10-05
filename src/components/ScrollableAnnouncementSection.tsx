import React, { useState } from 'react';
import {
  Megaphone,
  Pin,
  Calendar,
  User,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  X,
  Paperclip,
  Clock,
  Sparkles,
  Info,
  AlertCircle
} from 'lucide-react';
import { Announcement } from '../types';

interface ScrollableAnnouncementSectionProps {
  announcements: Announcement[];
  className?: string;
}

export const ScrollableAnnouncementSection: React.FC<ScrollableAnnouncementSectionProps> = ({
  announcements,
  className = '',
}) => {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Filter to published announcements only, sorted by pinned first then by date desc
  const publishedAnnouncements = (announcements || [])
    .filter((a) => a.status === 'published' || !a.status)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 flex items-center space-x-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>Urgent</span>
          </span>
        );
      case 'important':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
            Important
          </span>
        );
      case 'event':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
            Event
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
            General
          </span>
        );
    }
  };

  return (
    <section
      aria-label="School Announcements & Bulletins"
      className={`w-full bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 backdrop-blur-md shadow-sm animate-fadeIn text-slate-800 flex flex-col justify-between h-[480px] space-y-4 ${className}`}
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs">
            <Megaphone className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                School Bulletins
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                DepEd Official
              </span>
            </div>
            <p className="text-xs text-slate-500 font-sans">
              Official faculty advisories & campus notices
            </p>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            {publishedAnnouncements.length} {publishedAnnouncements.length === 1 ? 'Notice' : 'Notices'}
          </span>
        </div>
      </div>

      {/* Scrollable Content Area */}
      {publishedAnnouncements.length > 0 ? (
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
          {publishedAnnouncements.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedAnnouncement(item)}
              className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between space-y-2"
            >
              {/* Card Header: Badges & Pinned */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  {getPriorityBadge(item.priority)}
                  {item.isPinned && (
                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-800 border border-amber-300 text-[10px] font-mono font-bold">
                      <Pin className="w-2.5 h-2.5 fill-current text-amber-600" />
                      <span>Pinned</span>
                    </span>
                  )}
                  {item.targetAudience && (
                    <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                      {item.targetAudience}
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-mono text-slate-400 flex items-center space-x-1 shrink-0">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{item.createdAt || 'Recent'}</span>
                </span>
              </div>

              {/* Title & Preview Text */}
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 font-sans line-clamp-2 leading-relaxed">
                  {item.content}
                </p>
              </div>

              {/* Footer Author & Read More */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 text-[11px] font-mono text-slate-500">
                <div className="flex items-center space-x-1 truncate max-w-[200px]">
                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{item.authorName || 'School Administration'}</span>
                </div>
                <span className="text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform inline-flex items-center text-[10px]">
                  Read Full Notice
                  <ChevronRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-2xs">
            <Megaphone className="w-5 h-5 text-amber-600" />
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-slate-800">
            No Bulletins Posted Yet
          </h4>
          <p className="text-xs text-slate-500 font-sans max-w-xs">
            Official announcements published by school administrators will appear here.
          </p>
        </div>
      )}

      {/* Footer Status Bar */}
      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[10px] font-mono text-slate-500 shrink-0">
        <span className="flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Real-time DepEd Broadcast</span>
        </span>
        <span>Division of Bislig City</span>
      </div>

      {/* DETAILED ANNOUNCEMENT READING MODAL */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-slate-800 space-y-4 my-8 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                {getPriorityBadge(selectedAnnouncement.priority)}
                {selectedAnnouncement.isPinned && (
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-800 border border-amber-300 text-[10px] font-mono font-bold">
                    <Pin className="w-2.5 h-2.5 fill-current text-amber-600" />
                    <span>Pinned</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                aria-label="Close Announcement"
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                {selectedAnnouncement.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 pb-2 border-b border-slate-100">
                <span className="flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedAnnouncement.authorName || 'School Admin'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedAnnouncement.createdAt || 'Recent'}</span>
                </span>
                {selectedAnnouncement.targetAudience && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">{selectedAnnouncement.targetAudience}</span>
                  </>
                )}
              </div>
            </div>

            {/* Full Content */}
            <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar text-xs sm:text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap">
              {selectedAnnouncement.content}
            </div>

            {/* Attachment if present */}
            {selectedAnnouncement.attachmentUrl && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-2 truncate">
                  <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate font-semibold text-slate-800">
                    {selectedAnnouncement.attachmentName || 'Official Document Attachment'}
                  </span>
                </div>
                <a
                  href={selectedAnnouncement.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shrink-0 transition-colors"
                >
                  Download
                </a>
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
