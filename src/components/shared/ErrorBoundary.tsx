"use client";

import { Component, type ReactNode } from "react";

interface Props {
    children: ReactNode;
    label?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: string;
}

/**
 * Simple error boundary — tangkap render error + tampilkan detail.
 * Pakai di page root untuk trap "can't convert undefined to object" type errors.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: "" };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: error.stack ?? "" };
    }

    componentDidCatch(error: Error, info: { componentStack?: string | null }) {
        console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ""}]`, error);
        console.error("Component stack:", info.componentStack);
        this.setState({ errorInfo: `${error.stack ?? ""}\n\n${info.componentStack ?? ""}` });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="mx-auto max-w-3xl p-6">
                    <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-5">
                        <h1 className="ds-heading text-red-400 mb-2">Render Error Caught</h1>
                        {this.props.label && (
                            <p className="ds-label opacity-80 mb-2">Location: {this.props.label}</p>
                        )}
                        <p className="ds-body mb-4 font-mono text-red-300">
                            {this.state.error?.name}: {this.state.error?.message}
                        </p>
                        <details className="mt-3">
                            <summary className="ds-small cursor-pointer opacity-80">Stack trace</summary>
                            <pre className="ds-small mt-2 rounded bg-muted/40 p-3 overflow-x-auto whitespace-pre-wrap">
                                {this.state.errorInfo}
                            </pre>
                        </details>
                        <button
                            type="button"
                            onClick={() => {
                                this.setState({ hasError: false, error: null, errorInfo: "" });
                            }}
                            className="ds-label ds-transition cursor-pointer mt-4 inline-flex items-center rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-4 py-2"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
