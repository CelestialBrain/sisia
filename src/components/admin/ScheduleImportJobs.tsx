import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function ScheduleImportJobs() {
  const queryClient = useQueryClient();

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('cleanup_stale_import_jobs');
      if (error) throw error;
      return data;
    },
    onSuccess: (cleanedCount) => {
      if (cleanedCount > 0) {
        toast({
          title: "Cleanup Complete",
          description: `Marked ${cleanedCount} stale job(s) as failed`,
        });
      } else {
        toast({
          title: "No Stale Jobs",
          description: "All jobs are up to date",
        });
      }
      queryClient.invalidateQueries({ queryKey: ['schedule-import-jobs'] });
    },
    onError: (error) => {
      toast({
        title: "Cleanup Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('import_jobs')
        .delete()
        .eq('id', jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Job Deleted",
        description: "Import job has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ['schedule-import-jobs'] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['schedule-import-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('job_type', 'schedule_import')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      // Filter out stale "processing" jobs (older than 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const filteredData = data?.filter(job => {
        if (job.status === 'processing') {
          const jobTime = new Date(job.started_at || job.created_at);
          return jobTime > fiveMinutesAgo;
        }
        return true;
      });
      
      return filteredData;
    },
    refetchInterval: (query) => {
      // Refetch every 2 seconds if there are pending/processing jobs
      const hasPendingJobs = query.state.data?.some(
        job => job.status === 'pending' || job.status === 'processing'
      );
      return hasPendingJobs ? 2000 : false;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No import jobs found. Import schedules will appear here.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Recent Import Jobs</h3>
          <p className="text-sm text-muted-foreground">
            Track the status of your schedule imports
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => cleanupMutation.mutate()}
          disabled={cleanupMutation.isPending}
        >
          {cleanupMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          Clean Up Stale Jobs
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Schedules</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="text-sm">
                  {format(new Date(job.created_at), 'MMM d, yyyy HH:mm')}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {job.term_code}
                </TableCell>
                <TableCell className="text-sm">
                  {job.department}
                </TableCell>
                <TableCell>
                  <StatusBadge status={job.status} />
                </TableCell>
                <TableCell>
                  {job.status === 'processing' || job.status === 'pending' ? (
                    <div className="space-y-1 min-w-[120px]">
                      <Progress value={job.progress || 0} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {job.schedules_processed || 0} / {job.total_schedules || 0}
                      </p>
                    </div>
                  ) : job.status === 'completed' ? (
                    <span className="text-sm text-muted-foreground">100%</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {job.status === 'completed' 
                    ? job.schedules_processed || job.total_schedules 
                    : job.total_schedules || '—'}
                </TableCell>
                <TableCell className="text-right">
                  {(job.status === 'failed' || job.status === 'completed') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(job.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {jobs.some(job => job.status === 'failed' && job.error_message) && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Recent Errors:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              {jobs
                .filter(job => job.status === 'failed' && job.error_message)
                .slice(0, 3)
                .map(job => (
                  <li key={job.id}>
                    {job.term_code} - {job.department}: {job.error_message}
                  </li>
                ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: any; icon: any; label: string }> = {
    pending: {
      variant: 'secondary',
      icon: Clock,
      label: 'Pending'
    },
    processing: {
      variant: 'default',
      icon: Loader2,
      label: 'Processing'
    },
    completed: {
      variant: 'default',
      icon: CheckCircle,
      label: 'Completed'
    },
    failed: {
      variant: 'destructive',
      icon: XCircle,
      label: 'Failed'
    }
  };

  const config = variants[status] || variants.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}
