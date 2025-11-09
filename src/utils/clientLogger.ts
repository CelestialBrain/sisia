// Client-side logging utility for diagnosing frontend operations
// Logs are stored in sessionStorage (per-session basis) and accessible via /logs page

import { APPLICATION_METADATA } from './appContext';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogCategory = 
  | 'api' 
  | 'storage' 
  | 'query' 
  | 'auth' 
  | 'component' 
  | 'navigation'
  | 'schedule'
  | 'program-selection'
  | 'grade-planner'
  | 'ui'
  | 'user-action'
  | 'network'
  | 'scraper'
  | 'import-job';

export type EntityType = 'course' | 'schedule' | 'enrollment' | 'grade-plan' | 'schedule-block' | 'palette-item' | 'requirement-group' | 'program' | 'curriculum-version';
export type CRUDOperation = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'SYNC' | 'INVALIDATE';
export type StorageLayerType = 'sessionStorage' | 'supabase' | 'reactQueryCache';

export interface AppContext {
  entityType?: EntityType;
  operation?: CRUDOperation;
  storageLayer?: StorageLayerType;
  relatedEntities?: { [key: string]: string };
}

export interface TechnicalContext {
  component?: string;
  hook?: string;
  queryKey?: string;
  cacheInvalidated?: string[];
  sqlOperation?: string;
  httpMethod?: string;
  endpoint?: string;
}

export interface ClientLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  userType: 'guest' | 'authenticated' | 'unknown';
  userId?: string;
  details?: any;
  stackTrace?: string;
  operation?: string; // e.g., 'FETCH', 'SAVE', 'UPDATE', 'DELETE'
  duration?: number; // milliseconds
  version?: string; // Build version
  buildTime?: string; // Build timestamp
  
  // Enhanced context fields
  appContext?: AppContext;
  technicalContext?: TechnicalContext;
  interpretation?: string;
}

const MAX_LOGS = 500; // Keep last 500 logs
const STORAGE_KEY = 'client_logs';

// Get build version from environment
const getBuildVersion = () => {
  const version = import.meta.env.VITE_APP_VERSION || 'dev';
  const buildTime = import.meta.env.VITE_BUILD_TIME || new Date().toISOString();
  return { version, buildTime };
};

class ClientLogger {
  private logs: ClientLogEntry[] = [];
  private initialized = false;
  private buildInfo = getBuildVersion();

  constructor() {
    this.loadLogs();
  }

  private loadLogs() {
    try {
      // Use sessionStorage for per-session logging
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to load logs from sessionStorage:', error);
      this.logs = [];
      this.initialized = true;
    }
  }

