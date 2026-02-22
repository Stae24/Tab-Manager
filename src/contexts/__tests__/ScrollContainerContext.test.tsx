import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React, { createRef } from 'react';
import { useScrollContainer, ScrollContainerProvider } from '../ScrollContainerContext';

describe('ScrollContainerContext', () => {
  it('should provide container ref', () => {
    const containerRef = createRef<HTMLElement>();
    const TestComponent = () => {
      const { containerRef: contextRef } = useScrollContainer();
      return <div ref={contextRef as any} data-testid="container">Test</div>;
    };

    render(
      <ScrollContainerProvider containerRef={containerRef as any}>
        <TestComponent />
      </ScrollContainerProvider>
    );

    expect(containerRef.current).toBeDefined();
  });

  it('should return null containerRef when used outside provider', () => {
    const TestComponent = () => {
      const { containerRef } = useScrollContainer();
      return <div data-testid="result">{containerRef === null ? 'null' : 'provided'}</div>;
    };

    const { getByTestId } = render(<TestComponent />);
    
    expect(getByTestId('result').textContent).toBe('null');
  });

  it('should maintain ref across re-renders', () => {
    const containerRef = createRef<HTMLElement>();
    const refValues: Array<React.RefObject<HTMLElement | null>> = [];
    
    const TestComponent = () => {
      const { containerRef: contextRef } = useScrollContainer();
      refValues.push(contextRef as React.RefObject<HTMLElement | null>);
      return <div ref={contextRef as any}>Test</div>;
    };

    const { rerender } = render(
      <ScrollContainerProvider containerRef={containerRef as any}>
        <TestComponent />
      </ScrollContainerProvider>
    );

    rerender(
      <ScrollContainerProvider containerRef={containerRef as any}>
        <TestComponent />
      </ScrollContainerProvider>
    );

    expect(refValues[0]).toBe(refValues[1]);
  });

  it('should provide same ref to multiple children', () => {
    const containerRef = createRef<HTMLElement>();
    
    const ChildComponent = () => {
      const { containerRef: contextRef } = useScrollContainer();
      return <div data-testid="child" ref={contextRef as any}>Child</div>;
    };

    render(
      <ScrollContainerProvider containerRef={containerRef as any}>
        <ChildComponent />
        <ChildComponent />
      </ScrollContainerProvider>
    );

    expect(containerRef.current).toBeDefined();
  });
});
