import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface SearchFiltersProps {
  instructorQuery: string;
  setInstructorQuery: (value: string) => void;
  roomQuery: string;
  setRoomQuery: (value: string) => void;
  courseCodeQuery: string;
  setCourseCodeQuery: (value: string) => void;
  selectedDays: number[];
  setSelectedDays: (days: number[]) => void;
  startTimeAfter: string;
  setStartTimeAfter: (value: string) => void;
  endTimeBefore: string;
  setEndTimeBefore: (value: string) => void;
  excludeConflicting: boolean;
  setExcludeConflicting: (value: boolean) => void;
  onClearAll: () => void;
}

const dayOptions = [
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'TH', value: 4 },
  { label: 'F', value: 5 },
  { label: 'SAT', value: 6 },
];

export function SearchFilters({
  instructorQuery,
  setInstructorQuery,
  roomQuery,
  setRoomQuery,
  courseCodeQuery,
  setCourseCodeQuery,
  selectedDays,
  setSelectedDays,
  startTimeAfter,
  setStartTimeAfter,
  endTimeBefore,
  setEndTimeBefore,
  excludeConflicting,
  setExcludeConflicting,
  onClearAll,
}: SearchFiltersProps) {
  const toggleDay = (day: number) => {
    setSelectedDays(
      selectedDays.includes(day)
        ? selectedDays.filter(d => d !== day)
        : [...selectedDays, day]
    );
  };

  const getActiveFilters = () => {
    const filters: Array<{ label: string; onRemove: () => void }> = [];
    
    if (instructorQuery) {
      filters.push({
        label: `Instructor: ${instructorQuery}`,
        onRemove: () => setInstructorQuery(''),
      });
    }
    if (roomQuery) {
      filters.push({
        label: `Room: ${roomQuery}`,
        onRemove: () => setRoomQuery(''),
      });
    }
    if (courseCodeQuery) {
      filters.push({
        label: `Course: ${courseCodeQuery}`,
        onRemove: () => setCourseCodeQuery(''),
      });
    }
    if (selectedDays.length > 0) {
      const dayLabels = selectedDays
        .map(d => dayOptions.find(opt => opt.value === d)?.label)
        .join(', ');
      filters.push({
        label: `Days: ${dayLabels}`,
        onRemove: () => setSelectedDays([]),
      });
    }
    if (startTimeAfter) {
      filters.push({
        label: `After: ${startTimeAfter}`,
        onRemove: () => setStartTimeAfter(''),
      });
    }
    if (endTimeBefore) {
      filters.push({
        label: `Before: ${endTimeBefore}`,
        onRemove: () => setEndTimeBefore(''),
      });
    }
    if (excludeConflicting) {
      filters.push({
        label: 'Conflict-free only',
        onRemove: () => setExcludeConflicting(false),
      });
    }
    
    return filters;
  };

  const activeFilters = getActiveFilters();

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="course-code">Course Code / Title</Label>
              <Input
                id="course-code"
                placeholder="e.g., BIO 10, MATH"
                value={courseCodeQuery}
                onChange={(e) => setCourseCodeQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructor">Instructor</Label>
              <Input
                id="instructor"
                placeholder="e.g., Garcia"
                value={instructorQuery}
                onChange={(e) => setInstructorQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="room">Room / Building</Label>
              <Input
                id="room"
                placeholder="e.g., CTC, B-102"
                value={roomQuery}
                onChange={(e) => setRoomQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <div className="flex flex-wrap gap-2">
                {dayOptions.map(day => (
                  <Button
                    key={day.value}
                    variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleDay(day.value)}
                    className="min-w-[3rem]"
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Time Range</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="time"
                  placeholder="After"
                  value={startTimeAfter}
                  onChange={(e) => setStartTimeAfter(e.target.value)}
                  className="flex-1 max-w-[120px]"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="time"
                  placeholder="Before"
                  value={endTimeBefore}
                  onChange={(e) => setEndTimeBefore(e.target.value)}
                  className="flex-1 max-w-[120px]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center pt-2 border-t min-h-[48px]" >
            <div className="flex items-center space-x-2 flex-1">
              <Switch
                id="conflict-free"
                checked={excludeConflicting}
                onCheckedChange={setExcludeConflicting}
              />
              <Label htmlFor="conflict-free" className="cursor-pointer">
                Show only conflict-free courses
              </Label>
            </div>

            <div className="min-w-[80px] flex justify-end">
              {activeFilters.length > 0 && (
                <Button variant="ghost" size="sm" onClick={onClearAll} className="focus:outline-none focus:ring-0">
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {activeFilters.map((filter, idx) => (
            <Badge key={idx} variant="secondary" className="gap-1">
              {filter.label}
              <button
                onClick={filter.onRemove}
                className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
