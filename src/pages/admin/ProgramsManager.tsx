import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProgramForm } from './ProgramForm';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function ProgramsManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null);
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

  const { data: programs, isLoading } = useQuery({
    queryKey: ['admin-programs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('programs')
        .select(`
          *,
          schools(id, code, name),
          curriculum_versions(count),
          program_tracks(id, track_code, track_name)
        `)
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('programs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-programs'] });
      toast({ title: 'Program deleted successfully' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error deleting program', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const filteredPrograms = programs?.filter(p => {
    const schoolName = Array.isArray(p.schools) ? p.schools[0]?.name : p.schools?.name;
    const schoolId = Array.isArray(p.schools) ? p.schools[0]?.id : p.schools?.id;
    
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      schoolName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSchool = schoolFilter === 'all' || schoolId === schoolFilter;
    
    return matchesSearch && matchesSchool;
  });

  const handleExport = () => {
    if (!programs) return;
    const csv = [
      'Code,Name,School,Description,Total Units,Honors',
      ...programs.map(p => {
        const schoolName = Array.isArray(p.schools) ? p.schools[0]?.name : p.schools?.name;
        const isHonors = p.description?.includes('Honors Program') ? 'Yes' : 'No';
        return `"${p.code}","${p.name}","${schoolName}","${p.description || ''}",${p.total_units},"${isHonors}"`;
      })
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'programs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-0 lg:p-6 lg:border lg:rounded-lg lg:bg-card">
      <div className="mb-4 lg:mb-6">
        <h3 className="text-lg font-semibold">Programs Management</h3>
        <p className="text-sm text-muted-foreground">
          Manage academic programs, tracks, and curriculum versions
        </p>
      </div>
      <div>
        <div className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={schoolFilter} onValueChange={setSchoolFilter}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Filter by school" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {schools?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => { setEditingProgram(null); setIsFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Program
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
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Tracks</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Curriculum Versions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrograms?.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {program.code}
                        {program.description?.includes('Honors Program') && (
                          <Badge variant="success">Honors</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{program.name}</TableCell>
                    <TableCell>
                      {Array.isArray(program.schools) ? program.schools[0]?.code : program.schools?.code}
                    </TableCell>
                    <TableCell>
                      {program.program_tracks && program.program_tracks.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {program.program_tracks.map((track: any) => (
                            <Badge 
                              key={track.id} 
                              variant="success"
                              title={track.track_name}
                            >
                              {track.track_code}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No tracks</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{program.total_units}</TableCell>
                    <TableCell className="text-right">
                      {program.curriculum_versions?.[0]?.count || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingProgram(program); setIsFormOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Delete this program?')) {
                              deleteMutation.mutate(program.id);
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

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <ProgramForm
              program={editingProgram}
              onClose={() => { setIsFormOpen(false); setEditingProgram(null); }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
