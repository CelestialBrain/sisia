// Automatic network request logging interceptor
import { clientLogger } from './clientLogger';

// Track ongoing requests
const requestStartTimes = new Map<string, number>();

// Intercept fetch requests
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const [resource, config] = args;
  const url = typeof resource === 'string' ? resource : 
              resource instanceof Request ? resource.url : 
              resource.toString();
  const method = config?.method || 'GET';
  
  const requestId = `${method}-${url}-${Date.now()}`;
  requestStartTimes.set(requestId, Date.now());
  
  try {
    const response = await originalFetch.apply(this, args);
    const duration = Date.now() - (requestStartTimes.get(requestId) || Date.now());
    requestStartTimes.delete(requestId);
    
    clientLogger.logNetworkRequest(
      method,
      url,
      response.status,
      duration,
      {
        ok: response.ok,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      },
      { level: response.ok ? 'info' : 'error' }
    );
    
    return response;
  } catch (error) {
    const duration = Date.now() - (requestStartTimes.get(requestId) || Date.now());
    requestStartTimes.delete(requestId);
    
    clientLogger.logNetworkRequest(
      method,
      url,
      0,
      duration,
      {
        error: error instanceof Error ? error.message : 'Network request failed'
      },
      { level: 'error' }
    );
    
    throw error;
  }
};

// Intercept XMLHttpRequest
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...rest: any[]) {
  this._method = method;
  this._url = typeof url === 'string' ? url : url.toString();
  this._startTime = Date.now();
  return originalXHROpen.apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
  const xhr = this;
  
  const logRequest = () => {
    const duration = Date.now() - (xhr._startTime || Date.now());
    
    clientLogger.logNetworkRequest(
      xhr._method || 'GET',
      xhr._url || '',
      xhr.status,
      duration,
      {
        ok: xhr.status >= 200 && xhr.status < 300,
        statusText: xhr.statusText,
        responseType: xhr.responseType
      },
      { level: xhr.status >= 400 ? 'error' : 'info' }
    );
  };
  
  xhr.addEventListener('load', logRequest);
  xhr.addEventListener('error', () => {
    const duration = Date.now() - (xhr._startTime || Date.now());
    clientLogger.logNetworkRequest(
      xhr._method || 'GET',
      xhr._url || '',
      0,
      duration,
      { error: 'XMLHttpRequest failed' },
      { level: 'error' }
    );
  });
  
  return originalXHRSend.apply(this, [body]);
};

// Extend XMLHttpRequest type
declare global {
  interface XMLHttpRequest {
    _method?: string;
    _url?: string;
    _startTime?: number;
  }
}

export {}; // Make this a module
