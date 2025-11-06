import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type AISISSchedule = Database['public']['Tables']['aisis_schedules']['Row'];

export interface ScheduleBlock {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface SearchFilters {
  instructorQuery?: string;
  days?: number[];
  startTimeAfter?: string;
  endTimeBefore?: string;
  roomQuery?: string;
  buildingPrefix?: string;
  courseCodeQuery?: string;
  departments?: string[];
  termCode: string;
  excludeConflicting?: boolean;
  currentScheduleBlocks?: ScheduleBlock[];
}

export function hasConflictWithSchedule(
  candidate: AISISSchedule,
  scheduleBlocks: ScheduleBlock[]
): boolean {
  if (!candidate.days_of_week || !scheduleBlocks.length) return false;

  return scheduleBlocks.some(block => {
    // Check if any candidate day matches the block's day
    const daysOverlap = candidate.days_of_week?.includes(String(block.day_of_week));
    if (!daysOverlap) return false;

    // Check if times overlap
    const candidateStart = candidate.start_time;
    const candidateEnd = candidate.end_time;
    const blockStart = block.start_time;
    const blockEnd = block.end_time;

    return (
      (candidateStart < blockEnd && candidateEnd > blockStart) ||
      (blockStart < candidateEnd && blockEnd > candidateStart)
    );
  });
}

export function useAISISSearch() {
  const searchCourses = async (filters: SearchFilters): Promise<AISISSchedule[]> => {
    let query = supabase
      .from('aisis_schedules')
      .select('*')
      .eq('deprecated', false);

    // Additive filtering - each filter adds constraints
    if (filters.instructorQuery) {
      query = query.ilike('instructor', `%${filters.instructorQuery}%`);
    }

    if (filters.roomQuery) {
      query = query.ilike('room', `%${filters.roomQuery}%`);
    }

    if (filters.buildingPrefix) {
      query = query.ilike('room', `${filters.buildingPrefix}%`);
    }

    if (filters.courseCodeQuery) {
      query = query.or(
        `subject_code.ilike.%${filters.courseCodeQuery}%,course_title.ilike.%${filters.courseCodeQuery}%`
      );
    }

    if (filters.departments?.length) {
      query = query.in('department', filters.departments);
    }

    if (filters.startTimeAfter) {
      query = query.gte('start_time', filters.startTimeAfter);
    }

    if (filters.endTimeBefore) {
      query = query.lte('end_time', filters.endTimeBefore);
    }

    const { data, error } = await query.limit(500);

    if (error) throw error;

    let results = data || [];

    // Post-filter for days (since array overlap is complex in SQL)
    if (filters.days?.length) {
      results = results.filter(result =>
        result.days_of_week?.some(day => filters.days?.includes(Number(day)))
      );
    }

    // Post-filter for conflicts if needed
    if (filters.excludeConflicting && filters.currentScheduleBlocks) {
      results = results.filter(
        result => !hasConflictWithSchedule(result, filters.currentScheduleBlocks!)
      );
    }

    return results;
  };

  return { searchCourses };
}
