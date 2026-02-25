import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal, LogOut } from 'lucide-react';
import { cn } from '../utils/cn';
import { logger } from '../utils/logger';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary', `Module: ${this.props.name || 'Global'}`, error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 z-[9999] bg-gx-dark/95 backdrop-blur-2xl flex items-center justify-center p-6 select-none overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: 'linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

          <div className="relative w-full max-w-2xl bg-gx-gray/20 border border-gx-red/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(239,64,64,0.15)] animate-in fade-in zoom-in duration-300">
            <div className="bg-gx-red/10 border-b border-gx-red/20 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gx-red/20 flex items-center justify-center shadow-[0_0_15px_rgba(239,64,64,0.3)]">
                  <AlertTriangle className="text-gx-red w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-lg font-black italic uppercase tracking-widest text-gx-red leading-tight">Critical System Failure</h1>
                  <p className="text-[10px] font-bold text-gx-red/60 uppercase tracking-tighter">Segment: {this.props.name || 'Global Core'}</p>
                </div>
              </div>
              <Terminal className="text-gx-red/30 w-5 h-5" />
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-300 leading-relaxed">
                  The neural link has encountered an unhandled exception. The current workspace state might be unstable.
                </p>
                <div className="p-4 bg-black/40 rounded-xl border border-white/5 font-mono text-[11px] text-gx-red/80 overflow-auto max-h-40 scrollbar-hide">
                  <div className="flex items-center gap-2 mb-2 text-gx-red/40 uppercase font-black tracking-widest text-[9px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-gx-red animate-pulse" />
                    Error Log
                  </div>
                  <p className="whitespace-pre-wrap">{this.state.error?.stack || this.state.error?.message || 'Unknown protocol violation'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={this.handleReset}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
                >
                  <RefreshCw className="w-4 h-4 text-gray-400 group-hover:text-white transition-transform group-active:rotate-180 duration-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400 group-hover:text-white">Retry Sync</span>
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gx-red/20 hover:bg-gx-red/30 border border-gx-red/30 rounded-xl transition-all group shadow-[0_0_20px_rgba(239,64,64,0.1)] hover:shadow-[0_0_30px_rgba(239,64,64,0.2)]"
                >
                  <LogOut className="w-4 h-4 text-gx-red transition-transform group-hover:translate-x-1" />
                  <span className="text-xs font-black uppercase tracking-widest text-gx-red">Reboot System</span>
                </button>
              </div>
            </div>

            <div className="px-6 py-3 bg-black/20 flex items-center justify-between">
              <div className="flex gap-1">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={cn("w-1 h-1 rounded-full", i < 3 ? "bg-gx-red" : "bg-gx-red/20")} />
                ))}
              </div>
              <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.3em]">Antigravity Protocol v1.0.4</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
