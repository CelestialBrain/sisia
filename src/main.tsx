import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { clientLogger } from "@/utils/clientLogger";
import { errorHandler } from "@/utils/errorHandler";

// Initialize logging interceptors
import "./utils/networkLogger";
import "./utils/userActionLogger";

// Initialize global error handler
errorHandler.initialize();

// Check if scroll is currently locked by an overlay (Select, Dialog, etc.)
function isScrollLocked() {
  return document.documentElement.hasAttribute('data-scroll-locked') || 
         document.body.hasAttribute('data-scroll-locked');
}

// Detect if browser uses classic (layout-consuming) or overlay scrollbars
function setScrollbarMode() {
  // If innerWidth > clientWidth, a classic scrollbar is consuming layout width
  // Use 15px threshold to ignore tiny deltas (classic bars are ~12-17px wide)
  const diff = Math.abs(window.innerWidth - document.documentElement.clientWidth);
  const mode = diff >= 15 ? 'classic' : 'overlay';
  document.documentElement.setAttribute('data-scrollbar', mode);
}

// Inject runtime style override to neutralize react-remove-scroll compensation
// This MUST be last in the head to win the cascade
function injectScrollLockOverride() {
  const existingOverride = document.getElementById('rrs-override');
  if (existingOverride) {
    existingOverride.remove();
  }
  
  const style = document.createElement('style');
  style.id = 'rrs-override';
  style.textContent = `
    /* Neutralize react-remove-scroll compensation (higher specificity + !important) */
    html[data-scrollbar] body[data-scroll-locked],
    body[data-scroll-locked].__react-remove-scroll-bar {
      --removed-body-scroll-bar-size: 0px !important;
      padding-right: 0 !important;
      margin-right: 0 !important;
    }
  `;
  document.head.appendChild(style);
}

// Force body inline styles to zero when locked (belt-and-suspenders)
function neutralizeBodyCompensation(locked: boolean) {
  const body = document.body;
  if (!body) return;
  
  if (locked) {
    body.style.setProperty('--removed-body-scroll-bar-size', '0px', 'important');
    body.style.marginRight = '0px';
    body.style.paddingRight = '0px';
  } else {
    body.style.removeProperty('--removed-body-scroll-bar-size');
    body.style.removeProperty('margin-right');
    body.style.removeProperty('padding-right');
  }
}

// Run detection on initial load
setScrollbarMode();
injectScrollLockOverride();

// Initialize logo spacing from localStorage immediately
const savedLogoSpacing = localStorage.getItem('logo-letter-spacing');
if (savedLogoSpacing) {
  document.documentElement.style.setProperty('--logo-spacing', `${savedLogoSpacing}em`);
}

// Re-detect only on orientation change (not on every resize)
window.addEventListener('orientationchange', setScrollbarMode, { passive: true });

// Watch for scroll-lock changes and neutralize compensation
const observer = new MutationObserver(() => {
  const locked = isScrollLocked();
  
  // Re-inject override to ensure it's always last in head
  injectScrollLockOverride();
  
  // Force inline styles on body
  neutralizeBodyCompensation(locked);
  
  // Recompute scrollbar mode when unlocked
  if (!locked) {
    requestAnimationFrame(setScrollbarMode);
  }
});

observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-scroll-locked'] });
observer.observe(document.body, { attributes: true, attributeFilter: ['data-scroll-locked', 'style'] });

// Global error handlers for logging
window.addEventListener('error', (event) => {
  clientLogger.error('ui', 'Unhandled error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  clientLogger.error('ui', 'Unhandled promise rejection', {
    reason: String(event.reason),
    promise: event.promise,
  });
});

createRoot(document.getElementById("root")!).render(<App />);
