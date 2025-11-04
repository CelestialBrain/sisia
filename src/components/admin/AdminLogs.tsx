import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, Download } from "lucide-react";
import { toast } from "sonner";

type LogLevel = "info" | "error" | "warn" | "log";

interface LogEntry {
  id: string;
  created_at: string;
  event_message: string;
  event_type: string | null;
  level: LogLevel;
  function_name: string;
  details?: {
    summary?: any;
    fullLog?: string;
  };
}

export function AdminLogs() {
  const [selectedFunction, setSelectedFunction] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [limit, setLimit] = useState(100);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  // Fetch distinct function names from logs
  const { data: functionNames } = useQuery({
    queryKey: ["admin-logs-functions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("function_logs")
        .select("function_name")
        .order("function_name");
      
      if (error) throw error;
      
      // Get unique function names
      const uniqueNames = Array.from(new Set(data?.map(log => log.function_name) || []));
      return uniqueNames as string[];
    },
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-logs", selectedFunction, limit],
    queryFn: async () => {
      let query = supabase
        .from("function_logs")
        .select("id, created_at, event_message, event_type, level, function_name, details")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (selectedFunction !== "all") {
        query = query.eq("function_name", selectedFunction);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LogEntry[];
    },
    refetchInterval: 5000,
    staleTime: 3000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("function-logs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "function_logs" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-logs", selectedFunction] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, selectedFunction]);

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      searchTerm === "" ||
      log.event_message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel =
      levelFilter === "all" || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

const downloadLogs = () => {
    if (!filteredLogs) return;
    
    const logText = filteredLogs
      .map(
        (log) =>
          `[${new Date(log.created_at).toISOString()}] [${log.level.toUpperCase()}] ${log.event_message}`
      )
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-logs-${selectedFunction}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs downloaded");
  };

  const getLevelBadgeVariant = (level: LogLevel) => {
    switch (level) {
      case "error":
        return "destructive";
      case "warn":
        return "secondary";
      case "info":
        return "default";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-0 lg:p-6 lg:border lg:rounded-lg lg:bg-card">
        <div className="mb-4 lg:mb-6">
          <h3 className="text-lg font-semibold">Function Logs</h3>
          <p className="text-sm text-muted-foreground">
            Real-time logs from edge functions for debugging and analysis
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedFunction} onValueChange={setSelectedFunction}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select function" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Functions</SelectItem>
                <SelectItem value="chat-upload">Chat Upload</SelectItem>
                <SelectItem value="chat-cleanup">Chat Cleanup</SelectItem>
                {functionNames?.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </SelectItem>
                ))}
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
                <SelectItem value="log">Log</SelectItem>
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
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-logs", selectedFunction, limit] })} variant="outline" size="icon" className="shrink-0">
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Button onClick={downloadLogs} variant="outline" size="icon" className="shrink-0">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredLogs?.length || 0} log entries
          </div>

          <ScrollArea className="h-[600px] w-full rounded-md border">
            <div className="p-4 space-y-2">
              {isLoading && (
                <div className="text-center text-muted-foreground py-8">
                  Loading logs...
                </div>
              )}

              {!isLoading && filteredLogs?.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  {logs?.length === 0 ? (
                    <div>
                      <p className="font-medium">No logs yet</p>
                      <p className="text-sm mt-1">Once you run an import or purge, logs will appear here.</p>
                    </div>
                  ) : (
                    "No logs found matching your filters"
                  )}
                </div>
              )}

              {filteredLogs?.map((log, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getLevelBadgeVariant(log.level)}>
                          {log.level.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.function_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {log.event_message}
                    </div>
                    
                    {log.details?.summary && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        {Object.entries(log.details.summary).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-medium">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {log.details?.fullLog && (
                      <div className="mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleLogExpansion(log.id)}
                          className="h-7 text-xs"
                        >
                          {expandedLogs.has(log.id) ? 'Hide Details' : 'View Full Log'}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {expandedLogs.has(log.id) && log.details?.fullLog && (
                    <div className="border-t bg-muted/30 p-3">
                      <pre className="text-xs whitespace-pre-wrap break-words font-mono overflow-x-auto">
                        {log.details.fullLog}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          
          {logs && logs.length >= limit && (
            <div className="flex justify-center pt-4">
              <Button onClick={() => setLimit(prev => prev + 100)} variant="outline">
                Load More Logs
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
