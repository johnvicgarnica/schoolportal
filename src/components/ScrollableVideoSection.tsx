import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  Film,
  ShieldCheck,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { EmbeddedVideo } from '../types';
import { FineTunedVideoPlayer } from './FineTunedVideoPlayer';

interface ScrollableVideoSectionProps {
  videos: EmbeddedVideo[];
  className?: string;
}

/**
 * Normalizes embed code:
 * - If admin pasted a direct YouTube or Vimeo or Google Drive URL, convert to responsive iframe
 * - If admin pasted <iframe> or <video>, ensure allowfullscreen and remove restrictive hardcoded inline styles
 */
export const formatEmbedCode = (rawCode: string): string => {
  const trimmed = (rawCode || '').trim();
  if (!trimmed) return '';

  // 1. Direct YouTube watch URL - enforce autoplay=0
  const ytWatchMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i);
  if (ytWatchMatch && ytWatchMatch[1]) {
    return `<iframe src="https://www.youtube.com/embed/${ytWatchMatch[1]}?autoplay=0&enablejsapi=1&rel=0" title="SVNHS Video" frameborder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy" class="w-full h-full"></iframe>`;
  }

  // 2. Direct youtu.be short URL - enforce autoplay=0
  const ytShortMatch = trimmed.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/i);
  if (ytShortMatch && ytShortMatch[1]) {
    return `<iframe src="https://www.youtube.com/embed/${ytShortMatch[1]}?autoplay=0&enablejsapi=1&rel=0" title="SVNHS Video" frameborder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy" class="w-full h-full"></iframe>`;
  }

  // 3. Direct Google Drive preview URL - remove allow="autoplay"
  const gDriveMatch = trimmed.match(/(?:https?:\/\/)?drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(?:view|preview)/i);
  if (gDriveMatch && gDriveMatch[1]) {
    return `<iframe src="https://drive.google.com/file/d/${gDriveMatch[1]}/preview" title="SVNHS Google Drive Video" allowfullscreen loading="lazy" class="w-full h-full"></iframe>`;
  }

  // 4. HTML5 direct video file (.mp4, .webm) - no autoplay, controls enabled
  if (trimmed.match(/^https?:\/\/.+\.(mp4|webm|ogg)(\?.*)?$/i)) {
    return `<video controls playsinline preload="metadata" class="w-full h-full object-contain bg-black"><source src="${trimmed}" type="video/mp4">Your browser does not support the video tag.</video>`;
  }

  // 5. Raw <iframe> or <video> code provided by Master Admin
  let formatted = trimmed;

  // Strict anti-autoplay sanitizer: remove autoplay parameters and attributes
  formatted = formatted.replace(/autoplay=1/gi, 'autoplay=0');
  formatted = formatted.replace(/\bautoplay\b/gi, '');
  formatted = formatted.replace(/allow=["']([^"']*?)autoplay;?([^"']*?)["']/gi, 'allow="$1$2"');

  // Ensure allowfullscreen is present on iframes
  if (formatted.includes('<iframe') && !formatted.includes('allowfullscreen')) {
    formatted = formatted.replace('<iframe', '<iframe allowfullscreen loading="lazy"');
  } else if (formatted.includes('<iframe') && !formatted.includes('loading=')) {
    formatted = formatted.replace('<iframe', '<iframe loading="lazy"');
  }

  // Ensure video tags have controls and preload metadata
  if (formatted.includes('<video')) {
    if (!formatted.includes('controls')) {
      formatted = formatted.replace('<video', '<video controls');
    }
    if (!formatted.includes('preload=')) {
      formatted = formatted.replace('<video', '<video preload="metadata"');
    }
    if (!formatted.includes('playsinline')) {
      formatted = formatted.replace('<video', '<video playsinline');
    }
  }

  return formatted;
};

