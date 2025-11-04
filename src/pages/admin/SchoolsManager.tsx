import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function SchoolsManager() {
  const { data: schools, isLoading } = useQuery({
    queryKey: ['schools-with-stats'],
    queryFn: async () => {
      const { data: schools, error } = await supabase
        .from('schools')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      // Fetch program and course counts for each school
      const schoolsWithStats = await Promise.all(
        schools.map(async (school) => {
          const { count: programCount } = await supabase
            .from('programs')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', school.id);
          
          const { count: courseCount } = await supabase
            .from('courses')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', school.id);
          
          return {
            ...school,
            programCount: programCount || 0,
            courseCount: courseCount || 0,
          };
        })
      );
      
      return schoolsWithStats;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const totalPrograms = schools?.reduce((sum, s) => sum + s.programCount, 0) || 0;
  const totalCourses = schools?.reduce((sum, s) => sum + s.courseCount, 0) || 0;

  return (
    <div className="p-0 lg:p-6 lg:border lg:rounded-lg lg:bg-card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Schools</h3>
        <p className="text-sm text-muted-foreground">
          Undergraduate schools in Ateneo de Manila University. Schools are reference data and cannot be modified or deleted to maintain data integrity across the system.
        </p>
      </div>
      <div>
        <div className="flex gap-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Programs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPrograms}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCourses}</div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>School Name</TableHead>
                  <TableHead className="text-right">Programs</TableHead>
                  <TableHead className="text-right">Courses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools?.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell>
                      <Badge variant="outline">{school.code}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell className="text-right">{school.programCount}</TableCell>
                    <TableCell className="text-right">{school.courseCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
