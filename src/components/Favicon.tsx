import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '../utils/cn';

interface FaviconProps {
  src?: string;
  url?: string;
  className?: string;
}

export const Favicon: React.FC<FaviconProps> = ({ src, url, className }) => {
  const [error, setError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setError(false);
    setUseFallback(false);
  }, [src, url]);

  const getFaviconUrl = (pageUrl?: string) => {
    if (!pageUrl) return undefined;

    // Filter out system URL schemes that the favicon service can't handle
    if (
      pageUrl.startsWith('chrome://') ||
      pageUrl.startsWith('about:') ||
      pageUrl.startsWith('file:') ||
      pageUrl.startsWith('data:')
    ) {
      return undefined;
    }

    try {
      const u = new URL(pageUrl);
      // Clean base URL to ensure no trailing slash conflicts
      const base = chrome.runtime.getURL("/_favicon/").replace(/\/$/, "");
      const faviconUrl = new URL(base + "/");
      faviconUrl.searchParams.set("pageUrl", u.href);
      faviconUrl.searchParams.set("size", "32");
      return faviconUrl.toString();
    } catch (e) {
      return undefined;
    }
  };

  const _faviconUrl = getFaviconUrl(url);
  const currentSrc = (!useFallback && src) ? src : _faviconUrl;

  if (error || !currentSrc) {
    return <Globe className={cn("text-gray-500", className)} size={16} />;
  }

  return (
    <img
      src={currentSrc}
      alt=""
      className={className}
      onError={() => {
        if (!useFallback && src) {
          setUseFallback(true);
        } else {
          setError(true);
        }
      }}
      loading="lazy"
    />
  );
};
