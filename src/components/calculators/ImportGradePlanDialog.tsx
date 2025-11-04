import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileDown, Info, AlertCircle } from "lucide-react";
import { decodeGradePlanShare, GradePlanSharePayload } from "@/utils/gradePlanCodeGenerator";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ImportGradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (payload: GradePlanSharePayload) => Promise<void>;
}

export function ImportGradePlanDialog({
  open,
  onOpenChange,
  onImport,
}: ImportGradePlanDialogProps) {
  const [shareCode, setShareCode] = useState("");
  const [parsedPayload, setParsedPayload] = useState<GradePlanSharePayload | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCode = () => {
    setError(null);
    try {
      const payload = decodeGradePlanShare(shareCode.trim());
      setParsedPayload(payload);
      toast.success("Share code parsed successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Invalid share code";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleImport = async () => {
    if (!parsedPayload) return;

    setIsImporting(true);
    try {
      await onImport(parsedPayload);
      toast.success(`Imported ${parsedPayload.courses.length} courses`);
      onOpenChange(false);
      setShareCode("");
      setParsedPayload(null);
    } catch (err) {
      console.error("Error importing grade plan:", err);
      toast.error("Failed to import grade plan");
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setShareCode("");
      setParsedPayload(null);
      setError(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Import Grade Plan
          </DialogTitle>
          <DialogDescription>
            Paste a share code to import courses into your current plan
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!parsedPayload ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Share Code</label>
                <Textarea
                  value={shareCode}
                  onChange={(e) => setShareCode(e.target.value)}
                  placeholder="Paste share code here (starts with GP1.)"
                  className="font-mono text-xs resize-none"
                  rows={6}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Share codes start with "GP1." and contain encoded grade plan data.
                </AlertDescription>
              </Alert>
              <Button
                onClick={parseCode}
                disabled={!shareCode.trim()}
                className="w-full"
              >
                Parse Code
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Plan Name</label>
                  <p className="text-sm text-muted-foreground">{parsedPayload.plan_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Total Courses</label>
                  <p className="text-sm text-muted-foreground">{parsedPayload.courses.length} courses</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Courses Preview</label>
                  <ScrollArea className="h-48 border rounded-md p-3">
                    <div className="space-y-2">
                      {parsedPayload.courses.map((course, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm py-1">
                          <div className="flex-1">
                            <div className="font-medium">{course.course_code}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {course.course_title}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {course.grade && (
                              <Badge variant="secondary" className="text-xs">
                                {course.grade}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {course.units}u
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  These courses will be added to your current grade plan. Existing courses will not be affected.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        {parsedPayload && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setParsedPayload(null);
                setShareCode("");
              }}
            >
              Back
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? "Importing..." : "Import Courses"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
