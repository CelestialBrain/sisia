import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const courseSchema = z.object({
  school_id: z.string().uuid('Select a school').nullable().optional(),
  course_code: z.string().min(1, 'Code is required').max(20),
  catalog_no: z.string().min(1, 'Catalog number is required'),
  course_title: z.string().min(1, 'Title is required').max(200),
  units: z.coerce.number().min(0).max(12),
  prereq_expr: z.string().optional(),
  grade_mode: z.enum(['letter', 'pass_fail', 'audit']).default('letter'),
  repeatable: z.boolean().default(false),
});

type CourseFormData = z.infer<typeof courseSchema>;

interface CourseFormProps {
  course?: any;
  onClose: () => void;
}

export function CourseForm({ course, onClose }: CourseFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [categoryTags, setCategoryTags] = useState<string[]>(course?.category_tags || []);
  const [tagInput, setTagInput] = useState('');

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
  });

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: course ? {
      school_id: course.school_id || 'NONE',
      course_code: course.course_code,
      catalog_no: course.catalog_no || course.course_code,
      course_title: course.course_title,
      units: course.units,
      prereq_expr: (course as any).prereq_expr || '',
      grade_mode: (course as any).grade_mode || 'letter',
      repeatable: (course as any).repeatable || false,
    } : {
      school_id: 'NONE',
      course_code: '',
      catalog_no: '',
      course_title: '',
      units: 3,
      prereq_expr: '',
      grade_mode: 'letter',
      repeatable: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: CourseFormData) => {
      const payload = { 
        ...data, 
        category_tags: categoryTags,
        school_id: data.school_id === 'NONE' ? null : data.school_id // Convert 'NONE' to null
      };
      if (course) {
        const { error } = await supabase
          .from('courses')
          .update(payload as any)
          .eq('id', course.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('courses').insert([payload as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast({ title: course ? 'Course updated' : 'Course created' });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addTag = () => {
    const tag = tagInput.trim().toUpperCase();
    if (tag && !categoryTags.includes(tag)) {
      setCategoryTags([...categoryTags, tag]);
      setTagInput('');
    }
  };

  const commonTags = ['C', 'M', 'E', 'PFT1', 'PFT2', 'PFT3', 'PFT4', 'NP1', 'NP2', 'NS1A', 'NS1B', 'IE1E'];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <h2 className="text-2xl font-bold">{course ? 'Edit Course' : 'Add Course'}</h2>

        <FormField
          control={form.control}
          name="school_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>School (Optional)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || 'NONE'}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select school or leave blank for university-wide" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="NONE">University-wide (MATH, ENGL, etc.)</SelectItem>
                  {schools?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Leave blank for courses shared across all schools
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="course_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Course Code</FormLabel>
                <FormControl>
                  <Input placeholder="CS 21" {...field} />
                </FormControl>
                <FormDescription>Internal identifier</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="catalog_no"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Catalog Number</FormLabel>
                <FormControl>
                  <Input placeholder="CS 21" {...field} />
                </FormControl>
                <FormDescription>Display format</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="course_title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Course Title</FormLabel>
              <FormControl>
                <Input placeholder="Object-Oriented Programming" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="units"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Units</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="3" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="grade_mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grade Mode</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="letter">Letter Grade</SelectItem>
                    <SelectItem value="pass_fail">Pass/Fail</SelectItem>
                    <SelectItem value="audit">Audit</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="repeatable"
            render={({ field }) => (
              <FormItem className="flex flex-col justify-end">
                <FormLabel>Repeatable</FormLabel>
                <div className="flex items-center space-x-2 h-10">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <span className="text-sm text-muted-foreground">Can retake</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <FormLabel>Category Tags</FormLabel>
          <FormDescription className="mb-2">
            Common tags: Core (C), Major (M), Elective (E), PATHFit (PFT1-4), NSTP (NP1-2)
          </FormDescription>
          <div className="flex gap-2 mb-2 flex-wrap">
            {commonTags.map(tag => (
              <Button
                key={tag}
                type="button"
                variant={categoryTags.includes(tag) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (categoryTags.includes(tag)) {
                    setCategoryTags(categoryTags.filter(t => t !== tag));
                  } else {
                    setCategoryTags([...categoryTags, tag]);
                  }
                }}
              >
                {tag}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Custom tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            />
            <Button type="button" onClick={addTag}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {categoryTags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
                <button
                  type="button"
                  onClick={() => setCategoryTags(categoryTags.filter((t) => t !== tag))}
                  className="ml-2"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <FormField
          control={form.control}
          name="prereq_expr"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prerequisite Expression (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="CS 11 AND CS 12&#10;or&#10;(MATH 21 OR MATH 22) AND PHYS 71"
                  {...field} 
                  className="font-mono text-sm"
                  rows={3}
                />
              </FormControl>
              <FormDescription>
                Use AND, OR, and parentheses. Example: "CS 11 AND (MATH 21 OR MATH 22)"
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : course ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
