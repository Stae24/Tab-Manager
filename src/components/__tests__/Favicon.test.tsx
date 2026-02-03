import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Favicon } from '../Favicon';
import React from 'react';

const getURLMock = vi.fn();
vi.stubGlobal('chrome', {
  runtime: {
    getURL: getURLMock,
  },
});

describe('Favicon Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getURLMock.mockReturnValue('chrome-extension://test-id/_favicon/');
  });

  it('uses google proxy for url when src is missing', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} />);
    
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://www.google.com/s2/favicons?domain=example.com&sz=32');
  });

  it('uses google proxy for remote src', () => {
    const src = 'https://example.com/favicon.ico';
    const { container } = render(<Favicon src={src} />);
    
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

  it('falls back through tiers on error', () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} />);
    
    let img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('google.com'));
    
    // Fail Tier 0 (Google)
    fireEvent.error(img!);
    img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('_favicon'));
    
    // Fail Tier 1 (Internal)
    fireEvent.error(img!);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('lucide-globe');
  });

  it('recomputes favicon URL when props change', () => {
    const { rerender, container } = render(<Favicon src="https://site1.com/icon.png" />);
    
    let img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('google.com'));
    expect(img).toHaveAttribute('src', expect.stringContaining('domain=site1.com'));

    rerender(<Favicon url="https://site2.com" />);
    
    img = container.querySelector('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('google.com'));
    expect(img).toHaveAttribute('src', expect.stringContaining('domain=site2.com'));
  });

  it('handles URL construction error gracefully', () => {
    const { container } = render(<Favicon url="invalid-url" />);
    
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
});
