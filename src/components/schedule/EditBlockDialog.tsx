import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ScheduleBlock {
  id: string;
  course_code: string;
  section: string;
  room: string;
  instructor?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  color: string;
  font_color?: string | null;
  font_size?: string | null;
}

interface EditBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: ScheduleBlock | null;
  onUpdate: (blockId: string, updates: Partial<ScheduleBlock>, applyColorToAll: boolean) => void;
  isUpdating: boolean;
}

export function EditBlockDialog({ open, onOpenChange, block, onUpdate, isUpdating }: EditBlockDialogProps) {
  const { toast } = useToast();
  const [section, setSection] = useState("");
  const [room, setRoom] = useState("");
  const [instructor, setInstructor] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [color, setColor] = useState("#93C5FD");
  const [fontColor, setFontColor] = useState("#000000");
  const [fontSize, setFontSize] = useState("text-xs");
  const [applyColorToAll, setApplyColorToAll] = useState(false);

  useEffect(() => {
    if (block) {
      setSection(block.section || "");
      setRoom(block.room || "");
      setInstructor(block.instructor || "");
      setStartTime(block.start_time.slice(0, 5));
      setEndTime(block.end_time.slice(0, 5));
      setColor(block.color);
      setFontColor(block.font_color || "#000000");
      setFontSize(block.font_size || "text-xs");
      setApplyColorToAll(false);
    }
  }, [block]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!block) return;
    
    if (startTime >= endTime) {
      toast({ title: "End time must be after start time", variant: "destructive" });
      return;
    }

    onUpdate(
      block.id,
      {
        section: section.trim() || "N/A",
        room: room.trim() || "TBD",
        instructor: instructor.trim() || "TBD",
        start_time: startTime,
        end_time: endTime,
        color,
        font_color: fontColor,
        font_size: fontSize,
      },
      applyColorToAll
    );
  };

  if (!block) return null;

  const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>
              {block.course_code} - {dayNames[block.day_of_week]}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="e.g., A3"
                  disabled={isUpdating}
                />
              </div>
              <div>
                <Label htmlFor="room">Room</Label>
                <Input
                  id="room"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g., SEC-A210"
                  disabled={isUpdating}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="instructor">Instructor</Label>
              <Input
                id="instructor"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="e.g., GARCIA, Maria"
                disabled={isUpdating}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isUpdating}
                  className="max-w-full"
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={isUpdating}
                  className="max-w-full"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="color">Background Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-10"
                  disabled={isUpdating}
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#93C5FD"
                  disabled={isUpdating}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="fontColor">Font Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="fontColor"
                  type="color"
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                  className="w-16 h-10"
                  disabled={isUpdating}
                />
                <Input
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                  placeholder="#000000"
                  disabled={isUpdating}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="fontSize">Font Size</Label>
              <Select value={fontSize} onValueChange={setFontSize} disabled={isUpdating}>
                <SelectTrigger id="fontSize" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text-xs">Extra Small</SelectItem>
                  <SelectItem value="text-sm">Small</SelectItem>
                  <SelectItem value="text-base">Medium</SelectItem>
                  <SelectItem value="text-lg">Large</SelectItem>
                  <SelectItem value="text-xl">Extra Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="applyToAll"
                checked={applyColorToAll}
                onCheckedChange={(checked) => setApplyColorToAll(checked as boolean)}
                disabled={isUpdating}
              />
              <Label htmlFor="applyToAll" className="cursor-pointer font-normal text-sm">
                Apply color to all blocks for {block.course_code} in this schedule
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
