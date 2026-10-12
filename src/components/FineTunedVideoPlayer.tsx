import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { parseAndOptimizeEmbed } from '../lib/videoEmbedUtils';

interface FineTunedVideoPlayerProps {
  embedCode: string;
  title: string;
  className?: string;
  aspectRatioClass?: string;
  isActive?: boolean;
}

export const FineTunedVideoPlayer: React.FC<FineTunedVideoPlayerProps> = ({
  embedCode,
  title,
  className = '',
  aspectRatioClass,
  isActive = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const lastTouchTimeRef = useRef<number>(0);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  const [isMuted, setIsMuted] = useState<boolean>(true); // default muted ensures strict browser autoplay compliance
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(false); // Start hidden for clean playback view
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<boolean>(false);

  const raw = (embedCode || '').trim();
  const parsed = useMemo(() => parseAndOptimizeEmbed(raw), [raw]);
  const {
    iframeSrc: parsedIframeSrc,
    html5VideoSrc,
    youtubeId,
    gDriveId,
    provider,
    isPortrait,
    isSquare,
    isLandscape,
    aspectRatioValue,
    aspectRatioNum,
    recommendedWidth,
    recommendedHeight,
    isFacebookReel,
  } = parsed;

  const isFacebook = provider === 'facebook';
  const isGoogleDrive = provider === 'gdrive';
  const facebookWidth = recommendedWidth;
  const facebookHeight = recommendedHeight;
  const rawIframeSrc = parsedIframeSrc || '';

  // Container dimensions observed via ResizeObserver for responsive ratio containment
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerDimensions((prev) => {
            if (Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1) {
              return prev;
            }
            return { width, height };
          });
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute responsive containment style that preserves original video proportions without cropping or stretching
  const fittedStyle = useMemo<React.CSSProperties>(() => {
    const ratio = aspectRatioNum || (isPortrait ? 267 / 476 : 16 / 9);
    const aspectStr = aspectRatioValue || (isPortrait ? '267 / 476' : '16 / 9');

    if (!containerDimensions.width || !containerDimensions.height) {
      return {
        aspectRatio: aspectStr,
        width: isPortrait ? 'auto' : '100%',
        height: isPortrait ? '100%' : 'auto',
        maxWidth: '100%',
        maxHeight: '100%',
      };
    }

    const { width: cW, height: cH } = containerDimensions;
    const containerRatio = cW / cH;

    if (containerRatio > ratio) {
      // Container is wider than video ratio -> fit by container height, center horizontally
      const w = Math.min(Math.round(cH * ratio), cW);
      return {
        width: `${w}px`,
        height: `${cH}px`,
        aspectRatio: aspectStr,
        maxWidth: '100%',
        maxHeight: '100%',
      };
    } else {
      // Container is taller than video ratio -> fit by container width, center vertically
      const h = Math.min(Math.round(cW / ratio), cH);
      return {
        width: `${cW}px`,
        height: `${h}px`,
        aspectRatio: aspectStr,
        maxWidth: '100%',
        maxHeight: '100%',
      };
    }
  }, [containerDimensions, aspectRatioNum, aspectRatioValue, isPortrait]);

  // Helper to get safe origin for postMessage
  const getOrigin = () => {
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }
    return '*';
  };

  // Generate safe iframe URL with verified autoplay & muted parameters
  const getIframeUrl = () => {
    if (youtubeId) {
      // YouTube embed with enablejsapi=1, autoplay=1, mute=1, playsinline=1 for guaranteed mobile zero-click autoplay
      return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&playsinline=1&enablejsapi=1&controls=1&rel=0&modestbranding=1&iv_load_policy=3`;
    }

    if (gDriveId) {
      return `https://drive.google.com/file/d/${gDriveId}/preview`;
    }

    if (isFacebook && rawIframeSrc) {
      // Preserve clean Facebook video.php plugin URL without conflicting YouTube parameters
      let url = rawIframeSrc.replace(/&amp;/g, '&');
      url = url.replace(/https?:\/\/(?:web|m|touch)\.facebook\.com/gi, 'https://www.facebook.com');
      url = url.replace(/href=https%3A%2F%2F(?:web|m|touch)\.facebook\.com/gi, 'href=https%3A%2F%2Fwww.facebook.com');

      if (!url.includes('plugins/video.php')) {
        const isReel = isFacebookReel || isPortrait;
        const width = facebookWidth || (isReel ? 267 : 560);
        const height = facebookHeight || (isReel ? 476 : 315);
        url = `https://www.facebook.com/plugins/video.php?height=${height}&href=${encodeURIComponent(url)}&show_text=false&width=${width}&t=0`;
      } else {
        if (!url.includes('width=')) {
          url += `&width=${facebookWidth || (isPortrait ? 267 : 560)}`;
        }
        if (!url.includes('height=')) {
          url += `&height=${facebookHeight || (isPortrait ? 476 : 315)}`;
        }
        if (!url.includes('show_text=')) {
          url += '&show_text=false';
        }
        if (!url.includes('t=')) {
          url += '&t=0';
        }
      }
      return url;
    }

    if (rawIframeSrc) {
      let url = rawIframeSrc;
      if (!url.includes('autoplay=')) {
        url += (url.includes('?') ? '&' : '?') + 'autoplay=1';
      }
      if (!url.includes('mute=')) {
        url += '&mute=1';
      }
      if (!url.includes('playsinline=')) {
        url += '&playsinline=1';
      }
      return url;
    }

    return '';
  };

  // Format raw code fallback while preserving autoplay capabilities
  const getSanitizedRawCode = () => {
    let formatted = raw;
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
      // Remove loading="lazy" because lazy iframes block autoplay in Chrome/Safari
      formatted = formatted.replace(/\s*loading=["']lazy["']/gi, '');
    }
    if (formatted.includes('<video')) {
      if (!formatted.includes('object-fit')) {
        formatted = formatted.replace('<video', '<video style="object-fit: contain;"');
      }
      if (!formatted.includes('object-contain')) {
        formatted = formatted.replace('<video', '<video class="object-contain"');
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

  // Send command to YouTube iframe via postMessage safely
  const sendYouTubeCommand = useCallback((func: string, args: any = '') => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func,
            args,
          }),
          '*'
        );
      }
    } catch (_) {}
  }, []);

  // Handler when iframe finishes loading
  const handleIframeLoad = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'listening' }),
          '*'
        );
      } catch (_) {}

      if (isActive && youtubeId) {
        // Enforce mute first then trigger play with progressive retries for YouTube
        sendYouTubeCommand('mute');
        setTimeout(() => sendYouTubeCommand('playVideo'), 100);
        setTimeout(() => sendYouTubeCommand('playVideo'), 350);
        setTimeout(() => sendYouTubeCommand('playVideo'), 800);
      } else if (!isActive && youtubeId) {
        // Ensure inactive videos stay paused
        sendYouTubeCommand('pauseVideo');
      }
    }
  };

  // AUTOPLAY WHEN ACTIVE, STOP WHEN SCROLLED TO ANOTHER VIDEO
  useEffect(() => {
    if (isActive) {
      // 1. Direct HTML5 Video Autoplay
      if (videoRef.current) {
        videoRef.current.defaultMuted = true;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.setAttribute('playsinline', '');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.setAttribute('muted', '');
        videoRef.current.setAttribute('autoplay', '');

        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(() => {
              // Retry with guaranteed muted state
              if (videoRef.current) {
                videoRef.current.defaultMuted = true;
                videoRef.current.muted = true;
                videoRef.current
                  .play()
                  .then(() => setIsPlaying(true))
                  .catch(() => {});
              }
            });
        }
      }

      // 2. YouTube iframe play with retry to guarantee receipt once player boots
      sendYouTubeCommand('mute');
      sendYouTubeCommand('playVideo');
      const t1 = setTimeout(() => {
        sendYouTubeCommand('mute');
        sendYouTubeCommand('playVideo');
      }, 250);
      const t2 = setTimeout(() => sendYouTubeCommand('playVideo'), 700);
      const t3 = setTimeout(() => sendYouTubeCommand('playVideo'), 1200);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else {
      // STOP playback when scrolled away to next video
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }

      // Stop YouTube iframe playback immediately
      sendYouTubeCommand('pauseVideo');
      const tPause = setTimeout(() => sendYouTubeCommand('pauseVideo'), 150);
      return () => clearTimeout(tPause);
    }
  }, [isActive, sendYouTubeCommand]);

  // Window-level interaction fallback: if the browser held autoplay due to user gesture policy,
  // the first touch, scroll, or click anywhere on the page unlocks and starts playback
  useEffect(() => {
    if (!isActive) return;

    const handleFirstUserGesture = () => {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.defaultMuted = true;
        videoRef.current.muted = true;
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      sendYouTubeCommand('mute');
      sendYouTubeCommand('playVideo');
    };

    window.addEventListener('pointerdown', handleFirstUserGesture, { once: true, passive: true });
    window.addEventListener('touchstart', handleFirstUserGesture, { once: true, passive: true });
    window.addEventListener('scroll', handleFirstUserGesture, { once: true, passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstUserGesture);
      window.removeEventListener('touchstart', handleFirstUserGesture);
      window.removeEventListener('scroll', handleFirstUserGesture);
    };
  }, [isActive, sendYouTubeCommand]);

  // Intersection Observer for mobile: start autoplay as soon as the video player scrolls into viewport
  useEffect(() => {
    if (!isActive) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (videoRef.current && videoRef.current.paused) {
              videoRef.current.defaultMuted = true;
              videoRef.current.muted = true;
              videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
            sendYouTubeCommand('mute');
            sendYouTubeCommand('playVideo');
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isActive, sendYouTubeCommand]);

  // Video control helpers: robust auto-hide timers
  const scheduleHideControls = useCallback((delay = 1800) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    hideTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      hideTimeoutRef.current = null;
    }, delay);
  }, []);

  const resetHideTimer = useCallback(() => {
    // On touch devices, ignore synthetic mousemove right after a touch
    if (Date.now() - lastTouchTimeRef.current < 800) {
      return;
    }
    setShowControls(true);
    scheduleHideControls(2200);
  }, [scheduleHideControls]);

  // Initial auto-hide on mount/active
  useEffect(() => {
    const t = setTimeout(() => {
      setShowControls(false);
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  // Automatically hide controls after delay when playing
  useEffect(() => {
    if (isPlaying) {
      scheduleHideControls(1800);
    } else {
      setShowControls(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    }
  }, [isPlaying, scheduleHideControls]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      scheduleHideControls(1500);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
    resetHideTimer();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
    resetHideTimer();
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      // Guarantee controls auto-hide if playing and showing (e.g., in portrait mobile view)
      if (!videoRef.current.paused && showControls && !hideTimeoutRef.current) {
        scheduleHideControls(1800);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    const doc: any = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    } else {
      if (container.requestFullscreen) {
        container
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {
            if (video && (video as any).webkitEnterFullscreen) {
              (video as any).webkitEnterFullscreen();
              setIsFullscreen(true);
            }
          });
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
        setIsFullscreen(true);
      } else if (video && (video as any).webkitEnterFullscreen) {
        (video as any).webkitEnterFullscreen();
        setIsFullscreen(true);
      }
    }
  };

  const handleContainerTap = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      // Ignore synthetic click event emitted on mobile right after touch
      if (e.type === 'click' && Date.now() - lastTouchTimeRef.current < 500) {
        return;
      }
      const target = e.target as HTMLElement;
      if (target?.closest?.('button') || target?.closest?.('input')) {
        return;
      }
    }
    setShowControls((prev) => {
      const next = !prev;
      if (next) {
        scheduleHideControls(2200);
      }
      return next;
    });
  }, [scheduleHideControls]);

  // Double-tap gesture detector for mobile mode fullscreen & tap toggle
  const handleTouchEnd = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      return;
    }

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 350 && timeSinceLastTap > 0) {
      // Double tap confirmed! Toggle Fullscreen
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapRef.current = 0;

      toggleFullscreen();
      setDoubleTapFeedback(true);
      setTimeout(() => setDoubleTapFeedback(false), 700);
    } else {
      // First tap: toggle controls
      lastTapRef.current = now;
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
      singleTapTimeoutRef.current = setTimeout(() => {
        handleContainerTap(e);
        singleTapTimeoutRef.current = null;
      }, 250);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc: any = document;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
    };
  }, []);

  // 1. Direct HTML5 Video Player: Micro-sized auto-hiding controls that never cover the video frame
  const resolvedContainerClass = aspectRatioClass
    ? aspectRatioClass
    : 'w-full h-[380px] xs:h-[420px] sm:h-[480px] max-h-[75vh] mx-auto';

  if (html5VideoSrc) {
    return (
      <div
        ref={containerRef}
        className={`relative ${resolvedContainerClass} rounded-xl overflow-hidden bg-black border border-slate-300/80 shadow-inner group flex items-center justify-center select-none ${className}`}
        onMouseMove={resetHideTimer}
        onClick={handleContainerTap}
        onDoubleClick={toggleFullscreen}
        onTouchEnd={handleTouchEnd}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={html5VideoSrc}
          playsInline
          // @ts-expect-error webkit-playsinline for iOS Safari
          webkit-playsinline="true"
          preload="auto"
          autoPlay={isActive}
          muted={isMuted}
          loop
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={() => {
            if (isActive && videoRef.current && videoRef.current.paused) {
              videoRef.current.defaultMuted = true;
              videoRef.current.muted = true;
              videoRef.current.play().then(() => {
                setIsPlaying(true);
                scheduleHideControls(1500);
              }).catch(() => {});
            }
          }}
          onPlay={() => {
            setIsPlaying(true);
            scheduleHideControls(1500);
          }}
          onPlaying={() => {
            setIsPlaying(true);
            scheduleHideControls(1500);
          }}
          onPause={() => {
            setIsPlaying(false);
            setShowControls(true);
          }}
          style={{ objectFit: 'contain' }}
          className="w-full h-full object-contain object-center bg-black cursor-pointer block mx-auto my-auto"
        />

        {/* Double-Tap Fullscreen Visual Confirmation Badge */}
        {doubleTapFeedback && (
          <div className="absolute inset-0 m-auto w-24 h-16 rounded-2xl bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center text-emerald-400 pointer-events-none z-30 animate-scaleUp border border-emerald-500/30 shadow-xl">
            {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
            <span className="text-[9px] font-mono font-bold mt-1 text-white tracking-wider">
              {isFullscreen ? 'EXIT FULL' : 'FULLSCREEN'}
            </span>
          </div>
        )}

        {/* Reduced, unobtrusive center play button when paused (does NOT block the frame) */}
        {!isPlaying && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play Video"
            className={`absolute inset-0 m-auto rounded-full bg-emerald-600/90 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xs z-10 ${
              isFullscreen ? 'w-14 h-14' : 'w-7 h-7 sm:w-8 sm:h-8'
            }`}
          >
            <Play className={`${isFullscreen ? 'w-6 h-6' : 'w-3.5 h-3.5 sm:w-4 sm:h-4'} fill-current ml-0.5`} />
          </button>
        )}

        {/* Micro-sized bottom control bar that smoothly auto-hides after playback */}
        <div
          className={`absolute bottom-0 inset-x-0 transition-opacity duration-300 z-20 ${
            isFullscreen
              ? 'bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 py-2.5 flex items-center gap-3 text-white'
              : 'bg-black/75 backdrop-blur-[2px] px-2 py-0.5 sm:px-2.5 sm:py-1 flex items-center gap-1.5 sm:gap-2 text-white border-t border-white/10'
          } ${showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          {/* Mini Play / Pause */}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="p-0.5 sm:p-1 text-white hover:text-emerald-400 active:scale-90 transition-all cursor-pointer shrink-0"
          >
            {isPlaying ? (
              <Pause className={`${isFullscreen ? 'w-4 h-4' : 'w-2.5 h-2.5 sm:w-3 sm:h-3'} fill-current`} />
            ) : (
              <Play className={`${isFullscreen ? 'w-4 h-4' : 'w-2.5 h-2.5 sm:w-3 sm:h-3'} fill-current`} />
            )}
          </button>

          {/* Thin Progress Timeline */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Video scrubber"
            className={`w-full bg-white/30 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:opacity-100 transition-all ${
              isFullscreen ? 'h-1.5' : 'h-0.5 sm:h-1'
            }`}
          />

          {/* Compact Timestamp */}
          <span className={`${isFullscreen ? 'text-xs' : 'text-[8px] sm:text-[9.5px]'} font-mono text-slate-300 shrink-0 whitespace-nowrap leading-none`}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Mini Mute / Unmute */}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="p-0.5 sm:p-1 text-white hover:text-emerald-400 active:scale-90 transition-all cursor-pointer shrink-0"
          >
            {isMuted ? (
              <VolumeX className={`${isFullscreen ? 'w-4 h-4' : 'w-2.5 h-2.5 sm:w-3 sm:h-3'}`} />
            ) : (
              <Volume2 className={`${isFullscreen ? 'w-4 h-4' : 'w-2.5 h-2.5 sm:w-3 sm:h-3'}`} />
            )}
          </button>

          {/* Mini Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen"
            className="p-0.5 sm:p-1 text-white hover:text-emerald-400 active:scale-90 transition-all cursor-pointer shrink-0"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // 2. Iframe / YouTube / Google Drive / Facebook Preview
  const iframeSrc = parsedIframeSrc || getIframeUrl();

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onClick={handleContainerTap}
      onDoubleClick={toggleFullscreen}
      onTouchEnd={handleTouchEnd}
      className={`relative ${resolvedContainerClass} rounded-xl overflow-hidden bg-black border border-slate-300/80 shadow-inner group flex items-center justify-center ${className}`}
    >
      {/* Double-Tap Fullscreen Visual Confirmation Badge */}
      {doubleTapFeedback && (
        <div className="absolute inset-0 m-auto w-24 h-16 rounded-2xl bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center text-emerald-400 pointer-events-none z-30 animate-scaleUp border border-emerald-500/30 shadow-xl">
          {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
          <span className="text-[9px] font-mono font-bold mt-1 text-white tracking-wider">
            {isFullscreen ? 'EXIT FULL' : 'FULLSCREEN'}
          </span>
        </div>
      )}

      {/* Discreet Mobile Fullscreen Corner Toggle Button (Double-tap friendly) */}
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label="Toggle Fullscreen"
        title="Double-tap frame or click to toggle fullscreen"
        className={`absolute top-2 right-2 bg-black/60 hover:bg-black/85 text-white/90 hover:text-white p-1 rounded-lg border border-white/20 backdrop-blur-xs z-20 transition-all duration-300 cursor-pointer active:scale-95 flex items-center gap-1 text-[9px] font-mono ${
          showControls ? 'opacity-90 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {isFullscreen ? <Minimize className="w-3 h-3 text-emerald-400" /> : <Maximize className="w-3 h-3 text-emerald-400" />}
        <span className="hidden sm:inline text-[8px] font-bold">FULLSCREEN</span>
      </button>

      {iframeSrc ? (
        <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black">
          <div
            style={fittedStyle}
            className="relative flex items-center justify-center mx-auto my-auto"
          >
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title={title || 'School Video Presentation'}
              onLoad={handleIframeLoad}
              width={recommendedWidth || (isPortrait ? 267 : 560)}
              height={recommendedHeight || (isPortrait ? 476 : 315)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              scrolling="no"
              loading="eager"
              style={{
                border: 'none',
                overflow: 'hidden',
                width: '100%',
                height: '100%',
              }}
              className="w-full h-full border-0 block mx-auto my-auto"
            />
          </div>
        </div>
      ) : (
        /* Fallback for raw embed snippet */
        <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black">
          <div
            style={fittedStyle}
            className="relative flex items-center justify-center mx-auto my-auto [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0 [&_iframe]:block [&_video]:w-full [&_video]:h-full [&_video]:object-contain [&_video]:object-center"
            dangerouslySetInnerHTML={{ __html: getSanitizedRawCode() }}
          />
        </div>
      )}
    </div>
  );
};
