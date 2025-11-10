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
import { Database, Key, Play, Trash2, AlertTriangle, Download, FileText, Code, FileSpreadsheet } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { toast as sonnerToast } from "sonner";

export default function AISISScraper() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasCredentials, setHasCredentials] = useState(false);
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [scrapeSchedules, setScrapeSchedules] = useState(true);
  const [scrapeCurriculum, setScrapeCurriculum] = useState(false);
  const [scrapeGrades, setScrapeGrades] = useState(false);
  const [scrapeMySchedule, setScrapeMySchedule] = useState(false);
  const [scrapeMyProgram, setScrapeMyProgram] = useState(false);
  const [scrapeMyGrades, setScrapeMyGrades] = useState(false);
  const [scrapeHoldOrders, setScrapeHoldOrders] = useState(false);
  const [scrapeAccountInfo, setScrapeAccountInfo] = useState(false);
  const [isServerSide, setIsServerSide] = useState(true);
  const [isScrapingRunning, setIsScrapingRunning] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [jobHistory, setJobHistory] = useState<any[]>([]);
  const [curriculumDownloads, setCurriculumDownloads] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    checkCredentials();
    loadJobHistory();
  }, []);

  useEffect(() => {
    if (currentJobId) {
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

            if (job.status === "completed" || job.status === "failed") {
              setIsScrapingRunning(false);
              loadJobHistory();
              loadCurriculumDownloads();

              if (job.status === "completed") {
                toast({
                  title: "Scraping Completed",
                  description: "Your data has been successfully imported.",
                });
              } else {
                toast({
                  title: "Scraping Failed",
                  description: job.error_message || "An error occurred during scraping.",
                  variant: "destructive",
                });
              }
            }
          },
        )
        .subscribe();

      // Load existing logs first
      const loadExistingLogs = async () => {
        console.log("[SCRAPER UI] Loading existing logs for job:", currentJobId);
        const { data, error } = await supabase
          .from("function_logs")
          .select("*")
          .eq("import_job_id", currentJobId)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("[SCRAPER UI] Error loading existing logs:", error);
        } else if (data) {
          console.log("[SCRAPER UI] Loaded", data.length, "existing logs");
          setLogs(data);
        }
      };

      loadExistingLogs();

      const logsChannel = supabase
        .channel(`logs-${currentJobId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "function_logs",
            filter: `import_job_id=eq.${currentJobId}`,
          },
          (payload) => {
            console.log("[SCRAPER UI] New log received:", payload);
            const log = payload.new as any;
            setLogs((prev) => [...prev, log]);
          },
        )
        .subscribe((status) => {
          console.log("[SCRAPER UI] Logs subscription status:", status);
        });

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(logsChannel);
      };
    }
  }, [currentJobId]);

  const checkCredentials = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_aisis_credentials")
        .select("last_used_at")
        .eq("user_id", user.id)
        .single();

      if (data && !error) {
        setHasCredentials(true);
        setLastUsed(data.last_used_at);
      }
    } catch (error) {
      console.error("Error checking credentials:", error);
    }
  };

  const saveCredentials = async () => {
    if (!username || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter both username and password.",
        variant: "destructive",
      });
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Simple base64 encoding (in production, use proper encryption)
      const encryptedUsername = btoa(username);
      const encryptedPassword = btoa(password);

      const { error } = await supabase.from("user_aisis_credentials").upsert(
        [
          {
            user_id: user.id,
            encrypted_credentials: btoa(`${username}:${password}`),
            encrypted_username: encryptedUsername,
            encrypted_password: encryptedPassword,
            updated_at: new Date().toISOString(),
          },
        ],
        {
          onConflict: "user_id",
        },
      );

      if (error) throw error;

      setHasCredentials(true);
      setUsername("");
      setPassword("");

      toast({
        title: "Credentials Saved",
        description: "Your AISIS credentials have been saved securely.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteCredentials = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("user_aisis_credentials").delete().eq("user_id", user.id);

      if (error) throw error;

      setHasCredentials(false);
      setLastUsed(null);

      toast({
        title: "Credentials Deleted",
        description: "Your AISIS credentials have been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startScraping = async () => {
    if (!hasCredentials) {
      toast({
        title: "No Credentials",
        description: "Please save your AISIS credentials first.",
        variant: "destructive",
      });
      return;
    }

    if (
      !scrapeSchedules &&
      !scrapeCurriculum &&
      !scrapeGrades &&
      !scrapeMySchedule &&
      !scrapeMyProgram &&
      !scrapeMyGrades &&
      !scrapeHoldOrders &&
      !scrapeAccountInfo
    ) {
      toast({
        title: "No Data Selected",
        description: "Please select at least one type of data to scrape.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsScrapingRunning(true);
      setProgress(0);
      setStatusMessage("Starting...");
      setLogs([]);

      const { data, error } = await supabase.functions.invoke("aisis-scraper", {
        body: {
          scrapeSchedules,
          scrapeCurriculum,
          scrapeGrades,
          scrapeMySchedule,
          scrapeMyProgram,
          scrapeMyGrades,
          scrapeHoldOrders,
          scrapeAccountInfo,
        },
      });

      if (error) throw error;

      setCurrentJobId(data.jobId);

      toast({
        title: "Scraping Started",
        description: "Your data is being scraped. This may take a few minutes.",
      });
    } catch (error: any) {
      setIsScrapingRunning(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  const loadJobHistory = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("import_jobs")
        .select("*")
        .eq("user_id", user.id)
        .eq("job_type", "aisis_scrape")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setJobHistory(data || []);

      // Load curriculum downloads if any
      loadCurriculumDownloads();
    } catch (error) {
      console.error("Error loading job history:", error);
    }
  };

  const loadCurriculumDownloads = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // @ts-ignore - Supabase type inference depth
      const { data, error } = (await supabase
        .from("scraped_curriculum")
        .select("program_code, program_name, version_year, version_sem, scraped_at, import_job_id")
        .eq("user_id", user.id)
        .eq("is_placeholder", true)
        .order("scraped_at", { ascending: false })) as any;

      if (error) throw error;

      const grouped = data?.reduce((acc: any, curr: any) => {
        const key = `${curr.program_code}-${curr.version_year}-${curr.version_sem}`;
        if (!acc[key]) {
          acc[key] = { ...curr, course_count: 0 };
        }
        return acc;
      }, {});

      setCurriculumDownloads(Object.values(grouped || {}));
    } catch (error) {
      console.error("Error loading curriculum downloads:", error);
    }
  };

  const downloadJobLogs = async (job: any) => {
    try {
      const { data, error } = await supabase
        .from("function_logs")
        .select("*")
        .eq("import_job_id", job.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const logText = data
        .map(
          (log) =>
            `[${log.created_at}] [${log.level.toUpperCase()}] ${log.event_message}${log.details ? "\n  Details: " + JSON.stringify(log.details) : ""}`,
        )
        .join("\n\n");

      const blob = new Blob([logText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scrape-logs-${job.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      sonnerToast.success("Logs downloaded successfully");
    } catch (error: any) {
      console.error("Download error:", error);
      sonnerToast.error("Failed to download logs");
    }
  };

  const downloadJobJSON = async (job: any) => {
    try {
      // @ts-ignore - Supabase type inference depth
      const { data, error } = (await supabase
        .from("scraped_curriculum")
        .select("*")
        .eq("import_job_id", job.id)
        .eq("is_placeholder", false)) as any;

      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scrape-data-${job.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      sonnerToast.success("JSON downloaded successfully");
    } catch (error: any) {
      console.error("Download error:", error);
      sonnerToast.error("Failed to download JSON");
    }
  };

  const downloadJobCSV = async (job: any) => {
    try {
      const { data, error } = await supabase
        .from("scraped_curriculum")
        .select("*")
        .eq("import_job_id", job.id)
        .eq("is_placeholder", false);

      if (error) throw error;

      if (!data || data.length === 0) {
        sonnerToast.error("No course data available for CSV export");
        return;
      }

      const headers = [
        "Program Code",
        "Program Name",
        "Version Year",
        "Version Sem",
        "Course Code",
        "Course Title",
        "Units",
        "Year Level",
        "Semester",
        "Category",
        "Prerequisites",
      ];

      const rows = data.map((course) => [
        course.program_code,
        course.program_name,
        course.version_year,
        course.version_sem,
        course.course_code,
        course.course_title,
        course.units,
        course.year_level,
        course.semester,
        course.category,
        course.prerequisites || "",
      ]);

      const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scrape-data-${job.id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      sonnerToast.success("CSV downloaded successfully");
    } catch (error: any) {
      console.error("Download error:", error);
      sonnerToast.error("Failed to download CSV");
    }
  };

  const downloadJobHTML = async (job: any) => {
    try {
      const { data, error } = await supabase
        .from("scraped_curriculum")
        .select("raw_html")
        .eq("import_job_id", job.id)
        .eq("is_placeholder", true)
        .limit(1)
        .single();

      if (error) throw error;

      const blob = new Blob([data.raw_html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scrape-html-${job.id}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      sonnerToast.success("HTML downloaded successfully");
    } catch (error: any) {
      console.error("Download error:", error);
      sonnerToast.error("Failed to download HTML");
    }
  };

  return (
    <div className="space-y-4">
      {/* Warning Alert */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Testing Phase:</strong> This feature requires your AISIS credentials. Credentials are encrypted and
          stored securely. Automated scraping may violate AISIS Terms of Service. Use at your own risk.
        </AlertDescription>
      </Alert>

      {/* Credentials Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            AISIS Credentials
          </CardTitle>
          <CardDescription>
            {hasCredentials
              ? `Credentials saved${lastUsed ? `. Last used: ${format(new Date(lastUsed), "PPp")}` : ""}`
              : "Enter your AISIS username and password"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasCredentials ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your AISIS username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your AISIS password"
                />
              </div>
              <Button onClick={saveCredentials}>Save Credentials</Button>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="gap-1">
                <Database className="h-3 w-3" />
                Credentials Saved
              </Badge>
              <Button variant="destructive" size="sm" onClick={deleteCredentials}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Credentials
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scraping Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Scraping Configuration</CardTitle>
          <CardDescription>Select what data you want to scrape from AISIS</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Scraping Mode</Label>
              <p className="text-sm text-muted-foreground">
                {isServerSide ? "Server-side (Recommended)" : "Local (Bookmarklet)"}
              </p>
            </div>
            <Switch checked={isServerSide} onCheckedChange={setIsServerSide} />
          </div>
          {/* Data Selection */}
          <div className="space-y-6">
            {/* Public Data Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Public Data (No Login Required)</h3>
              <div className="space-y-3 ml-2 border-l-2 border-muted pl-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="curriculum"
                    checked={scrapeCurriculum}
                    onCheckedChange={(checked) => setScrapeCurriculum(checked as boolean)}
                  />
                  <Label htmlFor="curriculum" className="cursor-pointer font-normal">
                    Curriculum (Program Requirements)
                  </Label>
                </div>
              </div>
            </div>

            {/* Personal Data Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3">My Data (Requires Login)</h3>
              <div className="space-y-3 ml-2 border-l-2 border-primary/30 pl-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="schedules"
                    checked={scrapeSchedules}
                    onCheckedChange={(checked) => setScrapeSchedules(checked as boolean)}
                  />
                  <Label htmlFor="schedules" className="cursor-pointer font-normal">
                    Schedule of Classes (Course Offerings)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mySchedule"
                    checked={scrapeMySchedule}
                    onCheckedChange={(checked) => setScrapeMySchedule(checked as boolean)}
                  />
                  <Label htmlFor="mySchedule" className="cursor-pointer font-normal">
                    My Class Schedule (Enrolled Courses)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="myProgram"
                    checked={scrapeMyProgram}
                    onCheckedChange={(checked) => setScrapeMyProgram(checked as boolean)}
                  />
                  <Label htmlFor="myProgram" className="cursor-pointer font-normal">
                    My Program of Study (Curriculum Progress)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="myGrades"
                    checked={scrapeMyGrades}
                    onCheckedChange={(checked) => setScrapeMyGrades(checked as boolean)}
                  />
                  <Label htmlFor="myGrades" className="cursor-pointer font-normal">
                    My Advisory Grades (Grade Records)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="grades"
                    checked={scrapeGrades}
                    onCheckedChange={(checked) => setScrapeGrades(checked as boolean)}
                  />
                  <Label htmlFor="grades" className="cursor-pointer font-normal">
                    My Grades (Legacy Transcript)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="holdOrders"
                    checked={scrapeHoldOrders}
                    onCheckedChange={(checked) => setScrapeHoldOrders(checked as boolean)}
                  />
                  <Label htmlFor="holdOrders" className="cursor-pointer font-normal">
                    Hold Orders (Registration Blocks)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="accountInfo"
                    checked={scrapeAccountInfo}
                    onCheckedChange={(checked) => setScrapeAccountInfo(checked as boolean)}
                  />
                  <Label htmlFor="accountInfo" className="cursor-pointer font-normal">
                    Account Information (Profile Data)
                  </Label>
                </div>
              </div>
            </div>

            {/* Warning for personal data */}
            {(scrapeSchedules ||
              scrapeMySchedule ||
              scrapeMyProgram ||
              scrapeMyGrades ||
              scrapeGrades ||
              scrapeHoldOrders ||
              scrapeAccountInfo) && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Personal data scraping requires valid AISIS credentials saved above.
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          <Button onClick={startScraping} disabled={isScrapingRunning || !hasCredentials} className="w-full">
            <Play className="h-4 w-4 mr-2" />
            {isScrapingRunning ? "Scraping..." : "Start Scraping"}
          </Button>
          {!isServerSide && (
            <Button variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Generate Bookmarklet
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Progress Display */}
      {isScrapingRunning && (
        <Card>
          <CardHeader>
            <CardTitle>Scraping Progress</CardTitle>
            <CardDescription>{statusMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">{progress}% Complete</p>

            {/* Live Logs */}
            <div className="space-y-2">
              <Label>Live Logs</Label>
              <ScrollArea className="h-64 rounded-md border p-4">
                <div className="space-y-2">
                  {logs.map((log, i) => {
                    const metadata = log.metadata || {};
                    const isProgramLog = metadata.program_code;

                    return (
                      <div
                        key={i}
                        className={`text-xs ${isProgramLog ? "ml-4 border-l-2 border-primary/30 pl-2" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0">
                            [{new Date(log.created_at).toLocaleTimeString()}]
                          </span>
                          {isProgramLog && (
                            <Badge variant="outline" className="shrink-0 text-[10px] py-0">
                              {metadata.program_code}
                            </Badge>
                          )}
                          <span
                            className={
                              log.level === "error"
                                ? "text-destructive"
                                : log.level === "warn"
                                  ? "text-warning"
                                  : "text-foreground"
                            }
                          >
                            {log.event_message}
                          </span>
                        </div>
                        {metadata.progress && (
                          <div className="text-[10px] text-muted-foreground ml-[4.5rem]">
                            Progress: {metadata.progress}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job History */}
      <Card>
        <CardHeader>
          <CardTitle>Scraping History</CardTitle>
          <CardDescription>Recent scraping jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {jobHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No scraping history yet</p>
          ) : (
            <div className="space-y-2">
              {jobHistory.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          job.status === "completed"
                            ? "default"
                            : job.status === "failed"
                              ? "destructive"
                              : job.status === "processing"
                                ? "secondary"
                                : "outline"
                        }
                      >
                        {job.status}
                      </Badge>
                      <span className="text-sm font-medium">
                        {job.job_type.replace("aisis_", "").replace("_scrape", "")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(job.created_at), "PPp")}</p>
                    {job.courses_processed > 0 && (
                      <p className="text-xs text-muted-foreground">{job.courses_processed} courses processed</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-3">
                      <p className="text-sm font-medium">{job.progress}%</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadJobLogs(job)}>
                      <FileText className="h-3 w-3 mr-1" />
                      Logs
                    </Button>
                    {job.status === "completed" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => downloadJobJSON(job)}>
                          <Download className="h-3 w-3 mr-1" />
                          JSON
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadJobCSV(job)}>
                          <FileSpreadsheet className="h-3 w-3 mr-1" />
                          CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadJobHTML(job)}>
                          <Code className="h-3 w-3 mr-1" />
                          HTML
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Curriculum Downloads */}
      {curriculumDownloads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Curriculum Downloads
            </CardTitle>
            <CardDescription>Download scraped curriculum data per program</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {curriculumDownloads.map((program, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{program.program_code}</Badge>
                      <span className="text-sm font-medium">{program.program_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{program.course_count} courses</span>
                      <span>•</span>
                      <span>
                        Ver {program.version_year} Sem {program.version_sem}
                      </span>
                      <span>•</span>
                      <span>{format(new Date(program.scraped_at), "PPp")}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadJobJSON({ id: program.import_job_id, program_code: program.program_code })}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      JSON
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadJobHTML({ id: program.import_job_id, program_code: program.program_code })}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      HTML
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
