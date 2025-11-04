import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertCircle, Search, CheckCircle2, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProgramSelection } from '@/components/tracker/ProgramSelection';

interface Course {
  id: string;
  course_code: string;
  course_title: string;
  units: number;
  prereq_expr?: string;
}

interface Term {
  id: string;
  name: string;
  display_order: number;
  courses: Course[];
}

interface YearGroup {
  year: number;
  terms: Term[];
}

export default function CourseOverview() {
  const { user } = useAuth();
  const { activeEnrollment, loading: programLoading, refresh, hasProgram } = useActiveProgram();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [yearGroups, setYearGroups] = useState<YearGroup[]>([]);
  const [completedCourses, setCompletedCourses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [totalUnits, setTotalUnits] = useState(0);
  const [completedUnits, setCompletedUnits] = useState(0);

  useEffect(() => {
    if (user && hasProgram) {
      loadData();
    } else if (!programLoading) {
      setLoading(false);
    }
  }, [user, hasProgram, programLoading]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get user's completed courses
      const { data: userCourses } = await supabase
        .from('user_courses')
        .select('course_code, grade, units')
        .eq('user_id', user?.id);

      const completed = new Set(
        userCourses
          ?.filter(c => c.grade && c.grade !== 'F' && c.grade !== 'W')
          .map(c => c.course_code) || []
      );
      setCompletedCourses(completed);

      const completedUnitsTotal = userCourses
        ?.filter(c => completed.has(c.course_code))
        .reduce((sum, c) => sum + (c.units || 0), 0) || 0;
      setCompletedUnits(completedUnitsTotal);

      if (!activeEnrollment?.curriculum_version_id) {
        toast({ title: 'No curriculum version found', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const curriculumVersionId = activeEnrollment.curriculum_version_id;

      // Get all term groups from requirement_groups
      const { data: termGroups } = await supabase
        .from('requirement_groups')
        .select('id, name, display_order')
        .eq('curriculum_id', curriculumVersionId)
        .eq('group_type', 'term')
        .order('display_order', { ascending: true });

      if (!termGroups || termGroups.length === 0) {
        setLoading(false);
        return;
      }

      // Get all courses for these terms
      const termGroupIds = termGroups.map(g => g.id);
      const { data: rules } = await supabase
        .from('requirement_rules')
        .select('req_group_id, course_ids')
        .in('req_group_id', termGroupIds);

      // Build a map of term -> course IDs
      const termCoursesMap = new Map<string, string[]>();
      rules?.forEach(rule => {
        const existing = termCoursesMap.get(rule.req_group_id) || [];
        termCoursesMap.set(rule.req_group_id, [...existing, ...(rule.course_ids || [])]);
      });

      // Get all unique course IDs
      const allCourseIds = [...new Set([...termCoursesMap.values()].flat())];
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, course_code, course_title, units, prereq_expr')
        .in('id', allCourseIds);

      const coursesById = new Map(coursesData?.map(c => [c.id, c]) || []);

      // Build terms with their courses
      const terms: Term[] = termGroups.map(group => ({
        id: group.id,
        name: group.name,
        display_order: group.display_order,
        courses: (termCoursesMap.get(group.id) || [])
          .map(courseId => coursesById.get(courseId))
          .filter(Boolean) as Course[]
      }));

      // Group terms by year (extract year from term name or use display_order)
      const grouped = groupTermsByYear(terms);
      setYearGroups(grouped);

      // Calculate total units
      const total = terms.reduce((sum, term) => 
        sum + term.courses.reduce((termSum, course) => termSum + course.units, 0), 
        0
      );
      setTotalUnits(total);

    } catch (error: any) {
      toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const groupTermsByYear = (terms: Term[]): YearGroup[] => {
    const groups = new Map<number, Term[]>();
    
    terms.forEach(term => {
      let year = 1;
      
      // Pattern 1: "Y1 1st Sem", "Y2 Intersession", etc. (AISIS format)
      const shortYearMatch = term.name.match(/Y(\d+)/i);
      if (shortYearMatch) {
        year = parseInt(shortYearMatch[1]);
      } 
      // Pattern 2: "First Year - First Semester", "Second Year", etc.
      else {
        const yearMatch = term.name.match(/(\w+)\s+Year/i);
        if (yearMatch) {
          const yearWord = yearMatch[1].toLowerCase();
          if (yearWord === 'first') year = 1;
          else if (yearWord === 'second') year = 2;
          else if (yearWord === 'third') year = 3;
          else if (yearWord === 'fourth') year = 4;
          else if (yearWord === 'fifth') year = 5;
        } else {
          // Improved fallback: Group every 2-3 terms (accounting for intersessions)
          year = Math.floor(term.display_order / 2.5) + 1;
        }
      }
      
      const yearTerms = groups.get(year) || [];
      yearTerms.push(term);
      groups.set(year, yearTerms);
    });

    return Array.from(groups.entries())
      .map(([year, terms]) => ({ year, terms }))
      .sort((a, b) => a.year - b.year);
  };

  const filterCourses = (course: Course) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return course.course_code.toLowerCase().includes(query) ||
           course.course_title.toLowerCase().includes(query);
  };

  const progressPercentage = totalUnits > 0 ? (completedUnits / totalUnits) * 100 : 0;

  if (loading || programLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <Skeleton className="h-[44px] w-56 max-w-full mb-2" />
          <Skeleton className="h-[24px] w-80 max-w-full" />
        </div>

        {/* Program badges skeleton */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-32" />
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                {i === 3 && <Skeleton className="h-2 w-full" />}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search skeleton */}
        <Skeleton className="h-10 w-full" />

        {/* Year accordions skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="border rounded-lg">
              <div className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!hasProgram) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Course Overview</h1>
          <p className="text-muted-foreground">View your complete curriculum schedule</p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-justify">
            Please select a program first to view your curriculum.
          </AlertDescription>
        </Alert>

        <ProgramSelection onProgramSelected={refresh} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Course Overview</h1>
        <p className="text-muted-foreground">Complete curriculum schedule for your program</p>
      </div>

      {activeEnrollment && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg flex-wrap">
          <Badge variant="secondary">
            {activeEnrollment.programs?.name} ({activeEnrollment.programs?.code})
          </Badge>
          {activeEnrollment.program_tracks && (
            <Badge variant="success">
              Track: {activeEnrollment.program_tracks.track_name} ({activeEnrollment.program_tracks.track_code})
            </Badge>
          )}
          {activeEnrollment.curriculum_versions && (
            <Badge variant="outline">
              Curriculum: {activeEnrollment.curriculum_versions.version_label}
            </Badge>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUnits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{completedUnits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{progressPercentage.toFixed(1)}%</div>
            <Progress value={progressPercentage} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Course Schedule by Year */}
      <Accordion type="multiple" defaultValue={yearGroups.map((_, i) => `year-${i}`)} className="space-y-4">
        {yearGroups.map((yearGroup, yearIndex) => (
          <AccordionItem key={`year-${yearIndex}`} value={`year-${yearIndex}`} className="border rounded-lg">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5" />
                <span className="text-xl font-semibold">Year {yearGroup.year}</span>
                <Badge variant="secondary">
                  {yearGroup.terms.reduce((sum, term) => 
                    sum + term.courses.reduce((termSum, c) => termSum + c.units, 0), 0
                  )} units
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {yearGroup.terms.map(term => {
                  const termUnits = term.courses.reduce((sum, c) => sum + c.units, 0);
                  const filteredCourses = term.courses.filter(filterCourses);
                  
                  return (
                    <Card key={term.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{term.name}</CardTitle>
                          <Badge variant="outline">{termUnits} units</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {filteredCourses.length === 0 && searchQuery ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No courses match your search
                            </p>
                          ) : filteredCourses.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No courses in this term
                            </p>
                          ) : (
                            filteredCourses.map(course => {
                              const isCompleted = completedCourses.has(course.course_code);
                              return (
                                <div
                                  key={course.id}
                                  className={`p-3 rounded-lg border ${
                                    isCompleted 
                                      ? 'bg-primary/5 border-primary/20' 
                                      : 'bg-card'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    {isCompleted && (
                                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                          <p className="font-medium text-sm">{course.course_code}</p>
                                          <p className="text-xs text-muted-foreground line-clamp-2">
                                            {course.course_title}
                                          </p>
                                          {course.prereq_expr && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                              <span className="font-medium">Prereq:</span> {course.prereq_expr}
                                            </p>
                                          )}
                                        </div>
                                        <Badge variant="secondary" className="flex-shrink-0">
                                          {course.units}u
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {yearGroups.length === 0 && !loading && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-justify">
            No curriculum data found for this program version. Please contact your administrator.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
