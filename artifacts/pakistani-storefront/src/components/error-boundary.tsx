import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
  useState,
} from 'react';
import { createDiagnosticReport, redactDiagnostic } from '../utils/errorDiagnostics.mjs';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  componentStack?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError, componentStack = '' }: ErrorFallbackProps) {
  const [copyStatus, setCopyStatus] = useState('');
  const diagnostic = createDiagnosticReport(error, componentStack, window.location.pathname);
  const copyDiagnostic = async () => {
    try {
      await navigator.clipboard.writeText(diagnostic);
      setCopyStatus('Diagnostic copied. Review it before sharing.');
    } catch {
      setCopyStatus('Clipboard access is unavailable. Open the details below to copy it manually.');
    }
  };
  return (
    <div className="nura-commerce flex min-h-[70dvh] w-full items-center justify-center bg-[#faf8f5] p-6">
      <div className="w-full max-w-lg text-center">
        <p className="eyebrow">Storefront</p>
        <h1 className="serif mt-3 text-3xl font-semibold text-[#352b2b]">
          We hit a temporary issue
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#766d64]">
          This page could not be displayed. You can retry or choose another page.
        </p>
        {/* Dev only: messages can carry API responses and other internals. */}
        {import.meta.env.DEV ? (
          <pre className="mt-4 overflow-x-auto rounded bg-white p-3 text-left text-xs text-[#352b2b]">
            {error.message || String(error)}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={resetError}
          className="mt-5 min-h-11 rounded bg-[#6B2447] px-5 text-sm font-semibold text-white hover:bg-[#54203b]"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => void copyDiagnostic()}
          className="ml-2 mt-5 min-h-11 rounded border border-[#6B2447] px-5 text-sm font-semibold text-[#6B2447] hover:bg-[#f3ece8]"
        >
          Copy diagnostic
        </button>
        <details className="mx-auto mt-4 max-w-lg text-left text-xs text-[#766d64]">
          <summary className="cursor-pointer">Technical details (sensitive values redacted)</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-3">{diagnostic}</pre>
        </details>
        {copyStatus && <p role="status" className="mt-2 text-xs text-[#766d64]">{copyStatus}</p>}
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error), componentStack: '' };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.setState({ componentStack: redactDiagnostic(info.componentStack || '') });
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', toError(error), info.componentStack);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null, componentStack: '' });
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} componentStack={componentStack} />;
  }
}
