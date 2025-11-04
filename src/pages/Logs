import { useState, useEffect } from 'react';
import { clientLogger, ClientLogEntry, LogLevel, LogCategory } from '@/utils/clientLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Download, Search, RefreshCw, Activity, Database, Zap, TrendingUp, AlertCircle, Clock, CheckCircle, Terminal, BarChart3, Info, AlertTriangle, Bug, BookOpen, GraduationCap, FileEdit, HardDrive, Code, Key, Trash, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LogsInterpretationGuide } from '@/components/LogsInterpretationGuide';
import { calculatePerformanceMetrics } from '@/utils/performanceMetrics';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

export default function Logs() {
  const [logs, setLogs] = useState<ClientLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ClientLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const buildInfo = clientLogger.getBuildInfo();

  const loadLogs = () => {
    const allLogs = clientLogger.getLogs();
    setLogs(allLogs);
  };

  useEffect(() => {
    loadLogs();
    // Auto-refresh every 2 seconds
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = logs;

    // Filter by level
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(log => log.category === categoryFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(search) ||
        log.category.toLowerCase().includes(search) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(search)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, levelFilter, categoryFilter]);

  const handleClearLogs = () => {
    clientLogger.clearLogs();
    loadLogs();
    toast({
      title: 'Logs Cleared',
      description: 'All client logs have been cleared',
    });
  };

  const handleDownloadLogs = () => {
    const logData = clientLogger.exportLogsWithMetadata();
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-logs-with-context-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Logs Downloaded',
      description: 'Client logs with full application context exported successfully',
    });
  };

  const getLevelBadgeVariant = (level: LogLevel): "default" | "destructive" | "outline" | "secondary" => {
    switch (level) {
      case 'error': return 'destructive';
      case 'warn': return 'secondary';
      case 'info': return 'default';
      case 'debug': return 'outline';
      default: return 'outline';
    }
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const performanceMetrics = calculatePerformanceMetrics(logs);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Client Logs</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of frontend operations, API calls, and state changes
        </p>
      </div>

      

      {/* Site Performance Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Site Performance Dashboard
          </CardTitle>
          <CardDescription>
            Real-time metrics and activity monitoring for this session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Session Uptime */}
            <div className="space-y-2 p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Session Uptime</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{performanceMetrics.sessionUptime}</div>
              <div className="text-xs text-muted-foreground">
                {performanceMetrics.totalLogs} total events
              </div>
            </div>

            {/* Activity Rate */}
            <div className="space-y-2 p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Activity Rate</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{performanceMetrics.logsPerMinute}</div>
              <div className="text-xs text-muted-foreground">
                logs per minute
              </div>
            </div>

            {/* Error Rate */}
            <div className="space-y-2 p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Error Rate</span>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{performanceMetrics.errorRate}%</span>
                <Badge 
                  variant={performanceMetrics.errorRate === 0 ? "success" : performanceMetrics.errorRate < 5 ? "warning" : "destructive"}
                  size="sm"
                >
                  {performanceMetrics.errorCount} errors
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {performanceMetrics.warningCount} warnings
              </div>
            </div>

            {/* Cache Performance */}
            <div className="space-y-2 p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cache Hit Rate</span>
                <Database className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {performanceMetrics.cacheHitRate !== null ? `${performanceMetrics.cacheHitRate}%` : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">
                {performanceMetrics.avgResponseTime !== null 
                  ? `Avg: ${performanceMetrics.avgResponseTime}ms` 
                  : 'No data yet'}
              </div>
            </div>
          </div>

          {/* Activity Chart */}
          {performanceMetrics.logsByMinute.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity Over Time (Last 10 Minutes)
              </h4>
              <ChartContainer
                config={{
                  count: {
                    label: "Total Logs",
                    color: "hsl(var(--primary))",
                  },
                  errors: {
                    label: "Errors",
                    color: "hsl(var(--destructive))",
                  },
                }}
                className="h-[200px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceMetrics.logsByMinute}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="time" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="errors" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--destructive))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          )}

          {/* Error Distribution */}
          {performanceMetrics.errorsByCategory.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Error Distribution by Category
              </h4>
              <ChartContainer
                config={{
                  count: {
                    label: "Errors",
                    color: "hsl(var(--destructive))",
                  },
                }}
                className="h-[180px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceMetrics.errorsByCategory}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="category" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--destructive))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          )}

          {/* Health Status */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            {performanceMetrics.errorRate === 0 ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium">System Healthy</div>
                  <div className="text-xs text-muted-foreground">
                    No errors detected in this session
                  </div>
                </div>
                <Badge variant="success">All Good</Badge>
              </>
            ) : performanceMetrics.errorRate < 5 ? (
              <>
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Minor Issues Detected</div>
                  <div className="text-xs text-muted-foreground">
                    Low error rate - monitoring recommended
                  </div>
                </div>
                <Badge variant="warning">Caution</Badge>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Action Required</div>
                  <div className="text-xs text-muted-foreground">
                    High error rate detected - review logs below
                  </div>
                </div>
                <Badge variant="destructive">Alert</Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Activity Monitor
          </CardTitle>
          <CardDescription>
            Real-time client-side logs with full application context for debugging and AI analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Filters</label>
              <div className="flex flex-col sm:flex-row gap-4">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="user-action">User Actions</SelectItem>
                <SelectItem value="network">Network Requests</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="storage">Storage</SelectItem>
                <SelectItem value="query">Query</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
                <SelectItem value="component">Component</SelectItem>
                <SelectItem value="navigation">Navigation</SelectItem>
                <SelectItem value="schedule">Schedule</SelectItem>
                <SelectItem value="program-selection">Program Selection</SelectItem>
                <SelectItem value="grade-planner">Grade Planner</SelectItem>
                <SelectItem value="ui">UI</SelectItem>
              </SelectContent>
            </Select>

            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Log level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
              />
            </div>

                <div className="flex gap-2 shrink-0">
                  <Button onClick={loadLogs} variant="outline" size="icon" className="shrink-0">
                    <RefreshCw className="h-4 w-4" />
                  </Button>

                  <Button onClick={handleDownloadLogs} variant="outline" size="icon" className="shrink-0">
                    <Download className="h-4 w-4" />
                  </Button>

                  <Button onClick={handleClearLogs} variant="destructive" size="icon" className="shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Quick Stats */}
            <div className="flex gap-2 text-sm flex-wrap">
              <Badge variant="outline">
                Filtered: {filteredLogs.length}
              </Badge>
              <Badge variant="outline">
                Total Logs: {logs.length}
              </Badge>
              <Badge variant="destructive">
                Errors: {performanceMetrics.errorCount}
              </Badge>
              <Badge variant="secondary">
                Warnings: {performanceMetrics.warningCount}
              </Badge>
            </div>
          </div>

          {/* Log Entries */}
          <ScrollArea className="h-[600px] w-full">
            <div className="space-y-2">
              {filteredLogs.length === 0 && (
                <div className="text-center text-muted-foreground py-8 border rounded-lg">
                  {logs.length === 0 ? (
                    <div>
                      <p className="font-medium">No logs yet</p>
                      <p className="text-sm mt-1">Start using the app to see activity here.</p>
                    </div>
                  ) : (
                    "No logs found matching your filters"
                  )}
                </div>
              )}

              {filteredLogs.map((log) => {
                const getLevelIcon = () => {
                  switch (log.level) {
                    case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
                    case 'warn': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
                    case 'info': return <Info className="h-4 w-4 text-primary" />;
                    case 'debug': return <Bug className="h-4 w-4 text-muted-foreground" />;
                    default: return <Info className="h-4 w-4 text-muted-foreground" />;
                  }
                };

                const getEntityIcon = () => {
                  if (!log.appContext?.entityType) return null;
                  const entityType = log.appContext.entityType;
                  if (entityType === 'course') return <BookOpen className="h-4 w-4" />;
                  if (entityType === 'schedule') return <Activity className="h-4 w-4" />;
                  if (entityType === 'program') return <GraduationCap className="h-4 w-4" />;
                  if (entityType === 'enrollment') return <FileEdit className="h-4 w-4" />;
                  return <Database className="h-4 w-4" />;
                };

                return (
                  <div
                    key={log.id}
                    className="rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getLevelIcon()}
                          <Badge variant={getLevelBadgeVariant(log.level)} size="sm">
                            {log.level.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.category}
                          </Badge>
                          {log.userType !== 'unknown' && (
                            <Badge variant="outline" className="text-xs">
                              {log.userType}
                            </Badge>
                          )}
                          {log.version && (
                            <Badge variant="outline" className="text-xs font-mono">
                              v{log.version}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        {getEntityIcon() && (
                          <div className="mt-0.5 shrink-0">{getEntityIcon()}</div>
                        )}
                        <div className="text-sm whitespace-pre-wrap break-words flex-1">
                          {log.message}
                        </div>
                      </div>

                      {log.interpretation && (
                        <div className="mt-3 text-sm bg-primary/10 text-primary p-3 rounded-md">
                          <div className="flex items-start gap-2">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <div className="flex-1">{log.interpretation}</div>
                          </div>
                        </div>
                      )}

                      {log.appContext && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {log.appContext.entityType && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Database className="h-3 w-3" />
                              {log.appContext.entityType}
                            </Badge>
                          )}
                          {log.appContext.operation && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Zap className="h-3 w-3" />
                              {log.appContext.operation}
                            </Badge>
                          )}
                          {log.appContext.storageLayer && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <HardDrive className="h-3 w-3" />
                              {log.appContext.storageLayer}
                            </Badge>
                          )}
                        </div>
                      )}

                      {log.technicalContext && (log.technicalContext.component || log.technicalContext.queryKey) && (
                        <div className="mt-2 flex flex-wrap gap-1 text-xs">
                          {log.technicalContext.component && (
                            <code className="bg-muted px-2 py-1 rounded text-xs font-mono flex items-center gap-1">
                              <Code className="h-3 w-3" />
                              {log.technicalContext.component}
                            </code>
                          )}
                          {log.technicalContext.queryKey && (
                            <code className="bg-muted px-2 py-1 rounded text-xs font-mono flex items-center gap-1">
                              <Key className="h-3 w-3" />
                              {log.technicalContext.queryKey}
                            </code>
                          )}
                          {log.technicalContext.cacheInvalidated && (
                            <code className="bg-destructive/10 text-destructive px-2 py-1 rounded text-xs flex items-center gap-1">
                              <Trash className="h-3 w-3" />
                              {log.technicalContext.cacheInvalidated.length} keys invalidated
                            </code>
                          )}
                        </div>
                      )}
                      
                      {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                        <div className="mt-3 text-xs bg-muted/50 p-2 rounded space-y-1">
                          {Object.entries(log.details).slice(0, 3).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="font-medium text-muted-foreground min-w-[80px]">{key}:</span>
                              <span className="flex-1 break-all">
                                {String(value).slice(0, 50)}
                                {String(value).length > 50 && '...'}
                              </span>
                            </div>
                          ))}
                          {Object.keys(log.details).length > 3 && (
                            <div className="text-muted-foreground italic">
                              + {Object.keys(log.details).length - 3} more fields
                            </div>
                          )}
                        </div>
                      )}
                      
                      {(log.details || log.stackTrace) && (
                        <div className="mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleLogExpansion(log.id)}
                            className="h-7 text-xs flex items-center gap-1"
                          >
                            {expandedLogs.has(log.id) ? (
                              <>
                                <ChevronDown className="h-3 w-3" />
                                Hide Full Details
                              </>
                            ) : (
                              <>
                                <ChevronRight className="h-3 w-3" />
                                View Full Details
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  
                    {expandedLogs.has(log.id) && (
                      <div className="border-t bg-muted/30 p-4 space-y-4">
                        {log.userId && (
                          <div className="text-xs">
                            <span className="font-semibold">User ID:</span>{' '}
                            <code className="bg-background px-2 py-1 rounded">{log.userId}</code>
                          </div>
                        )}

                        {log.appContext && (
                          <div>
                            <div className="text-xs font-semibold mb-2 flex items-center gap-2">
                              <Database className="h-3 w-3" />
                              Application Context
                            </div>
                            <pre className="text-xs whitespace-pre-wrap break-words font-mono overflow-x-auto bg-background p-3 rounded border">
                              {JSON.stringify(log.appContext, null, 2)}
                            </pre>
                          </div>
                        )}

                        {log.technicalContext && (
                          <div>
                            <div className="text-xs font-semibold mb-2 flex items-center gap-2">
                              <Activity className="h-3 w-3" />
                              Technical Context
                            </div>
                            <pre className="text-xs whitespace-pre-wrap break-words font-mono overflow-x-auto bg-background p-3 rounded border">
                              {JSON.stringify(log.technicalContext, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {log.details && (
                          <div>
                            <div className="text-xs font-semibold mb-2">Details</div>
                            <pre className="text-xs whitespace-pre-wrap break-words font-mono overflow-x-auto bg-background p-3 rounded border">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {log.stackTrace && (
                          <div>
                            <div className="text-xs font-semibold mb-2 text-destructive flex items-center gap-2">
                              ⚠️ Stack Trace
                            </div>
                            <pre className="text-xs whitespace-pre-wrap break-words font-mono overflow-x-auto bg-destructive/10 p-3 rounded border border-destructive/20">
                              {log.stackTrace}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <LogsInterpretationGuide />
    </div>
  );
}
