import React, { useState, useMemo, useEffect } from 'react';
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
  const [tier, setTier] = useState(0);
  const effectiveUrl = url || src;

  useEffect(() => {
    setTier(0);
  }, [src, url]);

  const finalSrc = useMemo(() => {
    if (src?.startsWith('data:')) {
      return src;
    }

    if (!effectiveUrl || tier === 2) {
      return null;
    }

    const isRestricted = RESTRICTED_PROTOCOLS.some(p => effectiveUrl.startsWith(p));
    if (isRestricted) {
      return null;
    }

    if (tier === 0) {
      try {
        const hostname = new URL(effectiveUrl).hostname;
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
      } catch (e) {
        return null;
      }
    }

    if (tier === 1) {
      try {
        const faviconUrl = new URL(`chrome-extension://${chrome.runtime.id}/_favicon/`);
        faviconUrl.searchParams.set("pageUrl", effectiveUrl);
        faviconUrl.searchParams.set("size", "32");
        return faviconUrl.toString();
      } catch (e) {
        return null;
      }
    }

    return null;
  }, [src, url, effectiveUrl, tier]);

  const handleError = () => {
    setTier(prev => Math.min(prev + 1, 2));
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
      className={cn("transition-opacity duration-300 opacity-100", className)}
      onError={handleError}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
};
