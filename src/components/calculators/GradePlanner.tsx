import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProgram } from "@/hooks/useActiveProgram";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClientLogger } from "@/hooks/useClientLogger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw, Share2, Download, Trash2, Search, Check, Upload } from "lucide-react";
import { toast } from "sonner";
import { calculateQPI, GRADE_OPTIONS, qpiToGWA } from "@/utils/qpiCalculations";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteGradePlanDialog } from "./DeleteGradePlanDialog";
import { ShareGradePlanDialog } from "./ShareGradePlanDialog";
import { ImportGradePlanDialog } from "./ImportGradePlanDialog";
import { GradePlanSharePayload } from "@/utils/gradePlanCodeGenerator";
import { normalizeSemester } from "@/utils/terms";
import { fuzzyMatchCourseCode } from "@/utils/courseCodeNormalizer";
interface Course {
  id: string;
  course_code: string;
  course_title: string;
  units: number;
}
interface RequirementGroup {
  id: string;
  curriculum_id: string;
  name: string;
  group_type: string;
  display_order: number;
  min_units: number | null;
}
interface PlanCourse extends Course {
  grade?: string;
  is_from_actual: boolean;
  plan_course_id?: string;
  year_level?: number;
  semester_label?: string;
  term_semester?: number;
  term_year?: number;
}
interface GradePlannerProps {
  requirementGroups?: any[];
  groupedCourses?: Record<string, Course[]>;
}
export function GradePlanner({
  requirementGroups,
  groupedCourses
}: GradePlannerProps) {
  const {
    user,
    isGuest
  } = useAuth();
  const {
    activeEnrollment,
    loading: enrollmentLoading
  } = useActiveProgram();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const logger = useClientLogger();
  const [planCourses, setPlanCourses] = useState<Map<string, PlanCourse>>(new Map());
  const [targetQPI, setTargetQPI] = useState<string>("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(1);
  const [semesterFilter, setSemesterFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch or create active grade plan
  const {
    data: activePlan,
    isLoading: planLoading
  } = useQuery({
    queryKey: ["active-grade-plan", user?.id, activeEnrollment?.curriculum_version_id, isGuest],
    queryFn: async () => {
      logger.debug('grade-planner', 'Fetching grade plan', {
        isGuest,
        hasEnrollment: !!activeEnrollment
      });
      if (isGuest) {
        logger.info('grade-planner', 'Returning mock plan for guest', {});
        // For guests, return a mock plan object
        return {
          id: 'guest-plan',
          user_id: 'guest',
          curriculum_version_id: activeEnrollment!.curriculum_version_id,
          plan_name: 'My Grade Plan',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      logger.debug('grade-planner', 'Fetching existing plan from database', {});
      const {
        data: existingPlan,
        error: fetchError
      } = await supabase.from("user_grade_plans").select("*").eq("user_id", user!.id).eq("curriculum_version_id", activeEnrollment!.curriculum_version_id).eq("is_active", true).maybeSingle();
      if (fetchError) throw fetchError;
      if (existingPlan) return existingPlan;

      // Create new plan if none exists
      const {
        data: newPlan,
        error: createError
      } = await supabase.from("user_grade_plans").insert({
        user_id: user!.id,
        curriculum_version_id: activeEnrollment!.curriculum_version_id,
        plan_name: "My Grade Plan",
        is_active: true
      }).select().single();
      if (createError) throw createError;
      return newPlan;
    },
    enabled: (!!user || isGuest) && !!activeEnrollment?.curriculum_version_id,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000
  });

  // Fetch plan courses from database or guest storage
  const {
    data: savedPlanCourses
  } = useQuery({
    queryKey: ["grade-plan-courses", activePlan?.id, isGuest],
    queryFn: async () => {
      if (isGuest) {
        logger.debug('grade-planner', 'Fetching guest grade plan courses from sessionStorage', {});
        const {
          guestStorage
        } = await import('@/utils/guestStorage');
        const plans = guestStorage.getGradePlans();
        logger.info('grade-planner', 'Guest grade plan courses retrieved', {
          count: plans.length
        });
        return plans;
      }
      logger.debug('grade-planner', 'Fetching plan courses from database', {
        planId: activePlan!.id
      });
      const {
        data,
        error
      } = await supabase.from("user_grade_plan_courses").select("*").eq("plan_id", activePlan!.id);
      if (error) {
        logger.error('grade-planner', 'Failed to fetch plan courses', {
          error
        });
        throw error;
      }
      logger.info('grade-planner', 'Plan courses fetched', {
        count: data?.length || 0
      });
      return data;
    },
    enabled: !!activePlan,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Fetch user's actual grades
  const {
    data: actualGrades
  } = useQuery({
    queryKey: ["user-courses", isGuest ? "guest" : user?.id, isGuest],
    queryFn: async () => {
      if (isGuest) {
        const {
          guestStorage
        } = await import('@/utils/guestStorage');
        return guestStorage.getCourses();
      }
      const {
        data,
        error
      } = await supabase.from("user_courses").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user || isGuest,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Listen for guest actual grades updates and refresh in real-time
  useEffect(() => {
    const onGuestCoursesChanged = () => {
      queryClient.invalidateQueries({
        queryKey: ["user-courses", isGuest ? "guest" : user?.id, isGuest]
      });
    };
    window.addEventListener("guest-courses-changed", onGuestCoursesChanged);
    return () => window.removeEventListener("guest-courses-changed", onGuestCoursesChanged);
  }, [queryClient, user?.id, isGuest]);

  // Initialize plan courses from saved data
  useEffect(() => {
    if (savedPlanCourses) {
      const coursesMap = new Map<string, PlanCourse>();
      savedPlanCourses.forEach(saved => {
        coursesMap.set(saved.course_code, {
          id: saved.course_id || "",
          course_code: saved.course_code,
          course_title: saved.course_title,
          units: saved.units,
          semester_label: saved.semester_label,
          year_level: saved.year_level,
          grade: saved.grade,
          is_from_actual: saved.is_from_actual,
          plan_course_id: saved.id
        });
      });
      setPlanCourses(coursesMap);
    }
  }, [savedPlanCourses]);

  // Save course mutation with optimistic updates
  const saveCourseMutation = useMutation({
    mutationFn: async (course: PlanCourse) => {
      if (isGuest) {
        // For guests, store in sessionStorage via guestStorage
        logger.info('grade-planner', 'Saving guest grade plan course', {
          courseCode: course.course_code,
          grade: course.grade
        });
        const {
          guestStorage
        } = await import('@/utils/guestStorage');
        const plans = guestStorage.getGradePlans();

        // Find or create the guest plan courses array
        const existingIndex = plans.findIndex((p: any) => p.course_code === course.course_code);
        const updatedCourse = {
          id: course.plan_course_id || crypto.randomUUID(),
          plan_id: activePlan!.id,
          course_id: course.id || null,
          course_code: course.course_code,
          course_title: course.course_title,
          units: course.units,
          grade: course.grade,
          is_from_actual: course.is_from_actual,
          year_level: course.year_level,
          semester_label: course.semester_label
        };
        if (existingIndex >= 0) {
          plans[existingIndex] = updatedCourse;
        } else {
          plans.push(updatedCourse);
        }
        guestStorage.setGradePlans(plans);
        return updatedCourse.id;
      }

      // Database logic for authenticated users
      if (course.plan_course_id) {
        // Update existing
        const {
          error
        } = await supabase.from("user_grade_plan_courses").update({
          grade: course.grade,
          is_from_actual: course.is_from_actual
        }).eq("id", course.plan_course_id);
        if (error) throw error;
      } else {
        // Insert new
        const {
          data,
          error
        } = await supabase.from("user_grade_plan_courses").insert({
          plan_id: activePlan!.id,
          course_id: course.id || null,
          course_code: course.course_code,
          course_title: course.course_title,
          units: course.units,
          term_semester: course.term_semester || 1,
          term_year: course.term_year || 1,
          grade: course.grade,
          is_from_actual: course.is_from_actual
        }).select().single();
        if (error) throw error;
        return data.id;
      }
    },
    onMutate: async course => {
      await queryClient.cancelQueries({
        queryKey: ["grade-plan-courses", activePlan?.id]
      });
      const previousCourses = queryClient.getQueryData(["grade-plan-courses", activePlan?.id]);
      queryClient.setQueryData(["grade-plan-courses", activePlan?.id], (old: any) => {
        if (!old) return old;
        const exists = old.find((c: any) => c.course_code === course.course_code);
        if (exists) {
          return old.map((c: any) => c.course_code === course.course_code ? {
            ...c,
            grade: course.grade,
            is_from_actual: course.is_from_actual
          } : c);
        } else {
          return [...old, {
            plan_id: activePlan!.id,
            course_id: course.id,
            course_code: course.course_code,
            course_title: course.course_title,
            units: course.units,
            grade: course.grade,
            is_from_actual: course.is_from_actual
          }];
        }
      });
      return {
        previousCourses
      };
    },
    onError: (err, course, context) => {
      queryClient.setQueryData(["grade-plan-courses", activePlan?.id], context?.previousCourses);
      toast.error("Failed to save grade");
    },
    onSuccess: (newId, course) => {
      if (newId && !course.plan_course_id) {
        setPlanCourses(prev => {
          const updated = new Map(prev);
          const existing = updated.get(course.course_code);
          if (existing) {
            updated.set(course.course_code, {
              ...existing,
              plan_course_id: newId
            });
          }
          return updated;
        });
      }
    }
  });

  // Delete course mutation with optimistic updates
  const deleteCourseMutation = useMutation({
    mutationFn: async (planCourseId: string) => {
      if (isGuest) {
        logger.info('grade-planner', 'Deleting guest grade plan course', {
          planCourseId
        });
        const {
          guestStorage
        } = await import('@/utils/guestStorage');
        const plans = guestStorage.getGradePlans();
        const filtered = plans.filter((p: any) => p.id !== planCourseId);
        guestStorage.setGradePlans(filtered);
        return;
      }
      const {
        error
      } = await supabase.from("user_grade_plan_courses").delete().eq("id", planCourseId);
      if (error) throw error;
    },
    onMutate: async planCourseId => {
      await queryClient.cancelQueries({
        queryKey: ["grade-plan-courses", activePlan?.id]
      });
      const previousCourses = queryClient.getQueryData(["grade-plan-courses", activePlan?.id]);
      queryClient.setQueryData(["grade-plan-courses", activePlan?.id], (old: any) => old?.filter((c: any) => c.id !== planCourseId) || []);
      return {
        previousCourses
      };
    },
    onError: (error, planCourseId, context) => {
      queryClient.setQueryData(["grade-plan-courses", activePlan?.id], context?.previousCourses);
      toast.error("Failed to remove course");
    },
    onSuccess: () => {
      toast.success("Course removed from plan");
    }
  });

  // Debounced save to prevent rapid-fire mutations
  const debouncedSave = useCallback((course: PlanCourse) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveCourseMutation.mutate(course);
    }, 500);
  }, [saveCourseMutation]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
  const handleGradeChange = (course: Course, grade: string) => {
    setPlanCourses(prev => {
      const updated = new Map(prev);
      const existingCourse = updated.get(course.course_code);
      const updatedCourse: PlanCourse = {
        ...(existingCourse || course),
        grade,
        is_from_actual: false
      };
      updated.set(course.course_code, updatedCourse);
      debouncedSave(updatedCourse);
      return updated;
    });
  };
  const handleDeleteCourse = (courseCode: string) => {
    const planCourse = planCourses.get(courseCode);
    if (!planCourse?.plan_course_id) return;

    // Optimistically update UI
    setPlanCourses(prev => {
      const updated = new Map(prev);
      updated.delete(courseCode);
      return updated;
    });
    deleteCourseMutation.mutate(planCourse.plan_course_id);
  };
  const syncActualGrades = async () => {
    if (!groupedCourses) return;

    // If no actual grades yet, inform user but keep button enabled for realtime updates
    if (!actualGrades || actualGrades.length === 0) {
      toast.info("No actual grades found to sync yet");
      return;
    }
    setIsSyncing(true);
    try {
      const coursesMap = new Map(planCourses);
      const coursesToSync: PlanCourse[] = [];
      const allCurrCourses = Object.values(groupedCourses).flat();
      actualGrades.forEach((actual: any) => {
        const currCourse = allCurrCourses.find(c => fuzzyMatchCourseCode(actual.course_code, c.course_code, actual.course_title, c.course_title));
        if (currCourse) {
          const existing = coursesMap.get(currCourse.course_code);
          const updated: PlanCourse = {
            ...(existing || currCourse),
            grade: actual.grade,
            is_from_actual: true
          };

          // Only queue saves if there is a real change
          const changed = !existing || existing.grade !== actual.grade || existing.is_from_actual !== true;
          coursesMap.set(currCourse.course_code, updated);
          if (changed) {
            coursesToSync.push(updated);
          }
        }
      });

      // If nothing changed, skip writes
      if (coursesToSync.length === 0) {
        setPlanCourses(coursesMap);
        toast.info("Already up to date with actual grades");
        return;
      }
      setPlanCourses(coursesMap);
      await Promise.all(coursesToSync.map(course => saveCourseMutation.mutateAsync(course)));

      // Invalidate cache to ensure fresh data
      await queryClient.invalidateQueries({
        queryKey: ["grade-plan-courses", activePlan?.id, isGuest]
      });
      toast.success(`Synced ${coursesToSync.length} courses from actual grades`);
    } catch (error) {
      toast.error("Failed to sync some courses");
    } finally {
      setIsSyncing(false);
    }
  };
  const handleDeletePlan = async () => {
    if (!activePlan) return;
    setIsDeleting(true);
    try {
      if (isGuest) {
        logger.info('grade-planner', 'Clearing guest grade plan', {});
        const {
          guestStorage
        } = await import('@/utils/guestStorage');
        guestStorage.setGradePlans([]);
        toast.success('Grade plan cleared successfully');
      } else {
        await supabase.from('user_grade_plan_courses').delete().eq('plan_id', activePlan.id);
        await supabase.from('user_grade_plans').delete().eq('id', activePlan.id);
        toast.success('Grade plan deleted successfully');
      }
      setShowDeleteDialog(false);
      setPlanCourses(new Map());
      queryClient.invalidateQueries({
        queryKey: ['active-grade-plan']
      });
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Failed to delete grade plan');
    } finally {
      setIsDeleting(false);
    }
  };
  const handleImportPlan = async (payload: GradePlanSharePayload) => {
    if (!activePlan) return;
    try {
      const coursesToInsert = payload.courses.map(course => ({
        plan_id: activePlan.id,
        course_id: course.course_id || null,
        course_code: course.course_code,
        course_title: course.course_title,
        units: course.units,
        semester_label: course.semester_label,
        year_level: course.year_level,
        grade: course.grade,
        is_from_actual: false,
        term_semester: 1,
        term_year: course.year_level || 1
      }));
      const {
        error
      } = await supabase.from('user_grade_plan_courses').insert(coursesToInsert);
      if (error) throw error;
      toast.success(`Imported ${payload.courses.length} courses from "${payload.plan_name}"`);
      queryClient.invalidateQueries({
        queryKey: ['grade-plan-courses']
      });
    } catch (error) {
      console.error('Error importing plan:', error);
      throw error;
    }
  };

  // Extract available years from requirement groups (robust parser)
  const availableYears = useMemo(() => {
    if (!requirementGroups) return [];
    const years = new Set<number>();
    requirementGroups.forEach(group => {
      const lower = (group.name || '').toLowerCase();
      const word = lower.match(/(first|second|third|fourth|fifth)\s+year/);
      if (word) {
        const map: Record<string, number> = {
          first: 1,
          second: 2,
          third: 3,
          fourth: 4,
          fifth: 5
        };
        years.add(map[word[1]]);
        return;
      }
      const ordinal = lower.match(/(\d+)(st|nd|rd|th)?\s+year/);
      if (ordinal) {
        years.add(parseInt(ordinal[1], 10));
        return;
      }
      const afterWord = lower.match(/year\s*(\d+)/);
      if (afterWord) {
        years.add(parseInt(afterWord[1], 10));
        return;
      }
      const short = lower.match(/\b(y|yr)\s*([1-5])\b/);
      if (short) {
        years.add(parseInt(short[2], 10));
        return;
      }
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [requirementGroups]);

  // Extract available semesters from requirement groups (data-driven)
  const availableSemesters = useMemo(() => {
    if (!requirementGroups) return [];
    const semesters = new Set<string>();
    requirementGroups.forEach(group => {
      const lower = (group.name || '').toLowerCase();
      if (/(^|\b)(1st|first)\s*(sem|semester)\b/.test(lower)) semesters.add('First Semester');else if (/(^|\b)(2nd|second)\s*(sem|semester)\b/.test(lower)) semesters.add('Second Semester');else if (/(intercession|intersession|summer|mid[- ]?year)/.test(lower)) semesters.add('Intercession');
    });
    const order = ['First Semester', 'Second Semester', 'Intercession'];
    return order.filter(s => semesters.has(s));
  }, [requirementGroups]);

  // Build groups with their courses - filter by selected year and semester
  const filteredGroups = useMemo(() => {
    if (!requirementGroups || !groupedCourses) return [];
    return requirementGroups.filter(group => {
      // Parse year from group name (supports words, ordinals, numerals)
      const lower = (group.name || '').toLowerCase();
      const wordMap: Record<string, number> = {
        first: 1,
        second: 2,
        third: 3,
        fourth: 4,
        fifth: 5
      };
      let groupYear: number | null = null;
      const m1 = lower.match(/(first|second|third|fourth|fifth)\s+year/);
      if (m1) groupYear = wordMap[m1[1]];
      const m2 = lower.match(/(\d+)(st|nd|rd|th)?\s+year/);
      if (groupYear == null && m2) groupYear = parseInt(m2[1], 10);
      const m3 = lower.match(/year\s*(\d+)/);
      if (groupYear == null && m3) groupYear = parseInt(m3[1], 10);
      const m4 = lower.match(/\b(y|yr)\s*([1-5])\b/);
      if (groupYear == null && m4) groupYear = parseInt(m4[2], 10);
      if (groupYear !== null && groupYear !== selectedYear) return false;

      // Filter by semester
      if (semesterFilter !== "all") {
        const groupSemester = /(^|\b)(1st|first)\s*(sem|semester)\b/.test(lower) ? 'First Semester' : /(^|\b)(2nd|second)\s*(sem|semester)\b/.test(lower) ? 'Second Semester' : /(intercession|intersession|summer|mid[- ]?year)/.test(lower) ? 'Intercession' : null;
        return groupSemester === semesterFilter;
      }
      return true;
    }).map(group => ({
      group,
      courses: (groupedCourses[group.id] || []).filter((course: Course) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return course.course_code.toLowerCase().includes(query) || course.course_title.toLowerCase().includes(query);
      })
    })).filter(({
      courses
    }) => courses.length > 0).sort((a, b) => a.group.display_order - b.group.display_order);
  }, [requirementGroups, groupedCourses, selectedYear, semesterFilter, searchQuery]);

  // Calculate QPI
  const qpiData = useMemo(() => {
    const coursesWithGrades = Array.from(planCourses.values()).filter(c => c.grade && c.grade !== "N/A").map(c => ({
      course_code: c.course_code,
      units: c.units,
      grade: c.grade!,
      qpi_value: null,
      course_title: c.course_title,
      user_id: user?.id || "",
      id: c.id,
      school_year: "",
      semester: 1,
      created_at: "",
      updated_at: "",
      grading_basis: "letter" as const,
      counts_for_qpi: true,
      course_id: c.id,
      term_code: null
    }));
    return calculateQPI(coursesWithGrades);
  }, [planCourses, user]);

  // Calculate total units from requirement groups
  const totalUnits = useMemo(() => {
    if (!requirementGroups) return 0;
    return requirementGroups.reduce((sum, g) => sum + (g.min_units || 0), 0);
  }, [requirementGroups]);
  const completedUnits = qpiData.totalUnits;
  const remainingUnits = totalUnits - completedUnits;
  const progressPercent = totalUnits > 0 ? completedUnits / totalUnits * 100 : 0;

  // Calculate required QPI for target
  const calculateRequiredQPI = () => {
    const target = parseFloat(targetQPI);
    if (isNaN(target) || remainingUnits <= 0) return null;
    const currentQP = qpiData.cumulativeQPI * qpiData.totalUnits;
    const requiredQP = target * totalUnits - currentQP;
    const requiredQPI = requiredQP / remainingUnits;
    return requiredQPI;
  };
  const requiredQPI = calculateRequiredQPI();

  // Helper function to get grade background color (pastel colors)
  const getGradeBackgroundColor = (grade: string | undefined): string => {
    if (!grade) return '';
    const colorMap: Record<string, string> = {
      'A': 'bg-green-100 text-green-900 border-green-200',
      'B+': 'bg-lime-100 text-lime-900 border-lime-200',
      'B': 'bg-yellow-100 text-yellow-900 border-yellow-200',
      'C+': 'bg-orange-50 text-orange-900 border-orange-100',
      'C': 'bg-pink-100 text-pink-900 border-pink-200',
      'D': 'bg-pink-200 text-pink-900 border-pink-300',
      'F': 'bg-red-200 text-red-900 border-red-300',
      'W': 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return colorMap[grade] || '';
  };
  const isLoadingPlan = planLoading;
  const isLoadingSavedCourses = !savedPlanCourses && !!activePlan?.id;
  const isLoadingActualGrades = !actualGrades && !!user;
  return <Card>
      <CardContent className="pt-5 space-y-5">
      {activeEnrollment && <div className="flex flex-wrap items-center gap-2">
          {/* Mobile: Show only code */}
          <Badge variant="secondary" className="md:hidden text-sm px-3 py-1 whitespace-nowrap">
            {activeEnrollment.programs?.code}
          </Badge>
          {/* Desktop: Show full name with code */}
          <Badge variant="secondary" className="hidden md:inline-flex text-sm px-3 py-1 whitespace-nowrap">
            {activeEnrollment.programs?.name} ({activeEnrollment.programs?.code})
          </Badge>
          
          {activeEnrollment.curriculum_versions && <>
              {/* Mobile: Show only version */}
              <Badge variant="outline" className="md:hidden text-sm px-3 py-1 whitespace-nowrap">
                {activeEnrollment.curriculum_versions.version_label}
              </Badge>
              {/* Desktop: Show full label */}
              <Badge variant="outline" className="hidden md:inline-flex text-sm px-3 py-1 whitespace-nowrap">
                Curriculum: {activeEnrollment.curriculum_versions.version_label}
              </Badge>
            </>}
        </div>}

      {!enrollmentLoading && !activeEnrollment && <div className="text-center py-12 text-muted-foreground">
          Select a program to start planning your grades.
        </div>}

      {activeEnrollment && activePlan && <div className="space-y-3">
          <div className="flex gap-3">
            <Button variant="destructive" size="icon" onClick={() => setShowDeleteDialog(true)} title="Delete grade plan" className="shrink-0">
              <Trash2 className="h-4 w-4" />
            </Button>

            <Button variant="outline" onClick={syncActualGrades} disabled={isSyncing} className="flex-1">
              {isSyncing ? <>Syncing...</> : <>
                  <Download className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Sync from Actual</span>
                </>}
            </Button>

            <Button variant="outline" onClick={() => setShowShareDialog(true)} className="flex-1">
              <Share2 className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Share Plan</span>
            </Button>

            <Button variant="outline" onClick={() => setShowImportDialog(true)} className="flex-1">
              <Upload className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Import Plan</span>
            </Button>
          </div>

          <div className="space-y-3">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search courses..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
              </div>

              <div className="flex flex-row gap-3">
                <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="flex-[35]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.length > 0 ? availableYears.map(year => <SelectItem key={year} value={year.toString()}>Year {year}</SelectItem>) : <SelectItem value="1">Year 1</SelectItem>}
                  </SelectContent>
                </Select>
                
                <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                  <SelectTrigger className="flex-[65]">
                    <SelectValue placeholder="All Semesters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Semesters</SelectItem>
                    {availableSemesters.map(semester => <SelectItem key={semester} value={semester}>
                        {semester}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Responsive Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Course List */}
              <div className="lg:col-span-2 space-y-6">
                {filteredGroups.length > 0 ? <Accordion type="single" collapsible defaultValue={filteredGroups[0]?.group.id}>
                    {filteredGroups.map(({
                  group,
                  courses
                }) => {
                  return <AccordionItem key={group.id} value={group.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2 w-full pr-4">
                              <Badge variant="secondary" className="px-1.5 py-0 w-16 justify-center">
                                {(() => {
                            const totalUnitsGroup = courses.reduce((sum, c) => sum + c.units, 0);
                            const gradedUnitsGroup = courses.reduce((sum, c) => {
                              const planCourse = planCourses.get(c.course_code);
                              return planCourse?.grade ? sum + c.units : sum;
                            }, 0);
                            return `${gradedUnitsGroup} / ${totalUnitsGroup}`;
                          })()}
                              </Badge>
                              <span className="font-semibold">
                                {group.name}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 pt-2">
                              {courses.map((course: Course) => {
                          const planCourse = planCourses.get(course.course_code);
                          return <div key={course.id} className="flex items-center justify-between rounded-lg border bg-card hover:bg-accent/50 transition-colors p-2">
                                    <div className="flex-1 min-w-0 mr-2">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="px-1.5 py-0">
                                          {course.units}
                                        </Badge>
                                        <span className="font-medium text-foreground">
                                          {course.course_code}
                                        </span>
                                      </div>
                                      <div className="text-muted-foreground truncate mt-0.5">
                                        {course.course_title}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background">
                                      {isLoadingSavedCourses ? <Skeleton className="w-[80px] h-8" /> : <>
                                          <Select value={planCourse?.grade || ""} onValueChange={grade => handleGradeChange(course, grade)}>
                                            <SelectTrigger className={`w-[80px] h-8 border-0 ${getGradeBackgroundColor(planCourse?.grade)}`}>
                                              <SelectValue placeholder="N/A" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {GRADE_OPTIONS.map(grade => <SelectItem key={grade} value={grade}>
                                                  {grade}
                                                </SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                          <Button size="icon" variant="ghost" onClick={() => handleDeleteCourse(course.course_code)} disabled={!planCourse} className="h-7 w-7 disabled:opacity-30">
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </>}
                                    </div>
                                  </div>;
                        })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>;
                })}

                    {/* Uncategorized Section */}
                    <AccordionItem value="uncategorized" className="border-0">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2 w-full pr-4">
                          <Badge variant="secondary" className="px-0 py-0 w-16 flex items-center justify-center">
                            0
                          </Badge>
                          <span className="font-semibold">
                            Uncategorized
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="text-center py-8 text-muted-foreground">
                          <Check className="h-12 w-12 mx-auto mb-2 text-green-500" />
                          <p>All courses are from your curriculum!</p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion> : <div className="text-center py-12 text-muted-foreground">
                    {activeEnrollment ? "No curriculum data available for your program." : "Select a program to view curriculum courses."}
                  </div>}
              </div>

              {/* Right Column: QPI Summary Card */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>QPI Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      <div>
                        <div className="text-3xl font-bold">{qpiData.cumulativeQPI.toFixed(2)}</div>
                        <div className="text-sm text-muted-foreground">Planned QPI</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          GWA: {qpiToGWA(qpiData.cumulativeQPI).toFixed(2)}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Progress</span>
                          <span>
                            {completedUnits} / {totalUnits} units
                          </span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                        <div className="text-xs text-muted-foreground mt-1">
                          {remainingUnits} units remaining
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="target-qpi">Target QPI</Label>
                        <Input id="target-qpi" type="number" step="0.01" min="0" max="4" value={targetQPI} onChange={e => setTargetQPI(e.target.value)} placeholder="e.g., 3.50" />
                        {requiredQPI !== null && remainingUnits > 0 && <div className="text-sm">
                            <span className="text-muted-foreground">Required QPI: </span>
                            <span className={requiredQPI > 4 ? "text-destructive font-semibold" : "text-primary font-semibold"}>
                              {requiredQPI.toFixed(2)}
                            </span>
                            {requiredQPI > 4 && <span className="text-destructive text-xs block mt-1">
                                Target not achievable with remaining units
                              </span>}
                          </div>}
                      </div>

                      <div className="pt-4 border-t">
                        <div className="text-xs text-muted-foreground mb-2">Grade Distribution</div>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          {Object.entries(qpiData.gradeDistribution).map(([grade, count]) => <div key={grade} className="flex justify-between">
                              <span className="text-muted-foreground">{grade}:</span>
                              <span className="font-medium">{count}</span>
                            </div>)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>}

        {/* Dialogs */}
      <DeleteGradePlanDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} onConfirm={handleDeletePlan} planName={activePlan?.plan_name || ""} isDeleting={isDeleting} />

      {activePlan && <>
          <ShareGradePlanDialog open={showShareDialog} onOpenChange={setShowShareDialog} planId={activePlan.id} planName={activePlan.plan_name} curriculumVersionId={activePlan.curriculum_version_id} />

          <ImportGradePlanDialog open={showImportDialog} onOpenChange={setShowImportDialog} onImport={handleImportPlan} />
        </>}
      </CardContent>
    </Card>;
}
