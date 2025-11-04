import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateQPI } from "@/utils/qpiCalculations";
import { calculateRequirementProgress } from "@/utils/requirementResolver";
import { Loader2, TrendingUp, Award, Target } from "lucide-react";
import { guestStorage } from "@/utils/guestStorage";

interface ProgressOverviewProps {
  userProgram: any;
  curriculumVersion: any;
}

export function ProgressOverview({ userProgram, curriculumVersion }: ProgressOverviewProps) {
  const { user, isGuest } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    completedUnits: 0,
    remainingUnits: 0,
    totalUnits: 0,
    completionPercentage: 0,
    cumulativeQPI: 0,
  });
  const [categoryProgress, setCategoryProgress] = useState<any[]>([]);

  useEffect(() => {
    loadProgress();
  }, [user, isGuest, curriculumVersion]);

  const loadProgress = async () => {
    try {
      let courses: any[] = [];
      
      if (isGuest) {
        // Load courses from guest storage
        courses = guestStorage.getCourses();
      } else if (user) {
        // Load courses from Supabase
        const { data, error } = await supabase
          .from("user_courses")
          .select("*")
          .eq("user_id", user.id);

        if (error) throw error;
        courses = data || [];
      }

      // Check if user has any courses
      if (!courses || courses.length === 0) {
        setStats({
          completedUnits: 0,
          remainingUnits: userProgram?.programs?.total_units || 0,
          totalUnits: userProgram?.programs?.total_units || 0,
          completionPercentage: 0,
          cumulativeQPI: 0,
        });
        setLoading(false);
        return;
      }

      const completedUnits = courses.reduce((sum, course) => {
        if (course.grade !== 'W' && course.grade !== 'F') {
          return sum + course.units;
        }
        return sum;
      }, 0);

      const totalUnits = userProgram?.programs?.total_units || completedUnits;
      const remainingUnits = Math.max(0, totalUnits - completedUnits);
      const completionPercentage = totalUnits > 0 ? (completedUnits / totalUnits) * 100 : 0;

      const qpiCalc = calculateQPI(courses);

      setStats({
        completedUnits,
        remainingUnits,
        totalUnits,
        completionPercentage,
        cumulativeQPI: qpiCalc.cumulativeQPI,
      });

      // Skip category progress for guests
      if (!isGuest && curriculumVersion) {
        const progressData = await calculateRequirementProgress(
          curriculumVersion.id,
          courses
        );

        const categoryGroups = (progressData as any).groups?.filter(
          (g: any) => g.groupType === 'category'
        ) || [];

        const sortedGroups = categoryGroups.sort((a: any, b: any) => {
          if (b.unitsEarned !== a.unitsEarned) {
            return b.unitsEarned - a.unitsEarned;
          }
          return a.groupName.localeCompare(b.groupName);
        });

        setCategoryProgress(sortedGroups);
      }
    } catch (error: any) {
      console.error("Error loading progress:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-[14px] w-32" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-[14px] w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-16 mb-2" />
              <Skeleton className="h-2 w-full rounded-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-[14px] w-28" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show empty state if no courses
  if (stats.completedUnits === 0 && stats.cumulativeQPI === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No courses added yet</h3>
          <p className="text-muted-foreground mb-4">
            Start tracking your progress by adding your completed courses
          </p>
          <Link 
            to={userProgram?.program_id ? "/grades" : "/tracker"} 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            {userProgram?.program_id ? "Go to Grades Page" : "Select Program First"}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Stats */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Units</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.completedUnits}</div>
            <p className="text-xs text-muted-foreground">of {stats.totalUnits} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining Units</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.remainingUnits}</div>
            <p className="text-xs text-muted-foreground">units to go</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.completionPercentage.toFixed(1)}%</div>
            <Progress value={stats.completionPercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cumulative QPI</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.cumulativeQPI.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">current standing</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Progress - Removed per user request */}

      {/* Milestones */}
      <Card>
        <CardHeader>
          <CardTitle>Progress Milestones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="font-medium">Quarter Complete</span>
            <Badge variant={stats.completedUnits >= stats.totalUnits * 0.25 ? "default" : "outline"}>
              {stats.completedUnits >= stats.totalUnits * 0.25
                ? "Achieved" 
                : `${Math.max(0, Math.ceil(stats.totalUnits * 0.25 - stats.completedUnits))} units to go`
              }
            </Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="font-medium">Halfway Complete</span>
            <Badge variant={stats.completedUnits >= stats.totalUnits * 0.5 ? "default" : "outline"}>
              {stats.completedUnits >= stats.totalUnits * 0.5
                ? "Achieved" 
                : `${Math.max(0, Math.ceil(stats.totalUnits * 0.5 - stats.completedUnits))} units to go`
              }
            </Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="font-medium">Three-Quarters Complete</span>
            <Badge variant={stats.completedUnits >= stats.totalUnits * 0.75 ? "default" : "outline"}>
              {stats.completedUnits >= stats.totalUnits * 0.75
                ? "Achieved" 
                : `${Math.max(0, Math.ceil(stats.totalUnits * 0.75 - stats.completedUnits))} units to go`
              }
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
