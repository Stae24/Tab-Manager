import { describe, it, expect, vi } from 'vitest';
import { useStore } from '../../store/useStore';

// We'll define the modifier logic here for the RED test, 
// as we haven't implemented it in Dashboard.tsx yet.
// This matches the requested implementation in the prompt.
const scaleModifier = ({ transform }: any) => {
  const { appearanceSettings } = useStore.getState();
  return {
    ...transform,
    x: transform.x / appearanceSettings.uiScale,
    y: transform.y / appearanceSettings.uiScale,
  };
};

describe('DnD Scaling Modifier', () => {
  it('correctly scales transform coordinates based on uiScale', () => {
    // 1. Mock useStore to return uiScale of 1.5
    useStore.setState({
      appearanceSettings: {
        ...useStore.getState().appearanceSettings,
        uiScale: 1.5,
      },
    });

    // 2. Initial transform
    const transform = { x: 150, y: 150, scaleX: 1, scaleY: 1 };

    // 3. Apply modifier
    const result = scaleModifier({ transform });

    // 4. Verify result: 150 / 1.5 = 100
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it('handles uiScale of 1.0 (no change)', () => {
    useStore.setState({
      appearanceSettings: {
        ...useStore.getState().appearanceSettings,
        uiScale: 1.0,
      },
    });

    const transform = { x: 100, y: 100, scaleX: 1, scaleY: 1 };
    const result = scaleModifier({ transform });

    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });
});
