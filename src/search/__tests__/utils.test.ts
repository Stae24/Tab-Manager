import { describe, it, expect } from 'vitest';
import {
  isLocalUrl,
  isIpAddress,
  isBrowserUrl,
  normalizeUrl,
  buildDuplicateMap,
  findDuplicates,
  getGroupId,
  matchesText,
} from '../utils';
import type { Tab } from '../../types';

const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 'live-tab-1',
  title: 'Test Tab',
  url: 'https://example.com',
  favicon: '',
  active: false,
  discarded: false,
  windowId: 1,
  index: 0,
  groupId: -1,
  ...overrides,
});

describe('isLocalUrl', () => {
  describe('file:// URLs', () => {
    it('returns true for file:// URLs', () => {
      expect(isLocalUrl('file:///home/user/document.html')).toBe(true);
      expect(isLocalUrl('file:///C:/Users/Documents/file.html')).toBe(true);
    });
  });

  describe('localhost', () => {
    it('returns true for localhost URLs', () => {
      expect(isLocalUrl('http://localhost:3000')).toBe(true);
      expect(isLocalUrl('https://localhost')).toBe(true);
      expect(isLocalUrl('http://localhost:8080/app')).toBe(true);
    });
  });

  describe('.local domains', () => {
    it('returns true for .local domains', () => {
      expect(isLocalUrl('http://myapp.local')).toBe(true);
      expect(isLocalUrl('https://server.local:443')).toBe(true);
    });
  });

  describe('private IPv4 ranges', () => {
    it('returns true for 127.x.x.x (loopback)', () => {
      expect(isLocalUrl('http://127.0.0.1')).toBe(true);
      expect(isLocalUrl('http://127.0.0.1:3000')).toBe(true);
    });

    it('returns true for 10.x.x.x (Class A private)', () => {
      expect(isLocalUrl('http://10.0.0.1')).toBe(true);
      expect(isLocalUrl('http://10.255.255.255')).toBe(true);
    });

    it('returns true for 172.16-31.x.x (Class B private)', () => {
      expect(isLocalUrl('http://172.16.0.1')).toBe(true);
      expect(isLocalUrl('http://172.20.0.1')).toBe(true);
      expect(isLocalUrl('http://172.31.255.255')).toBe(true);
    });

    it('returns false for 172.15.x.x (not private)', () => {
      expect(isLocalUrl('http://172.15.0.1')).toBe(false);
    });

    it('returns false for 172.32.x.x (not private)', () => {
      expect(isLocalUrl('http://172.32.0.1')).toBe(false);
    });

    it('returns true for 192.168.x.x (Class C private)', () => {
      expect(isLocalUrl('http://192.168.0.1')).toBe(true);
      expect(isLocalUrl('http://192.168.1.100')).toBe(true);
    });

    it('returns true for 169.254.x.x (link-local)', () => {
      expect(isLocalUrl('http://169.254.0.1')).toBe(true);
    });

    it('returns true for 0.0.0.0', () => {
      expect(isLocalUrl('http://0.0.0.0:3000')).toBe(true);
    });
  });

  describe('private IPv6', () => {
    it('returns true for IPv6 loopback hostname', () => {
      expect(isLocalUrl('http://[::1]/')).toBe(true);
    });

    it('returns true for fc00: (ULA)', () => {
      expect(isLocalUrl('http://[fc00::1]/')).toBe(true);
    });

    it('returns true for fe80: (link-local)', () => {
      expect(isLocalUrl('http://[fe80::1]/')).toBe(true);
    });
  });

  describe('custom patterns', () => {
    it('returns true for string pattern match', () => {
      expect(isLocalUrl('http://mydevserver:3000', ['mydevserver'])).toBe(true);
    });

    it('returns true for regex pattern match', () => {
      expect(isLocalUrl('http://dev-123.local:3000', ['dev-\\d+'])).toBe(true);
    });

    it('returns false when no custom patterns match', () => {
      expect(isLocalUrl('https://example.com', ['mydevserver'])).toBe(false);
    });
  });

  describe('regular URLs', () => {
    it('returns false for regular domains', () => {
      expect(isLocalUrl('https://example.com')).toBe(false);
      expect(isLocalUrl('https://google.com/search')).toBe(false);
    });

    it('returns false for public IP addresses', () => {
      expect(isLocalUrl('http://8.8.8.8')).toBe(false);
      expect(isLocalUrl('http://1.1.1.1')).toBe(false);
    });
  });

  describe('invalid URLs', () => {
    it('returns false for invalid URLs', () => {
      expect(isLocalUrl('not-a-url')).toBe(false);
      expect(isLocalUrl('')).toBe(false);
    });
  });
});

