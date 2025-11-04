import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const programSchema = z.object({
  code: z.string()
    .min(1, 'Code is required')
    .max(30, 'Code is too long')
    .regex(/^[A-Z]{1,4}(?:\s+|\/|-)[A-Z\s\/-]+$/i, 'Invalid format (e.g., "BS ME", "BS/M AMF")'),
  name: z.string().min(1, 'Name is required').max(200),
  school_id: z.string().uuid('Select a school'),
  description: z.string().optional(),
  total_units: z.coerce.number().min(1).max(300),
});

type ProgramFormData = z.infer<typeof programSchema>;

interface ProgramFormProps {
  program?: any;
  onClose: () => void;
}

export function ProgramForm({ program, onClose }: ProgramFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schools } = useQuery({
    queryKey: ['schools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<ProgramFormData>({
    resolver: zodResolver(programSchema),
    defaultValues: program ? {
      ...program,
      school_id: Array.isArray(program.schools) ? program.schools[0]?.id : program.schools?.id || program.school_id
    } : {
      code: '',
      name: '',
      school_id: '',
      description: '',
      total_units: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProgramFormData) => {
      if (program) {
        const { error } = await supabase
          .from('programs')
          .update(data as any)
          .eq('id', program.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('programs').insert([data as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-programs'] });
      toast({ title: program ? 'Program updated' : 'Program created' });
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <h2 className="text-2xl font-bold">{program ? 'Edit Program' : 'Add Program'}</h2>

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Program Code</FormLabel>
              <FormControl>
                <Input placeholder="BS-CS" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Program Name</FormLabel>
              <FormControl>
                <Input placeholder="Bachelor of Science in Computer Science" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="school_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>School</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {schools?.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.code} - {school.name}
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
          name="total_units"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Units</FormLabel>
              <FormControl>
                <Input type="number" placeholder="180" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Program description..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : program ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
