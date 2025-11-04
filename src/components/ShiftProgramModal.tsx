import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ACTIVE_PROGRAM_QUERY_KEY } from "@/hooks/useActiveProgram";
import { guestStorage } from "@/utils/guestStorage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ShiftProgramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEnrollment: any;
  onShiftComplete: () => void;
}

export function ShiftProgramModal({ 
  open, 
  onOpenChange,
  currentEnrollment,
  onShiftComplete
}: ShiftProgramModalProps) {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const [programs, setPrograms] = useState<any[]>([]);
  const [curriculumVersions, setCurriculumVersions] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [effectiveTerm, setEffectiveTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(true);

  useEffect(() => {
    if (open) {
      loadPrograms();
      // Set default effective term to current year
      const currentYear = new Date().getFullYear();
      setEffectiveTerm(`${currentYear}-1`);
    }
  }, [open]);

  useEffect(() => {
    if (selectedProgram) {
      loadCurriculumVersions();
    }
  }, [selectedProgram]);

  const loadPrograms = async () => {
    setLoadingPrograms(true);
    const { data, error } = await supabase
      .from('programs')
      .select('id, code, name')
      .order('code');
    
    if (!error && data) {
      setPrograms(data);
    }
    setLoadingPrograms(false);
  };

  const loadCurriculumVersions = async () => {
    const { data, error } = await supabase
      .from('curriculum_versions')
      .select('id, version_label')
      .eq('program_id', selectedProgram)
      .eq('is_active', true)
      .order('effective_start', { ascending: false });
    
    if (!error && data) {
      setCurriculumVersions(data);
      if (data.length > 0) {
        setSelectedVersion(data[0].id);
      }
    }
  };

  const handleShift = async () => {
    if (!selectedProgram || !selectedVersion || !effectiveTerm) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      if (isGuest) {
        // For guests, update the guest storage enrollment
        const selectedProgramData = programs.find(p => p.id === selectedProgram);
        const selectedVersionData = curriculumVersions.find(v => v.id === selectedVersion);
        
        if (!selectedProgramData || !selectedVersionData) {
          throw new Error('Invalid program or curriculum version');
        }
        
        // Fetch full program and curriculum data to hydrate guest enrollment
        const [programRes, versionRes] = await Promise.all([
          supabase.from('programs').select('*').eq('id', selectedProgram).single(),
          supabase.from('curriculum_versions').select('*').eq('id', selectedVersion).single(),
        ]);
        
        if (programRes.error || versionRes.error) {
          throw new Error('Failed to fetch program data');
        }
        
        const newEnrollment = {
          id: guestStorage.generateId(),
          user_id: 'guest',
          program_id: selectedProgram,
          curriculum_version_id: selectedVersion,
          start_term: effectiveTerm,
          status: 'active' as const,
          notes,
          programs: programRes.data,
          curriculum_versions: versionRes.data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        guestStorage.setEnrollment(newEnrollment);
        
        // Update localStorage cache for immediate UI update
        localStorage.setItem('app_program', JSON.stringify({
          name: programRes.data.name,
          code: programRes.data.code,
        }));
      } else {
        // For authenticated users, use Supabase
        // 1. Check if an enrollment already exists with this combination
        const { data: existingEnrollment } = await supabase
          .from('program_enrollments')
          .select('id')
          .eq('user_id', user!.id)
          .eq('program_id', selectedProgram)
          .eq('start_term', effectiveTerm)
          .neq('id', currentEnrollment.id) // Exclude current enrollment
          .maybeSingle();

        if (existingEnrollment) {
          toast({
            title: "Enrollment already exists",
            description: `You already have an enrollment for this program starting in ${effectiveTerm}. Please choose a different effective term.`,
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        // 2. End current enrollment
        const { error: updateError } = await supabase
          .from('program_enrollments')
          .update({ 
            end_term: effectiveTerm, 
            status: 'ended' 
          })
          .eq('id', currentEnrollment.id);

        if (updateError) throw updateError;

        // 3. Create new enrollment
        const { error: insertError } = await supabase
          .from('program_enrollments')
          .insert({
            user_id: user!.id,
            program_id: selectedProgram,
            curriculum_version_id: selectedVersion,
            start_term: effectiveTerm,
            status: 'active',
            notes
          });

        if (insertError) throw insertError;
      }

      toast({
        title: 'Program shifted successfully!',
        description: 'Your courses will be re-evaluated against the new curriculum.'
      });
      
      // Invalidate active program cache globally
      queryClient.invalidateQueries({ queryKey: [ACTIVE_PROGRAM_QUERY_KEY] });
      
      onShiftComplete();
      onOpenChange(false);
      
      // Reset form
      setSelectedProgram('');
      setSelectedVersion('');
      setNotes('');
    } catch (error: any) {
      console.error('Error shifting program:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Shift Program</DialogTitle>
          <DialogDescription>
            Choose your new program and when the change takes effect. 
            Your completed courses will be re-evaluated against the new curriculum.
          </DialogDescription>
        </DialogHeader>
        
        {loadingPrograms ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>New Program</Label>
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProgram && curriculumVersions.length > 0 && (
              <div>
                <Label>Curriculum Version</Label>
                <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {curriculumVersions.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.version_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Effective Term</Label>
              <Input 
                value={effectiveTerm}
                onChange={(e) => setEffectiveTerm(e.target.value)}
                placeholder="e.g., 2024-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: YYYY-T (e.g., 2024-1 for AY2024-2025 1st Term)
              </p>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Input 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for shifting..."
              />
            </div>

            <Button 
              onClick={handleShift} 
              className="w-full"
              disabled={loading || !selectedProgram || !selectedVersion || !effectiveTerm}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Shift
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
