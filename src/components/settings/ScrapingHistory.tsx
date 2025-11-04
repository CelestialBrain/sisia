import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Download, FileText, Calendar, Clock, Database, AlertCircle, CheckCircle, XCircle, FileJson, FileCode, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ScrapingJob {
  id: string;
  job_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  started_at: string | null;
  program_name: string | null;
  term_code: string | null;
  department: string | null;
  error_message: string | null;
  progress: number;
  partial_data: any;
}

interface DataCounts {
  my_schedule: number;
  my_grades: number;
  my_program: number;
  curriculum: number;
  schedules: number;
  account_info: number;
  hold_orders: number;
  logs: number;
}

interface ScrapingJobWithCounts extends ScrapingJob {
  data_counts: DataCounts;
  selected_data_types: string[];
  duration: string | null;
}

export default function ScrapingHistory() {
  const [jobs, setJobs] = useState<ScrapingJobWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadHistory();

    // Set up real-time subscription for job updates
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      const channel = supabase
        .channel('import_jobs_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'import_jobs',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('[ScrapingHistory] Real-time update:', payload);
            loadHistory(); // Reload history when any job changes
          }
        )
        .subscribe();
    });

    // Cleanup function
    return () => {
      supabase.channel('import_jobs_changes').unsubscribe();
    };
  }, []);

  const loadHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[ScrapingHistory] No authenticated user');
        setLoading(false);
        return;
      }
      
      setLoading(true);

      console.log('[ScrapingHistory] Loading history for user:', user.id);
      const { data, error } = await supabase
        .from('import_jobs')
        .select('id, job_type, status, created_at, completed_at, started_at, program_name, term_code, department, error_message, progress, partial_data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[ScrapingHistory] Query error:', error);
        throw error;
      }
      
      console.log('[ScrapingHistory] Loaded jobs:', data?.length || 0);
      
      // Enrich jobs with data counts and metadata
      const enrichedJobs = await Promise.all((data || []).map(async (job) => {
        const dataCounts = await getDataCounts(job.id);
        const selectedTypes = getSelectedDataTypes(job);
        const duration = calculateDuration(job.started_at, job.completed_at);
        
        return {
          ...job,
          data_counts: dataCounts,
          selected_data_types: selectedTypes,
          duration
        } as ScrapingJobWithCounts;
      }));
      
      setJobs(enrichedJobs);
    } catch (error: any) {
      console.error('[ScrapingHistory] Error loading scraping history:', error);
      toast({
        title: "Error",
        description: "Failed to load scraping history: " + error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getDataCounts = async (jobId: string): Promise<DataCounts> => {
    try {
      // Query all data counts separately to avoid deep type inference issues
      const scheduleResult = await supabase.from('scraped_my_schedule').select('id', { count: 'exact', head: true }).eq('import_job_id', jobId);
      const gradesResult = await supabase.from('scraped_my_grades').select('id', { count: 'exact', head: true }).eq('import_job_id', jobId);
      const programResult = await supabase.from('scraped_my_program').select('id', { count: 'exact', head: true }).eq('import_job_id', jobId);
      const curriculumResult = await supabase.from('scraped_curriculum').select('id', { count: 'exact', head: true }).eq('import_job_id', jobId);
      const deptSchedulesResult = await (supabase as any).from('aisis_schedules').select('id', { count: 'exact', head: true }).eq('import_job_id', jobId);
      const accountResult = await supabase.from('scraped_account_info').select('id', { count: 'exact', head: true }).eq('import_job_id', jobId);
      const holdsResult = await supabase.from('scraped_hold_orders').select('id', { count: 'exact', head: true }).eq('import_job_id', jobId);
      const logsResult = await supabase.from('function_logs').select('id', { count: 'exact', head: true }).eq('import_job_id', jobId);

      return {
        my_schedule: scheduleResult.count || 0,
        my_grades: gradesResult.count || 0,
        my_program: programResult.count || 0,
        curriculum: curriculumResult.count || 0,
        schedules: deptSchedulesResult.count || 0,
        account_info: accountResult.count || 0,
        hold_orders: holdsResult.count || 0,
        logs: logsResult.count || 0
      };
    } catch (error) {
      console.error('[ScrapingHistory] Error getting data counts:', error);
      return {
        my_schedule: 0,
        my_grades: 0,
        my_program: 0,
        curriculum: 0,
        schedules: 0,
        account_info: 0,
        hold_orders: 0,
        logs: 0
      };
    }
  };

  const getSelectedDataTypes = (job: ScrapingJob): string[] => {
    // Try to get from partial_data metadata first
    if (job.partial_data?.selected_data_types) {
      return job.partial_data.selected_data_types;
    }
    
    // Fallback: return all possible types for aisis_scrape
    if (job.job_type === 'aisis_scrape') {
      return ['my_schedule', 'my_grades', 'my_program', 'curriculum', 'account_info', 'hold_orders'];
    }
    
    return [];
  };

  const calculateDuration = (startedAt: string | null, completedAt: string | null): string | null => {
    if (!startedAt || !completedAt) return null;
    
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    const durationMs = end - start;
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const downloadData = async (jobId: string, dataType: 'curriculum' | 'schedule' | 'grades' | 'program' | 'account' | 'holds' | 'logs', format: 'json' | 'html' = 'json') => {
    setDownloadingJobId(jobId);
    try {
      console.log(`[ScrapingHistory] Downloading ${dataType} for job ${jobId} as ${format}`);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let data: any[] = [];
      let filename = '';

      switch (dataType) {
        case 'curriculum':
          const { data: curriculum, error: currError } = await supabase
            .from('scraped_curriculum')
            .select('*')
            .eq('import_job_id', jobId);
          if (currError) throw currError;
          data = curriculum || [];
          filename = `curriculum-${jobId}`;
          break;

        case 'schedule':
          // Check if this is department schedules (aisis_schedules) or my schedule
          const { data: deptSchedules, error: deptSchedError } = await (supabase as any)
            .from('aisis_schedules')
            .select('*')
            .eq('import_job_id', jobId);
          
          if (!deptSchedError && deptSchedules && deptSchedules.length > 0) {
            data = deptSchedules;
            filename = `dept-schedules-${jobId}`;
          } else {
            const { data: mySchedule, error: schedError } = await supabase
              .from('scraped_my_schedule')
              .select('*')
              .eq('import_job_id', jobId);
            if (schedError) throw schedError;
            data = mySchedule || [];
            filename = `my-schedule-${jobId}`;
          }
          break;

        case 'grades':
          const { data: grades, error: gradesError } = await supabase
            .from('scraped_my_grades')
            .select('*')
            .eq('import_job_id', jobId);
          if (gradesError) throw gradesError;
          data = grades || [];
          filename = `grades-${jobId}`;
          break;

        case 'program':
          const { data: program, error: progError } = await supabase
            .from('scraped_my_program')
            .select('*')
            .eq('import_job_id', jobId);
          if (progError) throw progError;
          data = program || [];
          filename = `program-${jobId}`;
          break;

        case 'account':
          const { data: account, error: acctError } = await supabase
            .from('scraped_account_info')
            .select('*')
            .eq('import_job_id', jobId);
          if (acctError) throw acctError;
          data = account || [];
          filename = `account-${jobId}`;
          break;

        case 'holds':
          const { data: holds, error: holdsError } = await supabase
            .from('scraped_hold_orders')
            .select('*')
            .eq('import_job_id', jobId);
          if (holdsError) throw holdsError;
          data = holds || [];
          filename = `holds-${jobId}`;
          break;

        case 'logs':
          const { data: logs, error: logsError } = await supabase
            .from('function_logs')
            .select('*')
            .eq('import_job_id', jobId)
            .order('created_at', { ascending: true });
          if (logsError) throw logsError;
          data = logs || [];
          filename = `logs-${jobId}`;
          break;
      }

      console.log(`[ScrapingHistory] Retrieved ${data.length} records`);

      if (data.length === 0) {
        toast({
          title: "No Data",
          description: `No ${dataType} data found for this job`,
          variant: "default"
        });
        return;
      }

      // Create download based on format
      if (format === 'html') {
        // Extract HTML snapshots from raw_html fields
        const htmlContent = data.map((record, index) => {
          const rawHtml = record.raw_html || '';
          return `
            <!-- Record ${index + 1} -->
            <div style="border: 2px solid #ccc; margin: 20px 0; padding: 10px;">
              <h3>Record ${index + 1}</h3>
              <pre style="background: #f5f5f5; padding: 10px; overflow-x: auto;">${JSON.stringify(record, null, 2)}</pre>
              ${rawHtml ? `<hr><div>${rawHtml}</div>` : '<p>No raw HTML available</p>'}
            </div>
          `;
        }).join('\n');

        const fullHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>${dataType} - Job ${jobId}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; }
              pre { white-space: pre-wrap; word-wrap: break-word; }
            </style>
          </head>
          <body>
            <h1>${dataType.toUpperCase()} HTML Snapshots</h1>
            <p>Job ID: ${jobId}</p>
            <p>Total Records: ${data.length}</p>
            <p>Exported: ${new Date().toISOString()}</p>
            <hr>
            ${htmlContent}
          </body>
          </html>
        `;

        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // JSON format
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: "Download Complete",
        description: `Downloaded ${data.length} ${dataType} records as ${format.toUpperCase()}`,
      });
    } catch (error: any) {
      console.error('Error downloading data:', error);
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDownloadingJobId(null);
    }
  };

  const downloadAllData = async (jobId: string) => {
    setDownloadingJobId(jobId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch all data types
      const [curriculum, schedule, grades, program, account, holds, logs] = await Promise.all([
        supabase.from('scraped_curriculum').select('*').eq('import_job_id', jobId),
        supabase.from('scraped_my_schedule').select('*').eq('import_job_id', jobId),
        supabase.from('scraped_my_grades').select('*').eq('import_job_id', jobId),
        supabase.from('scraped_my_program').select('*').eq('import_job_id', jobId),
        supabase.from('scraped_account_info').select('*').eq('import_job_id', jobId),
        supabase.from('scraped_hold_orders').select('*').eq('import_job_id', jobId),
        supabase.from('function_logs').select('*').eq('import_job_id', jobId).order('created_at', { ascending: true })
      ]);

      const allData = {
        job_id: jobId,
        exported_at: new Date().toISOString(),
        curriculum: curriculum.data || [],
        schedule: schedule.data || [],
        grades: grades.data || [],
        program: program.data || [],
        account: account.data || [],
        holds: holds.data || [],
        logs: logs.data || []
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scraping-data-${jobId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalRecords = Object.values(allData).filter(v => Array.isArray(v)).reduce((sum, arr) => sum + arr.length, 0);
      toast({
        title: "Complete Export Downloaded",
        description: `Downloaded ${totalRecords} total records across all data types`,
      });
    } catch (error: any) {
      console.error('Error downloading all data:', error);
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDownloadingJobId(null);
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      console.log(`[ScrapingHistory] Deleting job ${jobId}`);
      
      const { error } = await supabase.functions.invoke('delete-scraping-job', {
        body: { jobIds: [jobId] }
      });

      if (error) throw error;

      toast({
        title: "Job Deleted",
        description: "Scraping job and all associated data have been deleted",
      });

      // Reload history
      await loadHistory();
    } catch (error: any) {
      console.error('Error deleting job:', error);
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'paused':
        return <Clock className="h-4 w-4 text-info" />;
      case 'incomplete':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

    const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"> = {
      completed: "success",
      failed: "destructive",
      processing: "warning",
      paused: "info",
      incomplete: "warning",
      pending: "outline"
    };
    return <Badge variant={variants[status] || "outline"}>{status.toUpperCase()}</Badge>;
  };

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const getDataTypeIcon = (dataType: string) => {
    const icons: Record<string, any> = {
      my_schedule: Calendar,
      my_grades: FileText,
      my_program: Database,
      curriculum: Database,
      schedules: Calendar,
      account_info: Database,
      hold_orders: AlertCircle,
      logs: FileText
    };
    return icons[dataType] || FileText;
  };

  const getDataTypeLabel = (dataType: string): string => {
    const labels: Record<string, string> = {
      my_schedule: 'My Schedule',
      my_grades: 'My Grades',
      my_program: 'My Program',
      curriculum: 'Curriculum',
      schedules: 'Department Schedules',
      account_info: 'Account Info',
      hold_orders: 'Hold Orders',
      logs: 'Logs'
    };
    return labels[dataType] || dataType;
  };

  const getJobTypeDisplay = (job: ScrapingJobWithCounts): string => {
    if (job.selected_data_types.length > 0) {
      const types = job.selected_data_types.slice(0, 2).map(getDataTypeLabel);
      const remaining = job.selected_data_types.length - 2;
      if (remaining > 0) {
        return `AISIS Scrape: ${types.join(', ')} +${remaining} more`;
      }
      return `AISIS Scrape: ${types.join(', ')}`;
    }
    
    // Detect from actual data
    const dataTypes = Object.entries(job.data_counts)
      .filter(([key, count]) => count > 0 && key !== 'logs')
      .map(([key]) => getDataTypeLabel(key));
    
    if (dataTypes.length > 0) {
      return `AISIS Scrape (${dataTypes.slice(0, 2).join(', ')}${dataTypes.length > 2 ? ` +${dataTypes.length - 2}` : ''})`;
    }
    
    return job.job_type === 'aisis_scrape' ? 'AISIS Data Scrape' : job.job_type;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scraping History</CardTitle>
          <CardDescription>Loading your scraping history...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Scraping History
        </CardTitle>
        <CardDescription>
          View and download data from your past scraping jobs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No scraping history yet</p>
            <p className="text-sm">Start a scraping job to see it here</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-3">
              {jobs.map((job) => {
                const isExpanded = expandedJobs.has(job.id);
                const hasAnyData = Object.values(job.data_counts).some(count => count > 0);
                
                return (
                  <Card key={job.id} className="border-border hover:border-primary/50 transition-colors">
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {/* Job Header - Clickable */}
                        <div 
                          className="flex items-start justify-between cursor-pointer"
                          onClick={() => toggleJobExpansion(job.id)}
                        >
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              {getStatusIcon(job.status)}
                              <h3 className="font-semibold text-sm">
                                {getJobTypeDisplay(job)}
                              </h3>
                              {getStatusBadge(job.status)}
                            </div>
                            
                            <div className="flex items-center gap-3 text-xs text-muted-foreground pl-6">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(job.created_at), 'MMM d, yyyy h:mm a')}
                              </span>
                              {job.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {job.duration}
                                </span>
                              )}
                            </div>

                            {/* Data Type Badges */}
                            <div className="flex gap-2 flex-wrap pl-6">
                              {Object.entries(job.data_counts)
                                .filter(([key, count]) => count > 0)
                                .map(([dataType, count]) => {
                                  const Icon = getDataTypeIcon(dataType);
                                  return (
                                    <Badge key={dataType} variant="outline" size="sm" className="gap-1">
                                      <Icon className="h-3 w-3" />
                                      {getDataTypeLabel(dataType)}: {count}
                                    </Badge>
                                  );
                                })}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="space-y-3 pl-6 pt-2 border-l-2 border-border ml-2">
                            {/* Job Metadata */}
                            {(job.program_name || job.term_code || job.department) && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Job Details</p>
                                <div className="flex gap-2 flex-wrap">
                                  {job.program_name && (
                                    <Badge variant="secondary" size="sm">{job.program_name}</Badge>
                                  )}
                                  {job.term_code && (
                                    <Badge variant="secondary" size="sm">Term: {job.term_code}</Badge>
                                  )}
                                  {job.department && (
                                    <Badge variant="secondary" size="sm">Dept: {job.department}</Badge>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Selected Data Types */}
                            {job.selected_data_types.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Selected Data Types</p>
                                <div className="flex gap-2 flex-wrap">
                                  {job.selected_data_types.map(dataType => {
                                    const Icon = getDataTypeIcon(dataType);
                                    const hasData = job.data_counts[dataType as keyof DataCounts] > 0;
                                    return (
                                      <Badge 
                                        key={dataType} 
                                        variant={hasData ? "success" : "outline"} 
                                        size="sm"
                                        className="gap-1"
                                      >
                                        <Icon className="h-3 w-3" />
                                        {getDataTypeLabel(dataType)}
                                        {hasData && <CheckCircle className="h-3 w-3" />}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Error Message */}
                            {job.error_message && (
                              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                                <p className="text-xs text-destructive flex items-start gap-2">
                                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span>{job.error_message}</span>
                                </p>
                              </div>
                            )}

                            <Separator />

                            {/* Download Actions - Only for data that exists */}
                            {hasAnyData && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Download Available Data</p>
                                 <div className="flex flex-wrap gap-2">
                                  {Object.entries(job.data_counts)
                                    .filter(([key, count]) => count > 0)
                                    .map(([dataType, count]) => {
                                      const Icon = getDataTypeIcon(dataType);
                                      return (
                                        <DropdownMenu key={dataType}>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              disabled={downloadingJobId === job.id}
                                              className="gap-1"
                                            >
                                              <Icon className="h-3 w-3" />
                                              {getDataTypeLabel(dataType)} ({count})
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => {
                                              const typeMap: Record<string, any> = {
                                                my_schedule: 'schedule',
                                                my_grades: 'grades',
                                                my_program: 'program',
                                                curriculum: 'curriculum',
                                                account_info: 'account',
                                                hold_orders: 'holds',
                                                logs: 'logs'
                                              };
                                              downloadData(job.id, typeMap[dataType], 'json');
                                            }}>
                                              <FileJson className="h-4 w-4 mr-2" />
                                              Download JSON
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                              const typeMap: Record<string, any> = {
                                                my_schedule: 'schedule',
                                                my_grades: 'grades',
                                                my_program: 'program',
                                                curriculum: 'curriculum',
                                                account_info: 'account',
                                                hold_orders: 'holds',
                                                logs: 'logs'
                                              };
                                              downloadData(job.id, typeMap[dataType], 'html');
                                            }}>
                                              <FileCode className="h-4 w-4 mr-2" />
                                              Download HTML Snapshot
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      );
                                    })}
                                  <Separator orientation="vertical" className="h-6" />
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => downloadAllData(job.id)}
                                    disabled={downloadingJobId === job.id}
                                    className="gap-1"
                                  >
                                    <Download className="h-3 w-3" />
                                    Download All ({Object.values(job.data_counts).reduce((a, b) => a + b, 0)})
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {!hasAnyData && job.status === 'completed' && (
                              <div className="text-xs text-muted-foreground italic">
                                No data was scraped for this job
                              </div>
                            )}
                            
                            {/* Delete Action */}
                            <div className="pt-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteJob(job.id)}
                                disabled={downloadingJobId === job.id}
                                className="gap-1"
                              >
                                <XCircle className="h-3 w-3" />
                                Delete Job & Data
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
