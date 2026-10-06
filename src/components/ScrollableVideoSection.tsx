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

  // 1. Direct YouTube watch URL - enforce autoplay=1, mute=1, playsinline=1, enablejsapi=1
  const ytWatchMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i);
  if (ytWatchMatch && ytWatchMatch[1]) {
    return `<iframe src="https://www.youtube.com/embed/${ytWatchMatch[1]}?autoplay=1&mute=1&enablejsapi=1&rel=0&playsinline=1&controls=1&fs=1" title="SVNHS Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen class="w-full h-full"></iframe>`;
  }

  // 2. Direct youtu.be short URL - enforce autoplay=1, mute=1, playsinline=1, enablejsapi=1
  const ytShortMatch = trimmed.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/i);
  if (ytShortMatch && ytShortMatch[1]) {
    return `<iframe src="https://www.youtube.com/embed/${ytShortMatch[1]}?autoplay=1&mute=1&enablejsapi=1&rel=0&playsinline=1&controls=1&fs=1" title="SVNHS Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen class="w-full h-full"></iframe>`;
  }

  // 3. Direct Google Drive preview URL
  const gDriveMatch = trimmed.match(/(?:https?:\/\/)?drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(?:view|preview)/i);
  if (gDriveMatch && gDriveMatch[1]) {
    return `<iframe src="https://drive.google.com/file/d/${gDriveMatch[1]}/preview" title="SVNHS Google Drive Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen class="w-full h-full"></iframe>`;
  }

  // 4. HTML5 direct video file (.mp4, .webm) - autoplay with muted, controls enabled, mobile playsinline
  if (trimmed.match(/^https?:\/\/.+\.(mp4|webm|ogg)(\?.*)?$/i)) {
    return `<video controls playsinline webkit-playsinline="true" autoPlay muted preload="auto" class="w-full h-full object-contain object-center bg-black mx-auto"><source src="${trimmed}" type="video/mp4">Your browser does not support the video tag.</video>`;
  }

  // 5. Raw <iframe> or <video> code provided by Master Admin
  let formatted = trimmed;

  // Ensure allowfullscreen and allow="autoplay" are present on iframes without blocking autoplay
  if (formatted.includes('<iframe')) {
    if (!formatted.includes('allow=')) {
      formatted = formatted.replace(
        '<iframe',
        '<iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"'
      );
    } else if (!formatted.includes('autoplay')) {
      formatted = formatted.replace(/allow=["']([^"']*?)["']/i, 'allow="$1; autoplay"');
    }
    if (!formatted.includes('allowfullscreen')) {
      formatted = formatted.replace('<iframe', '<iframe allowfullscreen');
    }
    // Remove loading="lazy" because lazy iframes disable autoplay
    formatted = formatted.replace(/\s*loading=["']lazy["']/gi, '');
  }

  // Ensure video tags have playsinline and autoplay capabilities
  if (formatted.includes('<video')) {
    if (!formatted.includes('controls')) {
      formatted = formatted.replace('<video', '<video controls');
    }
    if (!formatted.includes('playsinline')) {
      formatted = formatted.replace('<video', '<video playsinline webkit-playsinline="true"');
    }
    if (!formatted.includes('autoplay')) {
      formatted = formatted.replace('<video', '<video autoplay muted');
    }
  }

  return formatted;
};

export const ScrollableVideoSection: React.FC<ScrollableVideoSectionProps> = ({
  videos,
  className = '',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const slideItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Check scroll boundary to enable/disable buttons
  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);

    // Calculate approximate active index based on scroll position
    if (clientWidth > 0) {
      const idx = Math.round(scrollLeft / clientWidth);
      const clampedIdx = Math.min(Math.max(idx, 0), (videos?.length || 1) - 1);
      setActiveIndex(clampedIdx);
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

  // High precision IntersectionObserver to detect currently centered slide in view
  useEffect(() => {
    if (!videos || videos.length === 0 || !scrollContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            const rawIdx = entry.target.getAttribute('data-index');
            if (rawIdx !== null) {
              const idx = parseInt(rawIdx, 10);
              if (!isNaN(idx)) {
                setActiveIndex(idx);
              }
            }
          }
        });
      },
      {
        root: scrollContainerRef.current,
        threshold: [0.55, 0.75, 1.0],
      }
    );

    slideItemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [videos]);

  const scrollToNext = () => {
    if (!scrollContainerRef.current) return;
    const nextIdx = Math.min(activeIndex + 1, (videos?.length || 1) - 1);
    scrollToIndex(nextIdx);
  };

  const scrollToPrev = () => {
    if (!scrollContainerRef.current) return;
    const prevIdx = Math.max(activeIndex - 1, 0);
    scrollToIndex(prevIdx);
  };

  const scrollToIndex = (index: number) => {
    if (!scrollContainerRef.current) return;
    const targetElement = slideItemRefs.current[index];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    } else {
      const { clientWidth } = scrollContainerRef.current;
      scrollContainerRef.current.scrollTo({ left: index * clientWidth, behavior: 'smooth' });
    }
    setActiveIndex(index);
  };

  const hasVideos = videos && videos.length > 0;

  return (
    <section
      aria-label="Campus Video Broadcasts"
      className={`w-full bg-white border border-slate-200/90 rounded-3xl p-3 sm:p-4 backdrop-blur-md shadow-sm animate-fadeIn text-slate-800 flex flex-col justify-start h-auto overflow-hidden ${className}`}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2 shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
            <Video className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <h2 className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight leading-tight">
                Campus Video Presentations
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                Master Admin Verified
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-sans leading-none truncate max-w-[200px] sm:max-w-none">
              Official instructional videos & broadcasts
            </p>
          </div>
        </div>

        {/* Action Controls & Pagination */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {hasVideos ? (
            <>
              <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 sm:py-1 rounded-md border border-slate-200">
                {videos.length} {videos.length === 1 ? 'Video' : 'Videos'}
              </span>

              {/* Prev / Next buttons if multiple videos - mobile-friendly touch targets */}
              {videos.length > 1 && (
                <div className="flex items-center space-x-1 pl-0.5">
                  <button
                    type="button"
                    onClick={scrollToPrev}
                    disabled={!canScrollLeft}
                    aria-label="Previous Video"
                    className="p-1 sm:p-1.5 min-w-[30px] min-h-[30px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={scrollToNext}
                    disabled={!canScrollRight}
                    aria-label="Next Video"
                    className="p-1 sm:p-1.5 min-w-[30px] min-h-[30px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                  >
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
              Official Channel
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {hasVideos ? (
        <div className="w-full flex flex-col items-center justify-center overflow-hidden pt-1.5">
          {/* Scrollable Container with Horizontal Snap & Touch Scroll */}
          <div
            ref={scrollContainerRef}
            className={`flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 pt-0.5 scroll-smooth focus:outline-hidden no-scrollbar [&::-webkit-scrollbar]:hidden w-full items-center ${
              videos.length <= 1 ? 'justify-center' : 'justify-start'
            } touch-pan-x`}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {videos.map((video, index) => {
              return (
                <div
                  key={video.id || index}
                  ref={(el) => {
                    slideItemRefs.current[index] = el;
                  }}
                  data-index={index}
                  className="w-full shrink-0 snap-center flex flex-col items-center justify-center bg-slate-50 border border-slate-200/90 rounded-2xl p-1.5 sm:p-2 shadow-2xs hover:shadow-xs transition-shadow mx-auto"
                >
                  {/* Embedded Video Player with Fine-Tuned Play/Pause & Visible Buttons */}
                  <div className="w-full rounded-xl overflow-hidden bg-black flex items-center justify-center mx-auto">
                    <FineTunedVideoPlayer
                      embedCode={video.embedCode}
                      title={video.title}
                      aspectRatioClass="w-full aspect-video mx-auto"
                      isActive={index === activeIndex}
                    />
                  </div>

                  {/* Compact Video Meta Information Bar */}
                  <div className="flex items-center justify-between gap-2 pt-1.5 px-0.5 text-xs shrink-0">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                        #{index + 1}
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {video.title}
                      </h3>
                      {video.description && (
                        <span className="hidden sm:inline text-[11px] text-slate-500 truncate max-w-xs font-sans">
                          — {video.description}
                        </span>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center space-x-1 text-[10px] font-mono text-slate-400">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{video.createdAt || 'Recent'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dots Indicator for multiple videos */}
          {videos.length > 1 && (
            <div className="flex items-center justify-center space-x-1.5 pt-1 shrink-0">
              {videos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollToIndex(i)}
                  aria-label={`Go to video ${i + 1}`}
                  className={`transition-all rounded-full cursor-pointer ${
                    activeIndex === i
                      ? 'w-5 h-1.5 bg-emerald-600'
                      : 'w-1.5 h-1.5 bg-slate-300 hover:bg-slate-400'
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
