import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, AlertTriangle, CheckCircle, Trash2, Database, Check, Clock, Search } from 'lucide-react';
import { parseAISISScheduleTable, ParsedAISISSchedule } from '@/utils/aisisScheduleTableParser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScheduleImportJobs } from '@/components/admin/ScheduleImportJobs';

export function SchedulesManager() {
  const [inputText, setInputText] = useState('');
  const [termCode, setTermCode] = useState('');
  const [departmentOverride, setDepartmentOverride] = useState('');
  const [parsedData, setParsedData] = useState<ParsedAISISSchedule[]>([]);
  const [parseErrors, setParseErrors] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [filterTerm, setFilterTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch existing schedules
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['aisis-schedules', filterTerm, filterDepartment],
    queryFn: async () => {
      let query = supabase
        .from('aisis_schedules')
        .select('*')
        .eq('deprecated', false)
        .order('subject_code');

      if (filterTerm) {
        query = query.eq('term_code', filterTerm);
      }
      if (filterDepartment) {
        query = query.eq('import_source', filterDepartment);
      }

      // @ts-ignore - Supabase type inference depth
      const { data, error } = (await query.limit(100)) as any;
      if (error) throw error;
      return data;
    }
  });

  // Get unique terms and departments for filters from import jobs
  const { data: filterOptions } = useQuery({
    queryKey: ['aisis-schedules-filters'],
    queryFn: async () => {
      // Get departments from import jobs instead of individual schedules
      const { data: jobData, error: jobError } = await supabase
        .from('import_jobs')
        .select('term_code, department')
        .eq('job_type', 'schedule_import')
        .eq('status', 'completed');
      
      if (jobError) throw jobError;
      
      const terms = [...new Set(jobData?.map(d => d.term_code).filter(Boolean) || [])].sort();
      const departments = [...new Set(jobData?.map(d => d.department).filter(Boolean) || [])].sort();
      
      return { terms, departments };
    }
  });

  // Poll import job status
  const { data: currentJob } = useQuery({
    queryKey: ['import-job', currentJobId],
    queryFn: async () => {
      if (!currentJobId) return null;
      
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('id', currentJobId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'pending' || status === 'processing') {
        return 2000; // Poll every 2 seconds
      }
      return false; // Stop polling
    }
  });

  // Import mutation - calls edge function
  const importMutation = useMutation({
    mutationFn: async ({ schedules, replaceExisting }: { 
      schedules: ParsedAISISSchedule[];
      replaceExisting?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('import-schedules', {
        body: {
          term_code: metadata.term,
          department: metadata.department,
          schedules: schedules,
          replaceExisting: replaceExisting || false
        }
      });

      if (error) throw error;
      
      // Check if it's a duplicate
      if (data.existingJob) {
        return { isDuplicate: true, existingJob: data.existingJob };
      }
      
      return { isDuplicate: false, jobId: data.jobId };
    },
    onSuccess: (result) => {
      if (result.isDuplicate) {
        toast({
          title: 'Duplicate detected',
          description: `This dataset was already imported on ${new Date(result.existingJob.created_at).toLocaleDateString()}`,
          variant: 'default'
        });
      } else {
        setCurrentJobId(result.jobId);
        toast({
          title: 'Import started',
          description: 'Processing schedules in the background...'
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('aisis_schedules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Schedule deleted' });
      queryClient.invalidateQueries({ queryKey: ['aisis-schedules'] });
    }
  });

  const handleParse = () => {
    if (!inputText.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please provide schedule data',
        variant: 'destructive'
      });
      return;
    }

    setIsParsing(true);
    try {
      const result = parseAISISScheduleTable(inputText, termCode || undefined, departmentOverride || undefined);
      setParsedData(result.schedules);
      setParseErrors(result.errors);
      setMetadata(result.metadata);
      
      if (result.schedules.length > 0) {
        toast({
          title: 'Parsing complete',
          description: `Found ${result.schedules.length} courses, ${result.errors.length} issues`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Parsing failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = () => {
    if (!metadata) return;
    importMutation.mutate({ schedules: parsedData });
  };

  const handleReplace = () => {
    if (!metadata) return;
    setShowReplaceDialog(false);
    importMutation.mutate({ schedules: parsedData, replaceExisting: true });
  };

  const handleClear = () => {
    setInputText('');
    setParsedData([]);
    setParseErrors([]);
    setMetadata(null);
    setCurrentJobId(null);
  };

  // Watch for job completion
  if (currentJob?.status === 'completed') {
    queryClient.invalidateQueries({ queryKey: ['aisis-schedules'] });
    queryClient.invalidateQueries({ queryKey: ['aisis-schedules-filters'] });
    queryClient.invalidateQueries({ queryKey: ['schedule-import-jobs'] });
    
    if (currentJobId) {
      toast({
        title: 'Import completed',
        description: `Successfully imported ${currentJob.schedules_processed} schedules`
      });
      handleClear();
    }
  } else if (currentJob?.status === 'failed') {
    if (currentJobId) {
      toast({
        title: 'Import failed',
        description: currentJob.error_message || 'Unknown error',
        variant: 'destructive'
      });
      setCurrentJobId(null);
    }
  }

  return (
    <div className="p-0 lg:p-6 lg:border lg:rounded-lg lg:bg-card">
      <div className="mb-4 lg:mb-6">
        <h3 className="text-lg font-semibold">Schedule Management</h3>
        <p className="text-sm text-muted-foreground">
          Import and manage AISIS course schedules
        </p>
      </div>
      
      <div>
        <Tabs defaultValue="import" className="w-full space-y-6">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-auto">
          <TabsTrigger value="import">
            <Upload className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Import</span>
          </TabsTrigger>
          <TabsTrigger value="manage">
            <Database className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Manage</span>
          </TabsTrigger>
          <TabsTrigger value="jobs">
            <Clock className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Jobs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-1">Import AISIS Schedule Data</h4>
              <p className="text-sm text-muted-foreground">
                Paste the entire AISIS schedule table (including headers). The system will automatically parse course information.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="termCode">
                    Term Code <span className="text-muted-foreground text-xs">(optional - will auto-detect)</span>
                  </Label>
                  <Input
                    id="termCode"
                    placeholder="e.g., 2024-2025-First Semester (leave blank to auto-detect)"
                    value={termCode}
                    onChange={(e) => setTermCode(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="deptOverride">
                    Department Override <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="deptOverride"
                    placeholder="Leave blank to auto-detect"
                    value={departmentOverride}
                    onChange={(e) => setDepartmentOverride(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    If blank and HTML shows "ALL INTERDISCIPLINARY ELECTIVES", each course will be categorized by its subject code
                  </p>
                </div>
              </div>

              <div>
                <Label>AISIS Schedule Data *</Label>
                <Textarea
                  placeholder="Paste AISIS schedule table here..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleParse} disabled={isParsing}>
                  {isParsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Upload className="mr-2 h-4 w-4" />
                  Parse Data
                </Button>
                {metadata && (
                  <>
                    <Button 
                      onClick={handleImport} 
                      disabled={importMutation.isPending || !!currentJobId}
                    >
                      {(importMutation.isPending || !!currentJobId) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {currentJobId ? 'Importing...' : parsedData.length > 0 ? `Import ${parsedData.length} Courses` : 'Import Department'}
                    </Button>
                    {parsedData.length > 0 && (
                      <Button 
                        variant="outline" 
                        onClick={() => setShowReplaceDialog(true)}
                        disabled={importMutation.isPending || !!currentJobId}
                      >
                        Replace Existing
                      </Button>
                    )}
                    <Button variant="ghost" onClick={handleClear}>
                      Clear
                    </Button>
                  </>
                )}
              </div>

              {metadata && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Check className="h-5 w-5 text-green-600" />
                      {metadata.total_courses > 0 ? 'Successfully Parsed' : 'Parse Complete - No Courses Found'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {metadata.total_courses === 0 && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          <div className="text-sm">
                            <strong>No courses were parsed.</strong> Please check your paste format. 
                            Try copying the full schedule table from AISIS.
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                    <Alert>
                      <AlertDescription>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Parsing Mode:</span>
                            <Badge variant="outline">{metadata.mode}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Detected Term:</span>
                            <Badge variant={metadata.detected_term ? "default" : "secondary"}>
                              {metadata.detected_term || "Not detected - using manual input"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Detected Department:</span>
                            <Badge variant={metadata.detected_department ? "default" : "secondary"}>
                              {metadata.detected_department || "Extracting from subject codes"}
                            </Badge>
                          </div>
                          {metadata.detected_department?.includes('ALL') && (
                            <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                              ℹ️ Department field shows "{metadata.detected_department}". 
                              Each course will be categorized by its subject code prefix (BIO, MATH, SCIED, etc.)
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-3 gap-4 p-3 bg-muted rounded-lg">
                      <div>
                        <p className="text-xs text-muted-foreground">Lines Processed</p>
                        <p className="text-lg font-semibold">{metadata.linesProcessed}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Schedules Found</p>
                        <p className="text-lg font-semibold text-green-600">{metadata.total_courses}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Rows Skipped</p>
                        <p className="text-lg font-semibold text-amber-600">{metadata.rowsSkipped}</p>
                      </div>
                    </div>
                    
                    {metadata.rowsSkipped > 0 && metadata.skippedRows && (
                      <Alert>
                        <AlertDescription>
                          <details>
                            <summary className="cursor-pointer font-semibold mb-2">
                              Skip Reasons ({metadata.rowsSkipped} rows)
                            </summary>
                            <div className="space-y-2 text-xs">
                              {Object.entries(
                                metadata.skippedRows.reduce((acc: Record<string, any[]>, skip: any) => {
                                  if (!acc[skip.reason]) acc[skip.reason] = [];
                                  if (acc[skip.reason].length < 3) {
                                    acc[skip.reason].push(skip);
                                  }
                                  return acc;
                                }, {})
                              ).map(([reason, skips]: [string, any[]]) => (
                                <div key={reason} className="space-y-1">
                                  <div className="flex justify-between">
                                    <span className="font-medium">{reason}</span>
                                    <Badge variant="outline" size="sm">{skips.length}</Badge>
                                  </div>
                                  {skips.slice(0, 2).map((skip: any, idx: number) => (
                                    <div key={idx} className="ml-4 text-xs text-muted-foreground font-mono">
                                      Line {skip.lineNo}: {skip.data}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </details>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="space-y-2">
                      <p className="text-sm"><strong>Final Term:</strong> {metadata.term}</p>
                      <p className="text-sm"><strong>Total Courses:</strong> {metadata.total_courses}</p>
                      
                      <div>
                        <p className="text-sm font-semibold mb-2">Courses by Department:</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(
                            parsedData.reduce((acc, s) => {
                              acc[s.department] = (acc[s.department] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>)
                          ).map(([dept, count]) => (
                            <Badge key={dept} variant="outline">
                              {dept}: {count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {parseErrors.length > 0 && (
                <Alert variant={parseErrors.some(e => e.type === 'error') ? 'destructive' : 'default'}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {parseErrors.length} Parsing Issue{parseErrors.length > 1 ? 's' : ''} Detected
                  </AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-2 text-sm">
                      {parseErrors.map((error, i) => (
                        <div 
                          key={i} 
                          className={`p-2 rounded border ${
                            error.type === 'error' 
                              ? 'bg-destructive/10 border-destructive/20' 
                              : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800/40'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="font-semibold">
                              {error.type === 'error' ? '❌' : '⚠️'}
                            </span>
                            <div className="flex-1">
                              <div className="font-medium">
                                {error.message}
                              </div>
                              {error.line && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Line {error.line}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {parsedData.length > 0 && (
                <div className="border rounded-lg p-4 max-h-[400px] overflow-auto">
                  <h4 className="font-semibold mb-2">Preview ({parsedData.length} courses)</h4>
                  <div className="space-y-2 text-sm">
                    {parsedData.slice(0, 10).map((schedule, i) => (
                      <div key={i} className="border-b pb-2">
                        <div className="font-medium">{schedule.subject_code} - {schedule.section}</div>
                        <div className="text-muted-foreground">
                          {schedule.time_pattern} • {schedule.room} • {schedule.instructor || 'TBA'}
                        </div>
                      </div>
                    ))}
                    {parsedData.length > 10 && (
                      <div className="text-muted-foreground">... and {parsedData.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold mb-1">Manage Schedules</h4>
                <p className="text-sm text-muted-foreground">View and manage imported course schedules</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['aisis-schedules'] });
                  queryClient.invalidateQueries({ queryKey: ['aisis-schedules-filters'] });
                  toast({ title: 'Refreshing schedules...' });
                }}
              >
                <Database className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by course, title, instructor, room..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterTerm || "all"} onValueChange={(val) => setFilterTerm(val === "all" ? "" : val)}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Filter by term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {filterOptions?.terms.map(term => (
                    <SelectItem key={term} value={term}>{term}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterDepartment || "all"} onValueChange={(val) => setFilterDepartment(val === "all" ? "" : val)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {filterOptions?.departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject Code</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Instructor</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules?.filter(schedule => {
                      if (!searchQuery.trim()) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        schedule.subject_code.toLowerCase().includes(query) ||
                        schedule.course_title.toLowerCase().includes(query) ||
                        schedule.section.toLowerCase().includes(query) ||
                        (schedule.instructor?.toLowerCase().includes(query) || false) ||
                        schedule.room.toLowerCase().includes(query)
                      );
                    }).map(schedule => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">{schedule.subject_code}</TableCell>
                        <TableCell>{schedule.section}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{schedule.course_title}</TableCell>
                        <TableCell className="text-sm">{schedule.time_pattern}</TableCell>
                        <TableCell>{schedule.room}</TableCell>
                        <TableCell>{schedule.instructor || 'TBA'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" size="sm">{schedule.term_code}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(schedule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {schedules?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    No schedules found. Import some data to get started.
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <ScheduleImportJobs />
        </TabsContent>
      </Tabs>

      <AlertDialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Existing Schedules?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deprecate all existing schedules for <strong>{metadata?.department}</strong> in <strong>{metadata?.term}</strong> and replace them with the new data.
              <br /><br />
              Students with schedules referencing the old data will see a warning badge.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReplace}>
              Replace Schedules
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
