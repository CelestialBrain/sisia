import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, Download, Upload, Database, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CourseForm } from './CourseForm';
import { ImportProgramCourses } from '@/components/admin/ImportProgramCourses';
import { CurriculumImportJobs } from '@/components/admin/CurriculumImportJobs';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function CoursesManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schools } = useQuery({
    queryKey: ['schools-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('id, code, name')
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: courses, isLoading } = useQuery({
    queryKey: ['admin-courses', schoolFilter, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('courses')
        .select('*, schools(name, code)')
        .order('course_code');
      
      // Apply school filter
      if (schoolFilter !== 'all') {
        if (schoolFilter === 'none') {
          query = query.is('school_id', null);
        } else {
          query = query.eq('school_id', schoolFilter);
        }
      }
      
      // Apply category filter if selected
      if (categoryFilter !== 'all') {
        query = query.contains('category_tags', [categoryFilter]);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching courses:', error);
        throw error;
      }
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast({ title: 'Course deleted successfully' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error deleting course', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const filteredCourses = courses?.filter(c => {
    const matchesSearch = 
      c.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.course_title.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSchool = schoolFilter === 'all' || 
      (schoolFilter === 'none' && !c.school_id) ||
      (schoolFilter !== 'none' && c.school_id === schoolFilter);
    
    const matchesCategory = categoryFilter === 'all' || 
      (c as any).category_tags?.includes(categoryFilter);
    
    return matchesSearch && matchesSchool && matchesCategory;
  });

  const handleExport = () => {
    if (!courses) return;
    
    const escapeCSV = (str: string | null | undefined) => {
      if (!str) return '""';
      const escaped = String(str).replace(/"/g, '""');
      return `"${escaped}"`;
    };
    
    const csv = [
      'School Code,School Name,Course Code,Catalog No,Course Title,Units,Category Tags,Grade Mode,Repeatable,Prerequisites',
      ...courses.map(c => [
        escapeCSV(c.schools?.code || ''),
        escapeCSV(c.schools?.name || 'University-wide'),
        escapeCSV(c.course_code),
        escapeCSV((c as any).catalog_no || c.course_code),
        escapeCSV(c.course_title),
        c.units,
        escapeCSV((c as any).category_tags?.join('; ') || ''),
        escapeCSV((c as any).grade_mode || 'letter'),
        (c as any).repeatable ? 'Yes' : 'No',
        escapeCSV((c as any).prereq_expr || '')
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `courses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-0 lg:p-6 lg:border lg:rounded-lg lg:bg-card">
      <div className="mb-4 lg:mb-6">
        <h3 className="text-lg font-semibold">Courses Catalog</h3>
        <p className="text-sm text-muted-foreground">
          Manage course offerings and import from AISIS curriculum
        </p>
      </div>
      <div>
        <Tabs defaultValue="import" className="space-y-6">
          <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-auto">
            <TabsTrigger value="import">
              <Upload className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Import</span>
            </TabsTrigger>
            <TabsTrigger value="manage">
              <Database className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Manage</span>
            </TabsTrigger>
            <TabsTrigger value="jobs">
              <Clock className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Jobs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import">
            <ImportProgramCourses />
          </TabsContent>

          <TabsContent value="manage" className="space-y-6">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by school" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Schools</SelectItem>
                    <SelectItem value="none">University-wide</SelectItem>
                    {schools?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="C">Core (C)</SelectItem>
                    <SelectItem value="M">Major (M)</SelectItem>
                    <SelectItem value="E">Elective (E)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>School (Optional)</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCourses?.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell>
                          {(course as any).is_university_wide ? (
                            <Badge variant="outline" className="border-primary text-primary">University-wide</Badge>
                          ) : course.school_id && course.schools?.code ? (
                            <Badge variant="secondary">{course.schools.code}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">No School</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{course.course_code}</TableCell>
                        <TableCell className="max-w-xs truncate">{course.course_title}</TableCell>
                        <TableCell className="max-w-[120px]">
                          <div className="flex gap-1.5 flex-wrap">
                            {(course as any).category_tags?.map((tag: string) => {
                              const categoryName = {
                                'C': 'Core',
                                'M': 'Major',
                                'E': 'Elective',
                                'SPEC': 'Specialization',
                              }[tag] || tag;
                              
                              return (
                                <Badge 
                                  key={tag} 
                                  variant="info"
                                  size="sm"
                                  title={categoryName}
                                >
                                  {tag}
                                </Badge>
                              );
                            }) || <span className="text-sm text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{course.units}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {(course as any).grade_mode || 'letter'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditingCourse(course); setIsFormOpen(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Delete this course?')) {
                                  deleteMutation.mutate(course.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="jobs">
            <CurriculumImportJobs />
          </TabsContent>
        </Tabs>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <CourseForm
              course={editingCourse}
              onClose={() => { setIsFormOpen(false); setEditingCourse(null); }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
