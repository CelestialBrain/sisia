import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddCustomCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (course: {
    courseCode: string;
    courseTitle: string;
    section: string;
    color: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) => void;
  initialValues?: {
    courseCode?: string;
    courseTitle?: string;
    section?: string;
    color?: string;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
  };
}

export function AddCustomCourseDialog({ open, onOpenChange, onAdd, initialValues }: AddCustomCourseDialogProps) {
  const [courseCode, setCourseCode] = useState(initialValues?.courseCode || '');
  const [courseTitle, setCourseTitle] = useState(initialValues?.courseTitle || '');
  const [section, setSection] = useState(initialValues?.section || '');
  const [color, setColor] = useState(initialValues?.color || '#93C5FD');
  const [dayOfWeek, setDayOfWeek] = useState(String(initialValues?.dayOfWeek ?? 1)); // Monday
  const [startTime, setStartTime] = useState(initialValues?.startTime || '07:00');
  const [endTime, setEndTime] = useState(initialValues?.endTime || '08:30');

  // Update form when initialValues change
  useEffect(() => {
    if (initialValues) {
      setCourseCode(initialValues.courseCode || '');
      setCourseTitle(initialValues.courseTitle || '');
      setSection(initialValues.section || '');
      setColor(initialValues.color || '#93C5FD');
      setDayOfWeek(String(initialValues.dayOfWeek ?? 1));
      setStartTime(initialValues.startTime || '07:00');
      setEndTime(initialValues.endTime || '08:30');
    }
  }, [initialValues]);

  const handleSubmit = () => {
    if (!courseCode.trim() || !courseTitle.trim()) return;

    onAdd({
      courseCode: courseCode.toUpperCase().trim(),
      courseTitle: courseTitle.trim(),
      section: section.trim(),
      color,
      dayOfWeek: parseInt(dayOfWeek),
      startTime,
      endTime,
    });

    // Reset form
    setCourseCode('');
    setCourseTitle('');
    setSection('');
    setColor('#93C5FD');
    setDayOfWeek('1');
    setStartTime('07:00');
    setEndTime('08:30');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialValues ? 'Duplicate Course' : 'Add Custom Course'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="courseCode">Course Code *</Label>
            <Input
              id="courseCode"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="e.g., MATH 10"
              className="uppercase"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="courseTitle">Course Title *</Label>
            <Input
              id="courseTitle"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              placeholder="e.g., Calculus I"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="section">Section</Label>
            <Input
              id="section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g., A1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">Day of Week</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger>
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="2">Tuesday</SelectItem>
                <SelectItem value="3">Wednesday</SelectItem>
                <SelectItem value="4">Thursday</SelectItem>
                <SelectItem value="5">Friday</SelectItem>
                <SelectItem value="6">Saturday</SelectItem>
                <SelectItem value="0">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="max-w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="max-w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customColor">Color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                id="customColor"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#93C5FD"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!courseCode.trim() || !courseTitle.trim()}
          >
            {initialValues ? 'Duplicate Course' : 'Add Course'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
