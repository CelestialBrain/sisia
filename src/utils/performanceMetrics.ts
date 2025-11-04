import { ClientLogEntry } from './clientLogger';

export interface PerformanceMetrics {
  sessionStartTime: number;
  sessionUptime: string;
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  logsPerMinute: number;
  errorRate: number;
  avgResponseTime: number | null;
  cacheHitRate: number | null;
  logsByMinute: { time: string; count: number; errors: number }[];
  errorsByCategory: { category: string; count: number }[];
  recentActivity: { timestamp: number; count: number }[];
}

export function calculatePerformanceMetrics(logs: ClientLogEntry[]): PerformanceMetrics {
  const now = Date.now();
  const sessionStart = logs.length > 0 ? Number(logs[0].timestamp) : now;
  const uptimeMs = now - sessionStart;
  
  // Calculate uptime in a readable format
  const uptimeMinutes = Math.floor(uptimeMs / 60000);
  const uptimeSeconds = Math.floor((uptimeMs % 60000) / 1000);
  const sessionUptime = uptimeMinutes > 0 
    ? `${uptimeMinutes}m ${uptimeSeconds}s`
    : `${uptimeSeconds}s`;

  // Count by level
  const errorCount = logs.filter(log => log.level === 'error').length;
  const warningCount = logs.filter(log => log.level === 'warn').length;
  const infoCount = logs.filter(log => log.level === 'info').length;

  // Calculate logs per minute
  const logsPerMinute = uptimeMinutes > 0 
    ? Math.round((logs.length / uptimeMinutes) * 10) / 10 
    : logs.length;

  // Calculate error rate
  const errorRate = logs.length > 0 
    ? Math.round((errorCount / logs.length) * 100) 
    : 0;

  // Calculate average API response time from api logs
  const apiLogs = logs.filter(log => 
    log.category === 'api' && 
    log.details && 
    typeof log.details === 'object' && 
    'duration' in log.details
  );
  
  const avgResponseTime = apiLogs.length > 0
    ? Math.round(
        apiLogs.reduce((sum, log) => {
          const duration = (log.details as any).duration;
          return sum + (typeof duration === 'number' ? duration : 0);
        }, 0) / apiLogs.length
      )
    : null;

  // Calculate cache hit rate from storage logs
  const storageLogs = logs.filter(log => 
    log.category === 'storage' && 
    log.details && 
    typeof log.details === 'object' && 
    'fromCache' in log.details
  );
  
  const cacheHits = storageLogs.filter(log => 
    (log.details as any).fromCache === true
  ).length;
  
  const cacheHitRate = storageLogs.length > 0
    ? Math.round((cacheHits / storageLogs.length) * 100)
    : null;

  // Group logs by minute for charting (last 10 minutes)
  const tenMinutesAgo = now - (10 * 60 * 1000);
  const recentLogs = logs.filter(log => Number(log.timestamp) >= tenMinutesAgo);
  
  const logsByMinute: { time: string; count: number; errors: number }[] = [];
  const minuteMap = new Map<string, { count: number; errors: number }>();
  
  recentLogs.forEach(log => {
    const minute = new Date(Number(log.timestamp)).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const existing = minuteMap.get(minute) || { count: 0, errors: 0 };
    minuteMap.set(minute, {
      count: existing.count + 1,
      errors: existing.errors + (log.level === 'error' ? 1 : 0)
    });
  });
  
  minuteMap.forEach((value, time) => {
    logsByMinute.push({ time, ...value });
  });
  
  // Sort by time
  logsByMinute.sort((a, b) => a.time.localeCompare(b.time));

  // Group errors by category
  const errorsByCategoryMap = new Map<string, number>();
  logs.filter(log => log.level === 'error').forEach(log => {
    const count = errorsByCategoryMap.get(log.category) || 0;
    errorsByCategoryMap.set(log.category, count + 1);
  });
  
  const errorsByCategory = Array.from(errorsByCategoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 error categories

  // Recent activity (last 5 minutes, grouped by 30-second intervals)
  const fiveMinutesAgo = now - (5 * 60 * 1000);
  const veryRecentLogs = logs.filter(log => Number(log.timestamp) >= fiveMinutesAgo);
  
  const activityMap = new Map<number, number>();
  veryRecentLogs.forEach(log => {
    const interval = Math.floor(Number(log.timestamp) / 30000) * 30000; // 30-second intervals
    const count = activityMap.get(interval) || 0;
    activityMap.set(interval, count + 1);
  });
  
  const recentActivity = Array.from(activityMap.entries())
    .map(([timestamp, count]) => ({ timestamp, count }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return {
    sessionStartTime: sessionStart,
    sessionUptime,
    totalLogs: logs.length,
    errorCount,
    warningCount,
    infoCount,
    logsPerMinute,
    errorRate,
    avgResponseTime,
    cacheHitRate,
    logsByMinute,
    errorsByCategory,
    recentActivity,
  };
}
