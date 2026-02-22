# src/contexts AGENTS.md

## OVERVIEW
React context providers for shared state across component tree. Currently contains scroll container reference for virtualized lists.

---

## FILES

### ScrollContainerContext.tsx
Provides scroll container ref for virtualization and lazy loading.

```typescript
interface ScrollContainerContextType {
  containerRef: RefObject<HTMLElement | null> | null;
}

// Provider
<ScrollContainerProvider containerRef={ref}>
  {children}
</ScrollContainerProvider>

// Hook
const { containerRef } = useScrollContainer();
```

---

## USAGE

Used in `Dashboard.tsx` to share scroll container with:
- `TabCard.tsx` - Intersection observer for lazy favicon loading
- `useProximityGap.ts` - Scroll position for gap expansion

```typescript
// In Dashboard
const containerRef = useRef<HTMLElement>(null);
return (
  <ScrollContainerProvider containerRef={containerRef}>
    <div ref={containerRef} className="overflow-auto">
      {/* panels */}
    </div>
  </ScrollContainerProvider>
);

// In child components
const { containerRef } = useScrollContainer();
```

---

## CONVENTIONS

| Pattern | Example |
|---------|---------|
| Context naming | `XxxContext` + `XxxProvider` + `useXxx` |
| Single responsibility | One context per concern |
| Nullable refs | `RefObject<HTMLElement \| null>` |

---

## ANTI-PATTERNS

| Avoid | Use Instead |
|-------|-------------|
| Context for frequently changing state | Zustand store |
| Deep prop drilling | Context or store selectors |
