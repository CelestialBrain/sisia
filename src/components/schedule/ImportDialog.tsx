import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle2, AlertCircle, Info, Copy } from 'lucide-react';
import { parseAISISSchedule, ParsedScheduleBlock, DebugInfo } from '@/utils/aisisScheduleParser';
import { extractCoursesFromAISIS, CourseInfo } from '@/utils/courseFrequencyDetector';
import { useToast } from '@/hooks/use-toast';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  existingBlocks: Array<{ course_code: string; color: string }>;
  onSuccess: () => Promise<void>;
}

interface ParseDiagnostics {
  totalBlocks: number;
  uniqueCourses: number;
  tbaSchedules: ParsedScheduleBlock[];
  normalSchedules: ParsedScheduleBlock[];
}

export function ImportDialog({ open, onOpenChange, scheduleId, existingBlocks, onSuccess }: ImportDialogProps) {
  const [pastedText, setPastedText] = useState('');
  const [extractedCourses, setExtractedCourses] = useState<CourseInfo[]>([]);
  const [parsedBlocks, setParsedBlocks] = useState<ParsedScheduleBlock[]>([]);
  const [diagnostics, setDiagnostics] = useState<ParseDiagnostics | null>(null);
  const [debugData, setDebugData] = useState<DebugInfo | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleParse = () => {
    try {
      setError(null);
      const result = parseAISISSchedule(pastedText, true);
      const blocks = result.blocks;
      const courses = extractCoursesFromAISIS(blocks);
      
      setDebugData(result.debug);
      
      // Analyze blocks for diagnostics
      const tbaSchedules = blocks.filter(b => 
        b.startTime === '00:00' && b.endTime === '00:00'
      );
      const normalSchedules = blocks.filter(b => 
        !(b.startTime === '00:00' && b.endTime === '00:00')
      );
      
      setParsedBlocks(blocks);
      setExtractedCourses(courses);
      setDiagnostics({
        totalBlocks: blocks.length,
        uniqueCourses: courses.length,
        tbaSchedules,
        normalSchedules
      });
      setShowPreview(true);
      
      toast({
        title: "Parse Complete",
        description: `Found ${blocks.length} schedule blocks → ${courses.length} unique courses`,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to parse schedule. Please check format.');
      toast({
        title: "Parse Failed",
        description: err.message || 'Failed to parse schedule',
        variant: "destructive",
      });
    }
  };

  const mapDayToNumber = (day: string | number): number => {
    if (typeof day === 'number') return day;
    const dayMap: Record<string, number> = {
      'Mon': 1, 'Monday': 1,
      'Tue': 2, 'Tuesday': 2,
      'Wed': 3, 'Wednesday': 3,
      'Thu': 4, 'Thursday': 4, 'Thur': 4,
      'Fri': 5, 'Friday': 5,
      'Sat': 6, 'Saturday': 6,
    };
    return dayMap[day] || 1;
  };

  const handleImport = async () => {
    try {
      setIsImporting(true);
      
      const { supabase } = await import('@/integrations/supabase/client');
      const { assignColor } = await import('@/utils/colorAssignment');
      
      // Filter out TBA/invalid blocks
      const validBlocks = parsedBlocks.filter(b => 
        b.startTime !== '00:00' && b.endTime !== '00:00'
      );
      
      // Group blocks by course to assign consistent colors
      const colorMap = new Map<string, string>();
      validBlocks.forEach(block => {
        if (!colorMap.has(block.courseCode)) {
          colorMap.set(block.courseCode, assignColor(block.courseCode, existingBlocks));
        }
      });
      
      // Map parsed blocks to database format
      const blocksToInsert = validBlocks.map(block => ({
        schedule_id: scheduleId,
        course_code: block.courseCode,
        course_title: block.courseCode, // Parser doesn't provide course title, use code
        section: block.section || '',
        room: block.room || 'TBA',
        instructor: null,
        day_of_week: typeof block.day === 'number' ? block.day : mapDayToNumber(block.day),
        start_time: block.startTime.length === 5 ? `${block.startTime}:00` : block.startTime,
        end_time: block.endTime.length === 5 ? `${block.endTime}:00` : block.endTime,
        color: colorMap.get(block.courseCode)!,
        palette_item_id: null,
        aisis_schedule_id: null,
        is_auto_filled: false,
      }));
      
      // Insert all blocks in a single transaction
      const { error } = await supabase
        .from('schedule_blocks')
        .insert(blocksToInsert);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Added ${blocksToInsert.length} class blocks to your schedule`,
      });
      
      await onSuccess();
      onOpenChange(false);
      
      // Reset state
      setPastedText('');
      setExtractedCourses([]);
      setParsedBlocks([]);
      setDiagnostics(null);
      setDebugData(null);
      setShowPreview(false);
      setError(null);
    } catch (err: any) {
      console.error('Import error:', err);
      toast({
        title: "Import Failed",
        description: err.message || 'Failed to add classes to schedule',
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleBack = () => {
    setShowPreview(false);
    setError(null);
  };

  const copyDebugReport = () => {
    if (!debugData) return;
    const report = JSON.stringify(debugData, null, 2);
    navigator.clipboard.writeText(report);
    toast({
      title: "Copied",
      description: "Debug report copied to clipboard",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Import Courses from AISIS</DialogTitle>
          <DialogDescription>
            Copy your entire AISIS schedule and we'll add all classes directly to your schedule grid
          </DialogDescription>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Go to AISIS → My Class Schedule</li>
                  <li>Press Ctrl+A (or Cmd+A on Mac) to select all</li>
                  <li>Press Ctrl+C (or Cmd+C) to copy</li>
                  <li>Paste below and we'll extract your courses</li>
                </ol>
              </AlertDescription>
            </Alert>

            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your AISIS schedule here (Ctrl+V)..."
              className="min-h-[400px] font-mono text-xs"
            />

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleParse} disabled={!pastedText}>
              Extract Courses
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="preview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="debug">Debug Report</TabsTrigger>
              <TabsTrigger value="raw">Raw Input</TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="space-y-4">
              {/* Diagnostic Summary */}
              {diagnostics && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Parse Results</AlertTitle>
                <AlertDescription className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Schedule blocks found: <strong>{diagnostics.totalBlocks}</strong></div>
                    <div>Unique courses: <strong>{diagnostics.uniqueCourses}</strong></div>
                    <div>Normal schedules: <strong>{diagnostics.normalSchedules.length}</strong></div>
                    <div>TBA/Tutorial schedules: <strong>{diagnostics.tbaSchedules.length}</strong></div>
                  </div>
                  
                  {diagnostics.tbaSchedules.length > 0 && (
                    <div className="mt-3 p-2 bg-muted rounded text-xs">
                      <div className="font-semibold mb-1">⚠️ Unparseable Time Patterns:</div>
                      {diagnostics.tbaSchedules.map((block, i) => (
                        <div key={i} className="ml-2">
                          • <strong>{block.courseCode} {block.section}</strong>: "{block.room}" → Created as TBA placeholder (00:00-00:00)
                        </div>
                      ))}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Found {extractedCourses.length} unique courses. These will be added to your course palette.
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Code</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Day</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedBlocks.map((block, i) => {
                    const isTBA = block.startTime === '00:00' && block.endTime === '00:00';
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{block.courseCode}</TableCell>
                        <TableCell>{block.section}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{block.room}</TableCell>
                        <TableCell>
                          <Badge variant={isTBA ? "outline" : "default"}>
                            {isTBA ? 'TBA' : 'Normal'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {isTBA ? 'TBA' : `${block.startTime}-${block.endTime}`}
                        </TableCell>
                        <TableCell>{block.day}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex gap-2">
              <Button onClick={handleBack} variant="outline">
                Back
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? 'Loading...' : `Load to Palette`}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="debug" className="space-y-4">
            {debugData && (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Parsing Debug Report</h3>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => {
                        const dataStr = JSON.stringify(debugData, null, 2);
                        const blob = new Blob([dataStr], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `aisis-debug-${Date.now()}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }} 
                      variant="outline" 
                      size="sm"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Download JSON
                    </Button>
                    <Button onClick={copyDebugReport} variant="outline" size="sm">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Report
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[500px]">
                  <Accordion type="multiple" defaultValue={["raw-analysis"]} className="w-full">
                    <AccordionItem value="raw-analysis">
                      <AccordionTrigger>📊 Raw Input Analysis</AccordionTrigger>
                      <AccordionContent className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded">
                          <div>Total lines: <strong>{debugData.rawAnalysis.totalLines}</strong></div>
                          <div>Header found: <strong>Line {debugData.rawAnalysis.headerLine}</strong></div>
                          <div>Time slot groups: <strong>{debugData.rawAnalysis.timeSlotGroups}</strong></div>
                          <div>Format: <Badge variant={debugData.rawAnalysis.usesTabSeparator ? "default" : "outline"}>
                            {debugData.rawAnalysis.usesTabSeparator ? 'Tab-separated ✓' : 'Space-separated'}
                          </Badge></div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded text-xs font-mono">
                          <div className="text-muted-foreground mb-1">Header content:</div>
                          {debugData.rawAnalysis.headerContent}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="column-extraction">
                      <AccordionTrigger>🔍 Column Extraction ({debugData.columnExtractions.length} time slots)</AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <div className="text-xs text-muted-foreground mb-2">
                          Showing first 10 time slots. {debugData.columnExtractions.length > 10 ? `${debugData.columnExtractions.length - 10} more available in JSON download.` : ''}
                        </div>
                        <ScrollArea className="h-[300px]">
                          {debugData.columnExtractions.slice(0, 10).map((extraction, idx) => (
                            <div key={idx} className="mb-4 p-3 bg-muted rounded text-xs">
                              <div className="font-semibold mb-2">⏰ {extraction.timeSlot}</div>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-muted-foreground">Raw lines ({extraction.rawLines.length}):</span>
                                  <div className="font-mono bg-background p-2 rounded mt-1 max-h-20 overflow-auto">
                                    {extraction.rawLines.map((line, i) => (
                                      <div key={i} className="truncate">{line || '(empty)'}</div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Columns with content:</span>
                                  <div className="flex gap-1 mt-1">
                                    {extraction.cellsWithContent.map(colIdx => (
                                      <Badge key={colIdx} variant="outline" className="text-xs">
                                        Col {colIdx}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {debugData.columnExtractions.length > 10 && (
                            <div className="text-center text-muted-foreground text-xs mt-2">
                              ...and {debugData.columnExtractions.length - 10} more time slots
                            </div>
                          )}
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="validation">
                      <AccordionTrigger>✅ Course Code Validation ({debugData.validationResults.length} cells evaluated)</AccordionTrigger>
                      <AccordionContent className="space-y-2">
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-1">
                            {debugData.validationResults.map((validation, idx) => {
                              const icon = validation.result === 'accepted' ? '✅' : 
                                          validation.result === 'rejected' ? '❌' : '⚠️';
                              const colorClass = validation.result === 'accepted' ? 'text-green-600' : 
                                                validation.result === 'rejected' ? 'text-red-600' : 'text-muted-foreground';
                              return (
                                <div key={idx} className={`p-2 rounded text-xs ${colorClass} bg-muted/30`}>
                                  <div className="flex items-start gap-2">
                                    <span>{icon}</span>
                                    <div className="flex-1">
                                      <div className="font-semibold">
                                        {validation.dayName} {validation.timeRange}
                                      </div>
                                      {validation.cellContent && (
                                        <div className="font-mono mt-1">"{validation.cellContent}"</div>
                                      )}
                                      <div className="text-xs mt-1 opacity-80">
                                        {validation.reason}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="issues">
                      <AccordionTrigger>⚠️ Common Issues ({debugData.commonIssues.length})</AccordionTrigger>
                      <AccordionContent className="space-y-2">
                        {debugData.commonIssues.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            No common issues detected ✓
                          </div>
                        ) : (
                          debugData.commonIssues.map((issue, idx) => (
                            <Alert key={idx} variant={issue.severity === 'error' ? 'destructive' : 'default'}>
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle className="text-sm">
                                {issue.type.toUpperCase()} {issue.severity === 'error' ? 'ERROR' : 'WARNING'}
                              </AlertTitle>
                              <AlertDescription className="text-xs">
                                {issue.message}
                                {issue.lineNumbers.length > 0 && (
                                  <div className="mt-1">Lines: {issue.lineNumbers.join(', ')}</div>
                                )}
                              </AlertDescription>
                            </Alert>
                          ))
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </ScrollArea>

                <div className="flex gap-2">
                  <Button onClick={handleBack} variant="outline">
                    Back
                  </Button>
                  <Button onClick={handleImport} disabled={isImporting}>
                    {isImporting ? 'Adding...' : 'Add to Schedule'}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="raw" className="space-y-4">
            <ScrollArea className="h-[500px]">
              <div className="font-mono text-xs whitespace-pre-wrap bg-muted p-4 rounded">
                {pastedText}
              </div>
            </ScrollArea>
            
            <div className="flex gap-2">
              <Button onClick={handleBack} variant="outline">
                Back
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? 'Adding...' : 'Add to Schedule'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
