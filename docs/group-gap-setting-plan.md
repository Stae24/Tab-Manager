# Group Gap Size Setting

## Overview
Add a configurable setting to control the gap between groups/islands in the Live Workspace and Neural Vault. The idle gap will match the gap between tabs within groups by default, creating a consistent visual rhythm.

## Current State
- **Gap between groups (idle)**: `h-px` (1px) - barely visible
- **Gap between groups (expanded)**: `h-[2.375rem]` (38px) - for drop target
- **Gap between tabs within groups**: `space-y-1` = 0.25rem (4px at 16px base)

## Target State
- **Gap between groups (idle)**: Configurable via setting, defaulting to 0.25rem (4px)
- **Gap between groups (expanded)**: Fixed at 38px (unchanged)
- **Gap between tabs within groups**: Uses the same setting value

## Files to Modify

### 1. `src/constants.ts`
Add constants for the gap setting:
```typescript
export const DEFAULT_GROUP_GAP_REM = 0.25;
export const GROUP_GAP_MIN = 0.125;  // 2px
export const GROUP_GAP_MAX = 1.0;    // 16px
export const GROUP_GAP_STEP = 0.125; // 2px increments
```

### 2. `src/types/index.ts`
Add to `AppearanceSettings` interface (~line 122):
```typescript
groupGapRem: number; // Gap between groups in rem units
```

### 3. `src/store/utils.ts`
- Add to `defaultAppearanceSettings` (~line 165):
  ```typescript
  groupGapRem: DEFAULT_GROUP_GAP_REM,
  ```
- Add to `isAppearanceSettings` type guard (~line 95):
  ```typescript
  typeof s.groupGapRem === 'number' &&
  ```

### 4. `src/components/DroppableGap.tsx`
- Import `appearanceSettings` from store
- Replace static `h-px` with dynamic height using `groupGapRem`
- Example:
  ```typescript
  const { appearanceSettings } = useStore();
  const gapHeight = appearanceSettings.groupGapRem * BASE_FONT_SIZE; // Convert to px
  
  // In className:
  !expanded && `h-[${gapHeight}px] min-h-[${gapHeight}px]`,
  ```

### 5. `src/components/Island.tsx`
- Import `appearanceSettings` from store
- Replace `space-y-1` (line 348, 376) with dynamic inline style:
  ```typescript
  style={{ gap: `${appearanceSettings.groupGapRem}rem` }}
  ```
- Use `flex flex-col` instead of `space-y`

### 6. `src/components/VaultPanel.tsx`
- Same as Island.tsx - update gap between vault items

### 7. `src/components/AppearanceSettingsPanel.tsx`
Add slider control under "Groups" tab (~line 920):
```tsx
<SliderControl
  value={appearanceSettings.groupGapRem}
  onChange={(value) => setAppearanceSettings({ groupGapRem: value })}
  min={GROUP_GAP_MIN}
  max={GROUP_GAP_MAX}
  step={GROUP_GAP_STEP}
  label="Group Gap Size"
  displayValue={`${Math.round(appearanceSettings.groupGapRem * 16)}px`}
/>
```

## Import Dependencies

Add to `AppearanceSettingsPanel.tsx` imports:
```typescript
import { 
  // ...existing...
  DEFAULT_GROUP_GAP_REM,
  GROUP_GAP_MIN,
  GROUP_GAP_MAX,
  GROUP_GAP_STEP,
} from '../constants';
```

Add to `DroppableGap.tsx` imports:
```typescript
import { useStore } from '../store/useStore';
import { BASE_FONT_SIZE } from '../constants';
```

Add to `Island.tsx` imports:
```typescript
// Already has useStore import
```

## Testing Considerations
1. Verify gap renders correctly at different scale factors (uiScale)
2. Verify gap persists across sessions (sync)
3. Verify type guard accepts valid values
4. Test edge cases: min value (2px), max value (16px)
5. Verify expanded drop zone still works (38px fixed)

## Implementation Order
1. Add constants
2. Add to types
3. Add to defaults and type guard
4. Update DroppableGap component
5. Update Island component (tab gaps)
6. Update VaultPanel (if needed)
7. Add UI control in settings panel
8. Test end-to-end
