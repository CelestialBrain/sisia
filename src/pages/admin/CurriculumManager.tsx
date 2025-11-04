import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';


// Temporary types until migration is approved and types are regenerated
interface CurriculumVersion {
  id: string;
  program_id: string;
  version_label: string;
  effective_start: string | null;
  effective_end: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RequirementGroup {
  id: string;
  curriculum_id: string;
  name: string;
  group_type: string;
  display_order: number;
  min_units: number | null;
  min_courses: number | null;
  max_units: number | null;
  double_counting_rule: string;
  description: string | null;
  created_at: string;
}

interface RequirementRule {
  id: string;
  req_group_id: string;
  rule_type: string;
  course_ids: string[] | null;
  tag_pattern: string | null;
  code_prefix: string | null;
  course_pattern: string | null;
  units_override: number | null;
  choices_count: number | null;
  description: string | null;
  created_at: string;
}

export default function CurriculumManager() {
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string | 'all' | 'none'>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Real-time subscription for curriculum version updates
  useEffect(() => {
    const channel = supabase
      .channel('curriculum-version-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'curriculum_versions'
        },
        (payload) => {
          console.log('New curriculum version created:', payload);
          // Invalidate queries to refetch latest data
          queryClient.invalidateQueries({ queryKey: ['curriculum-versions'] });
          queryClient.invalidateQueries({ queryKey: ['admin-programs'] });
          
          toast({
            title: 'New Curriculum Version',
            description: 'A new curriculum version has been added and is now visible.',
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);

  // Fetch programs with persistent cache
  const { data: programs } = useQuery({
    queryKey: ['admin-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('*, schools(name, code)')
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch tracks for selected program
  const { data: tracks } = useQuery({
    queryKey: ['program-tracks', selectedProgram],
    queryFn: async () => {
      if (!selectedProgram) return [];
      const { data, error } = await supabase
        .from('program_tracks')
        .select('*')
        .eq('program_id', selectedProgram)
        .order('track_code');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProgram,
  });

  // Fetch curriculum versions for selected program
  const { data: versions } = useQuery<any[]>({
    queryKey: ['curriculum-versions', selectedProgram, selectedTrack],
    queryFn: async () => {
      if (!selectedProgram) return [];
      
      let query = supabase
        .from('curriculum_versions' as any)
        .select('*, program_tracks(id, track_code, track_name)')
        .eq('program_id', selectedProgram);
      
      // Apply track filter
      if (selectedTrack === 'none') {
        query = query.is('track_id', null);
      } else if (selectedTrack !== 'all') {
        query = query.eq('track_id', selectedTrack);
      }
      
      query = query.order('effective_start', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data || [];
    },
    enabled: !!selectedProgram,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: true,
  });

  // Fetch requirement groups for selected version
  const { data: groups } = useQuery<RequirementGroup[]>({
    queryKey: ['requirement-groups', selectedVersion],
    queryFn: async () => {
      if (!selectedVersion) return [];
      
      const { data, error } = await supabase
        .from('requirement_groups' as any)
        .select('*')
        .eq('curriculum_id', selectedVersion)
        .order('display_order');
      if (error) throw error;
      
      return (data as unknown) as RequirementGroup[];
    },
    enabled: !!selectedVersion,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: true,
  });

  // Fetch requirement rules for groups
  const { data: rules } = useQuery<RequirementRule[]>({
    queryKey: ['requirement-rules', selectedVersion],
    queryFn: async () => {
      if (!selectedVersion || !groups) return [];
      const groupIds = groups.map(g => g.id);
      const { data, error } = await supabase
        .from('requirement_rules' as any)
        .select('*')
        .in('req_group_id', groupIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as unknown) as RequirementRule[];
    },
    enabled: !!selectedVersion && !!groups,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: true,
  });

  // Fetch courses grouped by requirement group (optimized batch query)
  const { data: groupedCourses, isLoading: coursesLoading } = useQuery({
    queryKey: ['grouped-courses', selectedVersion],
    queryFn: async () => {
      if (!selectedVersion || !groups) return {};
      
      // Step 1: Get ALL rules for ALL groups in ONE query
      const groupIds = groups.map(g => g.id);
      const { data: allRules } = await supabase
        .from('requirement_rules')
        .select('req_group_id, course_ids')
        .in('req_group_id', groupIds);
      
      // Step 2: Collect unique course IDs across all groups
      const allCourseIds = Array.from(
        new Set(
          allRules?.flatMap(r => r.course_ids || []).filter(Boolean) || []
        )
      );
      
      // Step 3: Fetch ALL courses in ONE query
      const { data: allCourses } = await supabase
        .from('courses')
        .select('id, course_code, course_title, units, prereq_expr, category_tags')
        .in('id', allCourseIds)
        .order('course_code');
      
      // Step 4: Create lookup map for fast access
      const courseMap = new Map(allCourses?.map(c => [c.id, c]) || []);
      
      // Step 5: Group courses by requirement group (preserve duplicate occurrences)
      const result: Record<string, any[]> = {};
      groups.forEach(group => {
        const groupRules = allRules?.filter(r => r.req_group_id === group.id) || [];
        // Keep ALL course IDs including duplicates - don't use Set
        const groupCourseIds = groupRules.flatMap(r => r.course_ids || []).filter(Boolean);
        result[group.id] = groupCourseIds
          .map(id => courseMap.get(id))
          .filter(Boolean);
        // Note: We preserve import order, no sorting to maintain curriculum sequence
      });
      
      return result;
    },
    enabled: !!selectedVersion && !!groups,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: true,
  });

  const selectedProgramData = programs?.find(p => p.id === selectedProgram);
  const selectedVersionData = versions?.find(v => v.id === selectedVersion);

  // Group requirement groups by type
  const termGroups = groups?.filter(g => g.group_type === 'term') || [];
  const categoryGroups = groups?.filter(g => g.group_type === 'category') || [];
  const seriesGroups = groups?.filter(g => g.group_type === 'series') || [];

  // Course table component for displaying courses in AISIS style
  const CourseTable = ({ courses }: { courses: any[] }) => {
    const totalUnits = courses.reduce((sum, c) => sum + (c.units || 0), 0);
    
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          {courses.length} courses • {totalUnits} total units
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Cat No</TableHead>
              <TableHead>Course Title</TableHead>
              <TableHead className="w-[80px] text-center">Units</TableHead>
              <TableHead className="w-[200px]">Prerequisites</TableHead>
              <TableHead className="w-[100px] text-center">Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course, index) => (
              <TableRow key={`${course.id}-${index}`}>
                <TableCell className="font-mono text-xs">{course.course_code}</TableCell>
                <TableCell className="font-medium">{course.course_title}</TableCell>
                <TableCell className="text-center">{course.units}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {course.prereq_expr || '-'}
                </TableCell>
                <TableCell className="text-center">
                  {course.category_tags && course.category_tags.length > 0 ? (
                    <Badge variant="outline" size="sm">
                      {course.category_tags[0]}
                    </Badge>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <>
      <div className="p-0 lg:p-6 lg:border lg:rounded-lg lg:bg-card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Curriculum Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage curriculum versions and requirement groups
          </p>
        </div>
        <div>

          {/* Program Selector */}
          <div className="space-y-4">
            <Label>Select Program</Label>
            <Select value={selectedProgram || ''} onValueChange={(val) => {
              setSelectedProgram(val);
              setSelectedTrack('all');
              setSelectedVersion(null);
            }}>
              <SelectTrigger className="w-full [&>span]:truncate">
                <SelectValue placeholder="Choose a program to view its curriculum versions" />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)] md:max-w-[600px]">
                {programs?.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                    <div className="truncate max-w-full">
                      <span className="font-semibold">{p.code}</span> - {p.name} ({p.schools?.code})
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Track Filter */}
          {selectedProgram && tracks && tracks.length > 0 && (
            <div className="space-y-2 mt-4">
              <Label>Filter by Track</Label>
              <Select value={selectedTrack} onValueChange={(val) => {
                setSelectedTrack(val as string);
                setSelectedVersion(null);
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tracks</SelectItem>
                  <SelectItem value="none">No Track (Base Program)</SelectItem>
                  {tracks.map((track) => (
                    <SelectItem key={track.id} value={track.id}>
                      Track {track.track_code} - {track.track_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Version List */}
      {selectedProgram && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Curriculum Versions</CardTitle>
                <CardDescription>
                  {selectedProgramData?.name}
                </CardDescription>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Version
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {versions && versions.length > 0 ? (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVersion(v.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedVersion === v.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{v.version_label}</p>
                            {v.program_tracks ? (
                              <Badge variant="outline" className="text-xs">
                                Track {v.program_tracks.track_code}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Base
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Effective: {v.effective_start ? new Date(v.effective_start).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={v.is_active ? 'success' : 'secondary'}>
                          {v.is_active ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Archived
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No curriculum versions found. Create one to get started.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Version Editor */}
      {selectedVersion && selectedVersionData && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedVersionData.version_label}
            </CardTitle>
            <CardDescription>
              Manage requirement groups and rules for this curriculum version
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="groups" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="groups">
                  <span className="hidden sm:inline">Requirement Groups</span>
                  <span className="sm:hidden">Groups</span>
                </TabsTrigger>
                <TabsTrigger value="rules">
                  <span className="hidden sm:inline">Rules Details</span>
                  <span className="sm:hidden">Rules</span>
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <span className="hidden sm:inline">Checklist Preview</span>
                  <span className="sm:hidden">Preview</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="groups" className="space-y-6">
                {/* Term Groups */}
                {termGroups.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-3">Term-Based Requirements</h3>
                    <Accordion type="multiple" className="space-y-2">
                      {termGroups.map((group) => (
                        <AccordionItem key={group.id} value={group.id}>
                          <AccordionTrigger>
                            <div className="flex justify-between items-center w-full pr-4">
                              <span>{group.name}</span>
                              <Badge variant="outline">
                                {group.min_units || 0} units
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 pt-2">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Min Units:</span> {group.min_units || 0}
                                </div>
                                <div>
                                  <span className="font-medium">Double Counting:</span> {group.double_counting_rule}
                                </div>
                                <div className="col-span-2">
                                  <span className="font-medium">Description:</span> {group.description || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}

                {/* Category Groups */}
                {categoryGroups.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Category Requirements</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {categoryGroups.map((group) => (
                        <Card key={group.id}>
                          <CardHeader>
                            <CardTitle className="text-base">{group.name}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Min Units:</span> {group.min_units || 0}
                              </div>
                              {group.min_courses && (
                                <div>
                                  <span className="font-medium">Min Courses:</span> {group.min_courses}
                                </div>
                              )}
                              <div>
                                <span className="font-medium">Double Counting:</span>{' '}
                                {group.double_counting_rule}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Series Groups */}
                {seriesGroups.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Series Requirements</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {seriesGroups.map((group) => (
                        <Card key={group.id}>
                          <CardHeader>
                            <CardTitle className="text-base">{group.name}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              {group.min_courses && (
                                <div>
                                  <span className="font-medium">Min Courses:</span> {group.min_courses}
                                </div>
                              )}
                              {group.min_units && (
                                <div>
                                  <span className="font-medium">Min Units:</span> {group.min_units}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {!groups || groups.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    No requirement groups found for this curriculum version.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="rules">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Total Rules: {rules?.length || 0}
                  </p>
                  {rules && rules.length > 0 ? (
                    <div className="space-y-4">
                      {rules.map((rule) => {
                        const group = groups?.find(g => g.id === rule.req_group_id);
                        return (
                          <Card key={rule.id}>
                            <CardHeader>
                              <CardTitle className="text-sm">
                                {group?.name} - {rule.rule_type}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                              {rule.tag_pattern && (
                                <div>
                                  <span className="font-medium">Tag Pattern:</span> {rule.tag_pattern}
                                </div>
                              )}
                              {rule.code_prefix && (
                                <div>
                                  <span className="font-medium">Code Prefix:</span> {rule.code_prefix}
                                </div>
                              )}
                              {rule.choices_count && (
                                <div>
                                  <span className="font-medium">Choices:</span> {rule.choices_count}
                                </div>
                              )}
                              {rule.description && (
                                <div>
                                  <span className="font-medium">Description:</span> {rule.description}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No requirement rules found.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="preview">
                {coursesLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <div className="text-center">
                      <p className="text-lg font-medium">Loading curriculum...</p>
                      <p className="text-sm text-muted-foreground">
                        Fetching {groups?.length || 0} requirement groups
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Term-based Groups (Accordion) */}
                    {termGroups.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Term-by-Term Curriculum</h3>
                        <Accordion type="single" collapsible className="w-full">
                          {termGroups.map((group) => {
                            const courses = groupedCourses?.[group.id] || [];
                            const totalUnits = courses.reduce((sum, c) => sum + (c.units || 0), 0);
                            
                            return (
                              <AccordionItem key={group.id} value={group.id}>
                                <AccordionTrigger>
                                  <div className="flex items-center gap-3">
                                    <span className="font-medium">{group.name}</span>
                                    <Badge variant="secondary">
                                      {courses.length} courses • {totalUnits} units
                                    </Badge>
                                    {group.min_units && (
                                      <Badge variant="outline">
                                        Required: {group.min_units} units
                                      </Badge>
                                    )}
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  {courses.length > 0 ? (
                                    <CourseTable courses={courses} />
                                  ) : (
                                    <p className="text-sm text-muted-foreground py-4">
                                      No courses found for this term.
                                    </p>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>
                    )}

                    {/* Series Groups */}
                    {seriesGroups.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Series Requirements</h3>
                        <div className="space-y-4">
                          {seriesGroups.map((group) => {
                            const courses = groupedCourses?.[group.id] || [];
                            
                            return (
                              <Card key={group.id}>
                                <CardHeader>
                                  <CardTitle className="text-base">{group.name}</CardTitle>
                                  {group.description && (
                                    <CardDescription>{group.description}</CardDescription>
                                  )}
                                </CardHeader>
                                <CardContent>
                                  {courses.length > 0 ? (
                                    <CourseTable courses={courses} />
                                  ) : (
                                    <p className="text-sm text-muted-foreground">
                                      No courses found for this series.
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(!groupedCourses || Object.keys(groupedCourses).length === 0) && (
                      <p className="text-muted-foreground text-center py-8">
                        No courses found for this curriculum version.
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </>
  );
}
