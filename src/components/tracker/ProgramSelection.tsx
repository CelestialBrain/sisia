import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useClientLogger } from "@/hooks/useClientLogger";
import { useQueryClient } from "@tanstack/react-query";
import { ACTIVE_PROGRAM_QUERY_KEY } from "@/hooks/useActiveProgram";
import { Loader2, Search } from "lucide-react";

interface ProgramSelectionProps {
  onProgramSelected: () => void;
}

export function ProgramSelection({ onProgramSelected }: ProgramSelectionProps) {
  const { user, isGuest } = useAuth();
  const { toast } = useToast();
  const logger = useClientLogger();
  const queryClient = useQueryClient();
  const [programs, setPrograms] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [curriculumVersions, setCurriculumVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");
  const [selectedCurriculumVersion, setSelectedCurriculumVersion] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    logger.info('component', 'ProgramSelection mounted', { isGuest });
    loadPrograms();
  }, [user, isGuest]);

  const loadPrograms = async () => {
    logger.info('program-selection', 'Loading programs list', { hasSearchQuery: !!searchQuery });
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/api-public-programs?limit=1000&search=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch programs');
      }

      const result = await response.json();
      setPrograms(result.data || []);
      logger.info('program-selection', 'Programs loaded', { count: result.data?.length || 0 });
    } catch (error: any) {
      logger.error('api', 'Failed to load programs', { error: error.message });
      console.error('Error loading programs:', error);
      toast({
        title: "Error",
        description: "Failed to load programs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTracks = async (programId: string) => {
    try {
      const { data, error } = await supabase
        .from("program_tracks")
        .select("*")
        .eq("program_id", programId)
        .order("track_code");

      if (error) throw error;
      setTracks(data || []);
      setSelectedTrack("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load program tracks",
        variant: "destructive",
      });
    }
  };

  const loadCurriculumVersions = async (programId: string, trackId?: string) => {
    try {
      let query = supabase
        .from("curriculum_versions")
        .select("*, program_tracks(track_code, track_name)")
        .eq("program_id", programId);

      if (trackId) {
        // Load versions for the specific track
        query = query.eq("track_id", trackId);
      } else if (tracks.length > 0) {
        // If tracks exist but none selected, load only trackless versions
        query = query.is("track_id", null);
      }
      // If no tracks exist, load all versions (no additional filter)

      const { data, error } = await query.order("effective_start", { ascending: false });

      if (error) throw error;
      setCurriculumVersions(data || []);
      setSelectedCurriculumVersion("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load curriculum versions",
        variant: "destructive",
      });
    }
  };

  const handleProgramChange = (programId: string) => {
    setSelectedProgram(programId);
    setSelectedTrack("");
    setTracks([]);
    setCurriculumVersions([]);
    setSelectedCurriculumVersion("");
    
    if (programId) {
      loadTracks(programId);
      loadCurriculumVersions(programId);
    }
  };

  const handleTrackChange = (trackId: string) => {
    setSelectedTrack(trackId);
    setSelectedCurriculumVersion("");
    if (trackId && selectedProgram) {
      loadCurriculumVersions(selectedProgram, trackId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    logger.info('program-selection', '=== SUBMIT FORM ===', { 
      selectedProgram, 
      selectedTrack, 
      selectedCurriculumVersion 
    });

    if (!selectedProgram || !selectedCurriculumVersion) {
      logger.warn('program-selection', 'Validation failed - missing selections', {
        hasProgram: !!selectedProgram,
        hasCurriculum: !!selectedCurriculumVersion
      });
      toast({
        title: "Error",
        description: "Please select a program and curriculum version",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    logger.info('program-selection', 'Fetching program data', { programId: selectedProgram });
    try {
      // Fetch full program and curriculum data for storage
      const { data: programData, error: progError } = await supabase
        .from("programs")
        .select("*")
        .eq("id", selectedProgram)
        .maybeSingle();

      if (progError) {
        logger.error('api', 'Failed to fetch program data', { error: progError });
        throw progError;
      }
      logger.info('api', 'Program data fetched', { programName: programData?.name });

      logger.info('program-selection', 'Fetching curriculum data', { curriculumVersionId: selectedCurriculumVersion });
      const { data: curriculumData, error: currError } = await supabase
        .from("curriculum_versions")
        .select("*")
        .eq("id", selectedCurriculumVersion)
        .maybeSingle();

      if (currError) {
        logger.error('api', 'Failed to fetch curriculum data', { error: currError });
        throw currError;
      }
      logger.info('api', 'Curriculum data fetched', { versionLabel: curriculumData?.version_label });

      let trackData = null;
      if (selectedTrack) {
        logger.info('program-selection', 'Fetching track data', { trackId: selectedTrack });
        const { data, error: trackError } = await supabase
          .from("program_tracks")
          .select("*")
          .eq("id", selectedTrack)
          .single();
        
        if (trackError) {
          logger.error('api', 'Failed to fetch track data', { error: trackError });
          throw trackError;
        }
        trackData = data;
        logger.info('api', 'Track data fetched', { trackName: data?.track_name });
      }

      const startTerm = curriculumData?.effective_start 
        ? `${new Date(curriculumData.effective_start).getFullYear()}-1`
        : "2024-1";

      if (isGuest) {
        // Store in guest storage
        const { guestStorage } = await import('@/utils/guestStorage');
        logger.info('program-selection', 'Creating guest enrollment object');
        const enrollment = {
          id: guestStorage.generateId(),
          user_id: 'guest',
          program_id: selectedProgram,
          track_id: selectedTrack || null,
          curriculum_version_id: selectedCurriculumVersion,
          start_term: startTerm,
          end_term: null,
          status: 'active',
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          programs: programData,
          curriculum_versions: curriculumData,
          program_tracks: trackData,
        };
        
        logger.info('program-selection', 'Enrollment object created', { 
          programId: selectedProgram, 
          programName: programData?.name,
          curriculumId: selectedCurriculumVersion,
          hasProgramData: !!programData,
          hasCurriculumData: !!curriculumData,
          hasTrackData: !!trackData,
        });
        
        guestStorage.setEnrollment(enrollment);
        logger.info('storage', 'Enrollment saved to sessionStorage');
        
        // Immediately update localStorage cache for UI
        if (programData) {
          try {
            localStorage.setItem('app_program', JSON.stringify({
              name: programData.name,
              code: programData.code,
            }));
            logger.info('storage', 'Updated app_program cache', { 
              programName: programData.name,
              programCode: programData.code 
            });
            
            // Dispatch custom event to notify Layout
            window.dispatchEvent(new CustomEvent('program-updated', { 
              detail: { name: programData.name, code: programData.code } 
            }));
            logger.info('ui', 'Dispatched program-updated event');
            
            // Invalidate React Query cache to trigger useActiveProgram refresh
            queryClient.invalidateQueries({ queryKey: [ACTIVE_PROGRAM_QUERY_KEY] });
            logger.info('query', 'Invalidated active program query cache');
            
            logger.info('program-selection', '=== PROGRAM SELECTION COMPLETE ===', { 
              programName: programData.name,
              curriculumVersionId: selectedCurriculumVersion,
            });
          } catch (e) {
            logger.error('storage', 'Failed to update app_program cache', { error: e });
          }
        }
      } else {
        // Store in database for authenticated users
        const { error } = await supabase.from("program_enrollments").insert({
          user_id: user?.id,
          program_id: selectedProgram,
          track_id: selectedTrack || null,
          curriculum_version_id: selectedCurriculumVersion,
          start_term: startTerm,
          status: "active",
        });

        if (error) throw error;
      }

      // Invalidate useActiveProgram query FIRST to force immediate refresh
      await queryClient.invalidateQueries({ queryKey: [ACTIVE_PROGRAM_QUERY_KEY] });
      
      // Small delay to ensure React Query cache is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Dispatch custom event to notify Layout as backup
      window.dispatchEvent(new CustomEvent('program-updated'));
      
      logger.info('program-selection', 'Program selection complete', { 
        programId: selectedProgram,
        curriculumVersionId: selectedCurriculumVersion 
      });

      toast({
        title: "Success",
        description: "Program selected successfully",
      });

      onProgramSelected();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save program",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-48 max-w-full mb-1" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <div className="space-y-3">
              <Skeleton className="h-6 w-32 mb-3" />
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-6 w-40 mb-3" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-11 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredPrograms = programs.filter(program => 
    program.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    program.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
          <CardHeader>
            <CardTitle>Select Your Program</CardTitle>
            <CardDescription>
              Choose your academic program to start tracking your progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3">
                <Label htmlFor="program" className="text-base font-medium">Program Code *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by code or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 mb-2"
                  />
                </div>
                <Select value={selectedProgram} onValueChange={handleProgramChange}>
                  <SelectTrigger id="program">
                    <SelectValue placeholder="Select a program code" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPrograms.length > 0 ? (
                      filteredPrograms.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.code} - {program.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No programs found
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedProgram && tracks.length > 0 && (
                <div className="space-y-3">
                  <Label htmlFor="track" className="text-base font-medium">Program Track *</Label>
                  <Select value={selectedTrack} onValueChange={handleTrackChange}>
                    <SelectTrigger id="track">
                      <SelectValue placeholder="Select a track" />
                    </SelectTrigger>
                    <SelectContent>
                      {tracks.map((track) => (
                        <SelectItem key={track.id} value={track.id}>
                          {track.track_name} ({track.track_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedProgram && (
                <div className="space-y-3">
                  <Label htmlFor="curriculum_version" className="text-base font-medium">Curriculum Version *</Label>
                  <Select value={selectedCurriculumVersion} onValueChange={setSelectedCurriculumVersion}>
                    <SelectTrigger id="curriculum_version">
                      <SelectValue placeholder="Select curriculum version" />
                    </SelectTrigger>
                    <SelectContent>
                      {curriculumVersions.length > 0 ? (
                        curriculumVersions.map((version) => (
                          <SelectItem key={version.id} value={version.id}>
                            {version.version_label}
                            {version.program_tracks ? (
                              <span className="text-muted-foreground ml-2">
                                ({version.program_tracks.track_code})
                              </span>
                            ) : tracks.length > 0 ? (
                              <span className="text-muted-foreground ml-2">
                                (General)
                              </span>
                            ) : null}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          {tracks.length > 0 && !selectedTrack 
                            ? "Select a track above, or choose from general versions below"
                            : "No versions available"
                          }
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={!selectedProgram || !selectedCurriculumVersion || saving}
                className="w-full h-11 text-base font-semibold"
                size="lg"
              >
                {saving ? "Saving..." : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
  );
}
