import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Maximize2,
  X,
  Camera
} from 'lucide-react';
import { GalleryPhoto } from '../types';

interface AutoSwipingGalleryProps {
  photos: GalleryPhoto[];
  autoPlayInterval?: number; // ms, default 4500
  className?: string;
}

export const AutoSwipingGallery: React.FC<AutoSwipingGalleryProps> = ({
  photos,
  autoPlayInterval = 4500,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<GalleryPhoto | null>(null);

  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  const validPhotos = photos && photos.length > 0 ? photos : [];
  const currentPhoto = validPhotos[currentIndex] || validPhotos[0];

  // 3-Picture Stage calculations: Previous, Center (Active), and Next
  const prevIndex = (currentIndex - 1 + validPhotos.length) % validPhotos.length;
  const nextIndex = (currentIndex + 1) % validPhotos.length;

  const prevPhoto = validPhotos[prevIndex] || currentPhoto;
  const nextPhoto = validPhotos[nextIndex] || currentPhoto;

  // Next Slide Handler
  const handleNext = useCallback(() => {
    if (validPhotos.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % validPhotos.length);
  }, [validPhotos.length]);

  // Previous Slide Handler
  const handlePrev = useCallback(() => {
    if (validPhotos.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + validPhotos.length) % validPhotos.length);
  }, [validPhotos.length]);

  // Auto-play timer (paused when full screen is open)
  useEffect(() => {
    if (validPhotos.length <= 1 || isPaused || isHovered || fullScreenPhoto) return;

    const timer = setInterval(() => {
      handleNext();
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [validPhotos.length, isPaused, isHovered, fullScreenPhoto, autoPlayInterval, handleNext]);

  // Escape key handler to return to LoginScreen gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullScreenPhoto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Touch Swipe Handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchEndXRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current !== null && touchEndXRef.current !== null) {
      const delta = touchStartXRef.current - touchEndXRef.current;
      if (delta > 50) {
        handleNext();
      } else if (delta < -50) {
        handlePrev();
      }
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  if (validPhotos.length === 0) {
    return (
      <div className={`w-full bg-slate-900/60 border border-slate-700/60 rounded-3xl p-8 text-center text-slate-400 ${className}`}>
        <div className="flex flex-col items-center justify-center space-y-2">
          <Camera className="w-8 h-8 text-slate-500" />
          <p className="font-mono text-sm">No gallery pictures currently available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <section
        aria-label="San Vicente National High School Campus Photo Gallery"
        className={`w-full relative group rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 bg-[#070b13] select-none ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* CAROUSEL STAGE CONTAINER: 3 pictures shown side-by-side */}
        <div className="relative w-full h-52 sm:h-60 md:h-68 lg:h-72 p-2 sm:p-3 overflow-hidden bg-[#070b13] flex items-center justify-center gap-2 sm:gap-3">
          
          {/* 1. LEFT PICTURE (Previous picture - clickable to switch) */}
          {validPhotos.length > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              title={`Previous: ${prevPhoto.title || 'Previous slide'}`}
              className="h-full w-[20%] sm:w-[22%] shrink-0 rounded-2xl overflow-hidden relative cursor-pointer opacity-50 hover:opacity-85 transition-all duration-300 border border-white/10 bg-slate-950 flex items-center justify-center group/side"
            >
              <div
                className="absolute inset-0 bg-cover bg-center blur-lg opacity-30 pointer-events-none"
                style={{ backgroundImage: `url(${prevPhoto.url})` }}
              />
              <img
                src={prevPhoto.url}
                alt={prevPhoto.title || 'Previous picture'}
                className="w-full h-full object-contain object-center relative z-10 select-none pointer-events-none transform-none"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=800&q=80';
                }}
              />
              <div className="absolute inset-0 bg-black/35 group-hover/side:bg-black/15 transition-colors z-20 flex items-center justify-center">
                <div className="p-1 sm:p-1.5 rounded-full bg-black/60 text-white/90 group-hover/side:scale-110 transition-transform shadow-md">
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="absolute bottom-1.5 inset-x-1.5 z-20 pointer-events-none hidden md:block">
                <p className="text-[9px] text-white/80 font-mono truncate text-center bg-black/60 px-1 py-0.5 rounded">
                  {prevPhoto.title || 'Previous'}
                </p>
              </div>
            </button>
          )}

          {/* 2. CENTER PICTURE (Hero - CLICKING BRINGS TO FRONT OF LOGIN SCREEN FULL SCREEN) */}
          <div
            onClick={() => setFullScreenPhoto(currentPhoto)}
            title="Click picture to view full screen at the center of Login Screen"
            className="h-full flex-1 min-w-0 rounded-2xl overflow-hidden relative cursor-zoom-in border-2 border-emerald-500/60 shadow-xl bg-slate-950 flex items-center justify-center group/center transition-all duration-300"
          >
            {/* Ambient Soft Blur in Background */}
            <div
              className="absolute inset-0 bg-cover bg-center blur-2xl opacity-20 scale-105 pointer-events-none"
              style={{ backgroundImage: `url(${currentPhoto.url})` }}
            />

            {/* Center Image - Original orientation & size preserved, NO zooming in */}
            <img
              key={currentPhoto.id || currentIndex}
              src={currentPhoto.url}
              alt={currentPhoto.title || 'SVNHS Campus Gallery'}
              className="w-full h-full object-contain object-center relative z-10 select-none pointer-events-none transform-none transition-opacity duration-300"
              style={{ transform: 'none', transition: 'none' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1600&q=80';
              }}
            />

            {/* Click to view full screen hover hint */}
            <div className="absolute top-2.5 left-2.5 z-20 opacity-0 group-hover/center:opacity-100 transition-opacity bg-black/80 backdrop-blur-xs text-white text-[10px] font-mono px-2.5 py-1 rounded-full border border-white/20 flex items-center space-x-1.5 shadow-md pointer-events-none">
              <Maximize2 className="w-3 h-3 text-emerald-400" />
              <span>Click for Full Screen</span>
            </div>

            {/* Streamlined text details: Only picture title and caption with compact font */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-6 pb-2.5 px-3 sm:px-4 z-20 flex flex-col justify-end pointer-events-none">
              <div className="max-w-xl space-y-0.5">
                <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight drop-shadow leading-tight line-clamp-1">
                  {currentPhoto.title || 'San Vicente National High School'}
                </h2>
                {currentPhoto.caption && (
                  <p className="text-[10px] sm:text-[11px] text-slate-200/90 font-sans leading-relaxed line-clamp-1 drop-shadow">
                    {currentPhoto.caption}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 3. RIGHT PICTURE (Next picture - clickable to switch) */}
          {validPhotos.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              title={`Next: ${nextPhoto.title || 'Next slide'}`}
              className="h-full w-[20%] sm:w-[22%] shrink-0 rounded-2xl overflow-hidden relative cursor-pointer opacity-50 hover:opacity-85 transition-all duration-300 border border-white/10 bg-slate-950 flex items-center justify-center group/side"
            >
              <div
                className="absolute inset-0 bg-cover bg-center blur-lg opacity-30 pointer-events-none"
                style={{ backgroundImage: `url(${nextPhoto.url})` }}
              />
              <img
                src={nextPhoto.url}
                alt={nextPhoto.title || 'Next picture'}
                className="w-full h-full object-contain object-center relative z-10 select-none pointer-events-none transform-none"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=800&q=80';
                }}
              />
              <div className="absolute inset-0 bg-black/35 group-hover/side:bg-black/15 transition-colors z-20 flex items-center justify-center">
                <div className="p-1 sm:p-1.5 rounded-full bg-black/60 text-white/90 group-hover/side:scale-110 transition-transform shadow-md">
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="absolute bottom-1.5 inset-x-1.5 z-20 pointer-events-none hidden md:block">
                <p className="text-[9px] text-white/80 font-mono truncate text-center bg-black/60 px-1 py-0.5 rounded">
                  {nextPhoto.title || 'Next'}
                </p>
              </div>
            </button>
          )}

        </div>

        {/* Top Right Controls: Play/Pause & Fullscreen Button */}
        <div className="absolute top-2.5 right-2.5 z-30 flex items-center space-x-1.5 pointer-events-auto">
          {validPhotos.length > 1 && (
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? 'Resume auto-swipe' : 'Pause auto-swipe'}
              className="p-1.5 bg-black/50 hover:bg-black/80 text-white backdrop-blur-md rounded-full border border-white/20 transition-all shadow-md cursor-pointer"
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-slate-200" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setFullScreenPhoto(currentPhoto)}
            title="View picture full screen in front of Login Screen"
            className="p-1.5 bg-black/50 hover:bg-black/80 text-white backdrop-blur-md rounded-full border border-white/20 transition-all shadow-md cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-200" />
          </button>
        </div>

        {/* Bottom Dot Indicators */}
        {validPhotos.length > 1 && (
          <div className="absolute bottom-2.5 right-3 sm:right-5 z-30 flex items-center space-x-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15">
            {validPhotos.map((_, dotIdx) => {
              const isDotActive = dotIdx === currentIndex;
              return (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => setCurrentIndex(dotIdx)}
                  aria-label={`Go to picture ${dotIdx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    isDotActive
                      ? 'w-5 sm:w-6 bg-emerald-400 shadow-xs'
                      : 'w-1.5 bg-white/40 hover:bg-white/80'
                  }`}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* FULL-SCREEN VIEW BROUGHT TO THE FRONT OF LOGINSCREEN (Portal with z-[99999]) */}
      {fullScreenPhoto && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-3 sm:p-6 bg-black/92 backdrop-blur-md animate-fadeIn cursor-zoom-out select-none"
          onClick={() => setFullScreenPhoto(null)}
          title="Click anywhere to return to Login Screen"
        >
          {/* Top Return / Close Toolbar */}
          <div
            className="w-full max-w-5xl flex items-center justify-between pb-3 text-white pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs font-mono text-slate-300 bg-white/10 px-3 py-1 rounded-full border border-white/15 shadow-sm">
              Click picture to return to Login Screen (or press Esc)
            </span>

            <button
              type="button"
              onClick={() => setFullScreenPhoto(null)}
              className="p-2 text-white hover:text-rose-400 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-md"
              title="Return to Login Screen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Centered Full Screen Picture Container */}
          <div
            className="relative max-w-5xl w-full flex-1 min-h-0 flex flex-col items-center justify-center cursor-zoom-out"
            onClick={() => setFullScreenPhoto(null)}
            title="Click picture to return to Login Screen"
          >
            {/* Picture displayed at the center full screen */}
            <div className="relative flex items-center justify-center max-h-[78vh] w-full">
              <img
                src={fullScreenPhoto.url}
                alt={fullScreenPhoto.title}
                className="max-h-[76vh] max-w-[92vw] w-auto h-auto object-contain rounded-2xl shadow-2xl border border-white/20 transform-none select-none cursor-pointer"
              />
            </div>

            {/* Picture Title & Caption centered underneath */}
            <div
              className="mt-3.5 bg-slate-900/95 border border-slate-700/80 rounded-2xl px-5 py-3 text-white text-center backdrop-blur-md cursor-pointer hover:border-slate-500 transition-colors max-w-2xl w-full shadow-2xl"
              onClick={() => setFullScreenPhoto(null)}
              title="Click to return to Login Screen"
            >
              <h3 className="text-sm sm:text-base font-bold font-mono text-emerald-400 leading-snug">
                {fullScreenPhoto.title}
              </h3>
              {fullScreenPhoto.caption && (
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {fullScreenPhoto.caption}
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
