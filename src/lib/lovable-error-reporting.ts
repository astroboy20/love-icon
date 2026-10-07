/**
 * Generic client-side error reporter for the React error boundary.
 * Reports to the browser console and forwards to any registered error
 * tracking integrations attached to window.__errorReporter.
 */

type ErrorReporterOptions = {
  mechanism?: string;
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

declare global {
  interface Window {
    __errorReporter?: {
      captureException?: (
        error: unknown,
        context?: Record<string, unknown>,
        options?: ErrorReporterOptions,
      ) => void;
    };
  }
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  // Forward to any registered error tracking integration
  window.__errorReporter?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
