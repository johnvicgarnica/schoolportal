import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

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
  aspectRatioClass = 'w-full aspect-video max-h-[310px] mx-auto',
  isActive = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true); // default muted ensures browser autoplay compliance
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<boolean>(false);

  const raw = (embedCode || '').trim();

  // Detect type of embed
  const isDirectVideoFile = /^https?:\/\/.+\.(mp4|webm|ogg)(\?.*)?$/i.test(raw);
  const isHtml5VideoTag = /<video[\s\S]*?>/i.test(raw);

  // Extract video src if it's a <video> tag
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

  // Check if it's YouTube
  const ytWatchMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i);
  const ytShortMatch = raw.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/i);
  const ytEmbedMatch = raw.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i);
  const youtubeId = ytWatchMatch?.[1] || ytShortMatch?.[1] || ytEmbedMatch?.[1];

  // Check if it's Google Drive preview
  const gDriveMatch = raw.match(/(?:https?:\/\/)?drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(?:view|preview)/i);
  const gDriveId = gDriveMatch?.[1];

  // Check if it's raw iframe
  const isIframe = /<iframe[\s\S]*?>/i.test(raw);
  let rawIframeSrc = '';
  if (isIframe) {
    const srcMatch = raw.match(/src=["'](.*?)["']/i);
    if (srcMatch && srcMatch[1]) {
      rawIframeSrc = srcMatch[1];
    }
  }

  // Generate safe iframe URL: clean, minimal controls, mobile playsinline=1, no annotations covering frame
  const getIframeUrl = () => {
    const autoPlayVal = isActive ? '1' : '0';
    if (youtubeId) {
      return `https://www.youtube.com/embed/${youtubeId}?autoplay=${autoPlayVal}&mute=1&enablejsapi=1&rel=0&modestbranding=1&playsinline=1&controls=1&iv_load_policy=3`;
    }

    if (gDriveId) {
      return `https://drive.google.com/file/d/${gDriveId}/preview`;
    }

    if (rawIframeSrc) {
      let url = rawIframeSrc.replace(/autoplay=1/gi, isActive ? 'autoplay=1' : 'autoplay=0');
      if (!url.includes('autoplay=')) {
        url += (url.includes('?') ? '&' : '?') + (isActive ? 'autoplay=1' : 'autoplay=0');
      }
      if (!url.includes('playsinline=')) {
        url += '&playsinline=1';
      }
      return url;
    }

    return '';
  };

  // Format raw code fallback to ensure no autoplay, mobile friendliness and proper sizing
  const getSanitizedRawCode = () => {
    let formatted = raw.replace(/autoplay=1/gi, isActive ? 'autoplay=1' : 'autoplay=0');
    formatted = formatted.replace(/\bautoplay\b/gi, '');
    formatted = formatted.replace(/allow=["']([^"']*?)autoplay;?([^"']*?)["']/gi, 'allow="$1$2"');
    if (formatted.includes('<iframe')) {
      if (!formatted.includes('loading=')) {
        formatted = formatted.replace('<iframe', '<iframe loading="lazy"');
      }
      if (!formatted.includes('allowfullscreen')) {
        formatted = formatted.replace('<iframe', '<iframe allowfullscreen');
      }
    }
    if (formatted.includes('<video')) {
      if (!formatted.includes('playsinline')) {
        formatted = formatted.replace('<video', '<video playsinline webkit-playsinline="true"');
      }
    }
    return formatted;
  };

  // AUTOPLAY WHEN ACTIVE, STOP WHEN SCROLLED TO ANOTHER VIDEO
  useEffect(() => {
    if (isActive) {
      // 1. HTML5 Video Autoplay
      if (videoRef.current) {
        videoRef.current.muted = isMuted;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(() => {
              // Retry with muted to fulfill strict browser autoplay policy
              if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
              }
            });
        }
      }

      // 2. YouTube iframe postMessage play
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      }
    } else {
      // STOP playback when scrolled away to next video
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }

      // YouTube iframe postMessage pause
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      }
    }
  }, [isActive]);

  // Video control helpers
  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    if (isPlaying) {
      hideTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 1200);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      resetHideTimer();
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
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

    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    } else {
      if (container.requestFullscreen) {
        container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {
          // Fallback for iOS webkit video
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

  // Double-tap gesture detector for mobile mode fullscreen
  const handleTouchEnd = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 320 && timeSinceLastTap > 0) {
      // It's a double-tap! Turn Fullscreen!
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapRef.current = 0;

      toggleFullscreen();
      setDoubleTapFeedback(true);
      setTimeout(() => setDoubleTapFeedback(false), 700);
    } else {
      // First tap
      lastTapRef.current = now;
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
      singleTapTimeoutRef.current = setTimeout(() => {
        resetHideTimer();
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
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
    };
  }, []);

  // 1. Direct HTML5 Video Player: Minimal, compact, auto-hiding controls that NEVER cover the video frame
  if (html5VideoSrc) {
    return (
      <div
        ref={containerRef}
        className={`relative ${aspectRatioClass} rounded-xl overflow-hidden bg-black border border-slate-300/80 shadow-inner group flex items-center justify-center select-none ${className}`}
        onMouseMove={resetHideTimer}
        onClick={resetHideTimer}
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
          preload="metadata"
          autoPlay={isActive}
          muted={isMuted}
          loop
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => {
            setIsPlaying(true);
            resetHideTimer();
          }}
          onPause={() => {
            setIsPlaying(false);
            setShowControls(true);
          }}
          className="w-full h-full object-contain bg-black cursor-pointer"
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

        {/* Micro-sized bottom control bar when not in fullscreen to avoid covering the video frame */}
        <div
          className={`absolute bottom-0 inset-x-0 transition-opacity duration-200 z-20 ${
            isFullscreen
              ? 'bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 py-2.5 flex items-center gap-3 text-white'
              : 'bg-black/75 backdrop-blur-[2px] px-2 py-0.5 sm:px-2.5 sm:py-1 flex items-center gap-1.5 sm:gap-2 text-white border-t border-white/10'
          } ${showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
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

  // 2. Iframe / YouTube / Google Drive Preview: strict 16:9 ratio so controls are docked to bottom edge and never cover the frame
  const iframeSrc = getIframeUrl();

  return (
    <div
      ref={containerRef}
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

      {iframeSrc ? (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title={title || 'School Video Preview'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          className="w-full h-full border-0 pointer-events-auto"
        />
      ) : (
        /* Fallback for raw embed snippet */
        <div
          className="w-full h-full flex items-center justify-center [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0 [&_video]:w-full [&_video]:h-full [&_video]:object-contain"
          dangerouslySetInnerHTML={{ __html: getSanitizedRawCode() }}
        />
      )}
    </div>
  );
};
