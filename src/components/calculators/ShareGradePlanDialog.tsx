import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Share2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { encodeGradePlanShare } from "@/utils/gradePlanCodeGenerator";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ShareGradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planName: string;
  curriculumVersionId: string;
}

export function ShareGradePlanDialog({
  open,
  onOpenChange,
  planId,
  planName,
  curriculumVersionId,
}: ShareGradePlanDialogProps) {
  const [shareCode, setShareCode] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateCode = async () => {
    setIsGenerating(true);
    try {
      // Fetch all plan courses
      const { data: courses, error: coursesError } = await supabase
        .from('user_grade_plan_courses')
        .select('*')
        .eq('plan_id', planId);

      if (coursesError) throw coursesError;

      if (!courses || courses.length === 0) {
        toast.error("No courses to share");
        setIsGenerating(false);
        return;
      }

      // Create payload
      const payload = {
        v: 1 as const,
        plan_name: planName,
        curriculum_version_id: curriculumVersionId,
        courses: courses.map(course => ({
          course_code: course.course_code,
          course_title: course.course_title,
          units: course.units,
          grade: course.grade,
          year_level: course.year_level,
          semester_label: course.semester_label,
          is_from_actual: course.is_from_actual,
          course_id: course.course_id,
        })),
      };

      // Encode share code
      const code = encodeGradePlanShare(payload);
      setShareCode(code);
      toast.success("Share code generated!");
    } catch (error) {
      console.error("Error generating share code:", error);
      toast.error("Failed to generate share code");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      toast.success("Share code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("Failed to copy share code");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Grade Plan
          </DialogTitle>
          <DialogDescription>
            Generate a shareable code for "{planName}"
          </DialogDescription>
        </DialogHeader>

        {!shareCode ? (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Share codes are offline and never expire. Anyone with the code can import your grade plan.
              </AlertDescription>
            </Alert>
            <Button
              onClick={generateCode}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? "Generating..." : "Generate Share Code"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Share Code</label>
              <Textarea
                value={shareCode}
                readOnly
                className="font-mono text-xs resize-none"
                rows={6}
              />
            </div>
            <Button
              onClick={copyCode}
              variant="outline"
              className="w-full"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This code is stored offline and contains all course data. Share it with others to let them import your grade plan.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
