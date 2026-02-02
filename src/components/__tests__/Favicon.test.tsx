import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Favicon } from '../Favicon';
import React from 'react';

const sendMessageMock = vi.fn();
vi.stubGlobal('chrome', {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://id${path}`),
    sendMessage: sendMessageMock,
  },
});

describe('Favicon Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMessageMock.mockResolvedValue({ success: true, dataUrl: 'data:image/png;base64,mock' });
  });

  it('uses background proxy for remote src', async () => {
    const src = 'https://example.com/favicon.ico';
    const { container } = render(<Favicon src={src} />);
    
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'FETCH_FAVICON',
      url: src
    });

    await waitFor(() => {
      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,mock');
    });
  });

  it('uses background proxy for url when src is missing', async () => {
    const url = 'https://example.com';
    const { container } = render(<Favicon url={url} />);
    
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'FETCH_FAVICON',
      url: expect.stringContaining('pageUrl=https%3A%2F%2Fexample.com')
    });

    await waitFor(() => {
      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,mock');
    });
  });

  it('renders data URI immediately without proxy', () => {
    const dataUri = 'data:image/png;base64,immediate';
    const { container } = render(<Favicon src={dataUri} />);
    
    expect(sendMessageMock).not.toHaveBeenCalled();
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
      expect(sendMessageMock).not.toHaveBeenCalled();
    });
  });

  it('shows Globe if proxy fails', async () => {
    sendMessageMock.mockResolvedValue({ success: false });
    const { container } = render(<Favicon src="https://fail.com/icon.png" />);
    
    await waitFor(() => {
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('lucide-globe');
    });
  });

  it('resets and refetches when props change', async () => {
    const { rerender, container } = render(<Favicon src="https://site1.com/icon.png" />);
    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument());
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    sendMessageMock.mockResolvedValue({ success: true, dataUrl: 'data:image/png;base64,site2' });
    rerender(<Favicon src="https://site2.com/icon.png" />);
    
    await waitFor(() => {
      expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,site2');
    });
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
  });
});
