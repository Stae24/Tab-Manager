import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

interface PointerPosition {
  x: number;
  y: number;
}

interface PointerPositionContextValue {
  pointerPosition: PointerPosition | null;
  isDragging: boolean;
}

const PointerPositionContext = createContext<PointerPositionContextValue>({
  pointerPosition: null,
  isDragging: false
});

export const usePointerPosition = () => useContext(PointerPositionContext);

interface PointerPositionProviderProps {
  children: React.ReactNode;
  isDragging: boolean;
}

const POSITION_BUFFER_SIZE = 3;
const RAF_INTERVAL_MS = 16;

export const PointerPositionProvider: React.FC<PointerPositionProviderProps> = ({ 
  children, 
  isDragging 
}) => {
  const [pointerPosition, setPointerPosition] = useState<PointerPosition | null>(null);
  const rafRef = useRef<number | null>(null);
  const positionBufferRef = useRef<PointerPosition[]>([]);
  const lastUpdateRef = useRef<number>(0);

  const processPositions = useCallback(() => {
    const buffer = positionBufferRef.current;
    if (buffer.length === 0) {
      rafRef.current = null;
      return;
    }

    const avgX = buffer.reduce((sum, p) => sum + p.x, 0) / buffer.length;
    const avgY = buffer.reduce((sum, p) => sum + p.y, 0) / buffer.length;
    
    setPointerPosition({ x: avgX, y: avgY });
    positionBufferRef.current = [];
    rafRef.current = null;
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const now = performance.now();
    positionBufferRef.current.push({ x: e.clientX, y: e.clientY });
    
    if (positionBufferRef.current.length >= POSITION_BUFFER_SIZE) {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(processPositions);
      }
    } else if (!rafRef.current && now - lastUpdateRef.current > RAF_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(processPositions);
    }
    
    lastUpdateRef.current = now;
  }, [processPositions]);

  useEffect(() => {
    if (!isDragging) {
      setPointerPosition(null);
      positionBufferRef.current = [];
      return;
    }

    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      positionBufferRef.current = [];
    };
  }, [isDragging, handlePointerMove]);

  return (
    <PointerPositionContext.Provider value={{ pointerPosition, isDragging }}>
      {children}
    </PointerPositionContext.Provider>
  );
};
