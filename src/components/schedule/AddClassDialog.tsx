import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Search, CheckCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface AddClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (classData: {
    courseCode: string;
    section: string;
    room: string;
    days: number[];
    startTime: string;
    endTime: string;
    color: string;
    instructor?: string;
    courseTitle?: string;
    aisisScheduleId?: string;
    isAutoFilled?: boolean;
  }) => void;
  isAdding: boolean;
  currentTerm?: string;
}

interface AISISSchedule {
  id: string;
  subject_code: string;
  section: string;
  course_title: string;
  time_pattern: string;
  room: string;
  instructor: string | null;
  department: string;
  days_of_week: string[];
  start_time: string;
  end_time: string;
}

export function AddClassDialog({ open, onOpenChange, onAdd, isAdding, currentTerm }: AddClassDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Manual entry state
  const [courseCode, setCourseCode] = useState("");
  const [section, setSection] = useState("");
  const [room, setRoom] = useState("");
  const [instructor, setInstructor] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:30");
  const [color, setColor] = useState("#93C5FD");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Auto-detection state
  const [searchRoom, setSearchRoom] = useState("");
  const [searchStartTime, setSearchStartTime] = useState("");
  const [searchEndTime, setSearchEndTime] = useState("");
  const [searchDays, setSearchDays] = useState<number[]>([]);
  const [searchAllDepts, setSearchAllDepts] = useState(false);
  const [selectedDept, setSelectedDept] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [matches, setMatches] = useState<AISISSchedule[]>([]);
  const [userDepartments, setUserDepartments] = useState<string[]>([]);
  const [allDepartments, setAllDepartments] = useState<string[]>([]);

  const days = [
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ];

  // Load user's departments and all available departments
  useEffect(() => {
    if (open && user) {
      loadUserDepartments();
      loadAllDepartments();
    }
  }, [open, user]);

  const loadUserDepartments = async () => {
    // For now, allow searching all departments
    // TODO: Implement proper user department filtering based on program
    setUserDepartments([]);
  };

  const loadAllDepartments = async () => {
    const { data } = await supabase
      .from('aisis_schedules')
      .select('department')
      .eq('deprecated', false);

    if (data) {
      const depts = [...new Set(data.map(d => d.department))];
      setAllDepartments(depts);
    }
  };

  const handleAutoDetect = async () => {
    if (!searchRoom && !searchStartTime) {
      toast({
        title: "Enter search criteria",
        description: "Provide at least room or time to search",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      let query = supabase
        .from('aisis_schedules')
        .select('*')
        .eq('deprecated', false);

      // Filter by term if available
      if (currentTerm) {
        query = query.eq('term_code', currentTerm);
      }

      // Filter by departments
      const deptsToSearch = searchAllDepts 
        ? (selectedDept ? [selectedDept] : allDepartments)
        : userDepartments;

      if (deptsToSearch.length > 0) {
        query = query.in('department', deptsToSearch);
      }

      // Room filter
      if (searchRoom.trim()) {
        query = query.ilike('room', `%${searchRoom.trim()}%`);
      }

      // Time filter (exact match)
      if (searchStartTime && searchEndTime) {
        query = query
          .eq('start_time', searchStartTime + ':00')
          .eq('end_time', searchEndTime + ':00');
      }

      // Days filter
      if (searchDays.length > 0) {
        query = query.contains('days_of_week', searchDays);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;

      setMatches(data || []);

      if (!data || data.length === 0) {
        toast({
          title: "No matches found",
          description: "Try adjusting your search criteria or use manual entry"
        });
      }
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectMatch = (match: AISISSchedule) => {
    setCourseCode(match.subject_code);
    setSection(match.section);
    setRoom(match.room);
    setInstructor(match.instructor || "");
    
    // Parse time from HH:MM:SS to HH:MM
    setStartTime(match.start_time.substring(0, 5));
    setEndTime(match.end_time.substring(0, 5));
    
    setSelectedDays(match.days_of_week);
    
    // Auto-fill selected match
    onAdd({
      courseCode: match.subject_code,
      section: match.section,
      room: match.room,
      instructor: match.instructor || undefined,
      courseTitle: match.course_title,
      days: match.days_of_week,
      startTime: match.start_time.substring(0, 5),
      endTime: match.end_time.substring(0, 5),
      color,
      aisisScheduleId: match.id,
      isAutoFilled: true
    });

    // Reset form
    resetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!courseCode.trim()) {
      toast({ title: "Course code required", variant: "destructive" });
      return;
    }
    
    if (selectedDays.length === 0) {
      toast({ title: "Select at least one day", variant: "destructive" });
      return;
    }
    
    if (startTime >= endTime) {
      toast({ title: "End time must be after start time", variant: "destructive" });
      return;
    }

    onAdd({
      courseCode: courseCode.trim(),
      section: section.trim() || "N/A",
      room: room.trim() || "TBD",
      instructor: instructor.trim() || undefined,
      days: selectedDays,
      startTime,
      endTime,
      color,
      isAutoFilled: false
    });

    resetForm();
  };

  const resetForm = () => {
    setCourseCode("");
    setSection("");
    setRoom("");
    setInstructor("");
    setStartTime("08:00");
    setEndTime("09:30");
    setColor("#93C5FD");
    setSelectedDays([]);
    setSearchRoom("");
    setSearchStartTime("");
    setSearchEndTime("");
    setSearchDays([]);
    setMatches([]);
  };

  const toggleDay = (dayValue: number, isSearch = false) => {
    if (isSearch) {
      setSearchDays(prev => 
        prev.includes(dayValue) 
          ? prev.filter(d => d !== dayValue)
          : [...prev, dayValue].sort()
      );
    } else {
      setSelectedDays(prev => 
        prev.includes(dayValue) 
          ? prev.filter(d => d !== dayValue)
          : [...prev, dayValue].sort()
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Class</DialogTitle>
          <DialogDescription>
            Auto-detect from schedule data or manually enter class information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Auto-Detection Section */}
          <Card className="border-primary/20">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Auto-Detect from Schedule</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Room</Label>
                  <Input
                    value={searchRoom}
                    onChange={(e) => setSearchRoom(e.target.value)}
                    placeholder="e.g., SEC-A210"
                    disabled={isSearching}
                  />
                </div>
                <div>
                  <Label>Time Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={searchStartTime}
                      onChange={(e) => setSearchStartTime(e.target.value)}
                      disabled={isSearching}
                      placeholder="Start"
                      className="max-w-[140px]"
                    />
                    <Input
                      type="time"
                      value={searchEndTime}
                      onChange={(e) => setSearchEndTime(e.target.value)}
                      disabled={isSearching}
                      placeholder="End"
                      className="max-w-[140px]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Days (Optional)</Label>
                <div className="flex gap-2 mt-2">
                  {days.map(day => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`search-day-${day.value}`}
                        checked={searchDays.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value, true)}
                        disabled={isSearching}
                      />
                      <Label htmlFor={`search-day-${day.value}`} className="cursor-pointer font-normal text-sm">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="search-all"
                    checked={searchAllDepts}
                    onCheckedChange={setSearchAllDepts}
                  />
                  <Label htmlFor="search-all" className="cursor-pointer">
                    Search All Departments
                  </Label>
                </div>

                {searchAllDepts && (
                  <Select value={selectedDept || "all"} onValueChange={(val) => setSelectedDept(val === "all" ? "" : val)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by dept" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {allDepartments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Button onClick={handleAutoDetect} disabled={isSearching} className="w-full">
                {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Search className="mr-2 h-4 w-4" />
                Search Matching Courses
              </Button>

              {matches.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <Label>Matching Courses ({matches.length})</Label>
                  {matches.map(match => (
                    <Card key={match.id} className="cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => handleSelectMatch(match)}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{match.subject_code}</span>
                              <Badge variant="outline" size="sm">{match.section}</Badge>
                              <Badge variant="success" size="sm">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Match
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{match.course_title}</p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {match.room} • {match.time_pattern} • {match.instructor || 'TBA'}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or Manual Entry</span>
            </div>
          </div>

          {/* Manual Entry Section */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="courseCode">Course Code *</Label>
              <Input
                id="courseCode"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g., MATH 53"
                disabled={isAdding}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="e.g., A3"
                  disabled={isAdding}
                />
              </div>
              <div>
                <Label htmlFor="room">Room</Label>
                <Input
                  id="room"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g., SEC-A210"
                  disabled={isAdding}
                />
              </div>
              <div>
                <Label htmlFor="instructor">Instructor</Label>
                <Input
                  id="instructor"
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  placeholder="Optional"
                  disabled={isAdding}
                />
              </div>
            </div>

            <div>
              <Label>Days *</Label>
              <div className="flex gap-2 mt-2">
                {days.map(day => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={selectedDays.includes(day.value)}
                      onCheckedChange={() => toggleDay(day.value)}
                      disabled={isAdding}
                    />
                    <Label htmlFor={`day-${day.value}`} className="cursor-pointer font-normal">
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isAdding}
                  className="max-w-full"
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={isAdding}
                  className="max-w-full"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-10"
                  disabled={isAdding}
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#93C5FD"
                  disabled={isAdding}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
                Cancel
              </Button>
              <Button type="submit" disabled={isAdding}>
                {isAdding ? "Adding..." : "Add Class"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
