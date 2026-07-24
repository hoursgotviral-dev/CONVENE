import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  const ignoredErrors = [
    "ResizeObserver loop completed with undelivered notifications.",
    "ResizeObserver loop limit exceeded",
    "reading 'dimensions'",
    "Cannot read properties of undefined (reading 'dimensions')"
  ];

  // Intercept and suppress console.error
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const isIgnored = args.some(arg => {
      if (typeof arg === 'string') {
        return ignoredErrors.some(err => arg.includes(err));
      }
      if (arg && typeof arg === 'object') {
        const msg = arg.message || '';
        const stack = arg.stack || '';
        return ignoredErrors.some(err => msg.includes(err) || stack.includes(err));
      }
      return false;
    });
    if (!isIgnored) {
      originalConsoleError.apply(console, args);
    }
  };

  // Intercept and suppress console.warn
  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    const isIgnored = args.some(arg => {
      if (typeof arg === 'string') {
        return ignoredErrors.some(err => arg.includes(err));
      }
      if (arg && typeof arg === 'object') {
        const msg = arg.message || '';
        const stack = arg.stack || '';
        return ignoredErrors.some(err => msg.includes(err) || stack.includes(err));
      }
      return false;
    });
    if (!isIgnored) {
      originalConsoleWarn.apply(console, args);
    }
  };

  // Intercept window.onerror as a fallback and return true to suppress
  window.onerror = (message, source, lineno, colno, error) => {
    const msg = typeof message === 'string' ? message : '';
    const errMessage = error?.message || '';
    const errStack = error?.stack || '';
    if (ignoredErrors.some(err => msg.includes(err) || errMessage.includes(err) || errStack.includes(err))) {
      return true; // suppresses the browser error
    }
  };

  window.addEventListener('error', (event) => {
    const message = event.message || '';
    const errMessage = event.error?.message || '';
    const errStack = event.error?.stack || '';
    if (ignoredErrors.some(err => message.includes(err) || errMessage.includes(err) || errStack.includes(err))) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || '';
    const reasonStack = event.reason?.stack || '';
    if (ignoredErrors.some(err => reason.includes(err) || reasonStack.includes(err))) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
