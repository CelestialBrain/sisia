import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { guestStorage } from '@/utils/guestStorage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CompactTimeGrid } from './CompactTimeGrid';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  font_color?: string | null;
  font_size?: string | null;
}

export function SchedulePreview() {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Listen for guest storage updates
  useEffect(() => {
    if (!isGuest) return;

    const handleStorageUpdate = () => {
      queryClient.invalidateQueries({ 
        queryKey: ['active-schedule', 'guest', true],
        exact: false 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['schedule-blocks-preview'],
        exact: false 
      });
    };

    window.addEventListener('guestScheduleUpdate', handleStorageUpdate);
    return () => window.removeEventListener('guestScheduleUpdate', handleStorageUpdate);
  }, [isGuest, queryClient]);

  // Real-time subscription for authenticated users
  useEffect(() => {
    if (isGuest || !user) return;

    const channel: RealtimeChannel = supabase
      .channel('schedule-preview-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_schedules',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Invalidate both preview and builder queries
          queryClient.invalidateQueries({ 
            queryKey: ['active-schedule'],
            exact: false 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['user-schedules'],
            exact: false 
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_blocks'
        },
        () => {
          // Invalidate both preview and builder block queries
          queryClient.invalidateQueries({ 
            queryKey: ['schedule-blocks-preview'],
            exact: false 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['schedule-blocks'],
            exact: false 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isGuest, user, queryClient]);

  // Get the selected term from sessionStorage (synced with Schedule Builder)
  const selectedTerm = sessionStorage.getItem('selected-term') || 'First Semester';

  const { data: activeSchedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['active-schedule', isGuest ? 'guest' : user?.id, selectedTerm, isGuest],
    queryFn: async () => {
      if (isGuest) {
        const schedules = guestStorage.getSchedules();
        // Filter by selected term, then find active schedule
        const termSchedules = schedules.filter((s: any) => s.term_code === selectedTerm);
        const active = termSchedules.find((s: any) => s.is_active);
        if (active) return active;
        return termSchedules.length > 0 ? termSchedules[0] : null;
      }
      // For authenticated users, get active schedule for selected term
      const { data: activeData } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('user_id', user!.id)
        .eq('term_code', selectedTerm)
        .eq('is_active', true)
        .maybeSingle();
      
      if (activeData) return activeData;
      
      // If no active schedule for this term, get the most recent one for this term
      const { data: anySchedule } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('user_id', user!.id)
        .eq('term_code', selectedTerm)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      return anySchedule;
    },
    enabled: !!user || isGuest,
    staleTime: 0,
    placeholderData: (prev) => prev,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: blocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: ['schedule-blocks-preview', activeSchedule?.id, isGuest],
    queryFn: async () => {
      if (!activeSchedule) return [];
      
      if (isGuest) {
        const allBlocks = guestStorage.getScheduleBlocks();
        return allBlocks.filter((b: any) => b.schedule_id === activeSchedule.id);
      }
      
      const { data } = await supabase
        .from('schedule_blocks')
        .select('*')
        .eq('schedule_id', activeSchedule.id);
      return data || [];
    },
    enabled: !!activeSchedule,
    staleTime: 0,
    placeholderData: (prev) => prev,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const handleNavigate = () => {
    navigate('/planner');
  };

  if (scheduleLoading || blocksLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    );
  }

  if (!activeSchedule) {
    return (
      <div className="text-center py-8 border border-dashed rounded-lg">
        <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <h3 className="text-base font-medium mb-2">No Schedule Yet</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Create your first schedule to see it here
        </p>
        <Button onClick={handleNavigate} size="sm">
          Create Schedule
        </Button>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed rounded-lg">
        <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <h3 className="text-base font-medium mb-2">{activeSchedule.schedule_name}</h3>
        <p className="text-sm text-muted-foreground mb-3">
          No classes added yet. Start building your schedule!
        </p>
        <Button onClick={handleNavigate} size="sm">
          Add Classes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">{activeSchedule.schedule_name}</h3>
          <p className="text-xs text-muted-foreground">{activeSchedule.term_code}</p>
        </div>
        <Button onClick={handleNavigate} variant="outline" size="sm">
          Edit Schedule
        </Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <CompactTimeGrid blocks={blocks} />
      </div>
    </div>
  );
}
