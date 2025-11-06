import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { guestStorage } from '@/utils/guestStorage';
import { useClientLogger } from '@/hooks/useClientLogger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimeGrid } from '@/components/schedule/TimeGrid';
import { CourseSearchTab } from '@/components/schedule/CourseSearchTab';
import { Badge } from '@/components/ui/badge';
import { ImportDialog } from '@/components/schedule/ImportDialog';
import { DeleteScheduleDialog } from '@/components/schedule/DeleteScheduleDialog';
import { RenameScheduleDialog } from '@/components/schedule/RenameScheduleDialog';
import { AddCustomCourseDialog } from '@/components/schedule/AddCustomCourseDialog';
import { ShareScheduleDialog } from '@/components/schedule/ShareScheduleDialog';
import { ImportShareDialog } from '@/components/schedule/ImportShareDialog';
import { ConflictConfirmDialog } from '@/components/schedule/ConflictConfirmDialog';
import { EditBlockDialog } from '@/components/schedule/EditBlockDialog';
import { detectConflicts } from '@/utils/conflictDetector';
import { assignColor } from '@/utils/colorAssignment';
import { CourseInfo } from '@/utils/courseFrequencyDetector';
import { SharePayload } from '@/utils/scheduleCodeGenerator';
import { useToast } from '@/hooks/use-toast';
import { Upload, Plus, AlertTriangle, Calendar, Trash2, Edit2, Share2, FileDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Schedule {
  id: string;
  name: string;
  term_code: string;
  is_active?: boolean;
  user_id: string;
}

interface ScheduleBlock {
  id: string;
  schedule_id: string;
  course_code: string;
  course_title: string | null;
  section: string;
  room: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  color: string;
  palette_item_id: string | null;
}

export default function ScheduleBuilder() {
  const { user, isGuest } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logger = useClientLogger();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showAddCustomDialog, setShowAddCustomDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showImportShareDialog, setShowImportShareDialog] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const [conflictData, setConflictData] = useState<any>(null);
  const [selectedTerm, setSelectedTerm] = useState(() => {
    return sessionStorage.getItem('selected-term') || 'First Semester';
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('schedule');
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }
  }));

  // Ensure first schedule exists synchronously for guests before queries
  const [initialScheduleCreated, setInitialScheduleCreated] = useState(false);
  
  useEffect(() => {
    logger.info('schedule', 'ScheduleBuilder mounted or term changed', { isGuest, term: selectedTerm });
    
    if (isGuest) {
      const schedules = guestStorage.getSchedules();
      const termSchedules = schedules.filter((s: Schedule) => s.term_code === selectedTerm);
      
      if (termSchedules.length === 0) {
        logger.info('schedule', 'Creating guest schedule for new term', { term: selectedTerm });
        const newSchedule: Schedule = {
          id: guestStorage.generateId(),
          schedule_name: 'My Schedule 1',
          term_code: selectedTerm,
          is_active: true
        };
        schedules.push(newSchedule);
        guestStorage.setSchedules(schedules);
        logger.info('schedule', 'Guest schedule created for term', { scheduleId: newSchedule.id, term: selectedTerm });
      }
      setInitialScheduleCreated(true);
    }
    
    return () => {
      logger.info('schedule', 'ScheduleBuilder unmounted');
    };
  }, [isGuest, selectedTerm]);

  // Use React Query to fetch schedules
  const { data: schedulesData, isLoading } = useQuery({
    queryKey: ['user-schedules', isGuest ? 'guest' : user?.id, selectedTerm, isGuest],
    queryFn: async () => {
      if (isGuest) {
        const stored = guestStorage.getSchedules();
        return stored.filter((s: Schedule) => s.term_code === selectedTerm);
      }
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('user_id', user.id)
        .eq('term_code', selectedTerm)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: (!!user || (isGuest && initialScheduleCreated))
  });

  const previousActiveIdRef = useRef<string | null>(null);

  // Update local state when query data changes
  // Invalidate queries when term changes
  useEffect(() => {
    queryClient.invalidateQueries({ 
      queryKey: ['user-schedules', isGuest ? 'guest' : user?.id, selectedTerm, isGuest] 
    });
  }, [selectedTerm, queryClient, isGuest, user?.id]);

  // Update local state when query data changes
  useEffect(() => {
    if (schedulesData) {
      setSchedules(schedulesData);
      const active = schedulesData.find(s => s.is_active) || schedulesData[0] || null;
      
      if (active && previousActiveIdRef.current !== active.id) {
        previousActiveIdRef.current = active.id;
        setActiveSchedule(active);
      } else if (!active && previousActiveIdRef.current !== null) {
        previousActiveIdRef.current = null;
        setActiveSchedule(null);
      }
    }
  }, [schedulesData]);

  // Auto-create first authenticated user schedule if none exists
  useEffect(() => {
    const createFirstSchedule = async () => {      
      if (user && !isLoading && schedulesData && schedulesData.length === 0) {
        try {
          const { data, error } = await supabase
            .from('user_schedules')
            .insert({
              user_id: user.id,
              term_code: selectedTerm,
              schedule_name: 'My Schedule 1',
              is_active: true
            })
            .select()
            .single();
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['user-schedules', user.id, selectedTerm] });
        } catch (error: any) {
          console.error('Error creating first schedule:', error);
        }
      }
    };
    createFirstSchedule();
  }, [user, isLoading, schedulesData, selectedTerm, queryClient]);

  // Use React Query to cache blocks
  const { data: cachedBlocks } = useQuery({
    queryKey: ['schedule-blocks', activeSchedule?.id, isGuest],
    queryFn: async () => {
      if (!activeSchedule) return [];
      if (isGuest) {
        const stored = guestStorage.getScheduleBlocks();
        return stored.filter((b: ScheduleBlock) => b.schedule_id === activeSchedule.id);
      }
      const { data, error } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('schedule_id', activeSchedule.id)
        .order('day_of_week')
        .order('start_time');
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeSchedule,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (cachedBlocks) setBlocks(cachedBlocks);
  }, [cachedBlocks]);

  const loadBlocks = async () => {
    queryClient.invalidateQueries({ queryKey: ['schedule-blocks', activeSchedule?.id, isGuest] });
  };

  const handleImportCourses = async (courses: CourseInfo[]) => {
    if (!activeSchedule) return;
    logger.info('schedule', 'Importing courses to schedule', { count: courses.length, isGuest });
    
    try {
      const blocksToAdd: any[] = [];
      
      courses.forEach(course => {
        const color = assignColor(course.courseCode, blocks);
        
        for (let i = 0; i < course.frequency; i++) {
          const dayOffset = i * 2;
          const dayOfWeek = (dayOffset % 5) + 1;
          const startTime = '08:00:00';
          const endTime = '09:30:00';
          
          blocksToAdd.push({
            schedule_id: activeSchedule.id,
            course_code: course.courseCode,
            course_title: course.courseTitle,
            section: course.section || '',
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
            room: 'TBD',
            color: color,
            palette_item_id: null
          });
        }
      });
      
      if (isGuest) {
        blocksToAdd.forEach(block => {
          guestStorage.addScheduleBlock({ ...block, id: guestStorage.generateId() });
        });
      } else {
        const { error } = await supabase.from('schedule_blocks').insert(blocksToAdd);
        if (error) throw error;
      }
      
      toast({
        title: "Imported",
        description: `${courses.length} courses added. Drag blocks to adjust times.`
      });
      
      await loadBlocks();
      setActiveTab('schedule');
    } catch (error: any) {
      console.error('Error importing courses:', error);
      throw error;
    }
  };

  const handleAddCustomCourse = async (course: {
    courseCode: string;
    courseTitle: string;
    section: string;
    color: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) => {
    if (!activeSchedule) return;
    try {
      if (isGuest) {
        const newBlock: ScheduleBlock = {
          id: guestStorage.generateId(),
          schedule_id: activeSchedule.id,
          course_code: course.courseCode,
          course_title: course.courseTitle,
          section: course.section || '',
          day_of_week: course.dayOfWeek,
          start_time: course.startTime,
          end_time: course.endTime,
          room: 'TBD',
          color: course.color,
          palette_item_id: null
        };
        guestStorage.addScheduleBlock(newBlock);
      } else {
        const { error } = await supabase.from('schedule_blocks').insert({
          schedule_id: activeSchedule.id,
          course_code: course.courseCode,
          course_title: course.courseTitle,
          section: course.section || null,
          day_of_week: course.dayOfWeek,
          start_time: course.startTime,
          end_time: course.endTime,
          room: 'TBD',
          color: course.color,
          palette_item_id: null
        });
        if (error) throw error;
      }
      
      toast({
        title: "Added",
        description: `${course.courseCode} added to your schedule`
      });
      await loadBlocks();
      setShowAddCustomDialog(false);
    } catch (error: any) {
      console.error('Error adding custom course:', error);
      toast({
        title: "Error",
        description: "Failed to add custom course",
        variant: "destructive"
      });
    }
  };

  const addCourseFromSearch = async (course: any) => {
    if (!activeSchedule) return;
    try {
      const color = assignColor(course.subject_code, blocks);
      const blocksToInsert = (course.days_of_week || []).map((day: number) => ({
        schedule_id: activeSchedule.id,
        course_code: course.subject_code,
        course_title: course.subject_title,
        section: course.class_nbr,
        room: course.room || 'TBD',
        day_of_week: day,
        start_time: course.start_time,
        end_time: course.end_time,
        units: course.units,
        color: color,
        palette_item_id: null,
        aisis_schedule_id: course.id,
        is_auto_filled: false
      }));

      if (isGuest) {
        blocksToInsert.forEach(block => {
          guestStorage.addScheduleBlock({ ...block, id: guestStorage.generateId() });
        });
        await loadBlocks();
      } else {
        const { error } = await supabase.from('schedule_blocks').insert(blocksToInsert);
        if (error) throw error;
        await loadBlocks();
      }

      toast({
        title: "Added",
        description: `${course.subject_code} added to your schedule`
      });
      setActiveTab('schedule');
    } catch (error: any) {
      console.error('Error adding course from search:', error);
      toast({
        title: "Error",
        description: "Failed to add course to schedule",
        variant: "destructive"
      });
    }
  };

  const checkConflictAtPosition = (day: number, startTime: string, endTime: string) => {
    const conflicts: Array<{ courseCode: string; time: string; }> = [];
    for (const block of blocks) {
      if (block.day_of_week !== day) continue;
      const blockStart = block.start_time;
      const blockEnd = block.end_time;
      if (startTime < blockEnd && endTime > blockStart) {
        conflicts.push({
          courseCode: block.course_code,
          time: `${blockStart.slice(0, 5)} - ${blockEnd.slice(0, 5)}`
        });
      }
    }
    return conflicts;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;
    
    const activeData = active.data.current;
    const overData = over.data.current;

    // Moving an existing block to a grid cell
    if (activeData?.type === 'schedule-block' && overData?.type === 'grid-cell') {
      const block = activeData.block as ScheduleBlock;
      const newDayOfWeek = overData.day as number;
      const newTime = overData.time as string;
      const newStartTime = `${newTime}:00`;

      // Calculate duration and new end time
      const oldStart = new Date(`2000-01-01T${block.start_time}`);
      const oldEnd = new Date(`2000-01-01T${block.end_time}`);
      const durationMs = oldEnd.getTime() - oldStart.getTime();
      const newStart = new Date(`2000-01-01T${newStartTime}`);
      const newEnd = new Date(newStart.getTime() + durationMs);
      const newEndTime = newEnd.toTimeString().slice(0, 8);

      // Check for conflicts
      const conflicts = checkConflictAtPosition(newDayOfWeek, newStartTime, newEndTime)
        .filter(c => c.courseCode !== block.course_code);

      if (conflicts.length > 0) {
        setConflictData({
          conflicts,
          onConfirm: async () => {
            setBlocks(prev => prev.map(b => b.id === block.id ? {
              ...b,
              day_of_week: newDayOfWeek,
              start_time: newStartTime,
              end_time: newEndTime
            } : b));
            queryClient.setQueryData<ScheduleBlock[]>(
              ['schedule-blocks', activeSchedule?.id, isGuest],
              prev => prev ? prev.map(b => b.id === block.id ? {
                ...b,
                day_of_week: newDayOfWeek,
                start_time: newStartTime,
                end_time: newEndTime
              } : b) : prev
            );
            setShowConflictDialog(false);
            updateBlockPosition(block.id, newDayOfWeek, newStartTime, newEndTime);
          }
        });
        setShowConflictDialog(true);
      } else {
        setBlocks(prev => prev.map(b => b.id === block.id ? {
          ...b,
          day_of_week: newDayOfWeek,
          start_time: newStartTime,
          end_time: newEndTime
        } : b));
        queryClient.setQueryData<ScheduleBlock[]>(
          ['schedule-blocks', activeSchedule?.id, isGuest],
          prev => prev ? prev.map(b => b.id === block.id ? {
            ...b,
            day_of_week: newDayOfWeek,
            start_time: newStartTime,
            end_time: newEndTime
          } : b) : prev
        );
        updateBlockPosition(block.id, newDayOfWeek, newStartTime, newEndTime);
      }
      return;
    }
  };

  const updateBlockPosition = async (blockId: string, day: number, startTime: string, endTime: string) => {
    try {
      if (isGuest) {
        guestStorage.updateScheduleBlock(blockId, {
          day_of_week: day,
          start_time: startTime,
          end_time: endTime
        });
      } else {
        const { error } = await supabase
          .from('schedule_blocks')
          .update({ day_of_week: day, start_time: startTime, end_time: endTime })
          .eq('id', blockId);
        if (error) throw error;
      }
      await loadBlocks();
    } catch (error: any) {
      console.error('Error updating block position:', error);
      toast({
        title: "Error",
        description: "Failed to update block position",
        variant: "destructive"
      });
    }
  };

  const handleDeleteBlock = async (blockIdOrBlock: string | any) => {
    const blockId = typeof blockIdOrBlock === 'string' ? blockIdOrBlock : blockIdOrBlock.id;
    try {
      if (isGuest) {
        guestStorage.deleteScheduleBlock(blockId);
      } else {
        const { error } = await supabase.from('schedule_blocks').delete().eq('id', blockId);
        if (error) throw error;
      }
      await loadBlocks();
    } catch (error: any) {
      console.error('Error deleting block:', error);
      toast({
        title: "Error",
        description: "Failed to delete class",
        variant: "destructive"
      });
    }
  };

  const handleDuplicateBlock = async (blockIdOrBlock: string | any) => {
    const blockId = typeof blockIdOrBlock === 'string' ? blockIdOrBlock : blockIdOrBlock.id;
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    setDuplicateData({
      courseCode: block.course_code,
      courseTitle: block.course_title,
      section: block.section,
      color: block.color,
      dayOfWeek: block.day_of_week,
      startTime: block.start_time,
      endTime: block.end_time
    });
    setShowAddCustomDialog(true);
  };

  const handleDeleteSchedule = async () => {
    if (!activeSchedule) return;
    setIsDeleting(true);
    try {
      if (isGuest) {
        const allSchedules = guestStorage.getSchedules();
        const filtered = allSchedules.filter((s: Schedule) => s.id !== activeSchedule.id);
        guestStorage.setSchedules(filtered);
        
        const blocks = guestStorage.getScheduleBlocks()
          .filter((b: ScheduleBlock) => b.schedule_id !== activeSchedule.id);
        guestStorage.setScheduleBlocks(blocks);
        
        // Optimistically update the cache for instant UI response
        const termSchedules = filtered.filter((s: Schedule) => s.term_code === selectedTerm);
        queryClient.setQueryData(
          ['user-schedules', 'guest', selectedTerm, true],
          termSchedules
        );
        
        // Also clear the blocks cache
        queryClient.setQueryData(
          ['schedule-blocks', activeSchedule.id, true],
          []
        );
      } else {
        const { error } = await supabase.from('user_schedules').delete().eq('id', activeSchedule.id);
        if (error) throw error;
        
        queryClient.invalidateQueries({
          queryKey: ['user-schedules', user?.id, selectedTerm, false]
        });
      }
      
      toast({
        title: "Deleted",
        description: "Schedule deleted successfully"
      });
      setShowDeleteDialog(false);
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Error",
        description: "Failed to delete schedule",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameSchedule = async (newName: string) => {
    if (!activeSchedule) return;
    setIsRenaming(true);
    try {
      if (isGuest) {
        const allSchedules = guestStorage.getSchedules();
        const updated = allSchedules.map((s: Schedule) => 
          s.id === activeSchedule.id ? { ...s, schedule_name: newName } : s
        );
        guestStorage.setSchedules(updated);
        
        // Optimistically update the cache for instant UI response
        const termSchedules = updated.filter((s: Schedule) => s.term_code === selectedTerm);
        queryClient.setQueryData(
          ['user-schedules', 'guest', selectedTerm, true],
          termSchedules
        );
      } else {
        const { error } = await supabase
          .from('user_schedules')
          .update({ name: newName })
          .eq('id', activeSchedule.id);
        if (error) throw error;
        
        queryClient.invalidateQueries({
          queryKey: ['user-schedules', user?.id, selectedTerm, false]
        });
      }
      
      toast({
        title: "Renamed",
        description: "Schedule renamed successfully"
      });
      setShowRenameDialog(false);
    } catch (error: any) {
      console.error('Error renaming schedule:', error);
      toast({
        title: "Error",
        description: "Failed to rename schedule",
        variant: "destructive"
      });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleUpdateBlock = async (blockId: string, updates: Partial<ScheduleBlock>, applyColorToAll: boolean) => {
    if (!activeSchedule) return;
    setIsUpdating(true);
    try {
      if (isGuest) {
        if (applyColorToAll && updates.color) {
          const block = blocks.find(b => b.id === blockId);
          if (block) {
            const allBlocks = guestStorage.getScheduleBlocks();
            const updated = allBlocks.map((b: ScheduleBlock) => 
              b.schedule_id === activeSchedule.id && b.course_code === block.course_code
                ? { ...b, color: updates.color }
                : b
            );
            guestStorage.setScheduleBlocks(updated);
          }
        } else {
          guestStorage.updateScheduleBlock(blockId, updates);
        }
      } else {
        if (applyColorToAll && updates.color) {
          const block = blocks.find(b => b.id === blockId);
          if (block) {
            await supabase
              .from('schedule_blocks')
              .update({ color: updates.color })
              .eq('schedule_id', activeSchedule.id)
              .eq('course_code', block.course_code);
          }
        } else {
          const { error } = await supabase
            .from('schedule_blocks')
            .update(updates)
            .eq('id', blockId);
          if (error) throw error;
        }
      }
      
      toast({
        title: "Updated",
        description: "Class updated successfully"
      });
      setShowEditDialog(false);
      setSelectedBlock(null);
      await loadBlocks();
    } catch (error: any) {
      console.error('Error updating block:', error);
      toast({
        title: "Error",
        description: "Failed to update class",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateNewSchedule = async () => {
    if (!user && !isGuest) return;
    try {
      const nextNum = schedules.length + 1;
      
      if (isGuest) {
        const allSchedules = guestStorage.getSchedules();
        // Set all existing schedules in this term to inactive
        const updatedSchedules = allSchedules.map((s: Schedule) => 
          s.term_code === selectedTerm ? { ...s, is_active: false } : s
        );
        
        // Create new schedule as active
        const newSchedule: Schedule = {
          id: guestStorage.generateId(),
          schedule_name: `My Schedule ${nextNum}`,
          term_code: selectedTerm,
          is_active: true
        };
        
        updatedSchedules.push(newSchedule);
        guestStorage.setSchedules(updatedSchedules);
        
        // Optimistically update the cache for instant UI response
        const termSchedules = updatedSchedules.filter((s: Schedule) => s.term_code === selectedTerm);
        queryClient.setQueryData(
          ['user-schedules', 'guest', selectedTerm, true],
          termSchedules
        );
        
        toast({
          title: "Created",
          description: "New schedule created"
        });
        
        setActiveSchedule(newSchedule);
      } else {
        // First set all user's schedules in this term to inactive
        await supabase
          .from('user_schedules')
          .update({ is_active: false })
          .eq('user_id', user!.id)
          .eq('term_code', selectedTerm);
        
        // Then create new schedule as active
        const { data, error } = await supabase
          .from('user_schedules')
          .insert({
            user_id: user!.id,
            term_code: selectedTerm,
            name: `My Schedule ${nextNum}`,
            is_active: true
          })
          .select()
          .single();
        if (error) throw error;
        
        toast({
          title: "Created",
          description: "New schedule created"
        });
        
        // Optimistically update cache
        queryClient.setQueryData(['active-schedule', user!.id], data);
        queryClient.invalidateQueries({
          queryKey: ['user-schedules', user!.id, selectedTerm]
        });
        setActiveSchedule(data);
      }
    } catch (error: any) {
      console.error('Error creating schedule:', error);
      toast({
        title: "Error",
        description: "Failed to create schedule",
        variant: "destructive"
      });
    }
  };

  const handleScheduleChange = async (scheduleId: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    
    try {
      if (isGuest) {
        const allSchedules = guestStorage.getSchedules();
        // Set all schedules to inactive, then set selected to active
        const updatedSchedules = allSchedules.map((s: Schedule) => ({
          ...s,
          is_active: s.id === scheduleId
        }));
        guestStorage.setSchedules(updatedSchedules);
        
        // Optimistically update the cache for instant UI response
        const termSchedules = updatedSchedules.filter((s: Schedule) => s.term_code === selectedTerm);
        queryClient.setQueryData(
          ['user-schedules', 'guest', selectedTerm, true],
          termSchedules
        );
        
        setActiveSchedule(schedule);
      } else {
        // Set all user's schedules to inactive
        await supabase
          .from('user_schedules')
          .update({ is_active: false })
          .eq('user_id', user!.id);
        
        // Set selected schedule to active
        await supabase
          .from('user_schedules')
          .update({ is_active: true })
          .eq('id', scheduleId);
        
        // Optimistically update cache
        queryClient.setQueryData(['active-schedule', user!.id], schedule);
        queryClient.invalidateQueries({
          queryKey: ['user-schedules', user!.id, selectedTerm]
        });
        setActiveSchedule(schedule);
      }
    } catch (error: any) {
      console.error('Error changing schedule:', error);
      toast({
        title: "Error",
        description: "Failed to switch schedule",
        variant: "destructive"
      });
    }
  };

  const handleImportShare = async (payload: SharePayload) => {
    if (!activeSchedule) {
      toast({
        title: "Error",
        description: "No active schedule selected",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Simplified import - just add blocks directly
      if (isGuest) {
        const existingBlocks = guestStorage.getScheduleBlocks();
        payload.blocks.forEach(block => {
          existingBlocks.push({
            id: guestStorage.generateId(),
            schedule_id: activeSchedule.id,
            course_code: block.course_code,
            course_title: block.course_title,
            section: block.section,
            room: block.room,
            day_of_week: block.day_of_week,
            start_time: block.start_time,
            end_time: block.end_time,
            color: block.color,
            font_color: block.font_color || '#000000',
            font_size: block.font_size || 'text-xs',
            palette_item_id: null
          });
        });
        guestStorage.setScheduleBlocks(existingBlocks);
      } else {
        const blocksToInsert = payload.blocks.map(block => ({
          schedule_id: activeSchedule.id,
          course_code: block.course_code,
          course_title: block.course_title,
          section: block.section,
          room: block.room,
          day_of_week: block.day_of_week,
          start_time: block.start_time,
          end_time: block.end_time,
          color: block.color,
          font_color: block.font_color || '#000000',
          font_size: block.font_size || 'text-xs',
          palette_item_id: null
        }));
        
        const { error } = await supabase
          .from('schedule_blocks')
          .insert(blocksToInsert);
        if (error) throw error;
      }
      
      toast({
        title: "Success",
        description: `Imported ${payload.blocks.length} blocks`
      });
      await loadBlocks();
    } catch (error: any) {
      console.error('Share import failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to import schedule",
        variant: "destructive"
      });
    }
  };

  const detectConflictsInSchedule = () => {
    return detectConflicts(blocks);
  };

  const conflicts = detectConflictsInSchedule();
  const conflictBlockIds = new Set(conflicts.flatMap(c => [c.block1.id, c.block2.id]));

  if (isLoading || !activeSchedule) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 pb-20 lg:pb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Schedule Builder</h1>
          <p className="text-muted-foreground">Build or import courses from AISIS to a schedule grid</p>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              {/* Term selector and schedule dropdown skeleton */}
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <Skeleton className="h-10 w-full sm:flex-1 lg:w-[280px]" />
                <div className="flex gap-3 w-full sm:w-auto sm:flex-1">
                  <Skeleton className="h-10 flex-1 sm:w-auto lg:w-[280px]" />
                  <Skeleton className="h-10 w-10 shrink-0" />
                  <Skeleton className="h-10 w-10 shrink-0" />
                </div>
              </div>

              {/* Action buttons skeleton */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Schedule grid skeleton */}
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[600px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="max-w-7xl mx-auto space-y-8 pb-20 lg:pb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Schedule Builder</h1>
          <p className="text-muted-foreground">Build or import courses from AISIS to a schedule grid</p>
        </div>

        <Card>
          <CardHeader>
              <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <Select value={selectedTerm} onValueChange={(term) => {
                  setSelectedTerm(term);
                  sessionStorage.setItem('selected-term', term);
                }}>
                  <SelectTrigger className="w-full sm:flex-1 lg:w-[280px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                    <Calendar className="h-4 w-4 mr-2 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="First Semester">First Semester</SelectItem>
                    <SelectItem value="Second Semester">Second Semester</SelectItem>
                    <SelectItem value="Intercession">Intercession</SelectItem>
                  </SelectContent>
                </Select>

                {schedules.length > 0 && (
                  <div className="flex gap-3 w-full sm:w-auto sm:flex-1">
                    <Select value={activeSchedule?.id || ''} onValueChange={handleScheduleChange}>
                      <SelectTrigger className="flex-1 sm:w-auto lg:w-[280px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                        <SelectValue placeholder="Select schedule" />
                      </SelectTrigger>
                      <SelectContent>
                        {schedules.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleCreateNewSchedule} 
                      className="shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      title="Create new schedule"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>

                    {activeSchedule && (
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        onClick={() => setShowDeleteDialog(true)} 
                        className="shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {schedules.length > 0 && (
                <div className="flex gap-3 w-full">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowRenameDialog(true)} 
                    className="gap-2 flex-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Rename</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowShareDialog(true)} 
                    className="gap-2 flex-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Share</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowImportShareDialog(true)} 
                    className="gap-2 flex-1 h-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <FileDown className="h-4 w-4" />
                    <span className="hidden sm:inline">Import</span>
                  </Button>
                  <Button 
                    onClick={() => setShowAddCustomDialog(true)} 
                    className="gap-2 flex-[1.5] h-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add</span>
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {activeSchedule && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-10 p-1" role="tablist">
          <TabsTrigger 
            value="schedule" 
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            role="tab"
            aria-controls="schedule-panel"
            aria-selected={activeTab === 'schedule'}
          >
            My Schedule
          </TabsTrigger>
          <TabsTrigger 
            value="search" 
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            role="tab"
            aria-controls="search-panel"
            aria-selected={activeTab === 'search'}
          >
            Course Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-3" style={{ marginTop: '19px' }}>
          {conflicts.length > 0 && (
            <div 
              className="flex items-start gap-2 p-3 rounded-md border border-destructive/50 bg-destructive/10 text-sm"
              role="status"
              aria-live="polite"
            >
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-destructive mb-1">
                  {conflicts.length} scheduling conflict{conflicts.length > 1 ? 's' : ''} detected
                </div>
                <ul className="list-disc list-inside space-y-1 text-destructive/90">
                  {conflicts.map((c, i) => (
                    <li key={i}>{c.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <section aria-label="Weekly timetable">
            <TimeGrid
              blocks={blocks}
              conflicts={conflictBlockIds}
              onBlockClick={block => {
                const fullBlock = blocks.find(b => b.id === block.id);
                if (fullBlock) {
                  setSelectedBlock(fullBlock);
                  setShowEditDialog(true);
                }
              }}
              onBlockDelete={(blockId) => handleDeleteBlock(blockId)}
              onBlockDuplicate={(blockId) => handleDuplicateBlock(blockId)}
            />
          </section>
            </TabsContent>

            <TabsContent value="search" className="space-y-6">
              <CourseSearchTab
                currentTerm={selectedTerm}
                currentScheduleBlocks={blocks}
                onAddCourse={addCourseFromSearch}
              />
            </TabsContent>
          </Tabs>
        )}

        <ImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          scheduleId={activeSchedule?.id || ''}
          existingBlocks={blocks}
          onSuccess={loadBlocks}
        />
        <DeleteScheduleDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          scheduleName={activeSchedule?.name || ''}
          onConfirm={handleDeleteSchedule}
          isDeleting={isDeleting}
        />
        <RenameScheduleDialog
          open={showRenameDialog}
          onOpenChange={setShowRenameDialog}
          currentName={activeSchedule?.name || ''}
          onRename={handleRenameSchedule}
          isRenaming={isRenaming}
        />
        <AddCustomCourseDialog
          open={showAddCustomDialog}
          onOpenChange={setShowAddCustomDialog}
          onAdd={handleAddCustomCourse}
        />
        <ShareScheduleDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          scheduleId={activeSchedule?.id || ''}
          scheduleName={activeSchedule?.name || ''}
        />
        <ImportShareDialog
          open={showImportShareDialog}
          onOpenChange={setShowImportShareDialog}
          onImport={handleImportShare}
        />
        <ConflictConfirmDialog
          open={showConflictDialog}
          onOpenChange={setShowConflictDialog}
          conflicts={conflictData?.conflicts || []}
          onConfirm={conflictData?.onConfirm}
        />
        <EditBlockDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          block={selectedBlock}
          onUpdate={handleUpdateBlock}
          isUpdating={isUpdating}
        />
      </div>
    </DndContext>
  );
}
