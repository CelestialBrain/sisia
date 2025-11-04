import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { parseAISISData } from "@/utils/aisisParser";
import { Copy, Image, Upload, Check, Info } from "lucide-react";
import { guestStorage } from "@/utils/guestStorage";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function ImportAISIS() {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const [pastedText, setPastedText] = useState("");
  const [parsedGrades, setParsedGrades] = useState<any[]>([]);
  const [detectedProgram, setDetectedProgram] = useState<string | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleParse = async () => {
    if (!pastedText.trim()) {
      toast({
        title: "No data to parse",
        description: "Please paste your AISIS data first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const parsed = parseAISISData(pastedText);
      if (parsed.courses.length === 0) {
        toast({
          title: "No grades found",
          description: "Could not find any valid grade data in the pasted text.",
          variant: "destructive",
        });
        return;
      }
      
      // Check program mismatch (skip for guests)
      if (parsed.detectedProgram && user && !isGuest) {
        const { data: userProgram } = await supabase
          .from("user_programs")
          .select("programs(code, name)")
          .eq("user_id", user.id)
          .eq("is_primary", true)
          .maybeSingle();
        
        if (userProgram?.programs) {
          const userProgramCode = (userProgram.programs as any).code;
          const detectedCode = parsed.detectedProgram;
          
          if (userProgramCode && detectedCode !== userProgramCode) {
            toast({
              title: "⚠️ Program Mismatch Detected",
              description: `You're importing grades from "${detectedCode}" but your selected program is "${userProgramCode}". This may cause courses to appear as uncategorized.`,
              variant: "destructive",
              duration: 8000,
            });
          }
        }
      }
      
      setParsedGrades(parsed.courses);
      setDetectedProgram(parsed.detectedProgram);
      toast({
        title: "Data parsed successfully",
        description: `Found ${parsed.courses.length} course(s) ready to import.`,
      });
    } catch (error) {
      toast({
        title: "Parse error",
        description: "Failed to parse the pasted data. Please check the format.",
        variant: "destructive",
      });
    }
  };

  const importMutation = useMutation({
    mutationFn: async (grades: any[]) => {
      if (!user && !isGuest) throw new Error("Not authenticated");
      
      // Handle guest mode
      if (isGuest) {
        grades.forEach((g) => {
          guestStorage.addCourse({
            id: guestStorage.generateId(),
            course_code: g.course_code,
            course_title: g.course_title,
            units: g.units,
            grade: g.grade,
            school_year: g.school_year,
            semester: g.semester,
            qpi_value: g.qpi_value,
            course_id: null,
            grading_basis: 'letter',
          });
        });
        return;
      }
      
      const payload = grades.map((g) => ({
        course_code: g.course_code,
        course_title: g.course_title,
        units: g.units,
        grade: g.grade,
        school_year: g.school_year,
        semester: g.semester,
        user_id: user.id,
        qpi_value: g.qpi_value,
      }));

      const { error } = await supabase.from("user_courses").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-courses"] });
      toast({
        title: "Import successful",
        description: `Successfully imported ${parsedGrades.length} grade(s).`,
      });
      setPastedText("");
      setParsedGrades([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (parsedGrades.length === 0) {
      toast({
        title: "No data to import",
        description: "Please parse some grades first.",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate(parsedGrades);
  };

  const handleOCR = async (file: File) => {
    setIsProcessing(true);
    toast({
      title: "Processing image",
      description: "This may take a moment...",
    });

    try {
      // Dynamic import of Tesseract
      const Tesseract = await import("tesseract.js");
      
      const result = await Tesseract.recognize(file, "eng", {
        logger: (m) => console.log(m),
      });

      const text = result.data.text;
      const parsed = parseAISISData(text);
      
      if (parsed.courses.length === 0) {
        toast({
          title: "No grades found",
          description: "Could not extract grade data from the image. Try using copy-paste instead.",
          variant: "destructive",
        });
      } else {
        // Check program mismatch (skip for guests)
        if (parsed.detectedProgram && user && !isGuest) {
          const { data: userProgram } = await supabase
            .from("user_programs")
            .select("programs(code, name)")
            .eq("user_id", user.id)
            .eq("is_primary", true)
            .maybeSingle();
          
          if (userProgram?.programs) {
            const userProgramCode = (userProgram.programs as any).code;
            const detectedCode = parsed.detectedProgram;
            
            if (userProgramCode && detectedCode !== userProgramCode) {
              toast({
                title: "⚠️ Program Mismatch Detected",
                description: `You're importing grades from "${detectedCode}" but your selected program is "${userProgramCode}". This may cause courses to appear as uncategorized.`,
                variant: "destructive",
                duration: 8000,
              });
            }
          }
        }
        
        setParsedGrades(parsed.courses);
        setDetectedProgram(parsed.detectedProgram);
        toast({
          title: "OCR successful",
          description: `Found ${parsed.courses.length} course(s) from the image.`,
        });
      }
    } catch (error) {
      toast({
        title: "OCR failed",
        description: "Failed to process the image. Please try again or use copy-paste.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Import multiple grades at once by copying data from AISIS or uploading a screenshot.
      </p>

      <Tabs defaultValue="paste" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="paste" className="gap-2">
            <Copy className="h-4 w-4" />
            Copy & Paste
          </TabsTrigger>
          <TabsTrigger value="ocr" className="gap-2">
            <Image className="h-4 w-4" />
            Screenshot OCR
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Paste AISIS Data</label>
            <Textarea
              placeholder="Copy your grades from AISIS and paste them here..."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
          <Button onClick={handleParse} disabled={!pastedText.trim()}>
            Parse Data
          </Button>
        </TabsContent>

        <TabsContent value="ocr" className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload Screenshot</label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleOCR(file);
                }}
                disabled={isProcessing}
                className="hidden"
                id="ocr-upload"
              />
              <label htmlFor="ocr-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isProcessing
                    ? "Processing image..."
                    : "Click to upload a screenshot of your grades"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Supports JPG, PNG, WEBP
                </p>
              </label>
            </div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> OCR accuracy depends on image quality. For best results,
              ensure the text is clear and well-lit.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {parsedGrades.length > 0 && (
        <div className="space-y-4">
          {detectedProgram && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Detected Program: {detectedProgram}</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Preview ({parsedGrades.length} courses)</h4>
            <Button onClick={handleImport} disabled={importMutation.isPending} className="gap-2">
              <Check className="h-4 w-4" />
              {importMutation.isPending ? "Importing..." : "Import All"}
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School Year</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Course Code</TableHead>
                  <TableHead>Course Title</TableHead>
                  <TableHead className="text-center">Units</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedGrades.map((grade, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{grade.school_year}</TableCell>
                    <TableCell>{grade.semester}</TableCell>
                    <TableCell className="font-medium">{grade.course_code}</TableCell>
                    <TableCell>{grade.course_title}</TableCell>
                    <TableCell className="text-center">{grade.units}</TableCell>
                    <TableCell className="text-center font-semibold">{grade.grade}</TableCell>
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
