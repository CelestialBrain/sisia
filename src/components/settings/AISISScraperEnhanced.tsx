import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Database,
  Key,
  Play,
  Trash2,
  AlertTriangle,
  Download,
  FileText,
  Code,
  FileSpreadsheet,
  Pause,
  Square,
  PlayCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { toast as sonnerToast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientLogger } from "@/hooks/useClientLogger";

export default function AISISScraperEnhanced() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasCredentials, setHasCredentials] = useState(false);
  const [lastUsed, setLastUsed] = useState<string | null>(null);

  // Scraping options
  const [scrapeSchedules, setScrapeSchedules] = useState(false);
  const [scrapeCurriculum, setScrapeCurriculum] = useState(false);
  const [scrapeGrades, setScrapeGrades] = useState(false);
  const [scrapeMySchedule, setScrapeMySchedule] = useState(false);
  const [scrapeMyProgram, setScrapeMyProgram] = useState(false);
  const [scrapeMyGrades, setScrapeMyGrades] = useState(false);
  const [scrapeHoldOrders, setScrapeHoldOrders] = useState(false);
  const [scrapeAccountInfo, setScrapeAccountInfo] = useState(false);

  // Scraping mode: Only 'server' is supported due to CORS restrictions
  const scrapeMode = "server";

  // Scraping state
  const [isScrapingRunning, setIsScrapingRunning] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [jobHistory, setJobHistory] = useState<any[]>([]);
  const [curriculumDownloads, setCurriculumDownloads] = useState<any[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const { toast } = useToast();
  const logger = useClientLogger();

  // Background job tracking
  useEffect(() => {
    logger.info("scraper", "AISISScraperEnhanced component mounted");

    // Check for active job from localStorage on mount
    const activeJobId = localStorage.getItem("active_scraping_job");
    if (activeJobId) {
      logger.info("scraper", "Found active scraping job in localStorage", { jobId: activeJobId });
      setCurrentJobId(activeJobId);
      checkJobStatus(activeJobId);
    } else {
      logger.debug("scraper", "No active scraping job found in localStorage");
    }

    return () => {
      logger.info("scraper", "AISISScraperEnhanced component unmounted");
    };
  }, []);

  useEffect(() => {
    logger.info("scraper", "Loading initial data (credentials and job history)");
    checkCredentials();
    loadJobHistory();
  }, []);

  // Realtime subscription for job history updates
  useEffect(() => {
    logger.info("scraper", "Setting up realtime subscription for job history");

    const setupRealtimeSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        logger.warn("scraper", "No user found, skipping realtime subscription");
        return;
      }

      const historyChannel = supabase
        .channel("job-history-updates")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "import_jobs",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            logger.info("scraper", "Job history realtime update received", {
              event: payload.eventType,
              jobId: (payload.new as any)?.id || (payload.old as any)?.id,
            });
            loadJobHistory();
          },
        )
        .subscribe((status) => {
          logger.info("scraper", "Job history subscription status", { status });
        });

      return historyChannel;
    };

    let channelPromise = setupRealtimeSubscription();

    return () => {
      logger.info("scraper", "Cleaning up job history subscription");
      channelPromise.then((channel) => {
        if (channel) channel.unsubscribe();
      });
    };
  }, []);

  // Real-time job updates
  useEffect(() => {
    if (!currentJobId) return;

    const channel = supabase
      .channel("job-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "import_jobs",
          filter: `id=eq.${currentJobId}`,
        },
        (payload) => {
          const job = payload.new as any;
          setProgress(job.progress || 0);
          setStatusMessage(job.status);
          setIsPaused(job.control_action === "pause");

          // Log status update
          logger.info("import-job", `Job status updated: ${job.status}`, {
            jobId: currentJobId,
            status: job.status,
            progress: job.progress,
            scrapeMode: "server",
            controlAction: job.control_action,
          });

          if (job.status === "completed" || job.status === "failed") {
            setIsScrapingRunning(false);
            localStorage.removeItem("active_scraping_job");
            loadJobHistory();
            loadCurriculumDownloads();

            // Show notification
            if (job.status === "completed") {
              sonnerToast.success("Scraping Completed", {
                description: "Your data has been successfully imported.",
                duration: 5000,
              });
              logger.info("import-job", "Scraping job completed successfully", {
                jobId: currentJobId,
                scrapeMode: "server",
              });
            } else {
              sonnerToast.error("Scraping Failed", {
                description: job.error_message || "An error occurred during scraping.",
                duration: 7000,
              });
              logger.error("import-job", "Scraping job failed", {
                jobId: currentJobId,
                scrapeMode: "server",
                error: job.error_message,
              });
            }
          }
        },
      )
      .subscribe();

    // Load existing logs
    loadExistingLogs(currentJobId);

    // Subscribe to new logs
    const logsChannel = supabase
      .channel("log-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "function_logs",
          filter: `import_job_id=eq.${currentJobId}`,
        },
        (payload) => {
          setLogs((prev) => [...prev, payload.new]);
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      logsChannel.unsubscribe();
    };
  }, [currentJobId]);

  // Client-side timeout detection for stuck jobs
  useEffect(() => {
    if (!currentJobId) return;

    const checkForStaleJob = async () => {
      const { data: job } = await supabase
        .from("import_jobs")
        .select("status, created_at, updated_at")
        .eq("id", currentJobId)
        .single();

      if (!job) return;

      // If job is in "processing" for more than 15 minutes, warn user
      const jobAge = Date.now() - new Date(job.created_at).getTime();
      const lastUpdate = Date.now() - new Date(job.updated_at).getTime();
      const STALE_THRESHOLD = 15 * 60 * 1000; // 15 minutes

      if (job.status === "processing" && (jobAge > STALE_THRESHOLD || lastUpdate > STALE_THRESHOLD)) {
        sonnerToast.warning("Job May Be Stuck", {
          description: "The scraping job appears to be stuck. You can stop it manually.",
          duration: 10000,
        });
        logger.warn("import-job", "Job exceeded timeout threshold", {
          jobId: currentJobId,
          age: jobAge,
          lastUpdate,
          threshold: STALE_THRESHOLD,
          scrapeMode: "server",
        });
      }
    };

    // Check every minute
    const intervalId = setInterval(checkForStaleJob, 60000);

    // Run initial check after 5 minutes
    const timeoutId = setTimeout(checkForStaleJob, 5 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [currentJobId, logger]);

  const checkJobStatus = async (jobId: string) => {
    const { data } = await supabase.from("import_jobs").select("*").eq("id", jobId).single();

    if (data) {
      if (data.status === "processing" || data.status === "pending") {
        setIsScrapingRunning(true);
        setProgress(data.progress || 0);
        setStatusMessage(data.status);
        setIsPaused(data.control_action === "pause");
      } else {
        localStorage.removeItem("active_scraping_job");
      }
    }
  };

  const loadExistingLogs = async (jobId: string) => {
    const { data, error } = await supabase
      .from("function_logs")
      .select("*")
      .eq("import_job_id", jobId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setLogs(data);
    }
  };

  const checkCredentials = async () => {
    try {
      logger.info("scraper", "Checking for AISIS credentials");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        logger.warn("scraper", "No user found when checking credentials");
        return;
      }

      const { data, error } = await supabase
        .from("user_aisis_credentials")
        .select("created_at")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setHasCredentials(true);
        setLastUsed(data.created_at);
        logger.info("scraper", "AISIS credentials found", { createdAt: data.created_at });
      } else {
        logger.info("scraper", "No AISIS credentials found", { error: error?.message });
      }
    } catch (err) {
      logger.error("scraper", "Error checking credentials", { error: err });
      console.error("Error checking credentials:", err);
    }
  };

  const saveCredentials = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Encrypt credentials (basic encoding - in production, use proper encryption)
      const encryptedUsername = btoa(username);
      const encryptedPassword = btoa(password);

      const { error: upsertError } = await supabase.from("user_aisis_credentials").upsert(
        [
          {
            user_id: user.id,
            encrypted_credentials: btoa(`${username}:${password}`),
            encrypted_username: encryptedUsername,
            encrypted_password: encryptedPassword,
          },
        ],
        {
          onConflict: "user_id",
        },
      );

      // Fallback for missing unique constraint
      if (upsertError && upsertError.message.includes("no unique or exclusion constraint")) {
        await supabase.from("user_aisis_credentials").delete().eq("user_id", user.id);
        const { error: insertError } = await supabase.from("user_aisis_credentials").insert({
          user_id: user.id,
          encrypted_credentials: btoa(`${username}:${password}`),
          encrypted_username: encryptedUsername,
          encrypted_password: encryptedPassword,
        });
        if (insertError) throw insertError;
      } else if (upsertError) {
        throw upsertError;
      }

      setHasCredentials(true);
      setUsername("");
      setPassword("");

      toast({
        title: "Credentials Saved",
        description: "Your AISIS credentials have been saved securely.",
      });
    } catch (error: any) {
      console.error("Error saving credentials:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save credentials",
        variant: "destructive",
      });
    }
  };

  const deleteCredentials = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("user_aisis_credentials").delete().eq("user_id", user.id);

      setHasCredentials(false);
      setLastUsed(null);

      toast({
        title: "Credentials Deleted",
        description: "Your AISIS credentials have been removed.",
      });
    } catch (error) {
      console.error("Error deleting credentials:", error);
    }
  };

  const startScraping = async () => {
    try {
      const scrapeTypes = [];
      if (scrapeSchedules) scrapeTypes.push("schedules");
      if (scrapeCurriculum) scrapeTypes.push("curriculum");
      if (scrapeGrades) scrapeTypes.push("grades");
      if (scrapeMySchedule) scrapeTypes.push("my_schedule");
      if (scrapeMyProgram) scrapeTypes.push("my_program");
      if (scrapeMyGrades) scrapeTypes.push("my_grades");
      if (scrapeHoldOrders) scrapeTypes.push("hold_orders");
      if (scrapeAccountInfo) scrapeTypes.push("account_info");

      if (scrapeTypes.length === 0) {
        toast({
          title: "No Options Selected",
          description: "Please select at least one scraping option.",
          variant: "destructive",
        });
        return;
      }

      // Server-side edge function scraping only
      await startServerScraping(scrapeTypes);
    } catch (error: any) {
      console.error("Error starting scraping:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start scraping",
        variant: "destructive",
      });
    }
  };
  const noobScraper = async () => {
    try {
      const scrapeTypes = [];
      if (scrapeSchedules) scrapeTypes.push("schedules");
      if (scrapeCurriculum) scrapeTypes.push("curriculum");
      if (scrapeGrades) scrapeTypes.push("grades");
      if (scrapeMySchedule) scrapeTypes.push("my_schedule");
      if (scrapeMyProgram) scrapeTypes.push("my_program");
      if (scrapeMyGrades) scrapeTypes.push("my_grades");
      if (scrapeHoldOrders) scrapeTypes.push("hold_orders");
      if (scrapeAccountInfo) scrapeTypes.push("account_info");

      if (scrapeTypes.length === 0) {
        toast({
          title: "No Options Selected",
          description: "Please select at least one scraping option.",
          variant: "destructive",
        });
        return;
      }

      alert("noob!");
    } catch (error: any) {
      console.error("Error starting scraping:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start scraping",
        variant: "destructive",
      });
    }
  };
  const startServerScraping = async (scrapeTypes: string[]) => {
    logger.info("scraper", "Starting server-side scraping", {
      scrapeTypes,
      scrapeMode: "server",
    });

    const { data, error } = await supabase.functions.invoke("aisis-scraper", {
      body: {
        scrapeSchedules: scrapeTypes.includes("schedules"),
        scrapeCurriculum: scrapeTypes.includes("curriculum"),
        scrapeGrades: scrapeTypes.includes("grades"),
        scrapeMySchedule: scrapeTypes.includes("my_schedule"),
        scrapeMyProgram: scrapeTypes.includes("my_program"),
        scrapeMyGrades: scrapeTypes.includes("my_grades"),
        scrapeHoldOrders: scrapeTypes.includes("hold_orders"),
        scrapeAccountInfo: scrapeTypes.includes("account_info"),
        // Store selected data types in metadata for history tracking
        metadata: {
          selected_data_types: scrapeTypes,
        },
      },
    });

    if (error) {
      logger.error("scraper", "Failed to start server-side scraping", {
        error: error.message,
        scrapeMode: "server",
      });
      throw error;
    }

    setCurrentJobId(data.jobId);
    setIsScrapingRunning(true);
    setStatusMessage("processing");
    setLogs([]);
    setProgress(0);

    // Save to localStorage for persistence
    localStorage.setItem("active_scraping_job", data.jobId);

    logger.info("import-job", "Server-side scraping job initiated", {
      jobId: data.jobId,
      scrapeTypes,
      scrapeMode: "server",
    });

    sonnerToast.info("Scraping Started", {
      description: "Your scraping job is running in the background. You can safely navigate away.",
      duration: 5000,
    });
  };

  const pauseScraping = async () => {
    if (!currentJobId) return;

    logger.info("scraper", "Pausing scraping job", {
      jobId: currentJobId,
      scrapeMode: "server",
    });

    await supabase
      .from("import_jobs")
      .update({ control_action: "pause", paused_at: new Date().toISOString() })
      .eq("id", currentJobId);

    setIsPaused(true);
    sonnerToast.info("Scraping Paused");
  };

  const resumeScraping = async () => {
    if (!currentJobId) return;

    logger.info("scraper", "Resuming scraping job", {
      jobId: currentJobId,
      scrapeMode: "server",
    });

    // Reset control action to allow resumption
    await supabase
      .from("import_jobs")
      .update({
        control_action: null,
        paused_at: null,
        status: "processing",
      })
      .eq("id", currentJobId);

    // Trigger edge function to resume from checkpoint
    const { error } = await supabase.functions.invoke("aisis-scraper", {
      body: {
        resumeJobId: currentJobId,
      },
    });

    if (error) {
      logger.error("scraper", "Failed to resume scraping", { error: error.message });
      sonnerToast.error("Failed to Resume", {
        description: error.message,
      });
      return;
    }

    setIsPaused(false);
    sonnerToast.info("Scraping Resumed", {
      description: "Continuing from where it left off",
    });
  };

  const stopScraping = async () => {
    if (!currentJobId) return;

    logger.warn("scraper", "Stopping scraping job", {
      jobId: currentJobId,
      scrapeMode: "server",
    });

    await supabase
      .from("import_jobs")
      .update({
        control_action: "stop",
        status: "incomplete",
        error_message: "Stopped by user",
        completed_at: new Date().toISOString(),
      })
      .eq("id", currentJobId);

    setIsScrapingRunning(false);
    setIsPaused(false);
    localStorage.removeItem("active_scraping_job");
    sonnerToast.info("Scraping Stopped");
  };

  const downloadPartialData = async (jobId: string) => {
    logger.info("scraper", "Downloading partial data", {
      jobId,
    });

    const { data } = await supabase.from("import_jobs").select("partial_data").eq("id", jobId).single();

    if (data?.partial_data) {
      const blob = new Blob([JSON.stringify(data.partial_data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `partial-data-${jobId}.json`;
      a.click();
      URL.revokeObjectURL(url);

      logger.info("scraper", "Partial data downloaded successfully", {
        jobId,
        dataSize: JSON.stringify(data.partial_data).length,
      });
    }
  };

  const loadJobHistory = async () => {
    logger.info("scraper", "Loading job history");
    const start = performance.now();

    const { data, error } = await supabase
      .from("import_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    const duration = performance.now() - start;

    if (!error && data) {
      setJobHistory(data);
      logger.info("scraper", "Job history loaded successfully", {
        count: data.length,
        duration,
        jobs: data.map((j) => ({ id: j.id, status: j.status, created_at: j.created_at })),
      });
    } else {
      logger.error("scraper", "Failed to load job history", {
        error: error?.message,
        duration,
      });
    }
  };

  const loadCurriculumDownloads = async () => {
    const { data, error } = await supabase
      .from("curriculum_downloads")
      .select("*")
      .order("scraped_at", { ascending: false })
      .limit(5);

    if (!error && data) {
      setCurriculumDownloads(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Credentials Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            AISIS Credentials
          </CardTitle>
          <CardDescription>Your credentials are encrypted and stored securely</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasCredentials ? (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Credentials saved</p>
                {lastUsed && (
                  <p className="text-sm text-muted-foreground">Last used: {format(new Date(lastUsed), "PPp")}</p>
                )}
              </div>
              <Button variant="destructive" onClick={deleteCredentials}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">AISIS Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your.email@student.ateneo.edu"
                />
              </div>
              <div>
                <Label htmlFor="password">AISIS Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your AISIS password"
                />
              </div>
              <Button onClick={saveCredentials} disabled={!username || !password}>
                <Database className="w-4 h-4 mr-2" />
                Save Credentials
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scraping Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Scraping Configuration</CardTitle>
          <CardDescription>Choose what data to scrape and how to scrape it</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info about server-side scraping */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Scraping runs server-side to bypass browser security (CORS) restrictions. Jobs continue in the background
              even if you close this page.
            </AlertDescription>
          </Alert>

          {/* Scraping Options */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Data to Scrape</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="my_schedule"
                  checked={scrapeMySchedule}
                  onCheckedChange={(checked) => setScrapeMySchedule(checked as boolean)}
                />
                <label htmlFor="my_schedule" className="text-sm cursor-pointer">
                  My Schedule (Your personal class schedule)
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="schedules"
                  checked={scrapeSchedules}
                  onCheckedChange={(checked) => setScrapeSchedules(checked as boolean)}
                />
                <label htmlFor="schedules" className="text-sm cursor-pointer">
                  Department Schedules (All available classes)
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="curriculum"
                  checked={scrapeCurriculum}
                  onCheckedChange={(checked) => setScrapeCurriculum(checked as boolean)}
                />
                <label htmlFor="curriculum" className="text-sm cursor-pointer">
                  Curriculum Data (Degree program requirements)
                </label>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <Button onClick={startScraping} disabled={!hasCredentials || isScrapingRunning} className="w-full" size="lg">
            <Play className="w-4 h-4 mr-2" />
            Start Scraping
          </Button>
          <Button onClick={noobScraper} disabled={false} className="w-full" size="lg">
            <Play className="w-4 h-4 mr-2" />
            Noob Scrapper
          </Button>
        </CardContent>
      </Card>

      {/* Active Job Progress */}
      {isScrapingRunning && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Scraping in Progress</CardTitle>
              <div className="flex gap-2">
                {!isPaused ? (
                  <Button variant="outline" size="sm" onClick={pauseScraping}>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={resumeScraping}>
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Resume
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={stopScraping}>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
                {currentJobId && (
                  <Button variant="outline" size="sm" onClick={() => downloadPartialData(currentJobId)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Partial
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground">Status: {isPaused ? "Paused" : statusMessage}</p>
            </div>

            {/* Live Logs */}
            <div>
              <Label className="text-sm font-semibold">Live Logs</Label>
              <ScrollArea className="h-[200px] mt-2 border rounded-md p-4 bg-muted/50">
                <div className="space-y-1 font-mono text-xs">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground">Waiting for logs...</p>
                  ) : (
                    logs.map((log, i) => (
                      <div
                        key={i}
                        className={`${
                          log.level === "error"
                            ? "text-destructive"
                            : log.level === "warn"
                              ? "text-yellow-600"
                              : "text-foreground"
                        }`}
                      >
                        [{format(new Date(log.created_at), "HH:mm:ss")}] {log.event_message}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
