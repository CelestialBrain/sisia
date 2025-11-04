import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PaletteItem {
  id: string;
  course_code: string;
  course_title: string;
  section: string | null;
  required_count: number;
  placed_count: number;
  is_manual: boolean;
  color: string;
}

interface DatabaseCourse {
  id: string;
  course_code: string;
  course_title: string;
  units: number;
}

interface CoursePaletteProps {
  items: PaletteItem[];
  onAddCustomCourse: () => void;
  onImportAISIS: () => void;
  onSearchDatabase: (query: string) => Promise<DatabaseCourse[]>;
  onAddFromDatabase: (course: DatabaseCourse) => Promise<void>;
  onDeletePaletteItem: (itemId: string) => Promise<void>;
}

export function CoursePalette({ items, onAddCustomCourse, onImportAISIS, onSearchDatabase, onAddFromDatabase, onDeletePaletteItem }: CoursePaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [databaseCourses, setDatabaseCourses] = useState<DatabaseCourse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const filteredItems = items.filter(item =>
    item.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.course_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Debounced database search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setDatabaseCourses([]);
      setShowSearchResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await onSearchDatabase(searchQuery);
        setDatabaseCourses(results);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Failed to search courses:', error);
        setDatabaseCourses([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, onSearchDatabase]);

  const handleAddCourse = async (course: DatabaseCourse) => {
    await onAddFromDatabase(course);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  return (
    <div className="bg-card pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-1">
          <Popover open={showSearchResults && searchQuery.length > 0}>
            <PopoverTrigger asChild>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length > 0 && setShowSearchResults(true)}
                  className="pl-8 h-9"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 z-50" align="start">
              <ScrollArea className="max-h-96">
                <div className="p-2">
                  {filteredItems.length > 0 && (
                    <div className="mb-2">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Your Courses ({filteredItems.length})
                      </div>
                      {filteredItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm"
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium">{item.course_code}</span>
                          <span className="text-muted-foreground truncate text-xs">
                            {item.course_title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {isSearching && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      Searching...
                    </div>
                  )}
                  
                  {!isSearching && databaseCourses.length > 0 && (
                    <div>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Add from Database ({databaseCourses.length})
                      </div>
                      {databaseCourses.map((course) => (
                        <button
                          key={course.id}
                          onClick={() => handleAddCourse(course)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-primary/10 transition-colors"
                        >
                          <Plus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{course.course_code}</span>
                          <span className="text-muted-foreground truncate text-xs">
                            {course.course_title}
                          </span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {course.units}u
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {!isSearching && searchQuery && filteredItems.length === 0 && databaseCourses.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No courses found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Badge variant="secondary" className="h-9 text-sm font-semibold shrink-0">
            <span className="sm:hidden">{items.length}</span>
            <span className="hidden sm:inline">{items.length} {items.length === 1 ? 'course' : 'courses'}</span>
          </Badge>
        </div>
        
        <div className="flex gap-2 ml-auto">
          <Button size="sm" onClick={onImportAISIS} className="h-9">
            Import AISIS
          </Button>
          <Button size="sm" onClick={onAddCustomCourse} className="h-9">
            <Plus className="h-4 w-4 mr-1" />
            Add Course
          </Button>
        </div>
      </div>
    </div>
  );
}
