import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

export class RouteErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ error, errorInfo });
        // Log to client_error_logs table if available (F1)
        if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).reportError) {
            (window as unknown as Record<string, (error: Error, errorInfo: ErrorInfo) => void>).reportError(error, errorInfo);
        }
        console.error('Route error caught:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleReport = () => {
        const { error, errorInfo } = this.state;
        const errorDetails = {
            message: error?.message,
            stack: error?.stack,
            componentStack: errorInfo?.componentStack,
            url: window.location.href,
            userAgent: navigator.userAgent,
        };
        console.log('Error details for reporting:', errorDetails);
        // In production, this would send to a bug tracking system
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary" role="alert" aria-live="assertive">
                    <div className="error-boundary-content">
                        <AlertTriangle size={48} color="var(--accent-error)" />
                        <h1>Something went wrong</h1>
                        <p>We encountered an unexpected error. Please try reloading the page.</p>
                        {this.state.error && (
                            <details className="error-details">
                                <summary>Error details</summary>
                                <pre>{this.state.error.toString()}</pre>
                            </details>
                        )}
                        <div className="error-actions">
                            <button className="btn btn-primary" onClick={this.handleReload}>
                                <RefreshCw size={16} /> Reload Page
                            </button>
                            <button className="btn btn-secondary" onClick={this.handleReport}>
                                <Bug size={16} /> Report Issue
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default RouteErrorBoundary;
