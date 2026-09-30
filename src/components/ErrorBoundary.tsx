import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends (Component as any)<Props, State> {
  public props: Props;
  public state: State = {
    hasError: false,
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f4f8f7] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-xl border border-gray-100 text-center space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle size={32} />
            </div>

            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">
                কিছু একটি অপ্রত্যাশিত সমস্যা হয়েছে
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
                আপনার লোকাল ডাটাবেজে সমস্ত হিসাব ও ক্যাশ ব্যালেন্স সম্পূর্ণ সুরক্ষিত আছে। অনুগ্রহ করে পেজটি রিলোড করুন।
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-mono text-gray-600 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-[#084b3e] hover:bg-[#0c5e4e] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw size={15} />
                <span>পেজ রিলোড করুন</span>
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home size={15} />
                <span>হোমে যান</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
