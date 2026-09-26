import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
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
    console.error('Uncaught React Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[280px] w-full p-6 flex flex-col items-center justify-center text-center bg-slate-950/90 border border-rose-500/40 rounded-2xl text-slate-200 space-y-4 my-3 backdrop-blur-md shadow-2xl">
          <div className="p-3.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-1.5 max-w-md">
            <h3 className="text-base font-bold text-rose-200">
              {this.props.fallbackTitle || '画面の安全保護が作動しました'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {this.props.fallbackMessage ||
                'モデルまたはコンポーネントの読み込み中に予期しない状態を検知しましたが、端末データとアプリ本体は保護されています。'}
            </p>
          </div>

          {this.state.error && (
            <div className="w-full max-w-lg p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-rose-300/90 text-left overflow-x-auto select-text">
              {this.state.error.toString()}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>画面を安全に復旧</span>
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
            >
              再試行
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
