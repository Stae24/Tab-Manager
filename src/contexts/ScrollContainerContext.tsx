import React, { createContext, useContext, RefObject } from 'react';

interface ScrollContainerContextType {
  containerRef: RefObject<HTMLElement | null> | null;
}

const ScrollContainerContext = createContext<ScrollContainerContextType>({
  containerRef: null,
});

export const ScrollContainerProvider: React.FC<{
  containerRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
}> = ({ containerRef, children }) => (
  <ScrollContainerContext.Provider value={{ containerRef }}>
    {children}
  </ScrollContainerContext.Provider>
);

export const useScrollContainer = () => useContext(ScrollContainerContext);
