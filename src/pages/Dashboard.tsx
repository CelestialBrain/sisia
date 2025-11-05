import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { calculateQPI, UserCourse, countsInQPI } from "@/utils/qpiCalculations";
import { GraduationCap, Plus, Upload, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ShiftProgramModal } from "@/components/ShiftProgramModal";
import { Skeleton } from "@/components/ui/skeleton";
import { guestStorage } from "@/utils/guestStorage";
import { SchedulePreview } from "@/components/schedule/SchedulePreview";

export default function Dashboard() {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const [shiftModalOpen, setShiftModalOpen] = useState(false);

  const { data: courses = [], isLoading: loading } = useQuery({
    queryKey: ["user-courses", isGuest ? "guest" : user?.id, isGuest],
    queryFn: async () => {
      if (isGuest) {
        return guestStorage.getCourses() as UserCourse[];
      }
      const { data, error } = await supabase
        .from("user_courses")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as UserCourse[]) || [];
    },
    enabled: !!user || isGuest,
  });

  const { data: activeEnrollment } = useQuery({
    queryKey: ["program-enrollments", user?.id, isGuest],
    queryFn: async () => {
      if (isGuest) {
        return guestStorage.getEnrollment();
      }
      const { data } = await supabase
        .from("program_enrollments")
        .select(
          `
          *,
          programs(code, name),
          curriculum_versions(version_label)
        `,
        )
        .eq("user_id", user!.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    enabled: !!user || isGuest,
  });
  const stats = calculateQPI(courses);

  // Calculate unit counters
  const totalUnits = courses.reduce((sum, c) => sum + c.units, 0);
  const countedCourses = courses.filter((c) => countsInQPI(c));
  const unitsCounted = countedCourses.reduce((sum, c) => sum + c.units, 0);
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <Skeleton className="h-[44px] w-48 max-w-full mb-2" />
          <Skeleton className="h-[24px] w-64 max-w-full" />
        </div>

        {/* Program badge skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>

        {/* Stats cards skeleton */}
        <div className="grid gap-3 md:grid-cols-3">...</div>

        {/* Schedule preview skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="min-h-[50px]">
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Track your academic progress and QPI</p>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Welcome to{" "}
              <span className="text-primary" style={{ letterSpacing: "var(--logo-spacing, -0.05em)" }}>
                (sisia)
              </span>
            </CardTitle>
            <CardDescription>Get started by following these steps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Onboarding Stepper */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${!activeEnrollment ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    1
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${!activeEnrollment ? "" : "text-muted-foreground"}`}>
                      Choose Your Program
                    </p>
                    {!activeEnrollment && (
                      <Button variant="link" asChild className="h-auto p-0 text-sm">
                        <Link to="/tracker">Select your program →</Link>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${activeEnrollment && courses.length === 0 ? "bg-primary text-primary-foreground" : "border-2"}`}
                  >
                    2
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium ${activeEnrollment && courses.length === 0 ? "" : "text-muted-foreground"}`}
                    >
                      Add Your Grades
                    </p>
                    <p className="text-sm text-muted-foreground">Import from AISIS or add manually</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2">3</div>
                  <div>
                    <p className="font-medium text-muted-foreground">Track Your Progress</p>
                    <p className="text-sm text-muted-foreground">View checklist and plan courses</p>
                  </div>
                </div>
              </div>

              {activeEnrollment && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-4">Ready to add your grades?</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button asChild className="flex-1">
                      <Link to="/grades">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Grades Manually
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link to="/grades?import=true">
                        <Upload className="mr-2 h-4 w-4" />
                        Import from AISIS
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeEnrollment && activeEnrollment.programs && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge size="lg" className="h-10 flex items-center">
                  {activeEnrollment.programs.code}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setShiftModalOpen(true)}>
                  Shift Program
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cumulative QPI</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{stats.cumulativeQPI.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Out of 4.0</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Units</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{unitsCounted}</div>
                <p className="text-xs text-muted-foreground">Units counted in QPI</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Courses</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{courses.length}</div>
                <p className="text-xs text-muted-foreground">Total courses taken</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>My Schedule</CardTitle>
              <CardDescription>Preview of your active schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <SchedulePreview />
            </CardContent>
          </Card>
        </div>
      )}

      <ShiftProgramModal
        open={shiftModalOpen}
        onOpenChange={setShiftModalOpen}
        currentEnrollment={activeEnrollment}
        onShiftComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["program-enrollments", user?.id] });
          queryClient.invalidateQueries({ queryKey: ["user-courses", isGuest ? "guest" : user?.id, isGuest] });
        }}
      />
    </div>
  );
}
