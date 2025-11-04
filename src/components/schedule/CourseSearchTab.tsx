import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { SearchFilters } from './SearchFilters';
import { SearchResults } from './SearchResults';
import { SavedSearches } from './SavedSearches';
import { useAISISSearch, ScheduleBlock } from '@/hooks/useAISISSearch';
import { Database } from '@/integrations/supabase/types';
import { toast } from '@/hooks/use-toast';

type AISISSchedule = Database['public']['Tables']['aisis_schedules']['Row'];

interface CourseSearchTabProps {
  currentTerm: string;
  currentScheduleBlocks: ScheduleBlock[];
  onAddCourse: (course: AISISSchedule) => Promise<void>;
}

export function CourseSearchTab({
  currentTerm,
  currentScheduleBlocks,
  onAddCourse,
}: CourseSearchTabProps) {
  const { searchCourses } = useAISISSearch();
  
  const [instructorQuery, setInstructorQuery] = useState('');
  const [roomQuery, setRoomQuery] = useState('');
  const [courseCodeQuery, setCourseCodeQuery] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTimeAfter, setStartTimeAfter] = useState('');
  const [endTimeBefore, setEndTimeBefore] = useState('');
  const [excludeConflicting, setExcludeConflicting] = useState(false);
  
  const [results, setResults] = useState<AISISSchedule[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Clear results when term changes
  useEffect(() => {
    setResults([]);
    setHasSearched(false);
  }, [currentTerm]);

  const handleSearch = async () => {
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const filters = {
        instructorQuery,
        roomQuery,
        courseCodeQuery,
        days: selectedDays.length > 0 ? selectedDays : undefined,
        startTimeAfter: startTimeAfter || undefined,
        endTimeBefore: endTimeBefore || undefined,
        termCode: currentTerm,
        excludeConflicting,
        currentScheduleBlocks,
      };

      const data = await searchCourses(filters);
      setResults(data);
      
      if (data.length === 0) {
        toast({
          title: 'No results found',
          description: 'Try adjusting your search filters.',
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search failed',
        description: 'An error occurred while searching. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearAll = () => {
    setInstructorQuery('');
    setRoomQuery('');
    setCourseCodeQuery('');
    setSelectedDays([]);
    setStartTimeAfter('');
    setEndTimeBefore('');
    setExcludeConflicting(false);
    setResults([]);
    setHasSearched(false);
  };

  const handleLoadSavedSearch = (filters: any) => {
    setInstructorQuery(filters.instructorQuery || '');
    setRoomQuery(filters.roomQuery || '');
    setCourseCodeQuery(filters.courseCodeQuery || '');
    setSelectedDays(filters.selectedDays || []);
    setStartTimeAfter(filters.startTimeAfter || '');
    setEndTimeBefore(filters.endTimeBefore || '');
    setExcludeConflicting(filters.excludeConflicting || false);
  };

  const currentFilters = {
    instructorQuery,
    roomQuery,
    courseCodeQuery,
    selectedDays,
    startTimeAfter,
    endTimeBefore,
    excludeConflicting,
  };

  return (
    <div className="mt-4 space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-2">Course Search</h2>
        <p className="text-muted-foreground">
          Search the AISIS database by instructor, time, room, or course code to find the perfect sections for your schedule.
        </p>
      </div>

      <SearchFilters
        instructorQuery={instructorQuery}
        setInstructorQuery={setInstructorQuery}
        roomQuery={roomQuery}
        setRoomQuery={setRoomQuery}
        courseCodeQuery={courseCodeQuery}
        setCourseCodeQuery={setCourseCodeQuery}
        selectedDays={selectedDays}
        setSelectedDays={setSelectedDays}
        startTimeAfter={startTimeAfter}
        setStartTimeAfter={setStartTimeAfter}
        endTimeBefore={endTimeBefore}
        setEndTimeBefore={setEndTimeBefore}
        excludeConflicting={excludeConflicting}
        setExcludeConflicting={setExcludeConflicting}
        onClearAll={handleClearAll}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={handleSearch} disabled={isSearching}>
          <Search className="h-4 w-4 mr-2" />
          {isSearching ? 'Searching...' : 'Search Courses'}
        </Button>

        <SavedSearches
          currentFilters={currentFilters}
          onLoadSearch={handleLoadSavedSearch}
        />
      </div>

      {hasSearched && (
        <SearchResults
          results={results}
          currentScheduleBlocks={currentScheduleBlocks}
          onAddCourse={onAddCourse}
          isLoading={isSearching}
        />
      )}
    </div>
  );
}
