import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { guestStorage } from "@/utils/guestStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { calculateRequirementProgress } from "@/utils/requirementResolver";
import { evaluatePrerequisite } from "@/utils/prerequisiteValidator";
import { PrerequisiteGraph } from "./PrerequisiteGraph";
import { Button } from "@/components/ui/button";

interface CourseChecklistProps {
  userProgram: any;
  curriculumVersion: any;
}

export function CourseChecklist({ userProgram, curriculumVersion }: CourseChecklistProps) {
  const { user, isGuest } = useAuth();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [progress, setProgress] = useState<any>(null);
  const [userCourses, setUserCourses] = useState<any[]>([]);

  useEffect(() => {
    if (curriculumVersion) {
      loadData();
    }
  }, [user, isGuest, curriculumVersion]);

  const loadData = async () => {
    try {
      let coursesData: any[] = [];

      if (isGuest) {
        // Load courses from guest storage
        coursesData = guestStorage.getCourses();
      } else if (user) {
        // Load courses from database
        const { data, error: coursesError } = await supabase
          .from("user_courses")
          .select("*")
          .eq("user_id", user.id);

        if (coursesError) throw coursesError;
        coursesData = data || [];
      }

      setUserCourses(coursesData);

      // Check if user has any courses
      if (!coursesData || coursesData.length === 0) {
        setProgress([]);
        setLoading(false);
        return;
      }

      // Calculate progress using requirement groups
      const progressData = await calculateRequirementProgress(
        curriculumVersion.id,
        coursesData || []
      );

      setProgress(progressData.groups);
    } catch (error: any) {
      console.error("Error loading checklist:", error);
    } finally {
      setLoading(false);
    }
  };

  const isCompleted = (courseCode: string) => {
    return userCourses.some(
      (uc) => uc.course_code === courseCode && uc.grade !== "W" && uc.grade !== "F"
    );
  };

  const getCompletedCourseCodes = () => {
    return userCourses
      .filter((uc) => uc.grade !== "W" && uc.grade !== "F")
      .map((uc) => uc.course_code);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>

          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg">
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-48 max-w-full" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                  <Skeleton className="h-2 w-full mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!curriculumVersion) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No curriculum version assigned. Cannot display course checklist.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no courses
  if (userCourses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No courses added yet</h3>
          <p className="text-muted-foreground mb-4">
            Add your completed courses to see your progress checklist
          </p>
          <Link 
            to="/grades" 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Go to Grades Page
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!progress) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Loading requirement progress...
          </p>
        </CardContent>
      </Card>
    );
  }

  const termGroups = progress.filter((g: any) => g.groupType === 'term');
  const categoryGroups = progress.filter((g: any) => g.groupType === 'category');

  const completedCourseCodes = getCompletedCourseCodes();

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Input
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Tabs defaultValue="terms" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="terms">By Term</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="graph">Prerequisite Graph</TabsTrigger>
        </TabsList>

        <TabsContent value="terms" className="space-y-4 mt-4">
          <Accordion type="multiple" className="space-y-4">
            {termGroups.map((group: any) => {
              const percentage = group.minUnits > 0 
                ? (group.earnedUnits / group.minUnits) * 100 
                : 0;

              return (
                <AccordionItem key={group.groupId} value={group.groupId} className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        {group.isSatisfied ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className="font-medium">{group.groupName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {group.earnedUnits} / {group.minUnits} units
                        </span>
                        <Progress value={percentage} className="w-24" />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4 mt-2">
                      {group.courses?.map((course: any) => {
                        const completed = isCompleted(course.course_code);
                        const prereqCheck = evaluatePrerequisite(
                          course.prereq_expr,
                          completedCourseCodes
                        );

                        return (
                          <Card key={course.id} className={completed ? "border-success" : ""}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  {completed ? (
                                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />
                                  )}
                                  <div>
                                    <p className="font-medium">{course.course_code}</p>
                                    <p className="text-sm text-muted-foreground">{course.course_title}</p>
                                    {!completed && !prereqCheck.satisfied && (
                                      <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                                        <AlertCircle className="h-3 w-3" />
                                        <span>Prerequisites: {prereqCheck.message}</span>
                                      </div>
                                    )}
                                    {!completed && prereqCheck.satisfied && (
                                      <Badge variant="outline" className="mt-1 text-xs">
                                        Ready to take
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="outline">{course.units} units</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4 mt-4">
          {categoryGroups.map((group: any) => {
            const percentage = group.minUnits > 0 
              ? (group.earnedUnits / group.minUnits) * 100 
              : 0;

            return (
              <Card key={group.groupId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {group.isSatisfied ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <CardTitle className="text-lg">{group.groupName}</CardTitle>
                    </div>
                    <Badge variant="outline">
                      {group.earnedUnits} / {group.minUnits} units
                    </Badge>
                  </div>
                  <Progress value={percentage} className="mt-2" />
                </CardHeader>
                {group.courses && group.courses.length > 0 && (
                  <CardContent>
                    <div className="space-y-2">
                      {group.courses.slice(0, 5).map((course: any) => {
                        const completed = isCompleted(course.course_code);
                        return (
                          <div key={course.id} className="flex items-center gap-2 text-sm">
                            {completed ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className={completed ? "text-muted-foreground" : ""}>
                              {course.course_code} - {course.course_title}
                            </span>
                          </div>
                        );
                      })}
                      {group.courses.length > 5 && (
                        <p className="text-xs text-muted-foreground pl-6">
                          + {group.courses.length - 5} more courses
                        </p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="graph">
          <PrerequisiteGraph 
            curriculumVersionId={userProgram.curriculum_version_id}
            userCourses={userCourses}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
