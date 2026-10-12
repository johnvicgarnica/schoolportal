/**
 * Comprehensive video embed validation, sanitization, and optimization utility.
 * Handles YouTube, Facebook (Videos & Reels), Google Drive, Vimeo, HTML5 direct video files,
 * and generic iframes across mobile and desktop.
 */

export interface OptimizedEmbedResult {
  /** The clean, optimized embed code string (iframe or video) */
  optimizedCode: string;
  /** Primary iframe URL (if iframe-based) */
  iframeSrc: string;
  /** Primary direct HTML5 video source (if file-based) */
  html5VideoSrc: string;
  /** Provider type */
  provider: 'youtube' | 'facebook' | 'gdrive' | 'vimeo' | 'html5' | 'generic';
  /** Detected video orientation */
  isPortrait: boolean;
  isSquare: boolean;
  isLandscape: boolean;
  /** Aspect ratio string, e.g. "16 / 9", "9 / 16", "267 / 476", "4 / 3", "1 / 1" */
  aspectRatioValue: string;
  /** Decimal aspect ratio (width / height) */
  aspectRatioNum: number;
  /** Recommended container max-width or width */
  recommendedWidth: number;
  /** Recommended container max-height or height */
  recommendedHeight: number;
  /** YouTube video ID if applicable */
  youtubeId?: string;
  /** Google Drive ID if applicable */
  gDriveId?: string;
  /** Whether this is a Facebook reel or vertical video */
  isFacebookReel?: boolean;
}

/**
 * Decodes common HTML entities (e.g. &amp;, &quot;, &#39;, &lt;, &gt;)
 */
export const decodeHtmlEntities = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
};

/**
 * Strips script tags, tracking pixels, noscript tags, meta/link tags,
 * and extraneous wrapper elements from pasted embed snippets.
 */
