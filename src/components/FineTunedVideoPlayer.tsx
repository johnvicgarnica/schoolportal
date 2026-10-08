import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

interface FineTunedVideoPlayerProps {
  embedCode: string;
  title: string;
  className?: string;
  aspectRatioClass?: string;
  isActive?: boolean;
}

interface ParsedEmbed {
  rawIframeSrc: string;
  html5VideoSrc: string;
  youtubeId: string;
  gDriveId: string;
  isGoogleDrive: boolean;
  isDirectVideoFile: boolean;
  isHtml5VideoTag: boolean;
  isIframe: boolean;
}

const parseEmbedCode = (embedCode: string): ParsedEmbed => {
  const raw = (embedCode || '').trim();

  // 1. Direct video file
  const isDirectVideoFile = /^https?:\/\/.+\.(mp4|webm|ogg)(\?.*)?$/i.test(raw);

  // 2. HTML5 <video> tag
  const isHtml5VideoTag = /<video[\s\S]*?>/i.test(raw);
  let html5VideoSrc = '';
  if (isDirectVideoFile) {
    html5VideoSrc = raw;
  } else if (isHtml5VideoTag) {
    const srcMatch = raw.match(/src=["'](.*?)["']/i);
    if (srcMatch && srcMatch[1]) {
      html5VideoSrc = srcMatch[1];
    } else {
      const sourceMatch = raw.match(/<source[\s\S]*?src=["'](.*?)["']/i);
      if (sourceMatch && sourceMatch[1]) {
        html5VideoSrc = sourceMatch[1];
      }
    }
  }

  // 3. Iframe tag & src extraction
  const isIframe = /<iframe[\s\S]*?>/i.test(raw);
  let rawIframeSrc = '';
  if (isIframe) {
    const srcMatch = raw.match(/src=["'](.*?)["']/i);
    if (srcMatch && srcMatch[1]) {
      rawIframeSrc = srcMatch[1];
    }
  }

  // 4. YouTube watch / short / embed
  const ytWatchMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i);
  const ytShortMatch = raw.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/i);
  const ytEmbedMatch = raw.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i);
  const youtubeId = ytWatchMatch?.[1] || ytShortMatch?.[1] || ytEmbedMatch?.[1] || '';

  // 5. Google Drive preview
  const gDriveMatch = raw.match(/(?:https?:\/\/)?(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
  const gDriveId = gDriveMatch?.[1] || '';
  const isGoogleDrive = !!gDriveId || raw.includes('drive.google.com') || (!!rawIframeSrc && rawIframeSrc.includes('drive.google.com'));

  return {
    rawIframeSrc,
    html5VideoSrc,
    youtubeId,
    gDriveId,
    isGoogleDrive,
    isDirectVideoFile,
    isHtml5VideoTag,
    isIframe,
  };
};

export const FineTunedVideoPlayer: React.FC<FineTunedVideoPlayerProps> = ({
  embedCode,
  title,
  className = '',
  aspectRatioClass = 'w-full aspect-video max-h-[310px] mx-auto',
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
  const {
    rawIframeSrc,
    html5VideoSrc,
    youtubeId,
    gDriveId,
    isGoogleDrive,
  } = parseEmbedCode(raw);

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
      // Strip web-share if present in iframe code
      formatted = formatted.replace(/;\s*web-share/gi, '').replace(/web-share;?\s*/gi, '');
      if (!formatted.includes('allow=')) {
        formatted = formatted.replace(
          '<iframe',
          '<iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"'
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

      if (isActive) {
        // Enforce mute first then trigger play with progressive retries for mobile
        sendYouTubeCommand('mute');
        setTimeout(() => sendYouTubeCommand('playVideo'), 100);
        setTimeout(() => sendYouTubeCommand('playVideo'), 350);
        setTimeout(() => sendYouTubeCommand('playVideo'), 800);
      } else {
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
  if (html5VideoSrc) {
    return (
      <div
        ref={containerRef}
        className={`relative ${aspectRatioClass} rounded-xl overflow-hidden bg-black border border-slate-300/80 shadow-inner group flex items-center justify-center select-none ${className}`}
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

  // 2. Iframe / YouTube / Google Drive Preview
  const iframeSrc = getIframeUrl();

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onClick={handleContainerTap}
      onDoubleClick={toggleFullscreen}
      onTouchEnd={handleTouchEnd}
      className={`relative ${aspectRatioClass} rounded-xl overflow-hidden bg-black border border-slate-300/80 shadow-inner group flex items-center justify-center ${className}`}
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
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title={title || 'School Video Presentation'}
            onLoad={handleIframeLoad}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0 pointer-events-auto block mx-auto my-auto object-contain object-center"
          />
        </div>
      ) : (
        /* Fallback for raw embed snippet */
        <div
          className="w-full h-full flex items-center justify-center text-center overflow-hidden relative bg-black [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0 [&_iframe]:block [&_iframe]:mx-auto [&_iframe]:my-auto [&_video]:[object-fit:contain] [&_video]:w-full [&_video]:h-full [&_video]:object-contain [&_video]:object-center [&_video]:mx-auto [&_video]:my-auto"
          dangerouslySetInnerHTML={{ __html: getSanitizedRawCode() }}
        />
      )}
    </div>
  );
};
