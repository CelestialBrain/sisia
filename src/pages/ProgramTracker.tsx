import { useAuth } from "@/contexts/AuthContext";
import { useActiveProgram } from "@/hooks/useActiveProgram";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { ProgramSelection } from "@/components/tracker/ProgramSelection";
import { ProgressOverview } from "@/components/tracker/ProgressOverview";
import { CourseChecklist } from "@/components/tracker/CourseChecklist";
import { WhatIfAnalysis } from "@/components/tracker/WhatIfAnalysis";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { clientLogger } from "@/utils/clientLogger";

export default function ProgramTracker() {
  const { user, isGuest } = useAuth();
  const { activeEnrollment, loading, refresh, hasProgram } = useActiveProgram();

  if (loading) {
    clientLogger.debug('component', 'ProgramTracker loading', {}, isGuest ? 'guest' : 'authenticated', user?.id);
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <Skeleton className="h-[44px] w-56 max-w-full mb-2" />
          <Skeleton className="h-[24px] w-80 max-w-full" />
        </div>

        <div className="space-y-4">
          {/* Tabs skeleton */}
          <div className="flex gap-2 border-b">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>

          {/* Progress Overview Skeleton */}
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-9 w-24 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Progress Bars Card Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Course List Card Skeleton */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-10 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-5 w-5" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!hasProgram) {
    clientLogger.info('component', 'ProgramTracker: No program found', {}, isGuest ? 'guest' : 'authenticated', user?.id);
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Program Tracker</h1>
          <p className="text-muted-foreground">
            Track your progress towards degree completion
          </p>
        </div>

        <ProgramSelection onProgramSelected={refresh} />
      </div>
    );
  }

  clientLogger.info('component', 'ProgramTracker: Rendering with program', { 
    programName: activeEnrollment?.programs?.name,
    hasCurriculum: !!activeEnrollment?.curriculum_versions 
  }, isGuest ? 'guest' : 'authenticated', user?.id);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Program Tracker</h1>
        <p className="text-muted-foreground">
          Track your progress towards degree completion
        </p>
      </div>

      {!isGuest && !activeEnrollment.curriculum_versions && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No curriculum version assigned. Progress tracking may be limited. Please contact your administrator.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="courses">Course Checklist</TabsTrigger>
          <TabsTrigger value="whatif">What-If</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <ProgressOverview 
            userProgram={activeEnrollment} 
            curriculumVersion={activeEnrollment.curriculum_versions}
          />
        </TabsContent>

        <TabsContent value="courses" className="mt-4">
          <CourseChecklist 
            userProgram={activeEnrollment}
            curriculumVersion={activeEnrollment.curriculum_versions}
          />
        </TabsContent>

        <TabsContent value="whatif" className="mt-4">
          <WhatIfAnalysis currentEnrollment={activeEnrollment} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
