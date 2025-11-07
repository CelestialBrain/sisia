/**
 * Global Error Handler
 * Catches all unhandled errors and promise rejections
 */

import { clientLogger } from './clientLogger';

export class ErrorHandler {
  private static instance: ErrorHandler;
  private initialized = false;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  initialize() {
    if (this.initialized) {
      return;
    }

    // Catch all unhandled errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error || event.message, {
        type: 'unhandled-error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Catch all unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, {
        type: 'unhandled-promise-rejection',
        promise: event.promise,
      });
    });

    // Catch React errors (will be supplemented by Error Boundary)
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      // Check if this is a React error
      const errorString = args.join(' ');
      if (errorString.includes('React') || errorString.includes('component')) {
        this.handleError(new Error(errorString), {
          type: 'react-error',
          args,
        });
      }
      originalConsoleError.apply(console, args);
    };

    this.initialized = true;
    clientLogger.info('component', 'Global error handler initialized');
  }

  private handleError(error: any, context?: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    clientLogger.log(
      'error',
      'component',
      `Global error caught: ${errorMessage}`,
      {
        error: errorMessage,
        stack: errorStack,
        context,
        timestamp: new Date().toISOString(),
      }
    );

    // Log to console for debugging
    console.error('[GLOBAL ERROR HANDLER]', error, context);
  }

  // Method to manually log errors
  logError(error: any, category: string = 'component', context?: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    clientLogger.error(
      category as any,
      errorMessage,
      {
        stack: errorStack,
        context,
        timestamp: new Date().toISOString(),
      }
    );
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();
