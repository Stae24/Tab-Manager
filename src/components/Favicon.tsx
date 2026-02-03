import React, { useState, useMemo, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '../utils/cn';
import type { FaviconSource, FaviconFallback, FaviconSize } from '../store/useStore';

interface FaviconProps {
  src?: string;
  url?: string;
  className?: string;
  onLoad?: () => void;
  source?: FaviconSource;
  fallback?: FaviconFallback;
  size?: FaviconSize;
}

const RESTRICTED_PROTOCOLS = [
  'chrome://',
  'about:',
  'file:',
  'data:',
  'chrome-extension:',
  'edge:',
  'opera:',
  'view-source:',
];

const getGoogleFaviconUrl = (effectiveUrl: string, size: string): string | null => {
  try {
    const hostname = new URL(effectiveUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`;
  } catch {
    return null;
  }
};

const getGoogleHdFaviconUrl = (effectiveUrl: string): string | null => {
  try {
    const hostname = new URL(effectiveUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  } catch {
    return null;
  }
};

const getDuckDuckGoFaviconUrl = (effectiveUrl: string): string | null => {
  try {
    const hostname = new URL(effectiveUrl).hostname;
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  } catch {
    return null;
  }
};

const getIconHorseUrl = (effectiveUrl: string): string | null => {
  try {
    const hostname = new URL(effectiveUrl).hostname;
    return `https://icon.horse/icon/${hostname}`;
  } catch {
    return null;
  }
};

const getChromeFaviconUrl = (effectiveUrl: string, size: string): string | null => {
  try {
    const faviconUrl = new URL(`chrome-extension://${chrome.runtime.id}/_favicon/`);
    faviconUrl.searchParams.set("pageUrl", effectiveUrl);
    faviconUrl.searchParams.set("size", size);
    return faviconUrl.toString();
  } catch {
    return null;
  }
};

const getFaviconUrl = (source: FaviconSource, effectiveUrl: string, size: string): string | null => {
  switch (source) {
    case 'google':
      return getGoogleFaviconUrl(effectiveUrl, size);
    case 'google-hd':
      return getGoogleHdFaviconUrl(effectiveUrl);
    case 'duckduckgo':
      return getDuckDuckGoFaviconUrl(effectiveUrl);
    case 'icon-horse':
      return getIconHorseUrl(effectiveUrl);
    case 'chrome':
      return getChromeFaviconUrl(effectiveUrl, size);
    default:
      return null;
  }
};

const getFallbackSource = (primary: FaviconSource): FaviconSource => {
  const fallbacks: Record<FaviconSource, FaviconSource> = {
    'chrome': 'google',
    'google': 'duckduckgo',
    'google-hd': 'google',
    'duckduckgo': 'google',
    'icon-horse': 'google',
  };
  return fallbacks[primary] || 'google';
};

export const Favicon: React.FC<FaviconProps> = ({ 
  src, 
  url, 
  className, 
  onLoad,
  source = 'google',
  fallback = 'enabled',
  size = '32'
}) => {
  const [tier, setTier] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const effectiveUrl = url || src;

  const isDataSaver = useMemo(() => {
    return (navigator as any).connection?.saveData === true;
  }, []);

  useEffect(() => {
    setTier(0);
  }, [src, url, source, size]);

  const finalSrc = useMemo(() => {
    if (src?.startsWith('data:')) {
      return src;
    }

    if (!effectiveUrl || isDataSaver) {
      return null;
    }

    const isRestricted = RESTRICTED_PROTOCOLS.some(p => effectiveUrl.startsWith(p));
    if (isRestricted) {
      return null;
    }

    const maxTier = fallback === 'enabled' ? 1 : 0;
    if (tier > maxTier) {
      return null;
    }

    if (tier === 0) {
      return getFaviconUrl(source, effectiveUrl, size);
    }

    if (tier === 1 && fallback === 'enabled') {
      const fallbackSource = getFallbackSource(source);
      return getFaviconUrl(fallbackSource, effectiveUrl, size);
    }

    return null;
  }, [src, url, effectiveUrl, tier, source, fallback, size, isDataSaver]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    const maxTier = fallback === 'enabled' ? 1 : 0;
    setTier(prev => Math.min(prev + 1, maxTier + 1));
  };

  if (!finalSrc) {
    return (
      <Globe 
        className={cn(
          "text-gray-500 transition-opacity duration-300 opacity-100",
          className
        )} 
        size={16} 
      />
    );
  }

  return (
    <img
      src={finalSrc}
      alt=""
      className={cn("transition-opacity duration-300", isLoaded ? "opacity-100" : "opacity-0", className)}
      onLoad={handleLoad}
      onError={handleError}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
};
