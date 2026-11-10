import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="dm-card p-8 sm:p-12 text-center max-w-xl mx-auto my-8 space-y-5 animate-in fade-in duration-200 border border-rose-300 dark:border-rose-900 bg-white dark:bg-brand-navy-dark shadow-elevated">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark dark:text-white">
              Something went wrong
            </h2>
            <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-300 max-w-md mx-auto">
              A view rendering error occurred. You can reload the application or switch views to continue.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] font-mono text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg max-w-md mx-auto truncate">
                {this.state.error.message}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full sm:w-auto py-2.5 px-6 rounded-xl font-bold text-xs text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

