import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function EquivalenciesManager() {
  const queryClient = useQueryClient();
  const [fromCourse, setFromCourse] = useState('');
  const [toCourse, setToCourse] = useState('');
  const [equivalenceType, setEquivalenceType] = useState<'full' | 'partial' | 'one_of_many'>('full');
  const [notes, setNotes] = useState('');

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, course_code, course_title')
        .order('course_code');
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: equivalencies, isLoading: equivalenciesLoading } = useQuery({
    queryKey: ['equivalencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_equivalencies')
        .select(`
          id,
          equivalence_type,
          notes,
          from_course:from_course_id (id, course_code, course_title),
          to_course:to_course_id (id, course_code, course_title)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!fromCourse || !toCourse) {
        throw new Error('Please select both courses');
      }

      const { error } = await supabase
        .from('course_equivalencies')
        .insert({
          from_course_id: fromCourse,
          to_course_id: toCourse,
          equivalence_type: equivalenceType,
          notes
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equivalencies'] });
      toast({
        title: 'Equivalency added',
        description: 'Course equivalency has been created successfully'
      });
      setFromCourse('');
      setToCourse('');
      setNotes('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('course_equivalencies')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equivalencies'] });
      toast({
        title: 'Equivalency deleted',
        description: 'Course equivalency has been removed'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  if (coursesLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="p-0 lg:p-6 lg:border lg:rounded-lg lg:bg-card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Add Course Equivalency</h3>
          <p className="text-sm text-muted-foreground">
            Map courses between different curricula for program shifts
          </p>
        </div>
        <div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>From Course</Label>
                <Select value={fromCourse} onValueChange={setFromCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.course_code} - {c.course_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>To Course</Label>
                <Select value={toCourse} onValueChange={setToCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.course_code} - {c.course_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Equivalence Type</Label>
              <Select value={equivalenceType} onValueChange={(v: any) => setEquivalenceType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Equivalency</SelectItem>
                  <SelectItem value="partial">Partial Equivalency</SelectItem>
                  <SelectItem value="one_of_many">One of Many</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional information about this equivalency..."
                rows={3}
              />
            </div>

            <Button 
              onClick={() => addMutation.mutate()}
              disabled={!fromCourse || !toCourse || addMutation.isPending}
            >
              {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Equivalency
            </Button>
          </div>
        </div>
      </div>

      <div className="p-0 lg:p-6 lg:border lg:rounded-lg lg:bg-card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Existing Equivalencies</h3>
          <p className="text-sm text-muted-foreground">
            Manage course mappings across curricula
          </p>
        </div>
        <div>
          {equivalenciesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : equivalencies && equivalencies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From Course</TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>To Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equivalencies.map((eq: any) => (
                  <TableRow key={eq.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{eq.from_course.course_code}</div>
                        <div className="text-sm text-muted-foreground">{eq.from_course.course_title}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{eq.to_course.course_code}</div>
                        <div className="text-sm text-muted-foreground">{eq.to_course.course_title}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {eq.equivalence_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground max-w-xs truncate">
                        {eq.notes || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(eq.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No equivalencies defined yet
            </div>
          )}
        </div>
      </div>
    </>
  );
}
