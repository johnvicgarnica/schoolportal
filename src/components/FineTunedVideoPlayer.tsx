import React, { useRef } from 'react';

interface FineTunedVideoPlayerProps {
  embedCode: string;
  title: string;
  className?: string;
  aspectRatioClass?: string;
}

export const FineTunedVideoPlayer: React.FC<FineTunedVideoPlayerProps> = ({
  embedCode,
  title,
  className = '',
  aspectRatioClass = 'w-full h-[265px] sm:h-[305px] md:h-[325px]',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
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

  // Generate safe iframe URL: strictly NO autoplay, mobile playsinline=1, controls=1, fullscreen fs=1
  const getIframeUrl = () => {
    if (youtubeId) {
      return `https://www.youtube.com/embed/${youtubeId}?autoplay=0&enablejsapi=1&rel=0&modestbranding=1&playsinline=1&controls=1&fs=1`;
    }

    if (gDriveId) {
      return `https://drive.google.com/file/d/${gDriveId}/preview`;
    }

    if (rawIframeSrc) {
      let url = rawIframeSrc.replace(/autoplay=1/gi, 'autoplay=0');
      if (!url.includes('autoplay=')) {
        url += (url.includes('?') ? '&' : '?') + 'autoplay=0';
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
    let formatted = raw.replace(/autoplay=1/gi, 'autoplay=0');
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
      if (!formatted.includes('controls')) {
        formatted = formatted.replace('<video', '<video controls');
      }
      if (!formatted.includes('playsinline')) {
        formatted = formatted.replace('<video', '<video playsinline webkit-playsinline="true"');
      }
    }
    return formatted;
  };

  // 1. Direct HTML5 Video Player: shows the video preview frame with full native mobile-friendly controls
  if (html5VideoSrc) {
    return (
      <div
        className={`relative w-full ${aspectRatioClass} rounded-xl overflow-hidden bg-black border border-slate-300/80 shadow-inner group flex items-center justify-center ${className}`}
      >
        <video
          ref={videoRef}
          src={html5VideoSrc}
          controls
          playsInline
          // @ts-expect-error webkit-playsinline for iOS Safari
          webkit-playsinline="true"
          preload="metadata"
          autoPlay={false}
          className="w-full h-full object-contain bg-black cursor-pointer"
        />
      </div>
    );
  }

  // 2. Iframe / YouTube / Google Drive Preview: shows the video preview thumbnail with native play/pause and all controls visible
  const iframeSrc = getIframeUrl();

  return (
    <div
      className={`relative w-full ${aspectRatioClass} rounded-xl overflow-hidden bg-black border border-slate-300/80 shadow-inner group flex items-center justify-center ${className}`}
    >
      {iframeSrc ? (
        <iframe
          src={iframeSrc}
          title={title || 'School Video Preview'}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
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