export const stripUnsafeAndConflictingTags = (raw: string): string => {
  if (!raw) return '';
  let clean = decodeHtmlEntities(raw.trim());

  // Remove <script> tags and contents (e.g., connect.facebook.net SDK, tracking scripts)
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove <noscript> tags and contents
  clean = clean.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  // Remove <style> tags and contents
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // Remove duplicate Facebook root divs
  clean = clean.replace(/<div\s+id=["']fb-root["'][^>]*>\s*<\/div>/gi, '');
  clean = clean.replace(/<div\s+id=["']fb-root["'][^>]*>/gi, '');
  // Remove standalone tracking or meta tags
  clean = clean.replace(/<meta[^>]*>/gi, '').replace(/<link[^>]*>/gi, '');
  // Remove hidden 1x1 tracking images
  clean = clean.replace(/<img[^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>/gi, '');

  return clean.trim();
};

/**
 * Normalizes Facebook URLs to canonical www.facebook.com
 */
export const normalizeFacebookUrl = (url: string): string => {
  if (!url) return '';
  let clean = url.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }
  // Replace mobile/web regional subdomains with canonical www
  clean = clean.replace(/https?:\/\/(?:web|m|touch|mobile|l|lm)\.facebook\.com/gi, 'https://www.facebook.com');
  return clean;
};

/**
 * Parses and fully optimizes any video embed snippet or direct URL.
 * Automatically resolves aspect ratio, dimensions, permissions, and prevents conflicts.
 */
export const parseAndOptimizeEmbed = (rawInput: string): OptimizedEmbedResult => {
  const stripped = stripUnsafeAndConflictingTags(rawInput || '');

  // 1. Direct video file (.mp4, .webm, .ogg, .mov)
  const isDirectVideoFile = /^https?:\/\/[^\s"']+\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(stripped);
  const isHtml5VideoTag = /<video[\s\S]*?>/i.test(stripped);

  if (isDirectVideoFile || isHtml5VideoTag) {
    let src = '';
    if (isDirectVideoFile) {
      src = stripped;
    } else {
      const srcMatch = stripped.match(/src=["'](.*?)["']/i);
      if (srcMatch && srcMatch[1]) {
        src = srcMatch[1];
      } else {
        const sourceMatch = stripped.match(/<source[\s\S]*?src=["'](.*?)["']/i);
        if (sourceMatch && sourceMatch[1]) {
          src = sourceMatch[1];
        }
      }
    }

    // Dimension checks
    const widthMatch = stripped.match(/\bwidth=["']?(\d+)["']?/i);
    const heightMatch = stripped.match(/\bheight=["']?(\d+)["']?/i);
    const w = widthMatch ? parseInt(widthMatch[1], 10) : 0;
    const h = heightMatch ? parseInt(heightMatch[1], 10) : 0;
    const isPortrait = w > 0 && h > 0 && h > w;
    const isSquare = w > 0 && h > 0 && w === h;
    const isLandscape = !isPortrait && !isSquare;

    const aspectRatioValue = w > 0 && h > 0 ? `${w} / ${h}` : isPortrait ? '9 / 16' : '16 / 9';
    const aspectRatioNum = w > 0 && h > 0 ? w / h : isPortrait ? 9 / 16 : 16 / 9;

    const optimizedCode = `<video controls playsinline webkit-playsinline="true" autoPlay muted loop preload="auto" style="object-fit: contain;" class="w-full h-full object-contain object-center bg-black mx-auto"><source src="${src}" type="video/mp4">Your browser does not support the video tag.</video>`;

    return {
      optimizedCode,
      iframeSrc: '',
      html5VideoSrc: src,
      provider: 'html5',
      isPortrait,
      isSquare,
      isLandscape,
      aspectRatioValue,
      aspectRatioNum,
      recommendedWidth: w || (isPortrait ? 267 : 560),
      recommendedHeight: h || (isPortrait ? 476 : 315),
    };
  }

  // Extract primary iframe src if present
  let extractedIframeSrc = '';
  const iframeMatch = stripped.match(/<iframe[\s\S]*?src=["'](.*?)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    extractedIframeSrc = decodeHtmlEntities(iframeMatch[1]);
  }

  // 2. YouTube (Watch, Short, Embed, youtu.be, youtube-nocookie)
  const isYouTube =
    stripped.includes('youtube.com') ||
    stripped.includes('youtu.be') ||
    stripped.includes('youtube-nocookie.com') ||
    extractedIframeSrc.includes('youtube.com') ||
    extractedIframeSrc.includes('youtu.be');

  if (isYouTube) {
    const ytWatchMatch = stripped.match(/(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/i);
    const ytShortMatch = stripped.match(/(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
    const ytYoutuBeMatch = stripped.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/i);
    const ytEmbedMatch = stripped.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i);

    const youtubeId =
      ytShortMatch?.[1] ||
      ytWatchMatch?.[1] ||
      ytYoutuBeMatch?.[1] ||
      ytEmbedMatch?.[1] ||
      '';

    const isShort = !!ytShortMatch || stripped.includes('/shorts/') || extractedIframeSrc.includes('/shorts/');
    const isPortrait = isShort;
    const isSquare = false;
    const isLandscape = !isPortrait;

    const width = isPortrait ? 267 : 560;
    const height = isPortrait ? 476 : 315;
    const aspectRatioValue = isPortrait ? '9 / 16' : '16 / 9';
    const aspectRatioNum = isPortrait ? 9 / 16 : 16 / 9;

    const cleanSrc = youtubeId
      ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&playsinline=1&enablejsapi=1&controls=1&rel=0&modestbranding=1&iv_load_policy=3`
      : extractedIframeSrc || stripped;

    const optimizedCode = `<iframe src="${cleanSrc}" width="${width}" height="${height}" title="SVNHS Video Presentation" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen class="w-full h-full border-0 block mx-auto"></iframe>`;

    return {
      optimizedCode,
      iframeSrc: cleanSrc,
      html5VideoSrc: '',
      provider: 'youtube',
      isPortrait,
      isSquare,
      isLandscape,
      aspectRatioValue,
      aspectRatioNum,
      recommendedWidth: width,
      recommendedHeight: height,
      youtubeId,
    };
  }

  // 3. Facebook Video / Reel
  const isFacebook =
    stripped.includes('facebook.com') ||
    stripped.includes('fb.watch') ||
    stripped.includes('fb.com') ||
    extractedIframeSrc.includes('facebook.com');

  if (isFacebook) {
    let rawSrc = extractedIframeSrc;

    // Check if pasted as Facebook SDK div or blockquote format
    const fbVideoDivMatch = stripped.match(/(?:data-href|cite)=["'](.*?)["']/i);
    if (!rawSrc && fbVideoDivMatch && fbVideoDivMatch[1]) {
      const fbUrl = normalizeFacebookUrl(fbVideoDivMatch[1]);
      const isReel = fbUrl.includes('/reel/') || fbUrl.includes('/reels/') || fbUrl.includes('/share/r/');
      const w = isReel ? 267 : 560;
      const h = isReel ? 476 : 315;
      rawSrc = `https://www.facebook.com/plugins/video.php?height=${h}&href=${encodeURIComponent(fbUrl)}&show_text=false&width=${w}&t=0`;
    }

    // Check direct link (e.g. pasted URL only)
    if (!rawSrc) {
      const directFbMatch = stripped.match(/(?:https?:\/\/)?(?:www\.|web\.|m\.|touch\.)?(?:facebook\.com|fb\.watch)\/[^\s"']+/i);
      if (directFbMatch) {
        const fbUrl = normalizeFacebookUrl(directFbMatch[0]);
        const isReel = fbUrl.includes('/reel/') || fbUrl.includes('/reels/') || fbUrl.includes('/share/r/');
        const w = isReel ? 267 : 560;
        const h = isReel ? 476 : 315;
        rawSrc = `https://www.facebook.com/plugins/video.php?height=${h}&href=${encodeURIComponent(fbUrl)}&show_text=false&width=${w}&t=0`;
      }
    }

    // Normalize domain in rawSrc
    if (rawSrc) {
      rawSrc = normalizeFacebookUrl(rawSrc);
    }

    const isReel =
      stripped.includes('/reel/') ||
      stripped.includes('/reels/') ||
      stripped.includes('/share/r/') ||
      stripped.includes('%2Freel%2F') ||
      stripped.includes('%2Freels%2F') ||
      stripped.includes('height=476') ||
      (rawSrc && (rawSrc.includes('/reel/') || rawSrc.includes('height=476') || rawSrc.includes('/share/r/')));

    // Extract width and height
    const widthAttrMatch = stripped.match(/\bwidth=["']?(\d+)["']?/i);
    const heightAttrMatch = stripped.match(/\bheight=["']?(\d+)["']?/i);
    const widthParamMatch = rawSrc ? rawSrc.match(/[?&]width=(\d+)/i) : null;
    const heightParamMatch = rawSrc ? rawSrc.match(/[?&]height=(\d+)/i) : null;

    const parsedWidth = parseInt(widthParamMatch?.[1] || widthAttrMatch?.[1] || (isReel ? '267' : '560'), 10);
    const parsedHeight = parseInt(heightParamMatch?.[1] || heightAttrMatch?.[1] || (isReel ? '476' : '315'), 10);

    const isPortrait = isReel || (parsedWidth > 0 && parsedHeight > 0 && parsedWidth < parsedHeight);
    const isSquare = parsedWidth > 0 && parsedHeight > 0 && parsedWidth === parsedHeight;
    const isLandscape = !isPortrait && !isSquare;

    const finalWidth = parsedWidth || (isPortrait ? 267 : 560);
    const finalHeight = parsedHeight || (isPortrait ? 476 : 315);
    const aspectRatioValue = `${finalWidth} / ${finalHeight}`;
    const aspectRatioNum = finalWidth / finalHeight;

    // Build canonical Facebook plugin URL with verified query parameters
    let cleanPluginSrc = rawSrc || '';
    if (cleanPluginSrc) {
      try {
        const fullUrl = cleanPluginSrc.startsWith('http') ? cleanPluginSrc : `https://${cleanPluginSrc}`;
        const parsedUrl = new URL(fullUrl);
        if (parsedUrl.pathname.includes('plugins/video.php')) {
          const hrefVal = parsedUrl.searchParams.get('href');
          if (hrefVal) {
            parsedUrl.searchParams.set('href', normalizeFacebookUrl(hrefVal));
          }
          parsedUrl.searchParams.set('width', String(finalWidth));
          parsedUrl.searchParams.set('height', String(finalHeight));
          parsedUrl.searchParams.set('show_text', 'false');
          parsedUrl.searchParams.set('t', '0');
          cleanPluginSrc = parsedUrl.toString();
        } else {
          // Direct video/reel URL -> wrap into plugin URL
          cleanPluginSrc = `https://www.facebook.com/plugins/video.php?height=${finalHeight}&href=${encodeURIComponent(normalizeFacebookUrl(fullUrl))}&show_text=false&width=${finalWidth}&t=0`;
        }
      } catch (_) {
        if (!cleanPluginSrc.includes('plugins/video.php')) {
          cleanPluginSrc = `https://www.facebook.com/plugins/video.php?height=${finalHeight}&href=${encodeURIComponent(normalizeFacebookUrl(cleanPluginSrc))}&show_text=false&width=${finalWidth}&t=0`;
        }
      }
    }

    const optimizedCode = `<iframe src="${cleanPluginSrc}" width="${finalWidth}" height="${finalHeight}" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen="true" class="w-full h-full border-0 block mx-auto"></iframe>`;

    return {
      optimizedCode,
      iframeSrc: cleanPluginSrc,
      html5VideoSrc: '',
      provider: 'facebook',
      isPortrait,
      isSquare,
      isLandscape,
      aspectRatioValue,
      aspectRatioNum,
      recommendedWidth: finalWidth,
      recommendedHeight: finalHeight,
      isFacebookReel: isReel,
    };
  }

  // 4. Google Drive
  const isGoogleDrive =
    stripped.includes('drive.google.com') ||
    stripped.includes('docs.google.com') ||
    extractedIframeSrc.includes('drive.google.com') ||
    extractedIframeSrc.includes('docs.google.com');

  if (isGoogleDrive) {
    const targetStr = extractedIframeSrc || stripped;
    const gDriveMatch =
      targetStr.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|(?:open|uc)\?(?:[\w=&-]*&)?id=|(?:document|presentation)\/d\/)([a-zA-Z0-9_-]+)/i) ||
      targetStr.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i) ||
      stripped.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i) ||
      stripped.match(/[?&]id=([a-zA-Z0-9_-]+)/i);

    const gDriveId = gDriveMatch?.[1] || '';
    const cleanSrc = gDriveId ? `https://drive.google.com/file/d/${gDriveId}/preview` : extractedIframeSrc || stripped;

    // Check for explicit width / height in snippet (attribute or style)
    const widthAttrMatch = stripped.match(/\bwidth=["']?(\d+)(?:px)?["']?/i);
    const isWidthPercent = /\bwidth=["']?\d+%/i.test(stripped);
    const heightAttrMatch = stripped.match(/\bheight=["']?(\d+)(?:px)?["']?/i);
    const isHeightPercent = /\bheight=["']?\d+%/i.test(stripped);

    let parsedWidth = 0;
    let parsedHeight = 0;
    if (widthAttrMatch && !isWidthPercent) {
      parsedWidth = parseInt(widthAttrMatch[1], 10);
    }
    if (heightAttrMatch && !isHeightPercent) {
      parsedHeight = parseInt(heightAttrMatch[1], 10);
    }

    // Also check style="width: ...px; height: ...px"
    if (!parsedWidth || !parsedHeight) {
      const styleW = stripped.match(/width:\s*(\d+)px/i);
      const styleH = stripped.match(/height:\s*(\d+)px/i);
      if (styleW && !parsedWidth) parsedWidth = parseInt(styleW[1], 10);
      if (styleH && !parsedHeight) parsedHeight = parseInt(styleH[1], 10);
    }

    const isVerticalClue = /(?:reel|short|portrait|vertical|tiktok|story|stories)/i.test(stripped);

    let isPortrait = false;
    let isSquare = false;
    let isLandscape = true;
    let finalWidth = 560;
    let finalHeight = 315;
    let aspectRatioValue = '16 / 9';
    let aspectRatioNum = 16 / 9;

    if (parsedWidth > 0 && parsedHeight > 0) {
      isPortrait = parsedHeight > parsedWidth;
      isSquare = parsedWidth === parsedHeight;
      isLandscape = !isPortrait && !isSquare;
      finalWidth = parsedWidth;
      finalHeight = parsedHeight;
      aspectRatioValue = `${parsedWidth} / ${parsedHeight}`;
      aspectRatioNum = parsedWidth / parsedHeight;
    } else if (isVerticalClue) {
      isPortrait = true;
      isSquare = false;
      isLandscape = false;
      finalWidth = 360;
      finalHeight = 640;
      aspectRatioValue = '9 / 16';
      aspectRatioNum = 9 / 16;
    }

    const optimizedCode = `<iframe src="${cleanSrc}" width="${finalWidth}" height="${finalHeight}" title="Google Drive Presentation" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="true" allowFullScreen class="w-full h-full border-0 block mx-auto"></iframe>`;

    return {
      optimizedCode,
      iframeSrc: cleanSrc,
      html5VideoSrc: '',
      provider: 'gdrive',
      isPortrait,
      isSquare,
      isLandscape,
      aspectRatioValue,
      aspectRatioNum,
      recommendedWidth: finalWidth,
      recommendedHeight: finalHeight,
      gDriveId,
    };
  }

  // 5. Vimeo
  const isVimeo = stripped.includes('vimeo.com') || extractedIframeSrc.includes('vimeo.com');
  if (isVimeo) {
    const vimeoMatch = stripped.match(/(?:https?:\/\/)?(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?([0-9]+)/i);
    const vimeoId = vimeoMatch?.[1] || '';
    const cleanSrc = vimeoId
      ? `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&playsinline=1`
      : extractedIframeSrc || stripped;

    const optimizedCode = `<iframe src="${cleanSrc}" width="560" height="315" title="Vimeo Presentation" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen class="w-full h-full border-0 block mx-auto"></iframe>`;

    return {
      optimizedCode,
      iframeSrc: cleanSrc,
      html5VideoSrc: '',
      provider: 'vimeo',
      isPortrait: false,
      isSquare: false,
      isLandscape: true,
      aspectRatioValue: '16 / 9',
      aspectRatioNum: 16 / 9,
      recommendedWidth: 560,
      recommendedHeight: 315,
    };
  }

  // 6. Generic Iframe Fallback with full sanitization
  const widthAttrMatch = stripped.match(/\bwidth=["']?(\d+)["']?/i);
  const heightAttrMatch = stripped.match(/\bheight=["']?(\d+)["']?/i);
  const parsedWidth = widthAttrMatch ? parseInt(widthAttrMatch[1], 10) : 560;
  const parsedHeight = heightAttrMatch ? parseInt(heightAttrMatch[1], 10) : 315;

  const isPortrait = parsedWidth > 0 && parsedHeight > 0 && parsedWidth < parsedHeight;
  const isSquare = parsedWidth > 0 && parsedHeight > 0 && parsedWidth === parsedHeight;
  const isLandscape = !isPortrait && !isSquare;
  const aspectRatioValue = parsedWidth > 0 && parsedHeight > 0 ? `${parsedWidth} / ${parsedHeight}` : '16 / 9';
  const aspectRatioNum = parsedWidth > 0 && parsedHeight > 0 ? parsedWidth / parsedHeight : 16 / 9;

  let cleanSrc = extractedIframeSrc || stripped;
  if (cleanSrc.startsWith('//')) cleanSrc = 'https:' + cleanSrc;

  const optimizedCode = `<iframe src="${cleanSrc}" width="${parsedWidth}" height="${parsedHeight}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen class="w-full h-full border-0 block mx-auto"></iframe>`;

  return {
    optimizedCode,
    iframeSrc: cleanSrc,
    html5VideoSrc: '',
    provider: 'generic',
    isPortrait,
    isSquare,
    isLandscape,
    aspectRatioValue,
    aspectRatioNum,
    recommendedWidth: parsedWidth,
    recommendedHeight: parsedHeight,
  };
};
