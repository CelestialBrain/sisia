import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  GraduationCap, 
  BookOpen, 
  ListTree, 
  Users, 
  Building2,
  Calendar,
  LayoutGrid,
  TrendingUp
} from 'lucide-react';

export function AdminStatistics() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [
        programsRes, 
        coursesRes, 
        versionsRes, 
        usersRes,
        schoolsRes,
        aisisRes,
        userSchedulesRes,
        popularProgramRes
      ] = await Promise.all([
        supabase.from('programs').select('id', { count: 'exact', head: true }),
        supabase.from('courses').select('id', { count: 'exact', head: true }),
        (supabase as any).from('curriculum_versions').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('schools').select('id', { count: 'exact', head: true }),
        supabase.from('aisis_schedules').select('id', { count: 'exact', head: true }).eq('deprecated', false),
        supabase.from('user_schedules').select('id', { count: 'exact', head: true }),
        supabase
          .from('program_enrollments')
          .select('program_id, programs(name)', { count: 'exact' })
          .limit(1)
      ]);

      // Get most popular program
      const enrollmentCounts = await supabase
        .from('program_enrollments')
        .select('program_id');
      
      let mostPopularProgram = 'N/A';
      let maxEnrollments = 0;
      
      if (enrollmentCounts.data && enrollmentCounts.data.length > 0) {
        const programCounts = enrollmentCounts.data.reduce((acc: any, curr: any) => {
          acc[curr.program_id] = (acc[curr.program_id] || 0) + 1;
          return acc;
        }, {});
        
        const topProgramId = Object.entries(programCounts).sort(([,a]: any, [,b]: any) => b - a)[0]?.[0];
        maxEnrollments = programCounts[topProgramId] || 0;
        
        if (topProgramId) {
          const { data: programData } = await supabase
            .from('programs')
            .select('name')
            .eq('id', topProgramId)
            .single();
          
          if (programData) {
            mostPopularProgram = programData.name;
          }
        }
      }

      return {
        programs: programsRes.count || 0,
        courses: coursesRes.count || 0,
        curriculumVersions: versionsRes.count || 0,
        users: usersRes.count || 0,
        schools: schoolsRes.count || 0,
        aisisSchedules: aisisRes.count || 0,
        userSchedules: userSchedulesRes.count || 0,
        popularProgram: mostPopularProgram,
        popularProgramEnrollments: maxEnrollments,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-[14px] w-32" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-[12px] w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Registered Users',
      value: stats?.users || 0,
      icon: Users,
      description: 'Active users',
    },
    {
      title: 'Total Programs',
      value: stats?.programs || 0,
      icon: GraduationCap,
      description: 'Academic programs',
    },
    {
      title: 'Total Courses',
      value: stats?.courses || 0,
      icon: BookOpen,
      description: 'Available courses',
    },
    {
      title: 'User Schedules',
      value: stats?.userSchedules || 0,
      icon: Calendar,
      description: 'Schedules created',
    },
    {
      title: 'Schools',
      value: stats?.schools || 0,
      icon: Building2,
      description: 'Departments',
    },
    {
      title: 'Curriculum Versions',
      value: stats?.curriculumVersions || 0,
      icon: ListTree,
      description: 'Active versions',
    },
    {
      title: 'Most Popular Program',
      value: stats?.popularProgramEnrollments || 0,
      icon: TrendingUp,
      description: stats?.popularProgram || 'No enrollments yet',
    },
    {
      title: 'AISIS Schedules',
      value: stats?.aisisSchedules || 0,
      icon: LayoutGrid,
      description: 'Imported offerings',
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
