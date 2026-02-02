import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '../utils/cn';

interface FaviconProps {
  src?: string;
  url?: string;
  className?: string;
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

export const Favicon: React.FC<FaviconProps> = ({ src, url, className }) => {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const resolveFavicon = async () => {
      setDisplaySrc(null);

      if (src?.startsWith('data:')) {
        if (isMounted) {
          setDisplaySrc(src);
          setLoading(false);
        }
        return;
      }

      const isRestricted = url ? RESTRICTED_PROTOCOLS.some(p => url.startsWith(p)) : false;
      if (isRestricted || (!src && !url)) {
        if (isMounted) {
          setDisplaySrc(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      let targetUrl = src;

      if (!targetUrl && url) {
        try {
          const base = chrome.runtime.getURL("/_favicon/").replace(/\/$/, "");
          const faviconUrl = new URL(base + "/");
          faviconUrl.searchParams.set("pageUrl", url);
          faviconUrl.searchParams.set("size", "32");
          targetUrl = faviconUrl.toString();
        } catch (e) {
          if (isMounted) {
            setDisplaySrc(null);
            setLoading(false);
          }
          return;
        }
      }

      if (!targetUrl) {
        if (isMounted) {
          setDisplaySrc(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'FETCH_FAVICON',
          url: targetUrl
        });

        if (isMounted) {
          if (response?.success && response?.dataUrl) {
            setDisplaySrc(response.dataUrl);
          } else {
            setDisplaySrc(null);
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setDisplaySrc(null);
          setLoading(false);
        }
      }
    };

    resolveFavicon();

    return () => {
      isMounted = false;
    };
  }, [src, url]);

  if (loading || !displaySrc) {
    return (
      <Globe 
        className={cn(
          "text-gray-500 transition-opacity duration-300", 
          loading ? "animate-pulse opacity-50" : "opacity-100",
          className
        )} 
        size={16} 
      />
    );
  }

  return (
    <img
      src={displaySrc}
      alt=""
      className={cn("transition-opacity duration-300 opacity-100", className)}
      onError={() => setDisplaySrc(null)}
      loading="lazy"
    />
  );
};
