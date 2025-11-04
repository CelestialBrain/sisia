import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { guestStorage } from "@/utils/guestStorage";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getQPIValue, GRADE_OPTIONS, SEMESTER_OPTIONS } from "@/utils/qpiCalculations";

const gradeSchema = z.object({
  school_year: z.string().min(1, "School year is required"),
  semester: z.string().min(1, "Semester is required"),
  term_code: z.string().optional(),
  course_code: z.string().min(1, "Course code is required"),
  course_title: z.string().min(1, "Course title is required"),
  units: z.coerce.number().min(0.5).max(12),
  grade: z.string().min(1, "Grade is required"),
  grading_basis: z.enum(['letter', 'pass_fail', 'audit', 'satisfactory']).default('letter'),
});

type GradeFormData = z.infer<typeof gradeSchema>;


interface GradeFormProps {
  grade?: any;
  onClose?: () => void;
}

export function GradeForm({ grade, onClose }: GradeFormProps) {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<GradeFormData>({
    resolver: zodResolver(gradeSchema),
    defaultValues: {
      school_year: grade?.school_year || "",
      semester: grade?.semester || "",
      term_code: grade?.term_code || "",
      course_code: grade?.course_code || "",
      course_title: grade?.course_title || "",
      units: grade?.units || 3,
      grade: grade?.grade || "",
      grading_basis: grade?.grading_basis || 'letter',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: GradeFormData) => {
      if (!user && !isGuest) throw new Error("Not authenticated");

      const qpiValue = getQPIValue(data.grade);

      // Handle guest mode
      if (isGuest) {
        // Auto-generate term_code if not provided
        let termCode = data.term_code;
        if (!termCode && data.school_year && data.semester) {
          const termMap: Record<string, string> = {
            '1st Sem': '1',
            '2nd Sem': '2',
            'Intercession': '3'
          };
          const termNum = termMap[data.semester] || '1';
          termCode = `${data.school_year.split('-')[0]}-${termNum}`;
        }

        const payload = {
          id: grade?.id || guestStorage.generateId(),
          course_code: data.course_code,
          course_title: data.course_title,
          units: data.units,
          grade: data.grade,
          school_year: data.school_year,
          semester: data.semester,
          term_code: termCode,
          grading_basis: data.grading_basis,
          qpi_value: qpiValue,
          course_id: null,
        };

        if (grade) {
          guestStorage.updateCourse(grade.id, payload);
        } else {
          guestStorage.addCourse(payload);
        }
        return;
      }
      
      // Try to find matching course in courses table (prefer user's school, but allow university-wide)
      const { data: userProgram } = await supabase
        .from("user_programs")
        .select("program_id, programs(school_id)")
        .eq("user_id", user.id)
        .eq("is_primary", true)
        .maybeSingle();

      const userSchoolId = (userProgram?.programs as any)?.school_id;

      let matchingCourse = null;
      if (userSchoolId) {
        // First try school-specific or university-wide
        const { data: course } = await supabase
          .from("courses")
          .select("id")
          .eq("course_code", data.course_code)
          .or(`school_id.eq.${userSchoolId},school_id.is.null`)
          .maybeSingle();
        matchingCourse = course;
      } else {
        // Fallback to any matching course
        const { data: course } = await supabase
          .from("courses")
          .select("id")
          .eq("course_code", data.course_code)
          .maybeSingle();
        matchingCourse = course;
      }

      // Auto-generate term_code if not provided
      let termCode = data.term_code;
      if (!termCode && data.school_year && data.semester) {
        const termMap: Record<string, string> = {
          '1st Sem': '1',
          '2nd Sem': '2',
          'Intercession': '3'
        };
        const termNum = termMap[data.semester] || '1';
        termCode = `${data.school_year.split('-')[0]}-${termNum}`;
      }

      const payload = {
        course_code: data.course_code,
        course_title: data.course_title,
        units: data.units,
        grade: data.grade,
        school_year: data.school_year,
        semester: data.semester,
        term_code: termCode,
        grading_basis: data.grading_basis,
        user_id: user.id,
        qpi_value: qpiValue,
        course_id: matchingCourse?.id || null,
      };

      if (grade) {
        const { error } = await supabase
          .from("user_courses")
          .update(payload)
          .eq("id", grade.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_courses")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-courses"] });
      toast({
        title: grade ? "Grade updated" : "Grade added",
        description: grade
          ? "Your grade has been updated successfully."
          : "Your grade has been added successfully.",
      });
      form.reset();
      if (onClose) onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GradeFormData) => {
    mutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="school_year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>School Year</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 2023-2024" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="semester"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Semester</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SEMESTER_OPTIONS.map((sem) => (
                      <SelectItem key={sem} value={sem}>
                        {sem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="term_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Term Code (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 2024-1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="course_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Course Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., CS 21" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="course_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Course Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Introduction to Computing" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="units"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Units</FormLabel>
                <FormControl>
                  <Input type="number" step="0.5" min="0.5" max="12" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="grade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grade</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {GRADE_OPTIONS.map((g) => {
                      let label = g;
                      if (g === 'W') label = 'W - Counts as 0.00 in QPI';
                      if (g === 'WP') label = 'WP - Excluded from QPI';
                      return (
                        <SelectItem key={g} value={g}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="grading_basis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grading Basis</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select grading basis" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="letter">Letter Grade</SelectItem>
                    <SelectItem value="pass_fail">Pass/Fail</SelectItem>
                    <SelectItem value="audit">Audit</SelectItem>
                    <SelectItem value="satisfactory">Satisfactory</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-4">
          {onClose && (
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? grade
                ? "Updating..."
                : "Adding..."
              : grade
              ? "Update Grade"
              : "Add Grade"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
