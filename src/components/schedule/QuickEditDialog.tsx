import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface QuickEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultData: {
    courseCode: string;
    courseTitle: string;
    section: string | null;
    day: number;
    startTime: string;
    color: string;
  };
  onConfirm: (data: {
    section: string;
    room: string;
    instructor: string;
    startTime: string;
    endTime: string;
    color: string;
  }) => void;
}

export function QuickEditDialog({ open, onOpenChange, defaultData, onConfirm }: QuickEditDialogProps) {
  const [section, setSection] = useState(defaultData.section || '');
  const [room, setRoom] = useState('');
  const [instructor, setInstructor] = useState('');
  const [duration, setDuration] = useState(1.5);
  const [color, setColor] = useState(defaultData.color);

  const calculateEndTime = (start: string, hours: number): string => {
    const [h, m] = start.split(':').map(Number);
    const totalMinutes = h * 60 + m + hours * 60;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const handleConfirm = () => {
    onConfirm({
      section,
      room,
      instructor,
      startTime: defaultData.startTime,
      endTime: calculateEndTime(defaultData.startTime, duration),
      color,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {defaultData.courseCode} to Schedule</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex gap-2">
              {[1, 1.5, 2, 3].map((hours) => (
                <Button
                  key={hours}
                  variant={duration === hours ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDuration(hours)}
                  className="flex-1"
                >
                  {hours}h
                </Button>
              ))}
            </div>
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
            <Label htmlFor="room">Room</Label>
            <Input
              id="room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g., F201"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructor">Instructor (Optional)</Label>
            <Input
              id="instructor"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="Instructor name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                id="color"
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
          <Button onClick={handleConfirm}>
            Add to Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
