'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-[#272728] p-8">
          <div className="max-w-lg rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 text-red-400" size={40} />
            <h1 className="text-xl font-semibold text-red-200 mb-2">Something broke</h1>
            <p className="text-sm text-red-200/70 mb-4 break-words">
              {this.state.error?.message ?? 'Unknown error'}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.reset}
                className="flex items-center gap-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 px-4 py-2 text-sm font-medium text-red-100"
              >
                <RefreshCw size={14} /> Try again
              </button>
              <button
                onClick={() => location.reload()}
                className="rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-medium"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
