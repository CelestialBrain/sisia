// Automatic user action logging
import { clientLogger } from './clientLogger';

// Track click events
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  
  // Get meaningful target identifier
  let targetDescription = target.tagName.toLowerCase();
  
  if (target.id) {
    targetDescription += `#${target.id}`;
  } else if (target.className && typeof target.className === 'string') {
    const classes = target.className.split(' ').slice(0, 2).join('.');
    if (classes) targetDescription += `.${classes}`;
  }
  
  // Get button/link text if available
  const text = target.textContent?.trim().substring(0, 30);
  if (text) {
    targetDescription += ` "${text}"`;
  }
  
  clientLogger.logUserAction(
    'click',
    targetDescription,
    {
      x: event.clientX,
      y: event.clientY,
      path: window.location.pathname,
      timestamp: new Date().toISOString()
    }
  );
}, { capture: true, passive: true });

// Track form submissions
document.addEventListener('submit', (event) => {
  const target = event.target as HTMLFormElement;
  
  let formDescription = 'form';
  if (target.id) formDescription += `#${target.id}`;
  if (target.action) formDescription += ` -> ${target.action}`;
  
  clientLogger.logUserAction(
    'submit',
    formDescription,
    {
      method: target.method,
      action: target.action,
      path: window.location.pathname
    }
  );
}, { capture: true });

// Track navigation (using popstate for SPA routing)
window.addEventListener('popstate', () => {
  clientLogger.logUserAction(
    'navigate',
    window.location.pathname,
    {
      type: 'popstate',
      href: window.location.href
    }
  );
});

// Track initial page load
clientLogger.logUserAction(
  'page-load',
  window.location.pathname,
  {
    referrer: document.referrer,
    userAgent: navigator.userAgent
  }
);

export {};
