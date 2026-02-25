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

export const PointerPositionProvider: React.FC<PointerPositionProviderProps> = ({ 
  children, 
  isDragging 
}) => {
  const [pointerPosition, setPointerPosition] = useState<PointerPosition | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPositionRef = useRef<PointerPosition | null>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    pendingPositionRef.current = { x: e.clientX, y: e.clientY };
    
    if (rafRef.current) return;
    
    rafRef.current = requestAnimationFrame(() => {
      setPointerPosition(pendingPositionRef.current);
      pendingPositionRef.current = null;
      rafRef.current = null;
    });
  }, []);

  useEffect(() => {
    if (!isDragging) {
      setPointerPosition(null);
      return;
    }

    document.addEventListener('pointermove', handlePointerMove);
    
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingPositionRef.current = null;
    };
  }, [isDragging, handlePointerMove]);

  return (
    <PointerPositionContext.Provider value={{ pointerPosition, isDragging }}>
      {children}
    </PointerPositionContext.Provider>
  );
};
