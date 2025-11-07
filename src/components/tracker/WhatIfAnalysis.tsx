import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateWhatIf } from "@/utils/whatIfAnalysis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertCircle, TrendingUp, Calendar } from "lucide-react";

interface WhatIfAnalysisProps {
  currentEnrollment: any;
}

export function WhatIfAnalysis({ currentEnrollment }: WhatIfAnalysisProps) {
  const { user, isGuest } = useAuth();
  const [programs, setPrograms] = useState<any[]>([]);
  const [curriculumVersions, setCurriculumVersions] = useState<any[]>([]);
  const [targetProgram, setTargetProgram] = useState('');
  const [targetVersion, setTargetVersion] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(true);

  useEffect(() => {
    if (!isGuest) {
      loadPrograms();
    } else {
      setLoadingPrograms(false);
    }
  }, [isGuest]);

  useEffect(() => {
    if (targetProgram) {
      loadCurriculumVersions();
    }
  }, [targetProgram]);

  const loadPrograms = async () => {
    setLoadingPrograms(true);
    const { data, error } = await supabase
      .from('programs')
      .select('id, code, name')
      .order('code');
    
    if (!error && data) {
      setPrograms(data);
    }
    setLoadingPrograms(false);
  };

  const loadCurriculumVersions = async () => {
    const { data, error } = await supabase
      .from('curriculum_versions')
      .select('id, version_label')
      .eq('program_id', targetProgram)
      .eq('is_active', true)
      .order('effective_start', { ascending: false });
    
    if (!error && data) {
      setCurriculumVersions(data);
      if (data.length > 0) {
        setTargetVersion(data[0].id);
      }
    }
  };

  const runAnalysis = async () => {
    if (!targetProgram || !targetVersion) return;

    setLoading(true);
    try {
      const result = await calculateWhatIf(
        user!.id,
        targetProgram,
        targetVersion
      );
      setAnalysis(result);
    } catch (error) {
      console.error('Error running analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isGuest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>What-If Analysis</CardTitle>
          <CardDescription>
            Preview how your completed courses would count if you shifted programs
          </CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Sign up to run What-If scenarios</h3>
          <p className="text-muted-foreground mb-4">
            This feature is available for registered users only
          </p>
          <Button asChild>
            <a href="/signup">Create Account</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loadingPrograms) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid gap-4">
              <div>
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div>
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>What-If Analysis</CardTitle>
        <CardDescription>
          Preview how your completed courses would count if you shifted programs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid gap-4">
            <div>
              <Label>Target Program</Label>
              <Select value={targetProgram} onValueChange={setTargetProgram}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a program to analyze" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {targetProgram && curriculumVersions.length > 0 && (
              <div>
                <Label>Curriculum Version</Label>
                <Select value={targetVersion} onValueChange={setTargetVersion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {curriculumVersions.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.version_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button 
            onClick={runAnalysis} 
            disabled={!targetProgram || !targetVersion || loading}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Calculate What-If Scenario
          </Button>

          {analysis && (
            <div className="space-y-4 pt-6 border-t">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You would have <strong>{analysis.totalRemainingUnits} units</strong> remaining out of <strong>{analysis.totalRequiredUnits} total units</strong>.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Estimated Completion</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {analysis.estimatedTermsToComplete} {analysis.estimatedTermsToComplete === 1 ? 'term' : 'terms'}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Progress</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {Math.round((1 - analysis.totalRemainingUnits / analysis.totalRequiredUnits) * 100)}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">Requirement Groups</h4>
                {analysis.remainingGroups.map((group: any) => (
                  <Card key={group.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{group.name}</span>
                          <Badge variant={group.remainingUnits === 0 ? "default" : "outline"}>
                            {group.earnedUnits} / {group.totalUnits} units
                          </Badge>
                        </div>
                        <Progress 
                          value={(group.earnedUnits / group.totalUnits) * 100} 
                          className="h-2"
                        />
                        {group.remainingUnits > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {group.remainingUnits} units remaining
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
