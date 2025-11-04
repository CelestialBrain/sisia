import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GradeTable } from "@/components/grades/GradeTable";
import { GradeForm } from "@/components/grades/GradeForm";
import { ImportAISIS } from "@/components/grades/ImportAISIS";
import { GradePlanner } from "@/components/calculators/GradePlanner";
import { BookOpen, Plus, Upload, Calculator } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveProgram } from "@/hooks/useActiveProgram";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { guestStorage } from "@/utils/guestStorage";
import { useClientLogger } from "@/hooks/useClientLogger";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
const GRADE_TABS = [{
  value: 'all',
  label: 'My Courses',
  icon: BookOpen
}, {
  value: 'planner',
  label: 'Grade Planner',
  icon: Calculator
}];
export default function Grades() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'all';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { isGuest } = useAuth();
  const { activeEnrollment, loading: enrollmentLoading } = useActiveProgram();
  const queryClient = useQueryClient();
  const logger = useClientLogger();

  useEffect(() => {
    logger.logEntityOperation(
      'grade-plan',
      'READ',
      'Grades page mounted',
      {
        isGuest,
        hasEnrollment: !!activeEnrollment,
        curriculumVersionId: activeEnrollment?.curriculum_version_id,
      },
      {
        component: 'Grades',
        interpretation: 'User navigated to Grades page. System will fetch course requirements and display grade data.',
      }
    );
    
    return () => {
      logger.info('component', 'Grades page unmounted');
    };
  }, [logger, isGuest, activeEnrollment]);

  // Invalidate curriculum queries when program changes for guests
  useEffect(() => {
    if (isGuest && activeEnrollment?.program_id) {
      logger.logCacheOperation(
        'INVALIDATE',
        ['requirement-groups-term', 'grouped-courses'],
        'Program changed for guest user - clearing old curriculum data to fetch fresh requirements for the new program',
        'Grades'
      );
      
      queryClient.invalidateQueries({ queryKey: ['requirement-groups-term'] });
      queryClient.invalidateQueries({ queryKey: ['grouped-courses'] });
    }
  }, [isGuest, activeEnrollment?.program_id, activeEnrollment?.curriculum_version_id, queryClient, logger]);

  // Fetch requirement groups (shared between GradePlanner and GradeTable)
  const { data: requirementGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ["requirement-groups-term", isGuest ? "guest" : activeEnrollment?.curriculum_version_id, isGuest],
    queryFn: async () => {
      logger.info('query', '=== REQUIREMENT GROUPS QUERY EXECUTING ===', { isGuest });
      // For guests with selected program, fetch curriculum data
      if (isGuest) {
        logger.debug('query', 'Checking guest enrollment', {});
        const enrollment = guestStorage.getEnrollment();
        logger.info('query', 'Guest enrollment retrieved', {
          hasEnrollment: !!enrollment,
          curriculumVersionId: enrollment?.curriculum_version_id,
          programId: enrollment?.program_id,
        });
        
        if (enrollment?.curriculum_version_id) {
          logger.info('query', 'Fetching requirement groups with curriculum_version_id', { 
            curriculumVersionId: enrollment.curriculum_version_id 
          });
          const { data, error } = await supabase
            .from("requirement_groups")
            .select("*")
            .eq("curriculum_id", enrollment.curriculum_version_id)
            .eq("group_type", "term")
            .order("display_order");
          if (error) {
            logger.error('api', 'Failed to fetch requirement groups', { error });
            throw error;
          }
          logger.info('query', 'Fetched requirement groups for guest', { count: data?.length || 0 });
          return data || [];
        }
        logger.warn('query', 'Guest has no curriculum_version_id', {});
        return [];
      }

      logger.debug('query', 'Fetching requirement groups for authenticated user', {});
      const { data, error } = await supabase
        .from("requirement_groups")
        .select("*")
        .eq("curriculum_id", activeEnrollment!.curriculum_version_id)
        .eq("group_type", "term")
        .order("display_order");
      if (error) {
        logger.error('api', 'Failed to fetch requirement groups', { error });
        throw error;
      }
      return data || [];
    },
    enabled: !!activeEnrollment?.curriculum_version_id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Fetch courses grouped by requirement group (shared)
  const { data: groupedCourses, isLoading: coursesLoading } = useQuery({
    queryKey: [
      "grouped-courses", 
      activeEnrollment?.curriculum_version_id || "guest", 
      isGuest,
      (Array.isArray(requirementGroups) ? requirementGroups.map((g: any) => g.id).join(',') : 'none')
    ],
    queryFn: async () => {
      // For guests with selected program, fetch curriculum courses
      if (isGuest) {
        if (!requirementGroups || !Array.isArray(requirementGroups) || requirementGroups.length === 0) return {};
        
        const groupIds = requirementGroups.map((g: any) => g.id);
        const { data: allRules } = await supabase
          .from("requirement_rules")
          .select("req_group_id, course_ids")
          .in("req_group_id", groupIds);
        
        const allCourseIds = Array.from(
          new Set(allRules?.flatMap(r => r.course_ids || []).filter(Boolean) || [])
        );
        
        const { data: allCourses } = await supabase
          .from("courses")
          .select("id, course_code, course_title, units")
          .in("id", allCourseIds)
          .order("course_code");
        
        const courseMap = new Map(allCourses?.map(c => [c.id, c]) || []);
        
        const result: Record<string, any[]> = {};
        (requirementGroups as any[]).forEach((group: any) => {
          const groupRules = allRules?.filter(r => r.req_group_id === group.id) || [];
          const groupCourseIds = groupRules.flatMap(r => r.course_ids || []).filter(Boolean);
          result[group.id] = groupCourseIds
            .map(id => courseMap.get(id))
            .filter(Boolean);
        });
        
        return result;
      }

      if (!requirementGroups || !Array.isArray(requirementGroups)) return {};
      
      const groupIds = (requirementGroups as any[]).map((g: any) => g.id);
      const { data: allRules } = await supabase
        .from("requirement_rules")
        .select("req_group_id, course_ids")
        .in("req_group_id", groupIds);
      
      const allCourseIds = Array.from(
        new Set(allRules?.flatMap(r => r.course_ids || []).filter(Boolean) || [])
      );
      
      const { data: allCourses } = await supabase
        .from("courses")
        .select("id, course_code, course_title, units")
        .in("id", allCourseIds)
        .order("course_code");
      
      const courseMap = new Map(allCourses?.map(c => [c.id, c]) || []);
      
      const result: Record<string, any[]> = {};
      (requirementGroups as any[]).forEach((group: any) => {
        const groupRules = allRules?.filter(r => r.req_group_id === group.id) || [];
        const groupCourseIds = groupRules.flatMap(r => r.course_ids || []).filter(Boolean);
        result[group.id] = groupCourseIds
          .map(id => courseMap.get(id))
          .filter(Boolean);
      });
      
      return result;
    },
    enabled: !!activeEnrollment?.curriculum_version_id && !!requirementGroups && Array.isArray(requirementGroups) && requirementGroups.length > 0,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const isLoadingCurriculum = enrollmentLoading || groupsLoading || coursesLoading;
  if (isLoadingCurriculum) {
    return <div className="max-w-7xl mx-auto space-y-8">
        <div className="min-h-[50px]">
          <Skeleton className="h-[44px] w-48 max-w-full mb-2" />
          <Skeleton className="h-[24px] w-96 max-w-full" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-10 w-[240px]" />
          
          <Card>
            <CardContent className="pt-5 space-y-5">
              {/* Badges skeleton */}
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-7 w-48 max-w-full rounded-md" />
                <Skeleton className="h-7 w-40 max-w-full rounded-md" />
              </div>

              {/* Action buttons skeleton */}
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 shrink-0" />
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
              </div>

              {/* Search and filters skeleton */}
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <div className="flex gap-3">
                  <Skeleton className="h-10 flex-[35]" />
                  <Skeleton className="h-10 flex-[65]" />
                </div>
              </div>

              {/* Course list skeleton */}
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                          <Skeleton className="h-8 w-16" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>;
  }

  // Guard: Prevent render loop for guests without program selection
  if (isGuest && !activeEnrollment?.curriculum_version_id) {
    return <div className="max-w-7xl mx-auto space-y-8">
        <div className="min-h-[50px]">
          <h1 className="text-4xl font-bold mb-2">Grades</h1>
          <p className="text-muted-foreground">View your curriculum and plan your academic performance</p>
        </div>
        
        <Card className="p-12 text-center">
          <div className="space-y-4">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h2 className="text-2xl font-bold mb-2">No Program Selected</h2>
              <p className="text-muted-foreground mb-6">
                Please select your academic program from the Program Tracker first
              </p>
              <Link 
                to="/tracker"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                Go to Program Tracker
              </Link>
            </div>
          </div>
        </Card>
      </div>;
  }
  return <ErrorBoundary>
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="min-h-[50px]">
        <h1 className="text-4xl font-bold mb-2">Grades</h1>
        <p className="text-muted-foreground">View your curriculum and plan your academic performance</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger className="w-[240px]">
            <SelectValue>
              {GRADE_TABS.find(tab => tab.value === activeTab) && <div className="flex items-center gap-2">
                  {(() => {
                const Icon = GRADE_TABS.find(tab => tab.value === activeTab)!.icon;
                return <Icon className="h-4 w-4" />;
              })()}
                  <span>{GRADE_TABS.find(tab => tab.value === activeTab)!.label}</span>
                </div>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {GRADE_TABS.map(({
            value,
            label,
            icon: Icon
          }) => <SelectItem key={value} value={value}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </div>
              </SelectItem>)}
          </SelectContent>
        </Select>

        <TabsContent value="all" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-5">
              <GradeTable 
                requirementGroups={requirementGroups || []} 
                groupedCourses={groupedCourses || {}}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planner" className="mt-4 space-y-4">
          <GradePlanner 
            requirementGroups={requirementGroups || []} 
            groupedCourses={groupedCourses || {}}
          />
        </TabsContent>
      </Tabs>
    </div>
  </ErrorBoundary>;
}