  private saveLogs() {
    try {
      // Keep only last MAX_LOGS entries
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS);
      }
      // Use sessionStorage for per-session logging
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save logs to sessionStorage:', error);
    }
  }

  log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: any,
    userType: 'guest' | 'authenticated' | 'unknown' = 'unknown',
    userId?: string
  ) {
    if (!this.initialized) {
      this.loadLogs();
    }

    const entry: ClientLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      userType,
      userId,
      details,
      stackTrace: level === 'error' ? new Error().stack : undefined,
      version: this.buildInfo.version,
      buildTime: this.buildInfo.buildTime,
    };

    this.logs.push(entry);
    this.saveLogs();

    // Also log to console for dev debugging
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleMethod(`[${category.toUpperCase()}] ${message}`, details || '');
  }

  info(category: LogCategory, message: string, details?: any, userType?: 'guest' | 'authenticated' | 'unknown', userId?: string) {
    this.log('info', category, message, details, userType, userId);
  }

  warn(category: LogCategory, message: string, details?: any, userType?: 'guest' | 'authenticated' | 'unknown', userId?: string) {
    this.log('warn', category, message, details, userType, userId);
  }

  error(category: LogCategory, message: string, details?: any, userType?: 'guest' | 'authenticated' | 'unknown', userId?: string) {
    this.log('error', category, message, details, userType, userId);
  }

  debug(category: LogCategory, message: string, details?: any, userType?: 'guest' | 'authenticated' | 'unknown', userId?: string) {
    this.log('debug', category, message, details, userType, userId);
  }

  // Enhanced logging methods with context
  logEntityOperation(
    entityType: EntityType,
    operation: CRUDOperation,
    message: string,
    details?: any,
    options?: {
      level?: LogLevel;
      userType?: 'guest' | 'authenticated' | 'unknown';
      userId?: string;
      storageLayer?: StorageLayerType;
      relatedEntities?: { [key: string]: string };
      component?: string;
      interpretation?: string;
    }
  ) {
    const entry: ClientLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level: options?.level || 'info',
      category: this.mapEntityToCategory(entityType),
      message,
      userType: options?.userType || 'unknown',
      userId: options?.userId,
      details,
      version: this.buildInfo.version,
      buildTime: this.buildInfo.buildTime,
      appContext: {
        entityType,
        operation,
        storageLayer: options?.storageLayer,
        relatedEntities: options?.relatedEntities,
      },
      technicalContext: {
        component: options?.component,
      },
      interpretation: options?.interpretation,
    };

    this.logs.push(entry);
    this.saveLogs();

    const consoleMethod = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log;
    consoleMethod(`[${entry.category.toUpperCase()}] ${message}`, details || '');
  }

  logCacheOperation(
    action: 'INVALIDATE' | 'UPDATE' | 'MISS' | 'HIT',
    queryKeys: string[],
    reason: string,
    options?: {
      userType?: 'guest' | 'authenticated' | 'unknown';
      userId?: string;
      component?: string;
    }
  ) {
    const entry: ClientLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'query',
      message: `Cache ${action}: ${queryKeys.join(', ')}`,
      userType: options?.userType || 'unknown',
      userId: options?.userId,
      details: { queryKeys, reason },
      version: this.buildInfo.version,
      buildTime: this.buildInfo.buildTime,
      appContext: {
        operation: action === 'INVALIDATE' ? 'INVALIDATE' : 'READ',
        storageLayer: 'reactQueryCache',
      },
      technicalContext: {
        queryKey: queryKeys[0],
        cacheInvalidated: action === 'INVALIDATE' ? queryKeys : undefined,
        component: options?.component,
      },
      interpretation: reason,
    };

    this.logs.push(entry);
    this.saveLogs();

    console.log(`[QUERY] Cache ${action}: ${queryKeys.join(', ')}`, { reason });
  }

  logStorageOperation(
    layer: StorageLayerType,
    action: string,
    message: string,
    details?: any,
    options?: {
      level?: LogLevel;
      userType?: 'guest' | 'authenticated' | 'unknown';
      userId?: string;
      interpretation?: string;
    }
  ) {
    const entry: ClientLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level: options?.level || 'info',
      category: 'storage',
      message,
      userType: options?.userType || 'unknown',
      userId: options?.userId,
      details,
      version: this.buildInfo.version,
      buildTime: this.buildInfo.buildTime,
      appContext: {
        operation: action.toUpperCase() as CRUDOperation,
        storageLayer: layer,
      },
      interpretation: options?.interpretation,
    };

    this.logs.push(entry);
    this.saveLogs();

    const consoleMethod = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log;
    consoleMethod(`[STORAGE] ${message}`, details || '');
  }

  private mapEntityToCategory(entityType: EntityType): LogCategory {
    switch (entityType) {
      case 'schedule':
      case 'schedule-block':
      case 'palette-item':
        return 'schedule';
      case 'grade-plan':
        return 'grade-planner';
      case 'enrollment':
      case 'program':
      case 'curriculum-version':
        return 'program-selection';
      case 'course':
      case 'requirement-group':
        return 'query';
      default:
        return 'component';
    }
  }

  // Log user actions (clicks, form submissions, etc.)
  logUserAction(
    action: string,
    target: string,
    details?: any,
    options?: {
      userType?: 'guest' | 'authenticated' | 'unknown';
      userId?: string;
    }
  ) {
    const entry: ClientLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'user-action',
      message: `${action}: ${target}`,
      userType: options?.userType || 'unknown',
      userId: options?.userId,
      details: { action, target, ...details },
      version: this.buildInfo.version,
      buildTime: this.buildInfo.buildTime,
    };

    this.logs.push(entry);
    this.saveLogs();

    console.log(`[USER-ACTION] ${action}: ${target}`, details || '');
  }

  // Log network requests
  logNetworkRequest(
    method: string,
    url: string,
    status?: number,
    duration?: number,
    details?: any,
    options?: {
      level?: LogLevel;
      userType?: 'guest' | 'authenticated' | 'unknown';
      userId?: string;
    }
  ) {
    const entry: ClientLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level: options?.level || (status && status >= 400 ? 'error' : 'info'),
      category: 'network',
      message: `${method} ${url} ${status ? `- ${status}` : ''}`,
      userType: options?.userType || 'unknown',
      userId: options?.userId,
      details: { method, url, status, duration, ...details },
      duration,
      version: this.buildInfo.version,
      buildTime: this.buildInfo.buildTime,
      technicalContext: {
        httpMethod: method,
        endpoint: url,
      },
    };

    this.logs.push(entry);
    this.saveLogs();

    const consoleMethod = entry.level === 'error' ? console.error : console.log;
    consoleMethod(`[NETWORK] ${method} ${url}`, { status, duration, ...details });
  }

  getLogs(): ClientLogEntry[] {
    if (!this.initialized) {
      this.loadLogs();
    }
    return [...this.logs].reverse(); // Most recent first
  }

  clearLogs() {
    this.logs = [];
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  exportLogs(): string {
    const logs = this.getLogs();
    return JSON.stringify(logs, null, 2);
  }

  exportLogsWithMetadata(): string {
    const logs = this.getLogs();
    
    const exportData = {
      logExportMetadata: {
        exportDate: new Date().toISOString(),
        applicationName: APPLICATION_METADATA.name,
        applicationDescription: APPLICATION_METADATA.description,
        version: this.buildInfo.version,
        buildTime: this.buildInfo.buildTime,
        architecture: APPLICATION_METADATA.architecture,
        entities: APPLICATION_METADATA.entities,
        storageLayers: APPLICATION_METADATA.storageLayers,
        commonOperations: APPLICATION_METADATA.commonOperations,
        glossary: APPLICATION_METADATA.glossary,
        logCategories: APPLICATION_METADATA.logCategories,
      },
      logsCount: logs.length,
      logs: logs,
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  // Push logs to database for persistent server-side logging
  async syncToDatabase() {
    if (!this.initialized || this.logs.length === 0) {
      return;
    }

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const recentLogs = this.logs.slice(-50); // Only sync last 50 logs
      
      const logsToSync = recentLogs.map(log => ({
        user_id: log.userId || null,
        user_type: log.userType,
        level: log.level,
        category: log.category,
        message: log.message,
        details: log.details || null,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        app_version: log.version,
        build_time: log.buildTime
      }));

      await supabase.from('client_logs').insert(logsToSync);
      console.log(`[ClientLogger] Synced ${logsToSync.length} logs to database`);
    } catch (error) {
      console.error('[ClientLogger] Failed to sync logs to database:', error);
    }
  }

  getBuildInfo() {
    return this.buildInfo;
  }
}

// Singleton instance
export const clientLogger = new ClientLogger();