export const ScrollableVideoSection: React.FC<ScrollableVideoSectionProps> = ({
  videos,
  className = '',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Check scroll boundary to enable/disable buttons
  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);

    // Calculate approx active index based on scroll position
    if (clientWidth > 0) {
      const idx = Math.round(scrollLeft / clientWidth);
      setActiveIndex(Math.min(Math.max(idx, 0), (videos?.length || 1) - 1));
    }
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
      return () => {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [videos]);

  const scrollToNext = () => {
    if (!scrollContainerRef.current) return;
    const { clientWidth } = scrollContainerRef.current;
    scrollContainerRef.current.scrollBy({ left: clientWidth * 0.9, behavior: 'smooth' });
  };

  const scrollToPrev = () => {
    if (!scrollContainerRef.current) return;
    const { clientWidth } = scrollContainerRef.current;
    scrollContainerRef.current.scrollBy({ left: -clientWidth * 0.9, behavior: 'smooth' });
  };

  const scrollToIndex = (index: number) => {
    if (!scrollContainerRef.current) return;
    const { clientWidth } = scrollContainerRef.current;
    scrollContainerRef.current.scrollTo({ left: index * clientWidth, behavior: 'smooth' });
    setActiveIndex(index);
  };

  const hasVideos = videos && videos.length > 0;

  return (
    <section
      aria-label="Campus Video Broadcasts"
      className={`w-full bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 backdrop-blur-md shadow-sm animate-fadeIn text-slate-800 flex flex-col justify-between h-[480px] space-y-4 ${className}`}
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
            <Video className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Campus Video Presentations
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Master Admin Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 font-sans">
              Official instructional videos & multimedia broadcasts
            </p>
          </div>
        </div>

        {/* Action Controls & Pagination */}
        <div className="flex items-center space-x-2">
          {hasVideos ? (
            <>
              <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                {videos.length} {videos.length === 1 ? 'Video' : 'Videos'}
              </span>

              {/* Prev / Next buttons if multiple videos */}
              {videos.length > 1 && (
                <div className="flex items-center space-x-1 pl-1">
                  <button
                    type="button"
                    onClick={scrollToPrev}
                    disabled={!canScrollLeft}
                    aria-label="Previous Video"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={scrollToNext}
                    disabled={!canScrollRight}
                    aria-label="Next Video"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              Official Channel
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {hasVideos ? (
        <div className="space-y-4">
          {/* Scrollable Container with Horizontal Snap */}
          <div
            ref={scrollContainerRef}
            className="flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory pb-3 pt-1 scroll-smooth focus:outline-hidden custom-scrollbar"
            style={{ scrollbarWidth: 'thin' }}
          >
            {videos.map((video, index) => {
              const formattedHtml = formatEmbedCode(video.embedCode);
              return (
                <div
                  key={video.id || index}
                  className="w-full shrink-0 snap-center flex flex-col space-y-3 bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow"
                >
                  {/* Embedded Video Player with Fine-Tuned Play/Pause & Zero Autoplay */}
                  <FineTunedVideoPlayer
                    embedCode={video.embedCode}
                    title={video.title}
                  />

                  {/* Video Meta Information */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pt-1">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md">
                          Video #{index + 1}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                          {video.title}
                        </h3>
                      </div>
                      {video.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 font-sans">
                          {video.description}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center space-x-2 text-[11px] font-mono text-slate-500">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{video.createdAt || 'Recent'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dots Indicator for multiple videos */}
          {videos.length > 1 && (
            <div className="flex items-center justify-center space-x-2 pt-1">
              {videos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollToIndex(i)}
                  aria-label={`Go to video ${i + 1}`}
                  className={`transition-all rounded-full cursor-pointer ${
                    activeIndex === i
                      ? 'w-6 h-2 bg-emerald-600'
                      : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Empty State: Only provided code of Master Admin will be shown */
        <div className="py-8 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
            <Film className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-sm font-bold text-slate-800">
              No Embedded Videos Available Yet
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Only official HTML or iframe video codes provided by the Master Admin will be displayed in this section.
            </p>
          </div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-mono text-slate-600 shadow-2xs">
            <Info className="w-3 h-3 text-slate-400" />
            <span>Master Admin can configure embedded video codes in the Admin Dashboard</span>
          </div>
        </div>
      )}
    </section>
  );
};
