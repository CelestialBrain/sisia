import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertCircle, CheckCircle2, Upload, FileText, AlertTriangle, Building2, Layers, ChevronDown, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseAISISProgramData, ParsedCourse, ParsedTerm, ParseError, parseCodeAndTrack, parseVersion, inferTrackName } from '@/utils/aisisProgramParser';
import { parseAISISHTML } from '@/utils/aisisHtmlParser';
import { detectSchoolFromProgramName } from '@/utils/schoolDetector';
import { getQPIValue } from '@/utils/qpiCalculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RequirementGroupPreview {
  name: string;
  group_type: 'term' | 'category' | 'series';
  min_units: number;
  courseCount: number;
  courses: string[];
}

interface FlatCourse {
  course_code: string;
  course_title: string;
  units: number;
  prerequisites: string[];
  category: string;
  year_level: number;
  semester: string;
}

export function ImportProgramCourses() {
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'html'>('text');
  const [parsedTerms, setParsedTerms] = useState<ParsedTerm[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [isParsed, setIsParsed] = useState(false);
  const [schoolDetection, setSchoolDetection] = useState<any>(null);
  const [detectedProgram, setDetectedProgram] = useState<{
    name: string;
    code: string | null;
    baseCode: string;
    trackSuffix: string | null;
    version: string;
    versionYear: number | null;
    versionSem: number | null;
    schoolId: string | null;
    schoolName: string | null;
    existingProgramId: string | null;
    existingTrackId: string | null;
  } | null>(null);
  const [groupPreview, setGroupPreview] = useState<RequirementGroupPreview[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all schools for manual selection
  const { data: schools = [] } = useQuery({
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


  // Helper: Convert terms to flat course list
  const termsToFlatCourses = (terms: ParsedTerm[]): FlatCourse[] => {
    return terms.flatMap(term => 
      term.courses.map(c => {
        const yearMatch = term.label.match(/Y(\d+(?:\.\d+)?)/);
        const yearLevel = yearMatch ? parseFloat(yearMatch[1]) : 1;
        const semester = term.label.replace(/Y\d\s+/, '');
        
        return {
          course_code: c.catalog_no,
          course_title: c.title,
          units: c.units,
          prerequisites: c.prerequisites,
          category: c.category,
          year_level: yearLevel,
          semester: semester,
        };
      })
    );
  };

  const importMutation = useMutation({
    mutationFn: async (courses: FlatCourse[]) => {
      if (!detectedProgram) throw new Error('No program detected');
      if (!detectedProgram.baseCode) throw new Error('Program code is required for import');

      const totalUnits = courses.reduce((sum, c) => sum + c.units, 0);
      
      // Compute version sequence
      let versionSeq = 1;
      if (detectedProgram.existingProgramId && detectedProgram.versionYear && detectedProgram.versionSem) {
        let query = supabase
          .from('curriculum_versions')
          .select('version_seq')
          .eq('program_id', detectedProgram.existingProgramId)
          .eq('version_year', detectedProgram.versionYear)
          .eq('version_sem', detectedProgram.versionSem);

        if (detectedProgram.existingTrackId) {
          // Case 1: Existing track - filter by track ID
          query = query.eq('track_id', detectedProgram.existingTrackId);
        } else if (detectedProgram.trackSuffix) {
          // Case 2: New track - use impossible UUID to match nothing
          query = query.eq('track_id', '00000000-0000-0000-0000-000000000000');
        } else {
          // Case 3: No track - filter by track_id IS NULL
          query = query.is('track_id', null);
        }

        const { data: existingVersions } = await query
          .order('version_seq', { ascending: false })
          .limit(1);

        if (existingVersions && existingVersions.length > 0) {
          versionSeq = (existingVersions[0].version_seq || 0) + 1;
        }
      }

      const trackName = detectedProgram.trackSuffix ? inferTrackName(detectedProgram.trackSuffix) : null;

      // Call edge function for background processing
      const { data, error } = await supabase.functions.invoke('import-curriculum', {
        body: {
          program_name: detectedProgram.name,
          program_code: detectedProgram.baseCode,
          track_suffix: detectedProgram.trackSuffix,
          track_name: trackName,
          version_label: detectedProgram.version,
          version_year: detectedProgram.versionYear,
          version_sem: detectedProgram.versionSem,
          version_seq: versionSeq,
          school_id: detectedProgram.schoolId,
          total_units: totalUnits,
          courses: courses,
          existing_program_id: detectedProgram.existingProgramId,
          existing_track_id: detectedProgram.existingTrackId,
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setIsImporting(false);
      
      // Clear form immediately
      setParsedTerms([]);
      setIsParsed(false);
      setInputText('');
      setDetectedProgram(null);
      setGroupPreview([]);
      setErrors([]);

      if (data.existing) {
        toast({
          title: 'Import Already Exists',
          description: `Job ID: ${data.job_id}. ${data.message}`,
          duration: 8000,
        });
      } else {
        toast({
          title: '✓ Import Submitted',
          description: `Job ID: ${data.job_id}. You can safely leave this page - the curriculum is being processed in the background and will appear automatically when ready.`,
          duration: 10000,
        });
      }
    },
    onError: (error: any) => {
      setIsImporting(false);
      
      console.error('Import error:', error);
      
      // Parse error response - Supabase edge functions return errors differently
      let errorData: any = null;
      let errorMessage = '';
      
      console.log('Full error object:', JSON.stringify(error, null, 2));
      
      // Try to parse the error context which contains the response
      if (error.context?.body) {
        try {
          errorData = typeof error.context.body === 'string' 
            ? JSON.parse(error.context.body) 
            : error.context.body;
        } catch (e) {
          console.error('Failed to parse error body:', e);
        }
      }
      
      // Also check error.message for JSON
      if (!errorData && error.message) {
        try {
          const jsonMatch = error.message.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            errorData = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          // Not JSON, continue
        }
      }
      
      // Extract error details
      const errorType = errorData?.error || error.error;
      errorMessage = errorData?.message || error.message || 'An unexpected error occurred';
      
      // Handle duplicate curriculum error
      if (errorType === 'DUPLICATE_CURRICULUM' || 
          errorMessage.includes('DUPLICATE_CURRICULUM') ||
          errorMessage.includes('already exists')) {
        
        const existingVersionId = errorData?.existing_version_id;
        
        toast({
          title: 'Duplicate Curriculum Version',
          description: `${errorMessage} ${existingVersionId ? `(Version ID: ${existingVersionId})` : ''}`,
          variant: 'destructive',
          duration: 10000,
        });
        
        // Add error to the errors list for visibility
        setErrors(prev => [...prev, {
          type: 'error',
          message: `⚠️ DUPLICATE: ${errorMessage}`,
          line: 0
        }]);
      } else {
        toast({
          title: 'Import Failed',
          description: errorMessage,
          variant: 'destructive',
          duration: 7000,
        });
      }
    },
  });

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an HTML file (.html or .htm)',
        variant: 'destructive',
      });
      return;
    }

    try {
      const text = await file.text();
      setInputText(text);
      setInputMode('html');
      toast({
        title: 'File uploaded',
        description: 'HTML file loaded. Click "Parse HTML" to extract courses.',
      });
    } catch (error) {
      toast({
        title: 'Error reading file',
        description: 'Could not read the uploaded file',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleParse = async () => {
    if (!inputText.trim()) {
      toast({
        title: 'No data to parse',
        description: 'Please paste course data or upload an HTML file before parsing',
        variant: 'destructive',
      });
      return;
    }

    const result = inputMode === 'html' 
      ? parseAISISHTML(inputText)
      : parseAISISProgramData(inputText);
    
    if (!result.program_name) {
      toast({
        title: 'Program name not found',
        description: 'Could not detect program name from input.',
        variant: 'destructive',
      });
      return;
    }

    // Detect school
    const detection = await detectSchoolFromProgramName(result.program_name);
    setSchoolDetection(detection);

    // Parse code and track
    if (!result.program_code) {
      toast({
        title: 'Program code required',
        description: 'Could not extract program code from input. Program code is mandatory for import.',
        variant: 'destructive',
      });
      return;
    }

    // Use track_code directly from parsed result (already extracted by HTML parser)
    const baseCode = result.program_code || '';
    let trackSuffix = result.track_code || null;
    const { year, sem } = parseVersion(result.version || '');

    // Infer track from course placeholders if track not found
    if (!trackSuffix) {
      const allCourses = (result.terms || []).flatMap((t: any) => t.courses || []);
      for (const c of allCourses) {
        const text = `${c.course_code || ''} ${c.course_title || ''}`.toUpperCase();
        // Match patterns like "CHNS-H TRACK COURSE" or "CHNS H TRACK COURSE"
        const m = text.match(/([A-Z]{2,})[-\s]([A-Z])\s+TRACK\s+COURSE/);
        if (m) { 
          trackSuffix = m[2]; // Extract single letter track code (H, B, S, etc.)
          console.info('Track inferred from placeholder:', { course: c.course_code, trackSuffix });
          break; 
        }
      }
    }

    console.info('Track detection result:', {
      fromParser: result.track_code,
      finalTrackSuffix: trackSuffix,
      baseCode: baseCode,
      programName: result.program_name
    });

    // Find existing program by baseCode ONLY
    const { data: existingProgram } = await supabase
      .from('programs')
      .select('id, name, code, school_id, schools(name)')
      .eq('code', baseCode)
      .maybeSingle();

    // Find existing track if trackSuffix exists
    let existingTrack = null;
    if (existingProgram && trackSuffix) {
      const { data } = await supabase
        .from('program_tracks')
        .select('id, track_code, track_name')
        .eq('program_id', existingProgram.id)
        .eq('track_code', trackSuffix)
        .maybeSingle();
      existingTrack = data;
    }

    // Validation warning if similar program with different code exists
    if (!existingProgram) {
      const { data: similarPrograms } = await supabase
        .from('programs')
        .select('code, name')
        .ilike('name', `%${result.program_name}%`)
        .limit(3);

      if (similarPrograms && similarPrograms.length > 0) {
        const similarList = similarPrograms.map(p => `"${p.name}" (${p.code})`).join(', ');
        setErrors(prev => [...prev, {
          type: 'warning',
          message: `Similar program(s) found: ${similarList}. Your import will create a new program with code "${baseCode}".`,
        }]);
      }
    }

    setDetectedProgram({
      name: result.program_name,
      code: result.program_code,
      baseCode,
      trackSuffix,
      version: result.version || 'Unknown version',
      versionYear: year,
      versionSem: sem,
      schoolId: existingProgram?.school_id || detection.schoolId,
      schoolName: existingProgram 
        ? (Array.isArray(existingProgram.schools) ? existingProgram.schools[0]?.name : existingProgram.schools?.name)
        : detection.schoolName,
      existingProgramId: existingProgram?.id || null,
      existingTrackId: existingTrack?.id || null,
    });

    // Fetch highest version_seq for this program/year/sem/track to compute next seq
    if (existingProgram && year && sem) {
      let seqQuery = supabase
        .from('curriculum_versions')
        .select('version_seq')
        .eq('program_id', existingProgram.id)
        .eq('version_year', year)
        .eq('version_sem', sem);
      
      if (existingTrack) {
        // Case 1: Existing track - filter by track ID
        seqQuery = seqQuery.eq('track_id', existingTrack.id);
      } else if (trackSuffix) {
        // Case 2: New track - use impossible UUID to match nothing
        seqQuery = seqQuery.eq('track_id', '00000000-0000-0000-0000-000000000000');
      } else {
        // Case 3: No track - filter by track_id IS NULL
        seqQuery = seqQuery.is('track_id', null);
      }
      
      const { data: latest } = await seqQuery.order('version_seq', { ascending: false }).limit(1);
      const nextSeq = latest && latest.length > 0 ? (latest[0].version_seq || 0) + 1 : 1;
      
      console.log(`Next version seq for ${result.program_code} Y${year}S${sem}${trackSuffix ? `-${trackSuffix}` : ''}: ${nextSeq}`);
      
      // Check for duplicate curriculum with identical course list
      const courseCodesInPayload = (result.terms || [])
        .flatMap(t => t.courses || [])
        .map(c => c.catalog_no?.trim().toUpperCase())
        .filter(Boolean)
        .sort();

      let existingCurriculaQuery = supabase
        .from('curriculum_versions')
        .select(`
          id,
          version_seq,
          requirement_groups!inner(
            requirement_rules!inner(
              course_ids
            )
          )
        `)
        .eq('program_id', existingProgram.id)
        .eq('version_year', year)
        .eq('version_sem', sem);

      if (existingTrack) {
        // Case 1: Existing track - filter by track ID
        existingCurriculaQuery = existingCurriculaQuery.eq('track_id', existingTrack.id);
      } else if (trackSuffix) {
        // Case 2: New track - use impossible UUID to match nothing
        existingCurriculaQuery = existingCurriculaQuery.eq('track_id', '00000000-0000-0000-0000-000000000000');
      } else {
        // Case 3: No track - filter by track_id IS NULL
        existingCurriculaQuery = existingCurriculaQuery.is('track_id', null);
      }

      const { data: existingCurricula } = await existingCurriculaQuery;

      // Fetch course IDs to codes mapping
      const allCourseIds = (existingCurricula || [])
        .flatMap(cv => cv.requirement_groups || [])
        .flatMap((rg: any) => rg.requirement_rules || [])
        .flatMap((rr: any) => rr.course_ids || [])
        .filter(Boolean);

      let existingCoursesMap = new Map<string, string>();
      if (allCourseIds.length > 0) {
        const { data: coursesData } = await supabase
          .from('courses')
          .select('id, course_code')
          .in('id', [...new Set(allCourseIds)]);
        
        coursesData?.forEach(c => existingCoursesMap.set(c.id, c.course_code?.trim().toUpperCase()));
      }

      // Check if any existing curriculum has the same course list
      const hasDuplicate = existingCurricula?.some(cv => {
        const existingCourses = (cv.requirement_groups || [])
          .flatMap((rg: any) => rg.requirement_rules || [])
          .flatMap((rr: any) => (rr.course_ids || []).map((id: string) => existingCoursesMap.get(id)))
          .filter(Boolean)
          .sort();

        if (existingCourses.length !== courseCodesInPayload.length) return false;
        return existingCourses.every((code, i) => code === courseCodesInPayload[i]);
      });

      if (hasDuplicate) {
        setErrors(prev => [...prev, {
          type: 'error',
          message: `DUPLICATE CURRICULUM: An identical curriculum (same courses) already exists for ${baseCode}${trackSuffix ? `-${trackSuffix}` : ''} ${year} Sem ${sem}. Import blocked to prevent duplicates.`
        }]);
      }
    }

    // Generate requirement group preview
    const preview: RequirementGroupPreview[] = [];
    const flatCourses = termsToFlatCourses(result.terms);

    // Term groups
    const termGroups = new Map<string, FlatCourse[]>();
    flatCourses.forEach(course => {
      if (course.year_level && course.semester) {
        const key = `Year ${course.year_level} - ${course.semester}`;
        if (!termGroups.has(key)) {
          termGroups.set(key, []);
        }
        termGroups.get(key)!.push(course);
      }
    });

    termGroups.forEach((courses, name) => {
      preview.push({
        name,
        group_type: 'term',
        min_units: courses.reduce((sum, c) => sum + c.units, 0),
        courseCount: courses.length,
        courses: courses.map(c => c.course_code),
      });
    });

    // Category groups
    const categoryGroups = new Map<string, FlatCourse[]>();
    flatCourses.forEach(course => {
      if (!categoryGroups.has(course.category)) {
        categoryGroups.set(course.category, []);
      }
      categoryGroups.get(course.category)!.push(course);
    });

    categoryGroups.forEach((courses, category) => {
      preview.push({
        name: `${category} Requirements`,
        group_type: 'category',
        min_units: courses.reduce((sum, c) => sum + c.units, 0),
        courseCount: courses.length,
        courses: courses.map(c => c.course_code),
      });
    });

    setGroupPreview(preview);
    setParsedTerms(result.terms);
    setErrors(result.errors);
    setIsParsed(true);
  };

  const handleImport = () => {
    const flatCourses = termsToFlatCourses(parsedTerms);
    
    if (flatCourses.length === 0) {
      toast({
        title: 'No courses to import',
        description: 'Parse some valid courses before importing',
        variant: 'destructive',
      });
      return;
    }

    // Count duplicates for informational purposes (but preserve all occurrences)
    const seenCodes = new Map<string, number>();
    flatCourses.forEach(course => {
      const code = course.course_code.trim().toUpperCase();
      seenCodes.set(code, (seenCodes.get(code) || 0) + 1);
    });
    
    const duplicates = Array.from(seenCodes.entries())
      .filter(([_, count]) => count > 1)
      .map(([code, count]) => `${code} (${count}×)`);
    
    if (duplicates.length > 0) {
      console.log('Duplicate course occurrences preserved:', duplicates);
      toast({
        title: 'Multiple occurrences detected',
        description: `${duplicates.length} course(s) appear multiple times and will be preserved as separate requirements.`,
        duration: 5000,
      });
    }

    // Block import if there are errors (including duplicate warning)
    const hasDuplicateWarning = errors.some(e => e.message?.includes('DUPLICATE WARNING'));
    const hasErrors = errors.some(e => e.type === 'error');
    if (hasErrors) {
      toast({
        title: hasDuplicateWarning ? 'Duplicate Curriculum Version' : 'Fix errors first',
        description: hasDuplicateWarning
          ? 'This curriculum version already exists for this program/track/year/semester. Import is blocked.'
          : 'Please resolve the highlighted errors before importing.',
        variant: 'destructive',
      });
      return;
    }

    importMutation.mutate(flatCourses);
  };

  const errorCount = errors.filter(e => e.type === 'error').length;
  const warningCount = errors.filter(e => e.type === 'warning').length;
  const totalLinesProcessed = inputText.trim().split('\n').filter(l => l.trim()).length;
  const totalCourses = parsedTerms.reduce((acc, t) => acc + t.courses.length, 0);

  const getImportButtonText = () => {
    if (importMutation.isPending) return 'Importing...';
    if (!isParsed) return 'Parse Data First';
    if (errorCount > 0) return 'Fix Errors First';
    if (totalCourses === 0) return 'No Valid Courses';
    return `Import ${totalCourses} Course${totalCourses !== 1 ? 's' : ''}`;
  };

  const canImport = isParsed && 
    totalCourses > 0 && 
    errorCount === 0 &&
    !importMutation.isPending && 
    detectedProgram?.schoolId !== undefined;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold mb-1">Import AISIS Curriculum Data</h4>
        <p className="text-sm text-muted-foreground">
          Paste complete curriculum data or upload an HTML file from AISIS. The system will automatically parse course information and requirement groups.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={inputMode === 'text' ? 'default' : 'outline'}
            onClick={() => setInputMode('text')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Paste Text
          </Button>
          <Button
            variant={inputMode === 'html' ? 'default' : 'outline'}
            onClick={() => setInputMode('html')}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload HTML
          </Button>
        </div>
        
        {inputMode === 'text' ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">AISIS Curriculum Data *</label>
              <Textarea
                placeholder="Paste the entire curriculum from AISIS here..."
                value={inputMode === 'text' ? inputText : ''}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setInputMode('text');
                }}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleParse} 
                disabled={!inputText.trim()}
              >
                <FileText className="h-4 w-4 mr-2" />
                Parse Data
              </Button>
              {isParsed && totalCourses > 0 && (
                <Button
                  onClick={handleImport}
                  disabled={!canImport || importMutation.isPending}
                >
                  {getImportButtonText()}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 md:p-12 text-center transition-all duration-200 ${
                isDragging
                  ? 'border-primary bg-primary/10 scale-[1.02]'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/5'
              }`}
            >
              <input
                type="file"
                accept=".html,.htm"
                onChange={handleFileUpload}
                className="hidden"
                id="html-upload"
              />
              <label
                htmlFor="html-upload"
                className="cursor-pointer flex flex-col items-center gap-3 touch-manipulation"
              >
                <div className={`rounded-full p-4 transition-all duration-200 ${
                  isDragging ? 'bg-primary/20 scale-110' : 'bg-muted'
                }`}>
                  <Upload className={`h-8 w-8 transition-colors ${
                    isDragging ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                </div>
                <div>
                  <div className="text-base font-medium mb-1">
                    {isDragging
                      ? 'Drop HTML file here'
                      : 'Drag & drop HTML file or tap to upload'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    (.html or .htm files only)
                  </div>
                </div>
              </label>
            </div>

            {inputMode === 'html' && inputText && (
              <div className="space-y-4">
                <Alert className="border-primary/50 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription className="font-medium">
                    HTML file loaded ({(inputText.length / 1024).toFixed(1)} KB)
                  </AlertDescription>
                </Alert>
                
                <div className="flex gap-2">
                  <Button onClick={handleParse}>
                    <FileText className="h-4 w-4 mr-2" />
                    Parse Data
                  </Button>
                  {isParsed && totalCourses > 0 && (
                    <Button
                      onClick={handleImport}
                      disabled={!canImport || importMutation.isPending}
                    >
                      {getImportButtonText()}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Detected Program & School */}
      {isParsed && detectedProgram && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Check className="h-5 w-5 text-green-600" />
              {totalCourses > 0 ? 'Successfully Parsed' : 'Parse Complete - No Courses Found'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {totalCourses === 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="text-sm">
                    <strong>No courses were parsed.</strong> Please check your input format. 
                    Try pasting the full curriculum data from AISIS.
                  </div>
                </AlertDescription>
              </Alert>
            )}
            <Alert>
              <AlertDescription>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Program Name:</span>
                    <Badge variant="outline">{detectedProgram.name}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Program Code:</span>
                    <Badge variant={detectedProgram.code ? "default" : "secondary"}>
                      {detectedProgram.code || detectedProgram.baseCode}
                    </Badge>
                  </div>
                  {detectedProgram.trackSuffix && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Track Code:</span>
                      <Badge variant="default">{detectedProgram.trackSuffix}</Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Version:</span>
                    <Badge variant="outline">{detectedProgram.version}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Academic Year:</span>
                    <Badge variant="default">{detectedProgram.versionYear} Semester {detectedProgram.versionSem}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">School:</span>
                    <Badge variant={detectedProgram.schoolId ? "default" : "secondary"}>
                      {detectedProgram.schoolName}
                    </Badge>
                  </div>
                  {!detectedProgram.schoolId && (
                    <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                      ⚠️ School not detected. The curriculum will be created but needs manual school assignment.
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-3 gap-4 p-3 bg-muted rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Lines Processed</p>
                <p className="text-lg font-semibold">{totalLinesProcessed}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Courses Found</p>
                <p className="text-lg font-semibold text-green-600">{totalCourses}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Errors/Warnings</p>
                <p className="text-lg font-semibold text-amber-600">{errors.length}</p>
              </div>
            </div>
            
            {detectedProgram.existingProgramId && (
              <Alert>
                <AlertDescription>
                  <details>
                    <summary className="cursor-pointer font-semibold mb-2">
                      Existing Program Detected
                    </summary>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Program ID:</span>
                        <span className="text-muted-foreground">{detectedProgram.existingProgramId}</span>
                      </div>
                      {detectedProgram.existingTrackId && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Track ID:</span>
                          <span className="text-muted-foreground">{detectedProgram.existingTrackId}</span>
                        </div>
                      )}
                    </div>
                  </details>
                </AlertDescription>
              </Alert>
            )}
            
            {errors.length > 0 && (
              <Alert>
                <AlertDescription>
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 font-semibold mb-2 w-full">
                      <ChevronDown className="h-4 w-4" />
                      Issues Found ({errors.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 text-xs mt-2">
                        {errors.slice(0, 10).map((error, index) => (
                          <div key={index} className={`p-2 rounded border ${
                            error.type === 'error' ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : 
                            'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'
                          }`}>
                            <div className="flex items-start gap-2">
                              {error.type === 'error' ? 
                                <AlertCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" /> :
                                <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                              }
                              <p className="text-xs">{error.message}</p>
                            </div>
                          </div>
                        ))}
                        {errors.length > 10 && (
                          <p className="text-xs text-muted-foreground">
                            ... and {errors.length - 10} more issues
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Requirement Groups Preview */}
      {isParsed && groupPreview.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Requirement Groups Preview</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Group</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Courses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupPreview.map((group, index) => (
                  <TableRow key={index} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell className="text-right">{group.min_units}</TableCell>
                    <TableCell className="text-right">{group.courseCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

    </div>
  );
}
