# URL Storage Optimization Plan

This document outlines the implementation plan for optimizing URL storage in the Tab Manager Vault through URL normalization and domain deduplication.

## Overview

**Target File**: `src/services/vaultService.ts`

**Goal**: Reduce URL storage size by 40-60% through:
1. URL Normalization - strip redundant data
2. Domain Deduplication - share common domain strings

---

## 1. URL Normalization

### What to Strip

| Element | Example | Stripped Result |
|---------|---------|-----------------|
| Protocol | `https://` | Removed |
| `www.` prefix | `www.youtube.com` | `youtube.com` |
| UTM parameters | `?utm_source=twitter&utm_medium=social` | Removed |
| Hash fragments (optional) | `#section` | Keep by default |
| Trailing slash | `example.com/` | `example.com` |

### Implementation

Add these helper functions to `vaultService.ts`:

```typescript
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'ref', 'source', '_ga', 'mc_cid', 'mc_eid'
]);

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Remove www. prefix from hostname
    let hostname = parsed.hostname.replace(/^www\./, '');
    
    // Remove tracking parameters
    const params = new URLSearchParams(parsed.search);
    for (const key of Array.from(params.keys())) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        params.delete(key);
      }
    }
    
    // Rebuild URL without protocol and with cleaned params
    let normalized = hostname;
    
    const cleanSearch = params.toString();
    if (cleanSearch) {
      normalized += '?' + cleanSearch;
    }
    
    if (parsed.pathname && parsed.pathname !== '/') {
      normalized += parsed.pathname;
    }
    
    if (parsed.hash && parsed.hash !== '#') {
      normalized += parsed.hash;
    }
    
    return normalized;
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

function denormalizeUrl(normalized: string): string {
  // Check if already a full URL
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }
  
  // Add https:// prefix (assume https for modern web)
  // Note: Some legacy sites may need http, but this is rare
  return 'https://' + normalized;
}
```

### Integration Points

Apply normalization in these functions:

1. **`minifyVaultItem()`** - normalize URL before storing
2. **`expandVaultItem()`** - denormalize URL after loading
3. **`applyCompressionTier()`** - ensure URL is normalized for tiered saves

---

## 2. Domain Deduplication

### Concept

Store domains in a shared array, reference by index in URL strings:

```typescript
// Before minification (individual URLs)
[
  { url: "youtube.com/watch?v=abc", ... },
  { url: "youtube.com/watch?v=def", ... },
  { url: "github.com/AnomalyCo/opencode", ... },
  { url: "youtube.com/channel/xyz", ... }
]

// After minification with domain table
{
  domains: ["youtube.com", "github.com"],
  items: [
    { url: "0/watch?v=abc", ... },
    { url: "0/watch?v=def", ... },
    { url: "1/AnomalyCo/opencode", ... },
    { url: "0/channel/xyz", ... }
  ]
}
```

### Implementation

```typescript
interface MinifiedVaultWithDomains {
  version: 1;
  domains: string[];
  items: unknown[][];
}

function extractDomain(normalizedUrl: string): { domain: string; path: string } {
  const slashIndex = normalizedUrl.indexOf('/');
  const queryIndex = normalizedUrl.indexOf('?');
  const hashIndex = normalizedUrl.indexOf('#');
  
  let splitIndex = normalizedUrl.length;
  if (slashIndex !== -1) splitIndex = Math.min(splitIndex, slashIndex);
  if (queryIndex !== -1) splitIndex = Math.min(splitIndex, queryIndex);
  if (hashIndex !== -1) splitIndex = Math.min(splitIndex, hashIndex);
  
  return {
    domain: normalizedUrl.slice(0, splitIndex),
    path: normalizedUrl.slice(splitIndex)
  };
}

function minifyVaultWithDomains(vault: VaultItem[]): MinifiedVaultWithDomains {
  const domainMap = new Map<string, number>();
  const domains: string[] = [];
  
  // First pass: collect all domains
  const itemsWithDomainRefs = vault.map(item => {
    const normalizedUrl = normalizeUrl(item.url);
    const { domain, path } = extractDomain(normalizedUrl);
    
    let domainIndex = domainMap.get(domain);
    if (domainIndex === undefined) {
      domainIndex = domains.length;
      domains.push(domain);
      domainMap.set(domain, domainIndex);
    }
    
    return {
      ...item,
      url: `${domainIndex}${path}`
    };
  });
  
  // Second pass: minify items with domain references
  const items = itemsWithDomainRefs.map(minifyVaultItem);
  
  return { version: 1, domains, items };
}

function expandVaultWithDomains(data: MinifiedVaultWithDomains): VaultItem[] {
  const { domains, items } = data;
  
  return items.map(item => {
    const expanded = expandVaultItem(item);
    
    // Resolve domain reference
    const urlMatch = String(expanded.url).match(/^(\d+)(.*)$/);
    if (urlMatch) {
      const domainIndex = parseInt(urlMatch[1], 10);
      const path = urlMatch[2];
      expanded.url = denormalizeUrl(domains[domainIndex] + path);
    }
    
    return expanded;
  });
}
```

