import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Favicon } from '../Favicon';
import React from 'react';

// Mock chrome API
vi.stubGlobal('chrome', {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://id${path}`),
  },
});

describe('Favicon Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tries to load src first if provided', () => {
    const src = 'https://example.com/favicon.ico';
    const url = 'https://example.com';
    const { container } = render(<Favicon src={src} url={url} />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', src);
  });

  it('falls back to _favicon service if src fails', () => {
    const src = 'https://example.com/favicon.ico';
    const url = 'https://example.com';
    const { container } = render(<Favicon src={src} url={url} />);
    
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', src);

    fireEvent.error(img);

    const fallbackImg = container.querySelector('img');
    expect(fallbackImg).toHaveAttribute('src', expect.stringContaining('/_favicon/'));
    expect(fallbackImg).toHaveAttribute('src', expect.stringContaining('pageUrl=https%3A%2F%2Fexample.com'));
  });

  it('falls back to Globe if _favicon service fails', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} />);
    
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', expect.stringContaining('/_favicon/'));

    fireEvent.error(img);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('lucide-globe');
  });

  it('shows Globe immediately for system schemes', () => {
    const systemUrls = [
      'chrome://settings',
      'about:blank',
      'file:///home/user/test.html',
      'data:text/html,hello'
    ];

    systemUrls.forEach(url => {
      const { container } = render(<Favicon url={url} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('lucide-globe');
    });
  });

  it('cleans base URL from chrome.runtime.getURL', () => {
    (chrome.runtime.getURL as any).mockReturnValue('chrome-extension://id/_favicon/');
    
    const { container } = render(<Favicon url="https://example.com" />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringMatching(/^chrome-extension:\/\/id\/_favicon\/\?pageUrl=/));
  });

  it('resets state when src or url changes', () => {
    const { rerender, container } = render(<Favicon src="https://src1.com/1.ico" url="https://url1.com" />);
    const img = container.querySelector('img')!;
    
    fireEvent.error(img);
    expect(container.querySelector('img')).toHaveAttribute('src', expect.stringContaining('/_favicon/'));

    rerender(<Favicon src="https://src2.com/2.ico" url="https://url2.com" />);
    const newImg = container.querySelector('img');
    expect(newImg).toHaveAttribute('src', 'https://src2.com/2.ico');
  });
});
