import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Database } from '@/integrations/supabase/types';
import { hasConflictWithSchedule, ScheduleBlock } from '@/hooks/useAISISSearch';

type AISISSchedule = Database['public']['Tables']['aisis_schedules']['Row'];

interface SearchResultsProps {
  results: AISISSchedule[];
  currentScheduleBlocks: ScheduleBlock[];
  onAddCourse: (course: AISISSchedule) => void;
  isLoading?: boolean;
}

export function SearchResults({
  results,
  currentScheduleBlocks,
  onAddCourse,
  isLoading,
}: SearchResultsProps) {
  const [sortBy, setSortBy] = useState<keyof AISISSchedule>('subject_code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: keyof AISISSchedule) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const formatDays = (days: number[] | null) => {
    if (!days) return 'N/A';
    const dayMap: Record<number, string> = {
      1: 'M', 2: 'T', 3: 'W', 4: 'TH', 5: 'F', 6: 'SAT', 7: 'SUN'
    };
    return days.map(d => dayMap[d] || '?').join(', ');
  };

  const formatTime = (time: string | null) => {
    if (!time) return 'N/A';
    return time.slice(0, 5); // HH:MM
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Info className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No courses found</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Try adjusting your filters or search terms to find more results.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Found {results.length} course{results.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer w-[140px] md:w-[180px]" onClick={() => handleSort('subject_code')}>
                  Course {sortBy === 'subject_code' && (sortOrder === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('section')}>
                  Section {sortBy === 'section' && (sortOrder === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('room')}>
                  Room {sortBy === 'room' && (sortOrder === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('instructor')}>
                  Instructor {sortBy === 'instructor' && (sortOrder === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResults.map((course, idx) => {
                const hasConflict = hasConflictWithSchedule(course, currentScheduleBlocks);
                
                return (
                  <TableRow
                    key={`${course.id}-${idx}`}
                    className={hasConflict ? 'bg-destructive/5 border-l-4 border-l-destructive' : ''}
                  >
                    <TableCell className="font-medium w-[140px] md:w-[180px]">
                      <div>
                        <div>{course.subject_code}</div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs text-muted-foreground truncate max-w-[100px] md:max-w-[140px] cursor-help">
                                {course.course_title}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-[300px]">{course.course_title}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell>{course.section}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {formatDays(course.days_of_week)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatTime(course.start_time)} - {formatTime(course.end_time)}
                    </TableCell>
                    <TableCell>{course.room || 'TBA'}</TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {course.instructor || 'TBA'}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant={hasConflict ? 'destructive' : 'default'}
                              onClick={() => onAddCourse(course)}
                              className="w-full"
                            >
                              {hasConflict ? (
                                <>
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Add
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                          {hasConflict && (
                            <TooltipContent>
                              <p className="text-xs">
                                This course conflicts with your current schedule
                              </p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
