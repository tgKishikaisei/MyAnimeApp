import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * ErrorBoundary — глобальный обработчик React-крашей.
 * Оборачивает всё приложение в App.tsx.
 * При любой необработанной ошибке показывает красивую страницу
 * вместо белого экрана смерти.
 */
export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        // В production можно сюда послать в Sentry:
        // Sentry.captureException(error, { extra: errorInfo });
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">
                    {/* Animated glitch logo area */}
                    <div className="mb-8 relative">
                        <div className="text-8xl select-none animate-bounce">⚡</div>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 tracking-tight">
                        Something went wrong
                    </h1>
                    <p className="text-gray-400 text-base max-w-md mb-8 leading-relaxed">
                        The app encountered an unexpected error. Don't worry — your data is safe.
                        Try reloading the page.
                    </p>

                    {/* Error detail (dev only) */}
                    {import.meta.env.DEV && this.state.error && (
                        <details className="mb-8 w-full max-w-2xl text-left">
                            <summary className="text-xs text-red-400 cursor-pointer font-mono hover:text-red-300 transition-colors mb-2">
                                🐛 Error details (dev only)
                            </summary>
                            <pre className="bg-[#0d0d1a] border border-red-500/30 rounded-lg p-4 text-xs text-red-300 overflow-auto max-h-48 font-mono leading-relaxed">
                                {this.state.error.toString()}
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </details>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={this.handleReload}
                            className="px-8 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            🔄 Reload page
                        </button>
                        <a
                            href="/"
                            className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium rounded-lg transition-colors"
                        >
                            ← Go Home
                        </a>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
