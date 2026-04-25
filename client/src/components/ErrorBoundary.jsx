import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="glass-panel p-10 max-w-md w-full border border-white/10 shadow-2xl">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-500" size={32} />
            </div>
            <h1 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">Oops! Something went wrong</h1>
            <p className="text-gray-400 mb-8 text-sm">
              An unexpected error occurred. This might be due to a connection issue or a temporary glitch.
            </p>
            <button
              onClick={this.handleRetry}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-2xl transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
            >
              <RefreshCw size={20} />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
