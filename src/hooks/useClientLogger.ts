import { useAuth } from '@/contexts/AuthContext';
import { clientLogger, LogCategory, LogLevel, EntityType, CRUDOperation, StorageLayerType } from '@/utils/clientLogger';

export function useClientLogger() {
  const { user, isGuest } = useAuth();

  const log = (
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: any
  ) => {
    const userType = isGuest ? 'guest' : user ? 'authenticated' : 'unknown';
    const userId = user?.id;
    clientLogger.log(level, category, message, details, userType, userId);
  };

  const info = (category: LogCategory, message: string, details?: any) => {
    log('info', category, message, details);
  };

  const warn = (category: LogCategory, message: string, details?: any) => {
    log('warn', category, message, details);
  };

  const error = (category: LogCategory, message: string, details?: any) => {
    log('error', category, message, details);
  };

  const debug = (category: LogCategory, message: string, details?: any) => {
    log('debug', category, message, details);
  };

  // Enhanced logging methods
  const logEntityOperation = (
    entityType: EntityType,
    operation: CRUDOperation,
    message: string,
    details?: any,
    options?: {
      level?: LogLevel;
      storageLayer?: StorageLayerType;
      relatedEntities?: { [key: string]: string };
      component?: string;
      interpretation?: string;
    }
  ) => {
    const userType = isGuest ? 'guest' : user ? 'authenticated' : 'unknown';
    const userId = user?.id;
    clientLogger.logEntityOperation(entityType, operation, message, details, {
      ...options,
      userType,
      userId,
    });
  };

  const logCacheOperation = (
    action: 'INVALIDATE' | 'UPDATE' | 'MISS' | 'HIT',
    queryKeys: string[],
    reason: string,
    component?: string
  ) => {
    const userType = isGuest ? 'guest' : user ? 'authenticated' : 'unknown';
    const userId = user?.id;
    clientLogger.logCacheOperation(action, queryKeys, reason, {
      userType,
      userId,
      component,
    });
  };

  const logStorageOperation = (
    layer: StorageLayerType,
    action: string,
    message: string,
    details?: any,
    options?: {
      level?: LogLevel;
      interpretation?: string;
    }
  ) => {
    const userType = isGuest ? 'guest' : user ? 'authenticated' : 'unknown';
    const userId = user?.id;
    clientLogger.logStorageOperation(layer, action, message, details, {
      ...options,
      userType,
      userId,
    });
  };

  const logUserAction = (
    action: string,
    target: string,
    details?: any
  ) => {
    const userType = isGuest ? 'guest' : user ? 'authenticated' : 'unknown';
    const userId = user?.id;
    clientLogger.logUserAction(action, target, details, {
      userType,
      userId,
    });
  };

  const logNetworkRequest = (
    method: string,
    url: string,
    status?: number,
    duration?: number,
    details?: any,
    level?: LogLevel
  ) => {
    const userType = isGuest ? 'guest' : user ? 'authenticated' : 'unknown';
    const userId = user?.id;
    clientLogger.logNetworkRequest(method, url, status, duration, details, {
      level,
      userType,
      userId,
    });
  };

  return { 
    log, 
    info, 
    warn, 
    error, 
    debug, 
    logEntityOperation, 
    logCacheOperation, 
    logStorageOperation,
    logUserAction,
    logNetworkRequest 
  };
}
