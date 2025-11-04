import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClientLogger } from "@/hooks/useClientLogger";

export const ACTIVE_PROGRAM_QUERY_KEY = 'active-program';

interface ActiveProgram {
  id: string;
  user_id: string;
  program_id: string;
  track_id: string | null;
  curriculum_version_id: string;
  start_term: string;
  end_term: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  programs: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    total_units: number;
    school_id: string;
  };
  curriculum_versions: {
    id: string;
    program_id: string;
    version_label: string;
    effective_start: string | null;
    effective_end: string | null;
    is_active: boolean;
    notes: string | null;
  };
  program_tracks?: {
    id: string;
    track_code: string;
    track_name: string;
    description: string | null;
  } | null;
}

export function useActiveProgram() {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const previousProgramIdRef = React.useRef<string | null>(null);
  const logger = useClientLogger();

  const { data: activeEnrollment, isPending } = useQuery({
    queryKey: [ACTIVE_PROGRAM_QUERY_KEY, user?.id, isGuest],
    queryFn: async () => {
      logger.info('query', '=== useActiveProgram QUERY EXECUTING ===', { isGuest, userId: user?.id });
      // For guest users, return enrollment from storage (or null if not set)
      if (isGuest) {
        logger.debug('query', 'Fetching guest enrollment from sessionStorage', {});
        const { guestStorage } = await import('@/utils/guestStorage');
        let storedEnrollment = guestStorage.getEnrollment();
        
        if (!storedEnrollment) {
          logger.warn('query', 'No guest enrollment found in sessionStorage', {});
          return null;
        }
        
        logger.info('query', 'Guest enrollment retrieved', { 
          programId: storedEnrollment.program_id,
          curriculumVersionId: storedEnrollment.curriculum_version_id,
          hasProgramData: !!storedEnrollment.programs,
          hasCurriculumData: !!storedEnrollment.curriculum_versions,
        });
        
        // Hydrate missing nested data if needed
        if (!storedEnrollment.programs || !storedEnrollment.curriculum_versions) {
          logger.info('query', 'Hydrating guest enrollment data', {});
          const enrollmentData = storedEnrollment as any;
          
          // Fetch program data
          if (enrollmentData.program_id && !storedEnrollment.programs) {
            try {
              const { data: programData, error: programError } = await supabase
                .from('programs')
                .select('*')
                .eq('id', enrollmentData.program_id)
                .single();
              
              if (programError) {
                logger.error('query', 'Failed to fetch program data', { 
                  error: programError,
                  programId: enrollmentData.program_id 
                });
                throw new Error(`Program data fetch failed: ${programError.message}`);
              }
              
              if (programData) {
                enrollmentData.programs = programData;
                logger.info('query', 'Program data fetched successfully', { programName: programData.name });
              }
            } catch (error) {
              logger.error('query', 'Exception fetching program data', { error });
              throw error;
            }
          }
          
          // Fetch curriculum version data
          if (enrollmentData.curriculum_version_id && !storedEnrollment.curriculum_versions) {
            try {
              const { data: curriculumData, error: curriculumError } = await supabase
                .from('curriculum_versions')
                .select('*')
                .eq('id', enrollmentData.curriculum_version_id)
                .single();
              
              if (curriculumError) {
                logger.error('query', 'Failed to fetch curriculum data', { 
                  error: curriculumError,
                  curriculumId: enrollmentData.curriculum_version_id 
                });
                throw new Error(`Curriculum data fetch failed: ${curriculumError.message}`);
              }
              
              if (curriculumData) {
                enrollmentData.curriculum_versions = curriculumData;
                logger.info('query', 'Curriculum data fetched successfully', {});
              }
            } catch (error) {
              logger.error('query', 'Exception fetching curriculum data', { error });
              throw error;
            }
          }
          
          // Fetch track data if track_id exists
          if (enrollmentData.track_id && !storedEnrollment.program_tracks) {
            try {
              const { data: trackData, error: trackError } = await supabase
                .from('program_tracks')
                .select('id, track_code, track_name, description')
                .eq('id', enrollmentData.track_id)
                .single();
              
              if (trackError) {
                logger.warn('query', 'Failed to fetch track data', { 
                  error: trackError,
                  trackId: enrollmentData.track_id 
                });
              } else if (trackData) {
                enrollmentData.program_tracks = trackData;
                logger.info('query', 'Track data fetched successfully', { trackName: trackData.track_name });
              }
            } catch (error) {
              logger.warn('query', 'Exception fetching track data', { error });
            }
          }
          
          guestStorage.setEnrollment(enrollmentData);
          
          if (enrollmentData.programs) {
            try {
              localStorage.setItem('app_program', JSON.stringify({
                name: enrollmentData.programs.name,
                code: enrollmentData.programs.code,
              }));
              logger.info('storage', 'Updated app_program cache', { programName: enrollmentData.programs.name });
            } catch (e) {
              logger.error('storage', 'Failed to update app_program cache', { error: e });
              console.error('Failed to update app_program cache:', e);
            }
          }
          
          storedEnrollment = enrollmentData as ActiveProgram;
          logger.info('query', 'Guest enrollment hydration complete', { programName: enrollmentData.programs?.name });
        }
        
        return storedEnrollment as ActiveProgram;
      }

      logger.debug('query', 'Fetching authenticated user enrollment', {});
      const { data, error } = await supabase
        .from("program_enrollments")
        .select(`
          *,
          programs (*),
          curriculum_versions (*),
          program_tracks (
            id,
            track_code,
            track_name,
            description
          )
        `)
        .eq("user_id", user!.id)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id || isGuest,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [ACTIVE_PROGRAM_QUERY_KEY, user?.id, isGuest] });
  };

  // Detect program changes and invalidate curriculum cache
  React.useEffect(() => {
    if (activeEnrollment?.program_id && previousProgramIdRef.current !== activeEnrollment.program_id) {
      if (previousProgramIdRef.current !== null) {
        logger.logCacheOperation(
          'INVALIDATE',
          ['requirement-groups-term', 'grouped-courses', 'active-grade-plan', 'grade-plan-courses'],
          `Program switched from ${previousProgramIdRef.current} to ${activeEnrollment.program_id}. Invalidating all curriculum and grade plan caches to ensure data consistency.`,
          'useActiveProgram'
        );
        
        // Invalidate all curriculum-related queries
        queryClient.invalidateQueries({ queryKey: ['requirement-groups-term'] });
        queryClient.invalidateQueries({ queryKey: ['grouped-courses'] });
        queryClient.invalidateQueries({ queryKey: ['active-grade-plan'] });
        queryClient.invalidateQueries({ queryKey: ['grade-plan-courses'] });
      }
      previousProgramIdRef.current = activeEnrollment.program_id;
    }
  }, [activeEnrollment?.program_id, isGuest, queryClient, logger]);

  return {
    activeEnrollment: activeEnrollment || null,
    loading: isPending,
    refresh,
    hasProgram: !!activeEnrollment,
  };
}
