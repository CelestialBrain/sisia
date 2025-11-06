import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProgram } from "@/hooks/useActiveProgram";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { guestStorage } from "@/utils/guestStorage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { GradeForm } from "./GradeForm";
import { ImportAISIS } from "./ImportAISIS";
import { Edit, Trash2, Download, Search, List, Upload, AlertCircle, Check } from "lucide-react";
import { calculateQPI, countsInQPI, GRADE_OPTIONS, qpiToGWA } from "@/utils/qpiCalculations";
import { fetchCurriculumCourses } from "@/utils/curriculumFetcher";
import { normalizeSemester } from "@/utils/terms";
import { normalizeAISISCourseCode, normalizeCurriculumCourseCode, fuzzyMatchCourseCode, COURSE_EQUIVALENCIES } from "@/utils/courseCodeNormalizer";

interface GradeTableProps {
  requirementGroups?: any[];
  groupedCourses?: Record<string, any[]>;
}

export function GradeTable({ requirementGroups, groupedCourses }: GradeTableProps) {
  const { user, isGuest } = useAuth();
  const { activeEnrollment } = useActiveProgram();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [editingGrade, setEditingGrade] = useState<any>(null);
  const [deletingGrade, setDeletingGrade] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(1);
  const [targetQPI, setTargetQPI] = useState<string>("");

  // Fetch user grades (from Supabase or guest storage)
  const { data: grades, isLoading: isGradesLoading } = useQuery({
    queryKey: ["user-courses", isGuest ? "guest" : user?.id, isGuest],
    queryFn: async () => {
      if (isGuest) {
        return guestStorage.getCourses();
      }
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_courses")
        .select("*")
        .eq("user_id", user.id)
        .order("school_year", { ascending: false })
        .order("semester");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user || isGuest,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  });

  // Save grade mutation with optimistic updates
  const saveGradeMutation = useMutation({
    mutationFn: async ({ courseCode, courseTitle, units, grade }: any) => {
      if (!user && !isGuest) throw new Error("No user");
      
      // Handle guest mode
      if (isGuest) {
        const existing = grades?.find(g => g.course_code === courseCode);
        if (existing) {
          guestStorage.updateCourse(existing.id, { grade });
        } else {
          guestStorage.addCourse({
            id: guestStorage.generateId(),
            course_code: courseCode,
            course_title: courseTitle,
            units,
            grade,
            school_year: new Date().getFullYear().toString(),
            semester: "First Semester",
          });
        }
        return;
      }
      
      // Check if grade exists
      const existing = grades?.find(g => g.course_code === courseCode);
      
      if (existing) {
        // Update
        const { error } = await supabase
          .from("user_courses")
          .update({ grade })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("user_courses")
          .insert({
            user_id: user.id,
            course_code: courseCode,
            course_title: courseTitle,
            units,
            grade,
            school_year: new Date().getFullYear().toString(),
            semester: 1,
          });
        if (error) throw error;
      }
    },
    onMutate: async ({ courseCode, courseTitle, units, grade }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["user-courses", isGuest ? "guest" : user?.id, isGuest] });
      
      // Snapshot previous value
      const previousGrades = queryClient.getQueryData(["user-courses", isGuest ? "guest" : user?.id, isGuest]);
      
      // Optimistically update to new value
      queryClient.setQueryData(["user-courses", isGuest ? "guest" : user?.id, isGuest], (old: any) => {
        const existing = old?.find((g: any) => g.course_code === courseCode);
        if (existing) {
          return old.map((g: any) => 
            g.course_code === courseCode ? { ...g, grade } : g
          );
        } else {
          return [...(old || []), { 
            course_code: courseCode, 
            course_title: courseTitle,
            units,
            grade,
            school_year: new Date().getFullYear().toString(),
            semester: "First Semester",
            user_id: user?.id,
          }];
        }
      });
      
      return { previousGrades };
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(["user-courses", isGuest ? "guest" : user?.id, isGuest], context?.previousGrades);
      toast({
        title: "Error saving grade",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ["user-courses", isGuest ? "guest" : user?.id, isGuest] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isGuest) {
        guestStorage.deleteCourse(id);
        return;
      }
      const { error } = await supabase.from("user_courses").delete().eq("id", id);
      if (error) throw error;
    },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["user-courses", isGuest ? "guest" : user?.id, isGuest] });
      toast({
        title: "Grade deleted",
        description: "The grade has been deleted successfully.",
      });
      setDeletingGrade(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAllGradesMutation = useMutation({
    mutationFn: async () => {
      if (!user && !isGuest) throw new Error("No user");
      if (isGuest) {
        guestStorage.setCourses([]);
        return;
      }
      const { error } = await supabase
        .from("user_courses")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["user-courses", isGuest ? "guest" : user?.id, isGuest] });
      toast({
        title: "All grades deleted",
        description: "All your grades have been permanently deleted.",
      });
      setShowDeleteAllDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Extract available years from requirement groups - robust parser (words, ordinals, numerals)
  const availableYears = useMemo(() => {
    if (!requirementGroups) return [];
    const years = new Set<number>();
    requirementGroups.forEach((group: any) => {
      const lower = (group.name || '').toLowerCase();
      const word = lower.match(/(first|second|third|fourth|fifth)\s+year/);
      if (word) {
        const map: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
        years.add(map[word[1]]);
        return;
      }
      const ordinal = lower.match(/(\d+)(st|nd|rd|th)?\s+year/);
      if (ordinal) { years.add(parseInt(ordinal[1], 10)); return; }
      const afterWord = lower.match(/year\s*(\d+)/);
      if (afterWord) { years.add(parseInt(afterWord[1], 10)); return; }
      const short = lower.match(/\b(y|yr)\s*([1-5])\b/);
      if (short) { years.add(parseInt(short[2], 10)); return; }
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [requirementGroups]);

  // Extract available semesters from requirement groups (data-driven)
  const availableSemesters = useMemo(() => {
    if (!requirementGroups) return [];
    const semesters = new Set<string>();
    requirementGroups.forEach((group: any) => {
      const lower = (group.name || '').toLowerCase();
      if (/(^|\b)(1st|first)\s*(sem|semester)\b/.test(lower)) semesters.add('First Semester');
      else if (/(^|\b)(2nd|second)\s*(sem|semester)\b/.test(lower)) semesters.add('Second Semester');
      else if (/(intercession|intersession|summer|mid[- ]?year)/.test(lower)) semesters.add('Intercession');
    });
    const order = ['First Semester', 'Second Semester', 'Intercession'];
    return order.filter((s) => semesters.has(s));
  }, [requirementGroups]);

  // Build course index for matching AISIS codes to curriculum
  const courseIndex = useMemo(() => {
    const index = new Map<string, { course: any; groupId: string }>();
    
    if (!groupedCourses) return index;
    
    Object.entries(groupedCourses).forEach(([groupId, courses]: [string, any[]]) => {
      courses.forEach((course) => {
        const normalized = normalizeCurriculumCourseCode(course.course_code);
        index.set(normalized, { course, groupId });
        
        // Also add any equivalencies pointing to this course
        Object.entries(COURSE_EQUIVALENCIES).forEach(([oldCode, newCode]) => {
          if (normalizeCurriculumCourseCode(newCode) === normalized) {
            index.set(normalizeCurriculumCourseCode(oldCode), { course, groupId });
          }
        });
      });
    });
    
    return index;
  }, [groupedCourses]);

  // Build uncategorized list using fuzzy matching
  const uncategorizedGrades = useMemo(() => {
    if (!grades) return [];
    
    return grades.filter((grade: any) => {
      // Check if this grade matches any curriculum course using fuzzy matching
      for (const [_, { course }] of courseIndex.entries()) {
        if (fuzzyMatchCourseCode(grade.course_code, course.course_code, grade.course_title, course.course_title)) {
          return false; // Found a match, not uncategorized
        }
      }
      return true; // No match found, is uncategorized
    }).filter((grade: any) => {
      // Apply search filter
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        grade.course_code.toLowerCase().includes(query) ||
        grade.course_title.toLowerCase().includes(query)
      );
    });
  }, [grades, courseIndex, searchQuery]);

  // Build filtered groups - same as GradePlanner
  const filteredGroups = useMemo(() => {
    if (!requirementGroups || !groupedCourses) return [];
    
    return requirementGroups
      .filter((group: any) => {
        // Filter by year (supports words, ordinals, numerals)
        const lower = (group.name || '').toLowerCase();
        const wordMap: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
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
          const groupSemester =
            /(^|\b)(1st|first)\s*(sem|semester)\b/.test(lower) ? 'First Semester' :
            /(^|\b)(2nd|second)\s*(sem|semester)\b/.test(lower) ? 'Second Semester' :
            /(intercession|intersession|summer|mid[- ]?year)/.test(lower) ? 'Intercession' : null;
          if (groupSemester !== semesterFilter) return false;
        }
        
        return true;
      })
      .map((group: any) => ({
        group,
        courses: (groupedCourses[group.id] || []).filter((course: any) =>
          course.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.course_title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }))
      .filter(({ courses }) => courses.length > 0);
  }, [requirementGroups, groupedCourses, selectedYear, semesterFilter, searchQuery]);

  const filteredMyGrades = grades?.filter((grade) => {
    const matchesSearch =
      grade.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grade.course_title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSemester =
      semesterFilter === "all" || (() => {
        const s = (grade.semester || '').toString().toLowerCase();
        const normalized =
          /(^|\b)(1st|first)\s*(sem|semester)\b/.test(s) ? 'First Semester' :
          /(^|\b)(2nd|second)\s*(sem|semester)\b/.test(s) ? 'Second Semester' :
          /(intercession|intersession|summer|mid[- ]?year)/.test(s) ? 'Intercession' : 'all';
        return normalized === semesterFilter;
      })();
    return matchesSearch && matchesSemester;
  });

  const handleExport = () => {
    const dataToExport = grades || [];
    if (dataToExport.length === 0) {
      toast({
        title: "No data to export",
        description: "Add some grades first before exporting.",
        variant: "destructive",
      });
      return;
    }

    const csv = [
      ["School Year", "Semester", "Course Code", "Course Title", "Units", "Grade", "QPI Value"],
      ...dataToExport.map((g) => [
        g.school_year,
        g.semester,
        g.course_code,
        g.course_title,
        g.units,
        g.grade,
        g.qpi_value || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grades-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

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
      'W': 'bg-gray-100 text-gray-700 border-gray-200',
    };
    
    return colorMap[grade] || '';
  };


  const stats = grades
    ? (() => {
        const totalUnits = grades.reduce((sum, g) => sum + g.units, 0);
        const countedCourses = grades.filter(g => countsInQPI(g as any));
        const unitsCounted = countedCourses.reduce((sum, g) => sum + g.units, 0);
        const qpiCalc = calculateQPI(grades as any);
        return {
          totalUnits,
          unitsCounted,
          qpi: qpiCalc.cumulativeQPI,
        };
      })()
    : { totalUnits: 0, unitsCounted: 0, qpi: 0 };

  // Calculate total curriculum units
  const totalCurriculumUnits = useMemo(() => {
    if (!requirementGroups) return 0;
    return requirementGroups.reduce((sum, g) => sum + (g.min_units || 0), 0);
  }, [requirementGroups]);
  
  const completedUnits = stats.unitsCounted;
  const remainingUnits = totalCurriculumUnits - completedUnits;
  const progressPercent = totalCurriculumUnits > 0 ? (completedUnits / totalCurriculumUnits) * 100 : 0;

  // Calculate required QPI for target
  const calculateRequiredQPI = () => {
    const target = parseFloat(targetQPI);
    if (isNaN(target) || remainingUnits <= 0) return null;

    const currentQP = stats.qpi * stats.unitsCounted;
    const requiredQP = target * totalCurriculumUnits - currentQP;
    const requiredQPI = requiredQP / remainingUnits;

    return requiredQPI;
  };

  const requiredQPI = calculateRequiredQPI();

  return (
    <div className="space-y-5">
      {!activeEnrollment ? (
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-7 w-48 max-w-full rounded-md" />
          <Skeleton className="h-7 w-40 max-w-full rounded-md" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {/* Mobile: Show only code */}
          <Badge variant="secondary" className="md:hidden text-sm px-3 py-1 whitespace-nowrap">
            {activeEnrollment.programs?.code}
          </Badge>
          {/* Desktop: Show full name with code */}
          <Badge variant="secondary" className="hidden md:inline-flex text-sm px-3 py-1 whitespace-nowrap">
            {activeEnrollment.programs?.name} ({activeEnrollment.programs?.code})
          </Badge>
          
          {activeEnrollment.curriculum_versions && (
            <>
              {/* Mobile: Show only version */}
              <Badge variant="outline" className="md:hidden text-sm px-3 py-1 whitespace-nowrap">
                {activeEnrollment.curriculum_versions.version_label}
              </Badge>
              {/* Desktop: Show full label */}
              <Badge variant="outline" className="hidden md:inline-flex text-sm px-3 py-1 whitespace-nowrap">
                Curriculum: {activeEnrollment.curriculum_versions.version_label}
              </Badge>
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex gap-3">
          <Button 
            variant="destructive" 
            size="icon"
            onClick={() => setShowDeleteAllDialog(true)}
            title="Delete all grades"
            className="shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <Button 
            variant="outline" 
            onClick={() => setShowImportDialog(true)} 
            className="flex-1"
          >
            <Upload className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Import from AISIS</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleExport}
            className="flex-1"
          >
            <Download className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Export CSV</span>
          </Button>
        </div>

        <div className="flex flex-col gap-y-3">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-row gap-3">
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="flex-[35]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.length > 0 ? (
                    availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>Year {year}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="1">Year 1</SelectItem>
                  )}
                </SelectContent>
              </Select>
              
              <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                <SelectTrigger className="flex-[65]">
                  <SelectValue placeholder="All Semesters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {availableSemesters.map(semester => (
                    <SelectItem key={semester} value={semester}>
                      {semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Responsive Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Course List */}
            <div className="lg:col-span-2 space-y-6">
              {isGradesLoading ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 bg-muted/50 rounded-lg">
                    {[...Array(3)].map((_, i) => (
                      <div key={i}>
                        <Skeleton className="h-[14px] sm:h-[16px] w-32 mb-1" />
                        <Skeleton className="h-[28px] sm:h-[32px] w-20" />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="border rounded-lg">
                        <div className="flex items-center justify-between p-4">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-5 w-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {!isGradesLoading && filteredGroups.length > 0 ? (
                <Accordion type="single" collapsible defaultValue={filteredGroups[0]?.group.id}>
                  {filteredGroups.map(({ group, courses }) => {

                    return (
                      <AccordionItem key={group.id} value={group.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2 w-full pr-4">
                            <Badge variant="secondary" className="px-1.5 py-0 w-16 justify-center">
                              {(() => {
                                const totalUnits = courses.reduce((sum, c) => sum + c.units, 0);
                                const gradedUnits = courses.reduce((sum, c) => {
                                  const existingGrade = grades?.find(g => 
                                    fuzzyMatchCourseCode(g.course_code, c.course_code, g.course_title, c.course_title)
                                  );
                                  return existingGrade ? sum + c.units : sum;
                                }, 0);
                                return `${gradedUnits} / ${totalUnits}`;
                              })()}
                            </Badge>
                            <span className="font-semibold">
                              {group.name}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pt-2">
                            {courses.map((course: any) => {
                              const existingGrade = grades?.find(
                                g => fuzzyMatchCourseCode(g.course_code, course.course_code, g.course_title, course.course_title)
                              );

                              return (
                                <div
                                  key={course.id}
                                  className="flex items-center justify-between rounded-lg border bg-card hover:bg-accent/50 transition-colors p-2"
                                >
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
                                    <Select
                                      value={existingGrade?.grade || ""}
                                      onValueChange={(grade) => 
                                        saveGradeMutation.mutate({
                                          courseCode: course.course_code,
                                          courseTitle: course.course_title,
                                          units: course.units,
                                          grade
                                        })
                                      }
                                    >
                                      <SelectTrigger className={`w-[80px] h-8 border-0 ${getGradeBackgroundColor(existingGrade?.grade)}`}>
                                        <SelectValue placeholder="N/A" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {GRADE_OPTIONS.map((grade) => (
                                          <SelectItem key={grade} value={grade}>
                                            {grade}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setDeletingGrade(existingGrade)}
                                      disabled={!existingGrade}
                                      className="h-7 w-7 disabled:opacity-30"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}

                  {/* Uncategorized Courses - Always Visible */}
                  <AccordionItem value="uncategorized" className="border-0">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2 w-full pr-4">
                        <Badge variant="secondary" className="px-0 py-0 w-16 flex items-center justify-center">
                          {uncategorizedGrades.reduce((sum, g) => sum + g.units, 0)}
                        </Badge>
                        <span className="font-semibold">
                          Uncategorized
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {uncategorizedGrades.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Check className="h-12 w-12 mx-auto mb-2 text-green-500" />
                          <p>All your grades match courses in your curriculum!</p>
                        </div>
                      ) : (
                        <div className="space-y-2 p-4">
                          {uncategorizedGrades.map((grade: any) => (
                            <div 
                              key={grade.id}
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">{grade.course_code}</span>
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                    {grade.units}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground truncate">{grade.course_title}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {grade.school_year} • {grade.semester}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background">
                                <Badge variant="outline" className={`text-sm px-2.5 py-0.5 ${getGradeBackgroundColor(grade.grade)}`}>
                                  {grade.grade}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingGrade(grade)}
                                  className="h-7 w-7"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : null}

              {!isGradesLoading && filteredGroups.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  {activeEnrollment 
                    ? "No curriculum data available for your program." 
                    : "Select a program to view curriculum courses."}
                </div>
              )}
            </div>

            {/* Right Column: QPI Summary Card */}
            <div className="lg:col-span-1">
              {isGradesLoading ? (
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Skeleton className="h-9 w-20 mb-2" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20 mt-1" />
                    </div>
                    <div>
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-2 w-full mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="pt-4 border-t">
                      <Skeleton className="h-3 w-20 mb-2" />
                      <div className="grid grid-cols-2 gap-1">
                        {[...Array(7)].map((_, i) => (
                          <Skeleton key={i} className="h-3 w-16" />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                <CardHeader>
                  <CardTitle>QPI Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="text-3xl font-bold">{stats.qpi.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">Current QPI</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      GWA: {qpiToGWA(stats.qpi).toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress</span>
                      <span>
                        {completedUnits} / {totalCurriculumUnits} units
                      </span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                    <div className="text-xs text-muted-foreground mt-1">
                      {remainingUnits} units remaining
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target-qpi">Target QPI</Label>
                    <Input
                      id="target-qpi"
                      type="number"
                      step="0.01"
                      min="0"
                      max="4"
                      value={targetQPI}
                      onChange={(e) => setTargetQPI(e.target.value)}
                      placeholder="e.g., 3.50"
                    />
                    {requiredQPI !== null && remainingUnits > 0 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Required QPI: </span>
                        <span
                          className={
                            requiredQPI > 4
                              ? "text-destructive font-semibold"
                              : "text-primary font-semibold"
                          }
                        >
                          {requiredQPI.toFixed(2)}
                        </span>
                        {requiredQPI > 4 && (
                          <div className="text-xs text-destructive mt-1">
                            Target QPI is not achievable with remaining units
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-xs font-medium mb-2">QPI Scale</div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <div>A = 4.0</div>
                      <div>B+ = 3.5</div>
                      <div>B = 3.0</div>
                      <div>C+ = 2.5</div>
                      <div>C = 2.0</div>
                      <div>D = 1.0</div>
                      <div>F = 0.0</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingGrade ? "Edit Grade" : "Add Grade"}</DialogTitle>
          </DialogHeader>
          <GradeForm
            grade={editingGrade}
            onClose={() => {
              setIsFormOpen(false);
              setEditingGrade(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingGrade} onOpenChange={() => setDeletingGrade(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Grade</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this grade? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingGrade && deleteMutation.mutate(deletingGrade.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Grades?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <span className="font-semibold">all your grades</span>? 
              This action cannot be undone and will remove all {grades?.length || 0} grade{grades?.length !== 1 ? 's' : ''} from your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllGradesMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All Grades
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import AISIS Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Grades from AISIS</DialogTitle>
          </DialogHeader>
          <ImportAISIS />
        </DialogContent>
      </Dialog>
    </div>
  );
}