describe('isIpAddress', () => {
  describe('IPv4', () => {
    it('returns true for valid IPv4 addresses', () => {
      expect(isIpAddress('192.168.1.1')).toBe(true);
      expect(isIpAddress('10.0.0.1')).toBe(true);
      expect(isIpAddress('8.8.8.8')).toBe(true);
      expect(isIpAddress('0.0.0.0')).toBe(true);
      expect(isIpAddress('255.255.255.255')).toBe(true);
    });

    it('returns false for IPv4 with octets > 255', () => {
      expect(isIpAddress('256.0.0.1')).toBe(false);
      expect(isIpAddress('192.168.1.256')).toBe(false);
    });

    it('returns false for IPv4 with too few octets', () => {
      expect(isIpAddress('192.168.1')).toBe(false);
    });

    it('returns false for IPv4 with too many octets', () => {
      expect(isIpAddress('192.168.1.1.1')).toBe(false);
    });
  });

  describe('IPv6', () => {
    it('returns true for full IPv6 format', () => {
      expect(isIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    });

    it('returns true for compressed IPv6 (::)', () => {
      expect(isIpAddress('::1')).toBe(true);
      expect(isIpAddress('2001:db8::1')).toBe(true);
    });

    it('returns true for IPv6 with brackets', () => {
      expect(isIpAddress('[::1]')).toBe(true);
      expect(isIpAddress('[2001:db8::1]')).toBe(true);
    });
  });

  describe('non-IP values', () => {
    it('returns false for domain names', () => {
      expect(isIpAddress('example.com')).toBe(false);
      expect(isIpAddress('localhost')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isIpAddress('')).toBe(false);
    });
  });
});

describe('isBrowserUrl', () => {
  it('returns true for chrome:// URLs', () => {
    expect(isBrowserUrl('chrome://extensions')).toBe(true);
    expect(isBrowserUrl('chrome://settings')).toBe(true);
    expect(isBrowserUrl('chrome://newtab')).toBe(true);
  });

  it('returns true for chrome-extension:// URLs', () => {
    expect(isBrowserUrl('chrome-extension://abcdefg/popup.html')).toBe(true);
  });

  it('returns true for about: URLs', () => {
    expect(isBrowserUrl('about:blank')).toBe(true);
    expect(isBrowserUrl('about:newtab')).toBe(true);
  });

  it('returns true for edge:// URLs', () => {
    expect(isBrowserUrl('edge://settings')).toBe(true);
  });

  it('returns true for opera:// URLs', () => {
    expect(isBrowserUrl('opera://settings')).toBe(true);
  });

  it('returns true for brave:// URLs', () => {
    expect(isBrowserUrl('brave://settings')).toBe(true);
  });

  it('returns true for vivaldi:// URLs', () => {
    expect(isBrowserUrl('vivaldi://settings')).toBe(true);
  });

  it('returns true for firefox:// URLs', () => {
    expect(isBrowserUrl('firefox://settings')).toBe(true);
  });

  it('returns true for moz-extension:// URLs', () => {
    expect(isBrowserUrl('moz-extension://abcdefg/popup.html')).toBe(true);
  });

  it('returns false for regular URLs', () => {
    expect(isBrowserUrl('https://example.com')).toBe(false);
    expect(isBrowserUrl('http://localhost:3000')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isBrowserUrl('CHROME://extensions')).toBe(true);
    expect(isBrowserUrl('About:blank')).toBe(true);
  });
});

describe('normalizeUrl', () => {
  describe('loose mode (default)', () => {
    it('lowercases host', () => {
      expect(normalizeUrl('https://Example.com/path')).toBe('https://example.com/path');
    });

    it('removes trailing slashes', () => {
      expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
    });

    it('strips query string', () => {
      expect(normalizeUrl('https://example.com/path?query=value')).toBe('https://example.com/path');
    });

    it('strips hash', () => {
      expect(normalizeUrl('https://example.com/path#section')).toBe('https://example.com/path');
    });

    it('strips both query and hash', () => {
      expect(normalizeUrl('https://example.com/path?q=1#section')).toBe('https://example.com/path');
    });
  });

  describe('strict mode', () => {
    it('includes query string', () => {
      expect(normalizeUrl('https://example.com/path?query=value', 'strict')).toBe(
        'https://example.com/path?query=value'
      );
    });

    it('includes hash', () => {
      expect(normalizeUrl('https://example.com/path#section', 'strict')).toBe(
        'https://example.com/path#section'
      );
    });

    it('includes both query and hash', () => {
      expect(normalizeUrl('https://example.com/path?q=1#section', 'strict')).toBe(
        'https://example.com/path?q=1#section'
      );
    });
  });

  describe('common behavior', () => {
    it('lowercases host in both modes', () => {
      expect(normalizeUrl('https://Example.com/Path', 'strict')).toBe('https://example.com/path');
      expect(normalizeUrl('https://Example.com/Path', 'loose')).toBe('https://example.com/path');
    });

    it('handles URLs with ports', () => {
      expect(normalizeUrl('https://example.com:8443/path')).toBe('https://example.com:8443/path');
      expect(normalizeUrl('http://localhost:3000/app')).toBe('http://localhost:3000/app');
    });
  });

  describe('invalid URLs', () => {
    it('returns normalized string for invalid URL in loose mode', () => {
      const result = normalizeUrl('not-a-url', 'loose');
      expect(result).toBe('not-a-url');
    });

    it('returns normalized string for invalid URL in strict mode', () => {
      const result = normalizeUrl('not-a-url', 'strict');
      expect(result).toBe('not-a-url');
    });
  });
});

describe('buildDuplicateMap', () => {
  it('groups tabs by normalized URL', () => {
    const tabs = [
      createMockTab({ id: 'live-tab-1', url: 'https://example.com/page' }),
      createMockTab({ id: 'live-tab-2', url: 'https://example.com/page/' }),
      createMockTab({ id: 'live-tab-3', url: 'https://Example.com/Page' }),
      createMockTab({ id: 'live-tab-4', url: 'https://different.com' }),
    ];

    const map = buildDuplicateMap(tabs);

    expect(map.size).toBe(2);
    const exampleKey = 'https://example.com/page';
    expect(map.get(exampleKey)).toHaveLength(3);
  });

  it('ignores tabs without URLs', () => {
    const tabs = [
      createMockTab({ id: 'live-tab-1', url: 'https://example.com' }),
      createMockTab({ id: 'live-tab-2', url: '' }),
      createMockTab({ id: 'live-tab-3', url: undefined }),
    ];

    const map = buildDuplicateMap(tabs as Tab[]);

    expect(map.size).toBe(1);
  });

  it('respects strict mode', () => {
    const tabs = [
      createMockTab({ id: 'live-tab-1', url: 'https://example.com/page?q=1' }),
      createMockTab({ id: 'live-tab-2', url: 'https://example.com/page?q=2' }),
    ];

    const looseMap = buildDuplicateMap(tabs, 'loose');
    const strictMap = buildDuplicateMap(tabs, 'strict');

    expect(looseMap.size).toBe(1);
    expect(strictMap.size).toBe(2);
  });

  it('handles empty tab list', () => {
    const map = buildDuplicateMap([]);
    expect(map.size).toBe(0);
  });
});

describe('findDuplicates', () => {
  it('returns true when URL appears 2+ times', () => {
    const tabs = [
      createMockTab({ id: 'live-tab-1', url: 'https://example.com' }),
      createMockTab({ id: 'live-tab-2', url: 'https://example.com' }),
    ];
    const map = buildDuplicateMap(tabs);

    expect(findDuplicates(tabs[0], map)).toBe(true);
    expect(findDuplicates(tabs[1], map)).toBe(true);
  });

  it('returns false when URL appears once', () => {
    const tabs = [createMockTab({ id: 'live-tab-1', url: 'https://example.com' })];
    const map = buildDuplicateMap(tabs);

    expect(findDuplicates(tabs[0], map)).toBe(false);
  });

  it('returns false for tabs without URL', () => {
    const tab = createMockTab({ url: '' });
    const map = new Map();

    expect(findDuplicates(tab, map)).toBe(false);
  });

  it('respects strict mode', () => {
    const tabs = [
      createMockTab({ id: 'live-tab-1', url: 'https://example.com?q=1' }),
      createMockTab({ id: 'live-tab-2', url: 'https://example.com?q=2' }),
    ];
    const looseMap = buildDuplicateMap(tabs, 'loose');
    const strictMap = buildDuplicateMap(tabs, 'strict');

    expect(findDuplicates(tabs[0], looseMap, 'loose')).toBe(true);
    expect(findDuplicates(tabs[0], strictMap, 'strict')).toBe(false);
  });
});

describe('getGroupId', () => {
  it('returns number for valid groupId', () => {
    expect(getGroupId(createMockTab({ groupId: 123 }))).toBe(123);
    expect(getGroupId(createMockTab({ groupId: 0 }))).toBe(0);
  });

  it('returns null for groupId -1', () => {
    expect(getGroupId(createMockTab({ groupId: -1 }))).toBe(null);
  });

  it('returns null for undefined groupId', () => {
    const tab = { ...createMockTab() } as Tab;
    delete (tab as any).groupId;
    expect(getGroupId(tab)).toBe(null);
  });
});

describe('matchesText', () => {
  const tab = createMockTab({
    title: 'YouTube - Music Video',
    url: 'https://youtube.com/watch?v=123',
  });

  describe('default scope (both title and url)', () => {
    it('matches text in title', () => {
      expect(matchesText(tab, 'youtube')).toBe(true);
      expect(matchesText(tab, 'Music')).toBe(true);
    });

    it('matches text in url', () => {
      expect(matchesText(tab, 'watch')).toBe(true);
      expect(matchesText(tab, '123')).toBe(true);
    });

    it('is case insensitive', () => {
      expect(matchesText(tab, 'YOUTUBE')).toBe(true);
      expect(matchesText(tab, 'MUSIC')).toBe(true);
    });

    it('returns false when not in title or url', () => {
      expect(matchesText(tab, 'spotify')).toBe(false);
    });

    it('matches partial words', () => {
      expect(matchesText(tab, 'Tube')).toBe(true);
    });
  });

  describe('title scope', () => {
    it('matches text in title only', () => {
      expect(matchesText(tab, 'Music', 'title')).toBe(true);
    });

    it('does not match text only in url', () => {
      expect(matchesText(tab, 'watch', 'title')).toBe(false);
      expect(matchesText(tab, '123', 'title')).toBe(false);
    });
  });

  describe('url scope', () => {
    it('matches text in url only', () => {
      expect(matchesText(tab, 'watch', 'url')).toBe(true);
      expect(matchesText(tab, '123', 'url')).toBe(true);
    });

    it('does not match text only in title', () => {
      expect(matchesText(tab, 'Music Video', 'url')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for missing title', () => {
      const noTitle = createMockTab({ title: undefined });
      expect(matchesText(noTitle, 'test')).toBe(false);
    });

    it('returns false for missing url', () => {
      const noUrl = createMockTab({ url: '' });
      expect(matchesText(noUrl, 'test', 'url')).toBe(false);
    });

    it('returns true for empty term (matches everything)', () => {
      expect(matchesText(tab, '')).toBe(true);
    });
  });
});
