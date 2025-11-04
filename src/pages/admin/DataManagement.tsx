import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Trash2, AlertTriangle, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function DataManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedCurriculum, setSelectedCurriculum] = useState('');
  const [selectedTermForSchedule, setSelectedTermForSchedule] = useState('');
  const [selectedDeptForSchedule, setSelectedDeptForSchedule] = useState('');
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeType, setPurgeType] = useState<'curricula' | 'admin' | 'admin_with_schedules' | 'nuclear'>('curricula');
  const [confirmationText, setConfirmationText] = useState('');

  const { data: schools } = useQuery({
    queryKey: ['schools'],
    queryFn: async () => {
      const { data, error } = await supabase.from('schools').select('*').order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: programs } = useQuery({
    queryKey: ['programs-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('programs').select('id, code, name, schools(name)').order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: curriculumVersions } = useQuery({
    queryKey: ['curriculum-versions-list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('curriculum_versions')
        .select('id, version_label, programs(code, name)')
        .order('version_label');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: orphanedCourses } = useQuery({
    queryKey: ['orphaned-courses'],
    queryFn: async () => {
      console.log('[DataManagement] ========================================');
      console.log('[DataManagement] ORPHANED COURSES ANALYSIS');
      console.log('[DataManagement] Timestamp:', new Date().toISOString());
      console.log('[DataManagement] ========================================');
      
      const { data: allCourses } = await supabase.from('courses').select('id, course_code, course_title');
      const { data: rules } = await (supabase as any).from('requirement_rules').select('course_ids');
      
      console.log('[DataManagement] Total courses in database:', allCourses?.length);
      console.log('[DataManagement] Total requirement rules:', rules?.length);
      
      const usedCourseIds = new Set(
        rules?.flatMap((r: any) => r.course_ids || []) || []
      );
      console.log('[DataManagement] Unique course IDs referenced:', usedCourseIds.size);
      console.log('[DataManagement] Statistics:', {
        totalCourses: allCourses?.length,
        coursesInRules: usedCourseIds.size,
        potentialOrphans: (allCourses?.length || 0) - usedCourseIds.size,
        coveragePercentage: ((usedCourseIds.size / (allCourses?.length || 1)) * 100).toFixed(1) + '%'
      });
      
      const potentialOrphans = allCourses?.filter(c => !usedCourseIds.has(c.id)) || [];
      console.log('[DataManagement] Potential orphans (before verification):', potentialOrphans.length);
      if (potentialOrphans.length > 0) {
        console.log('[DataManagement] Candidates:', potentialOrphans.map(c => c.course_code).join(', '));
      }
      
      // Double-check each "orphaned" course by querying directly
      const confirmedOrphans = [];
      for (const course of potentialOrphans) {
        console.log(`[DataManagement] Verifying "${course.course_code}" (${course.id})...`);
        
        const { data: directCheck, error: checkError } = await (supabase as any)
          .from('requirement_rules')
          .select('id, req_group_id, rule_type, description')
          .contains('course_ids', [course.id]);
        
        if (checkError) {
          console.error(`[DataManagement] Error verifying "${course.course_code}":`, checkError);
          continue;
        }
        
        if (!directCheck || directCheck.length === 0) {
          console.log(`[DataManagement] ✗ CONFIRMED ORPHAN: "${course.course_code}" - "${course.course_title}"`);
          confirmedOrphans.push(course);
        } else {
          console.log(`[DataManagement] ✓ NOT ORPHANED: "${course.course_code}" found in ${directCheck.length} rule(s)`);
          directCheck.forEach((rule: any, idx: number) => {
            console.log(`[DataManagement]   Rule ${idx + 1}: Type="${rule.rule_type}", Group="${rule.req_group_id.slice(0, 8)}", Desc="${rule.description || 'N/A'}"`);
          });
          console.log(`[DataManagement] FALSE POSITIVE PREVENTED (cache issue)`);
        }
      }
      
      console.log('[DataManagement] ========================================');
      console.log('[DataManagement] FINAL RESULTS:');
      console.log('[DataManagement] - Confirmed orphans:', confirmedOrphans.length);
      console.log('[DataManagement] - False positives avoided:', potentialOrphans.length - confirmedOrphans.length);
      if (confirmedOrphans.length > 0) {
        console.log('[DataManagement] Orphaned courses:', confirmedOrphans.map(c => `${c.course_code} (${c.course_title})`).join(', '));
      }
      console.log('[DataManagement] ========================================');
      
      return confirmedOrphans;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0, // Don't cache results
  });

  const { data: scheduleFilters } = useQuery({
    queryKey: ['schedule-filters'],
    queryFn: async () => {
      const { data } = await supabase
        .from('aisis_schedules')
        .select('term_code, department')
        .eq('deprecated', false);
      
      const terms = [...new Set(data?.map(d => d.term_code) || [])].sort();
      const departments = [...new Set(data?.map(d => d.department) || [])].sort();
      
      return { terms, departments };
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const purgeBySchoolMutation = useMutation({
    mutationFn: async (schoolId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-purge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'by_school', schoolId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purge failed');
      }
    },
    onSuccess: async () => {
      // Verify purge success
      const { count: programsCount } = await supabase.from('programs').select('*', { count: 'exact', head: true });
      const { count: versionsCount } = await (supabase as any).from('curriculum_versions').select('*', { count: 'exact', head: true });
      const { count: jobsCount } = await supabase.from('import_jobs').select('*', { count: 'exact', head: true });
      
      queryClient.invalidateQueries();
      
      if ((programsCount || 0) === 0 && (versionsCount || 0) === 0) {
        toast({ 
          title: 'School data purged successfully',
          description: `Programs: ${programsCount}, Versions: ${versionsCount}, Jobs: ${jobsCount}` 
        });
      } else {
        toast({ 
          title: 'Purge completed with warnings',
          description: `Some items remain - Programs: ${programsCount}, Versions: ${versionsCount}`,
          variant: 'destructive'
        });
      }
      setSelectedSchool('');
    },
    onError: (error: any) => {
      toast({ title: 'Error purging data', description: error.message, variant: 'destructive' });
    },
  });

  const purgeByCurriculumMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-purge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'by_curriculum', curriculumId: versionId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purge failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: 'Curriculum version purged successfully' });
      setSelectedCurriculum('');
    },
    onError: (error: any) => {
      toast({ title: 'Error purging curriculum', description: error.message, variant: 'destructive' });
    },
  });

  const purgeByProgramMutation = useMutation({
    mutationFn: async (programId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-purge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'by_program', programId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purge failed');
      }
    },
    onSuccess: async () => {
      // Verify purge success
      const { count: programsCount } = await supabase.from('programs').select('*', { count: 'exact', head: true });
      const { count: versionsCount } = await (supabase as any).from('curriculum_versions').select('*', { count: 'exact', head: true });
      const { count: jobsCount } = await supabase.from('import_jobs').select('*', { count: 'exact', head: true });
      
      queryClient.invalidateQueries();
      
      toast({ 
        title: 'Program purged successfully',
        description: `Remaining - Programs: ${programsCount}, Versions: ${versionsCount}, Jobs: ${jobsCount}` 
      });
      setSelectedProgram('');
    },
    onError: (error: any) => {
      toast({ title: 'Error purging program', description: error.message, variant: 'destructive' });
    },
  });

  const purgeAllCurriculaMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-purge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'all_curricula' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purge failed');
      }
    },
    onSuccess: async () => {
      const { count: versionsCount } = await (supabase as any).from('curriculum_versions').select('*', { count: 'exact', head: true });
      const { count: groupsCount } = await (supabase as any).from('requirement_groups').select('*', { count: 'exact', head: true });
      
      queryClient.invalidateQueries();
      
      if ((versionsCount || 0) === 0 && (groupsCount || 0) === 0) {
        toast({ 
          title: 'All curricula purged successfully',
          description: 'All curriculum versions and requirements deleted. Programs and courses remain.' 
        });
      } else {
        toast({ 
          title: 'Purge completed with warnings',
          description: `Remaining - Versions: ${versionsCount}, Groups: ${groupsCount}`,
          variant: 'destructive'
        });
      }
      setPurgeDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error purging curricula', description: error.message, variant: 'destructive' });
    },
  });

  const purgeAllAdminDataMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-purge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'all_admin' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purge failed');
      }
    },
    onSuccess: async () => {
      // Verify purge success
      const { count: programsCount } = await supabase.from('programs').select('*', { count: 'exact', head: true });
      const { count: versionsCount } = await (supabase as any).from('curriculum_versions').select('*', { count: 'exact', head: true });
      const { count: coursesCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
      
      queryClient.invalidateQueries();
      
      if ((programsCount || 0) === 0 && (versionsCount || 0) === 0 && (coursesCount || 0) === 0) {
        toast({ 
          title: 'All programs & courses purged',
          description: 'Programs, courses, and curriculum data deleted. Schedules remain.' 
        });
      } else {
        toast({ 
          title: 'Purge completed with warnings',
          description: `Remaining - Programs: ${programsCount}, Versions: ${versionsCount}, Courses: ${coursesCount}`,
          variant: 'destructive'
        });
      }
      setPurgeDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error purging data', description: error.message, variant: 'destructive' });
    },
  });

  const purgeAllAdminWithSchedulesMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-purge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'all_admin_with_schedules' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purge failed');
      }
    },
    onSuccess: async () => {
      // Verify purge success
      const { count: programsCount } = await supabase.from('programs').select('*', { count: 'exact', head: true });
      const { count: versionsCount } = await (supabase as any).from('curriculum_versions').select('*', { count: 'exact', head: true });
      const { count: coursesCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
      const { count: schedulesCount } = await supabase.from('aisis_schedules').select('*', { count: 'exact', head: true });
      
      queryClient.invalidateQueries();
      
      if ((programsCount || 0) === 0 && (versionsCount || 0) === 0 && (coursesCount || 0) === 0 && (schedulesCount || 0) === 0) {
        toast({ 
          title: 'All programs, courses & schedules purged',
          description: 'All admin data deleted successfully. User data remains.' 
        });
      } else {
        toast({ 
          title: 'Purge completed with warnings',
          description: `Remaining - Programs: ${programsCount}, Versions: ${versionsCount}, Courses: ${coursesCount}, Schedules: ${schedulesCount}`,
          variant: 'destructive'
        });
      }
      setPurgeDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error purging data', description: error.message, variant: 'destructive' });
    },
  });

  const nuclearPurgeMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-purge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'nuclear' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purge failed');
      }
    },
    onSuccess: async () => {
      // Verify purge success
      const { count: programsCount } = await supabase.from('programs').select('*', { count: 'exact', head: true });
      const { count: versionsCount } = await (supabase as any).from('curriculum_versions').select('*', { count: 'exact', head: true });
      const { count: coursesCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
      const { count: userCoursesCount } = await supabase.from('user_courses').select('*', { count: 'exact', head: true });
      
      queryClient.invalidateQueries();
      
      if ((programsCount || 0) === 0 && (versionsCount || 0) === 0 && (coursesCount || 0) === 0 && (userCoursesCount || 0) === 0) {
        toast({ 
          title: 'Nuclear purge completed',
          description: 'All data deleted including user grades' 
        });
      } else {
        toast({ 
          title: 'Purge completed with warnings',
          description: `Remaining - Programs: ${programsCount}, Versions: ${versionsCount}, Courses: ${coursesCount}, User Courses: ${userCoursesCount}`,
          variant: 'destructive'
        });
      }
      setPurgeDialogOpen(false);
      setConfirmationText('');
    },
    onError: (error: any) => {
      toast({ title: 'Error during nuclear purge', description: error.message, variant: 'destructive' });
    },
  });

  const purgeSchedulesMutation = useMutation({
    mutationFn: async ({ termCode, department }: { termCode?: string, department?: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-purge', {
        body: { 
          type: 'by_schedule', 
          termCode: termCode?.trim(), 
          department: department?.trim()
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['aisis-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['aisis-schedules-filters'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-filters'] });
      const deletedCount = data?.deletedCount ?? 0;
      toast({ 
        title: 'Schedules purged successfully',
        description: `${deletedCount} schedule(s) deleted`
      });
      setSelectedTermForSchedule('');
      setSelectedDeptForSchedule('');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error purging schedules', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const handlePurge = () => {
    if (purgeType === 'curricula') {
      purgeAllCurriculaMutation.mutate();
    } else if (purgeType === 'admin') {
      purgeAllAdminDataMutation.mutate();
    } else if (purgeType === 'admin_with_schedules') {
      purgeAllAdminWithSchedulesMutation.mutate();
    } else if (purgeType === 'nuclear') {
      if (confirmationText === 'DELETE EVERYTHING') {
        nuclearPurgeMutation.mutate();
      } else {
        toast({ title: 'Confirmation required', description: 'Type "DELETE EVERYTHING" to proceed', variant: 'destructive' });
      }
    }
  };

  return (
    <>
      {/* Orphaned Courses */}
      {orphanedCourses && orphanedCourses.length > 0 && (
        <Alert>
          <Search className="h-4 w-4" />
          <AlertDescription>
            Found {orphanedCourses.length} orphaned courses not used in any curriculum.
          </AlertDescription>
        </Alert>
      )}

      {/* Selective Purge */}
      <div className="p-0 lg:p-6 lg:border lg:rounded-lg lg:bg-card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Selective Purge</h3>
          <p className="text-sm text-muted-foreground">Delete specific schools, programs, or curriculum versions</p>
        </div>
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Purge by School</h3>
              <div className="flex gap-2">
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools?.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.code} - {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => {
                    if (selectedSchool && confirm('This will delete ALL programs and courses in this school. Continue?')) {
                      purgeBySchoolMutation.mutate(selectedSchool);
                    }
                  }}
                  disabled={!selectedSchool || purgeBySchoolMutation.isPending}
                  title="Purge School"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Purge by Program</h3>
              <div className="flex gap-2">
                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs?.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.code} - {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => {
                    if (selectedProgram && confirm('This will delete this program and all its curriculum versions. Continue?')) {
                      purgeByProgramMutation.mutate(selectedProgram);
                    }
                  }}
                  disabled={!selectedProgram || purgeByProgramMutation.isPending}
                  title="Purge Program"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Purge by Curriculum Version</h3>
              <div className="flex gap-2">
                <Select value={selectedCurriculum} onValueChange={setSelectedCurriculum}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select curriculum version" />
                  </SelectTrigger>
                  <SelectContent>
                    {curriculumVersions?.map((cv: any) => (
                      <SelectItem key={cv.id} value={cv.id}>
                        {cv.programs?.code} - {cv.version_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => {
                    if (selectedCurriculum && confirm('This will delete this curriculum version and all its requirements. Continue?')) {
                      purgeByCurriculumMutation.mutate(selectedCurriculum);
                    }
                  }}
                  disabled={!selectedCurriculum || purgeByCurriculumMutation.isPending}
                  title="Purge Curriculum"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Purge AISIS Schedules</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Select value={selectedTermForSchedule} onValueChange={setSelectedTermForSchedule}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select term (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {scheduleFilters?.terms.map((term) => (
                        <SelectItem key={term} value={term}>{term}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedDeptForSchedule} onValueChange={setSelectedDeptForSchedule}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select department (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {scheduleFilters?.departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    const termDesc = selectedTermForSchedule || 'all terms';
                    const deptDesc = selectedDeptForSchedule || 'all departments';
                    if (confirm(`Delete schedules for ${deptDesc} in ${termDesc}?`)) {
                      purgeSchedulesMutation.mutate({
                        termCode: selectedTermForSchedule || undefined,
                        department: selectedDeptForSchedule || undefined
                      });
                    }
                  }}
                  disabled={
                    purgeSchedulesMutation.isPending || 
                    (!selectedTermForSchedule && !selectedDeptForSchedule)
                  }
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Purge Schedules
                </Button>
                <p className="text-xs text-muted-foreground">
                  Select term and/or department to purge. At least one filter required.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Purge */}
      <div className="p-0 lg:p-6 lg:border lg:border-destructive lg:rounded-lg lg:bg-card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
          <p className="text-sm text-muted-foreground">Permanently delete large amounts of data. These actions cannot be undone.</p>
        </div>
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              These operations will permanently delete data. Make sure you have backups before proceeding.
            </AlertDescription>
          </Alert>

          {/* Chat Data Purge */}
          <div className="space-y-3 pt-4 border-t">
            <div className="mb-2">
              <h4 className="text-sm font-semibold">Chat Data Management</h4>
              <p className="text-xs text-muted-foreground">
                Manage community chat data. Note: Chat resets automatically daily at 8 AM PHT.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!confirm('This will delete all chat messages, files, and typing indicators. Continue?')) return;
                
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) throw new Error('Not authenticated');

                  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-cleanup`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${session.access_token}`,
                      'Content-Type': 'application/json',
                    },
                  });

                  if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Cleanup failed');
                  }

                  toast({ title: 'Chat data purged successfully' });
                } catch (error: any) {
                  toast({ 
                    title: 'Error purging chat data', 
                    description: error.message, 
                    variant: 'destructive' 
                  });
                }
              }}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Purge All Chat Data Now
            </Button>
            <p className="text-sm text-muted-foreground">
              Deletes: All chat messages, uploaded files, and typing indicators. Online users remain.
            </p>
          </div>

          {/* Scraping Data Purge */}
          <div className="space-y-3 pt-4 border-t">
            <div className="mb-2">
              <h4 className="text-sm font-semibold">Scraping Data Management</h4>
              <p className="text-xs text-muted-foreground">
                Delete all scraped AISIS data from users (curriculum, grades, schedules, etc.)
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!confirm('This will delete ALL user scraped data (curriculum, grades, schedules, account info, holds). Import jobs will remain for history. Continue?')) return;
                
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) throw new Error('Not authenticated');

                  // Delete all scraped data
                  const [curriculum, grades, program, schedule, account, holds] = await Promise.all([
                    supabase.from('scraped_curriculum').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                    supabase.from('scraped_my_grades').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                    supabase.from('scraped_my_program').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                    supabase.from('scraped_my_schedule').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                    supabase.from('scraped_account_info').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                    supabase.from('scraped_hold_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                  ]);

                  const errors = [curriculum.error, grades.error, program.error, schedule.error, account.error, holds.error].filter(Boolean);
                  
                  if (errors.length > 0) {
                    throw new Error('Some deletions failed');
                  }

                  queryClient.invalidateQueries();
                  toast({ 
                    title: 'Scraping data purged successfully',
                    description: 'All user scraped data has been deleted'
                  });
                } catch (error: any) {
                  toast({ 
                    title: 'Error purging scraping data', 
                    description: error.message, 
                    variant: 'destructive' 
                  });
                }
              }}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Purge All Scraping Data
            </Button>
            <p className="text-sm text-muted-foreground">
              Deletes: All scraped curriculum, grades, schedules, program, account info, and hold orders. Import job history remains.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <Button
              variant="destructive"
              onClick={() => {
                setPurgeType('curricula');
                setPurgeDialogOpen(true);
              }}
              className="w-full"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Purge All Curricula
            </Button>
            <p className="text-sm text-muted-foreground">
              Deletes: All curriculum versions, requirements, and program enrollments. Programs, courses, and schedules remain intact.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <Button
              variant="destructive"
              onClick={() => {
                setPurgeType('admin');
                setPurgeDialogOpen(true);
              }}
              className="w-full"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Purge All Programs & Courses
            </Button>
            <p className="text-sm text-muted-foreground">
              Deletes: All programs, courses, curriculum versions, and requirements. AISIS schedules remain. User data (grades, custom programs, saved schedules) unaffected.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <Button
              variant="destructive"
              onClick={() => {
                setPurgeType('admin_with_schedules');
                setPurgeDialogOpen(true);
              }}
              className="w-full"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Purge All Programs, Courses & Schedules
            </Button>
            <p className="text-sm text-muted-foreground">
              Deletes: All programs, courses, curriculum versions, requirements, AND AISIS schedules. User data (grades, custom programs, saved schedules) remains.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <Button
              variant="destructive"
              onClick={() => {
                setPurgeType('nuclear');
                setPurgeDialogOpen(true);
              }}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              🔥 Nuclear Option: Delete Everything
            </Button>
            <p className="text-sm text-muted-foreground">
              Deletes: Everything above PLUS all user grades, schedules, and program selections. User accounts remain but all their data is wiped.
            </p>
          </div>
        </div>
      </div>

      <AlertDialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {purgeType === 'nuclear' ? '🔥 Nuclear Purge Confirmation' : 'Confirm Purge'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3">
                {purgeType === 'curricula' && (
                  <p>This will permanently delete ALL curriculum versions and requirements. Programs, courses, and schedules will be preserved.</p>
                )}
                {purgeType === 'admin' && (
                  <p>This will permanently delete ALL programs, courses, and curriculum data. AISIS schedules and user data will be preserved.</p>
                )}
                {purgeType === 'admin_with_schedules' && (
                  <p>This will permanently delete ALL programs, courses, curriculum data, AND AISIS schedules. User data will be preserved.</p>
                )}
                {purgeType === 'nuclear' && (
                  <>
                    <p className="font-semibold text-destructive">This will delete EVERYTHING including user grades!</p>
                    <p>Type <strong>DELETE EVERYTHING</strong> to confirm:</p>
                    <input
                      type="text"
                      className="w-full p-2 border rounded"
                      value={confirmationText}
                      onChange={(e) => setConfirmationText(e.target.value)}
                      placeholder="DELETE EVERYTHING"
                    />
                  </>
                )}
                <p>This action cannot be undone!</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmationText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePurge}
              className="bg-destructive hover:bg-destructive/90"
              disabled={purgeType === 'nuclear' && confirmationText !== 'DELETE EVERYTHING'}
            >
              {purgeType === 'nuclear' ? 'Proceed with Nuclear Purge' : 'Confirm Purge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