### Integration Points

1. **In `minifyVault()`**: Detect if using domain deduplication would save space (domains.length < totalItems * 0.3)
2. **In `expandVault()`**: Check for `domains` field to determine format
3. **In `VaultMeta`**: Add `domainDedup?: boolean` flag

---

## 3. Storage Format Decision

Add logic to choose the best format:

```typescript
function minifyVault(vault: VaultItem[]): unknown[] | MinifiedVaultWithDomains {
  // Collect unique domains
  const domainSet = new Set<string>();
  let totalUrlLength = 0;
  
  for (const item of vault) {
    const { domain } = extractDomain(normalizeUrl(item.url));
    domainSet.add(domain);
    totalUrlLength += item.url.length;
  }
  
  // Estimate savings from domain deduplication
  const domainOverhead = JSON.stringify(Array.from(domainSet)).length;
  const estimatedSavings = totalUrlLength * 0.4; // ~40% from domain refs
  
  // Use domain dedup if it saves >20% of URL storage
  if (estimatedSavings > domainOverhead * 1.2 && vault.length >= 3) {
    return minifyVaultWithDomains(vault);
  }
  
  // Fall back to simple minification
  return vault.map(minifyVaultItem);
}
```

---

## 4. Types to Update

In `src/types/index.ts`:

```typescript
export interface VaultMeta {
  version: number;
  chunkCount: number;
  chunkKeys: string[];
  checksum: string;
  timestamp: number;
  compressed: boolean;
  compressionTier?: CompressionTier;
  minified?: boolean;
  diffKey?: string;
  domainDedup?: boolean;  // NEW
}
```

---

## 5. Backward Compatibility

The expansion logic should handle all formats:

```typescript
function expandVault(data: unknown): VaultItem[] {
  // Format 1: Domain deduplication (has domains field)
  if (data && typeof data === 'object' && 'domains' in data) {
    return expandVaultWithDomains(data as MinifiedVaultWithDomains);
  }
  
  // Format 2: Simple array minification
  if (Array.isArray(data)) {
    return data.map(expandVaultItem);
  }
  
  // Format 3: Legacy object format (no minification)
  return data as VaultItem[];
}
```

---

## 6. Testing Requirements

Add tests to `src/utils/__tests__/vaultStorage.test.ts`:

```typescript
describe('vaultStorage - URL optimization', () => {
  describe('URL normalization', () => {
    it('strips https:// protocol', () => { /* ... */ });
    it('strips www. prefix', () => { /* ... */ });
    it('removes UTM parameters', () => { /* ... */ });
    it('preserves query params that are not tracking', () => { /* ... */ });
    it('preserves hash fragments', () => { /* ... */ });
    it('handles malformed URLs gracefully', () => { /* ... */ });
  });
  
  describe('Domain deduplication', () => {
    it('creates domain table for multiple same-domain URLs', () => { /* ... */ });
    it('references domains by index in URLs', () => { /* ... */ });
    it('round-trips domain-deduplicated data correctly', () => { /* ... */ });
    it('falls back to simple minification for small vaults', () => { /* ... */ });
  });
});
```

---

## 7. Expected Savings

| Vault Size | Before | After Normalization | After Domain Dedup |
|------------|--------|---------------------|-------------------|
| 10 tabs (mixed domains) | 2.5KB | 2.0KB (20% less) | 1.8KB (28% less) |
| 50 tabs (mostly same domains) | 12KB | 9KB (25% less) | 6KB (50% less) |
| 100 tabs (YouTube/GitHub heavy) | 25KB | 19KB (24% less) | 11KB (56% less) |

---

## Implementation Order

1. Add URL normalization helpers
2. Integrate normalization into minify/expand
3. Add domain deduplication helpers
4. Add format decision logic to `minifyVault()`
5. Update `expandVault()` for backward compatibility
6. Add `domainDedup` to `VaultMeta` type
7. Write tests
8. Run full test suite
