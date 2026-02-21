import { bench, describe } from 'vitest';
import {
  isLocalUrl,
  isIpAddress,
  isBrowserUrl,
  normalizeUrl,
  buildDuplicateMap,
  findDuplicates,
  matchesText,
} from '../../utils';
import type { Tab } from '../../../types';

function createMockTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: `live-tab-${Math.random()}`,
    title: `Test Tab`,
    url: `https://example.com/page`,
    favicon: '',
    active: false,
    discarded: false,
    windowId: 1,
    index: 0,
    groupId: -1,
    ...overrides,
  };
}

function generateUrls(count: number): string[] {
  const patterns = [
    'https://example.com/page/',
    'https://google.com/search?q=',
    'https://github.com/user/repo/',
    'https://stackoverflow.com/questions/',
    'https://youtube.com/watch?v=',
    'https://reddit.com/r/',
    'http://localhost:3000/app/',
    'https://192.168.1.',
    'chrome://extensions',
    'file:///home/user/',
  ];
  
  return Array.from({ length: count }, (_, i) => 
    `${patterns[i % patterns.length]}${i}`
  );
}

function generateTabs(count: number, duplicateRatio = 0.1): Tab[] {
  const uniqueUrls = Math.floor(count * (1 - duplicateRatio));
  const tabs: Tab[] = [];
  
  for (let i = 0; i < uniqueUrls; i++) {
    tabs.push(createMockTab({
      id: `live-tab-${i}`,
      url: `https://unique${i}.com/page`,
    }));
  }
  
  for (let i = uniqueUrls; i < count; i++) {
    tabs.push(createMockTab({
      id: `live-tab-${i}`,
      url: `https://unique${i % Math.max(1, Math.floor(uniqueUrls * 0.5))}.com/page`,
    }));
  }
  
  return tabs;
}

const urls100 = generateUrls(100);
const urls500 = generateUrls(500);
const urls1000 = generateUrls(1000);
const urls2000 = generateUrls(2000);

const tabs100 = generateTabs(100);
const tabs500 = generateTabs(500);
const tabs1000 = generateTabs(1000);
const tabs2000 = generateTabs(2000);

const ipv4Addresses = Array.from({ length: 1000 }, (_, i) => 
  `${Math.floor(i / 255) % 256}.${i % 256}.${Math.floor(i / 65025) % 256}.${i % 256}`
);

const ipv6Addresses = Array.from({ length: 1000 }, (_, i) => 
  `2001:0db8:85a3:${i.toString(16).padStart(4, '0')}::1`
);

const domains = Array.from({ length: 1000 }, (_, i) => 
  `subdomain${i}.example${i % 100}.com`
);

describe('normalizeUrl benchmarks', () => {
  bench('loose mode - 100 URLs', () => {
    urls100.forEach(url => normalizeUrl(url, 'loose'));
  });

  bench('loose mode - 500 URLs', () => {
    urls500.forEach(url => normalizeUrl(url, 'loose'));
  });

  bench('loose mode - 1000 URLs', () => {
    urls1000.forEach(url => normalizeUrl(url, 'loose'));
  });

  bench('strict mode - 100 URLs', () => {
    urls100.forEach(url => normalizeUrl(url, 'strict'));
  });

  bench('strict mode - 500 URLs', () => {
    urls500.forEach(url => normalizeUrl(url, 'strict'));
  });

  bench('strict mode - 1000 URLs', () => {
    urls1000.forEach(url => normalizeUrl(url, 'strict'));
  });
});

describe('buildDuplicateMap benchmarks', () => {
  bench('100 tabs', () => {
    buildDuplicateMap(tabs100);
  });

  bench('500 tabs', () => {
    buildDuplicateMap(tabs500);
  });

  bench('1000 tabs', () => {
    buildDuplicateMap(tabs1000);
  });

  bench('2000 tabs', () => {
    buildDuplicateMap(tabs2000);
  });

  bench('100 tabs - strict mode', () => {
    buildDuplicateMap(tabs100, 'strict');
  });

  bench('500 tabs - strict mode', () => {
    buildDuplicateMap(tabs500, 'strict');
  });
});

describe('isLocalUrl benchmarks', () => {
  bench('100 URLs', () => {
    urls100.forEach(url => isLocalUrl(url));
  });

  bench('500 URLs', () => {
    urls500.forEach(url => isLocalUrl(url));
  });

  bench('1000 URLs', () => {
    urls1000.forEach(url => isLocalUrl(url));
  });

  const customPatterns = ['mydev.local', 'staging', 'test-\\d+'];
  
  bench('500 URLs with 3 custom patterns', () => {
    urls500.forEach(url => isLocalUrl(url, customPatterns));
  });

  bench('1000 URLs with 3 custom patterns', () => {
    urls1000.forEach(url => isLocalUrl(url, customPatterns));
  });
});

describe('isIpAddress benchmarks', () => {
  bench('1000 IPv4 addresses', () => {
    ipv4Addresses.forEach(addr => isIpAddress(addr));
  });

  bench('1000 IPv6 addresses', () => {
    ipv6Addresses.forEach(addr => isIpAddress(addr));
  });

  bench('1000 domain names', () => {
    domains.forEach(domain => isIpAddress(domain));
  });

  bench('mixed 1000 addresses', () => {
    const mixed = [...ipv4Addresses.slice(0, 500), ...domains.slice(0, 500)];
    mixed.forEach(addr => isIpAddress(addr));
  });
});

describe('isBrowserUrl benchmarks', () => {
  bench('100 URLs', () => {
    urls100.forEach(url => isBrowserUrl(url));
  });

  bench('500 URLs', () => {
    urls500.forEach(url => isBrowserUrl(url));
  });

  bench('1000 URLs', () => {
    urls1000.forEach(url => isBrowserUrl(url));
  });
});

describe('findDuplicates benchmarks', () => {
  const map100 = buildDuplicateMap(tabs100);
  const map500 = buildDuplicateMap(tabs500);
  const map1000 = buildDuplicateMap(tabs1000);

  bench('100 tabs lookup', () => {
    tabs100.forEach(tab => findDuplicates(tab, map100));
  });

  bench('500 tabs lookup', () => {
    tabs500.forEach(tab => findDuplicates(tab, map500));
  });

  bench('1000 tabs lookup', () => {
    tabs1000.forEach(tab => findDuplicates(tab, map1000));
  });
});

describe('matchesText benchmarks', () => {
  bench('100 tabs - default scope', () => {
    tabs100.forEach(tab => matchesText(tab, 'example'));
  });

  bench('500 tabs - default scope', () => {
    tabs500.forEach(tab => matchesText(tab, 'example'));
  });

  bench('1000 tabs - default scope', () => {
    tabs1000.forEach(tab => matchesText(tab, 'example'));
  });

  bench('500 tabs - title scope', () => {
    tabs500.forEach(tab => matchesText(tab, 'Test', 'title'));
  });

  bench('500 tabs - url scope', () => {
    tabs500.forEach(tab => matchesText(tab, 'com', 'url'));
  });
});
