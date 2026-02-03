import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Favicon } from '../Favicon';
import React from 'react';

const getURLMock = vi.fn();
vi.stubGlobal('chrome', {
  runtime: {
    id: 'test-id',
    getURL: getURLMock,
  },
});

describe('Favicon Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getURLMock.mockReturnValue('chrome-extension://test-id/_favicon/');
  });

  it('uses google as default source for url', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://www.google.com/s2/favicons?domain=example.com&sz=32');
  });

  it('uses chrome extension when explicitly set', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} source="chrome" />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fexample.com&size=32');
  });

  it('uses google source when explicitly set', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} source="google" />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://www.google.com/s2/favicons?domain=example.com&sz=32');
  });

  it('uses google-hd source when set', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} source="google-hd" />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://www.google.com/s2/favicons?domain=example.com&sz=128');
  });

  it('uses duckduckgo source when set', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} source="duckduckgo" />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://icons.duckduckgo.com/ip3/example.com.ico');
  });

  it('uses icon-horse source when set', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} source="icon-horse" />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://icon.horse/icon/example.com');
  });

  it('respects size prop with google source', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} source="google" size="64" />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://www.google.com/s2/favicons?domain=example.com&sz=64');
  });

  it('respects size prop with chrome source', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} source="chrome" size="64" />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'chrome-extension://test-id/_favicon/?pageUrl=https%3A%2F%2Fexample.com&size=64');
  });

  it('uses google proxy for remote src with google source', () => {
    const src = 'https://example.com/favicon.ico';
    const { container } = render(<Favicon src={src} source="google" />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://www.google.com/s2/favicons?domain=example.com&sz=32');
  });

  it('renders data URI immediately without _favicon service', () => {
    const dataUri = 'data:image/png;base64,immediate';
    const { container } = render(<Favicon src={dataUri} />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', dataUri);
  });

  it('shows Globe immediately for restricted protocols', () => {
    const restrictedUrls = [
      'chrome://settings',
      'about:blank',
      'file:///test.html',
      'edge://extensions',
      'view-source:https://example.com'
    ];

    restrictedUrls.forEach(url => {
      const { container } = render(<Favicon url={url} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('lucide-globe');
      expect(container.querySelector('img')).toBeNull();
    });
  });

  it('falls back when fallback is enabled', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} source="google" fallback="duckduckgo" />);

    let img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('google.com'));

    fireEvent.error(img!);
    img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('duckduckgo.com'));

    fireEvent.error(img!);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('lucide-globe');
  });

  it('does not fall back when fallback is disabled', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} source="google" fallback="none" />);
    
    let img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('google.com'));
    
    fireEvent.error(img!);
    img = container.querySelector('img');
    expect(img).toBeNull();
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('lucide-globe');
  });

  it('recomputes favicon URL when props change', () => {
    const { rerender, container } = render(<Favicon src="https://site1.com/icon.png" />);
    
    let img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('google.com'));

    rerender(<Favicon url="https://site2.com" />);
    
    img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('google.com'));
    expect(img).toHaveAttribute('src', expect.stringContaining('site2.com'));
  });

  it('recomputes favicon URL when source prop changes', () => {
    const { rerender, container } = render(<Favicon url="https://example.com" source="chrome" />);
    
    let img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('_favicon'));

    rerender(<Favicon url="https://example.com" source="google" />);
    
    img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('google.com'));
  });

  it('recomputes favicon URL when size prop changes', () => {
    const { rerender, container } = render(<Favicon url="https://example.com" source="google" size="32" />);
    
    let img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('sz=32'));

    rerender(<Favicon url="https://example.com" source="google" size="64" />);
    
    img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('sz=64'));
  });

  it('handles URL construction error gracefully with google source', () => {
    const { container } = render(<Favicon url="invalid-url" source="google" />);
    
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('lucide-globe');
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows Globe when no url provided', () => {
    const { container } = render(<Favicon />);
    
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('lucide-globe');
    expect(container.querySelector('img')).toBeNull();
  });

  it('handles opacity transition on load', () => {
    const { container } = render(<Favicon url="https://example.com" />);
    const img = container.querySelector('img');
    expect(img).toHaveClass('opacity-0');
    
    fireEvent.load(img!);
    expect(img).toHaveClass('opacity-100');
  });

  it('respects saveData and shows Globe', () => {
    vi.stubGlobal('navigator', {
      connection: { saveData: true }
    });

    const { container } = render(<Favicon url="https://example.com" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('lucide-globe');
    expect(container.querySelector('img')).toBeNull();

    vi.unstubAllGlobals();
  });
});
