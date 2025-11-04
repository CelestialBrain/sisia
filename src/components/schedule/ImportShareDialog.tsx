import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { decodeScheduleShare, SharePayload } from '@/utils/scheduleCodeGenerator';
import { FileDown, AlertTriangle } from 'lucide-react';

interface ImportShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (payload: SharePayload) => Promise<void>;
}

export function ImportShareDialog({ open, onOpenChange, onImport }: ImportShareDialogProps) {
  const [shareText, setShareText] = useState('');
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleParse = () => {
    setError(null);
    setPayload(null);
    
    try {
      const decoded = decodeScheduleShare(shareText.trim());
      setPayload(decoded);
    } catch (err: any) {
      setError(err.message || 'Failed to parse share code');
    }
  };

  const handleImport = async () => {
    if (!payload) return;

    setIsImporting(true);
    try {
      await onImport(payload);
      setShareText('');
      setPayload(null);
      setError(null);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to import schedule');
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setShareText('');
      setPayload(null);
      setError(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Schedule</DialogTitle>
          <DialogDescription>
            Paste a schedule share code to import courses and blocks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Share Code</Label>
            <Textarea
              placeholder="Paste the share code here (starts with SB1. or SB2.)"
              value={shareText}
              onChange={(e) => setShareText(e.target.value)}
              className="font-mono text-xs resize-none"
              rows={6}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {payload && (
            <div className="space-y-3">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h4 className="font-semibold text-sm">Preview</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Schedule Name:</span> {payload.name}</p>
                  <p><span className="text-muted-foreground">Term:</span> {payload.term}</p>
                  <p><span className="text-muted-foreground">Courses:</span> {payload.palette.length}</p>
                  <p><span className="text-muted-foreground">Time Blocks:</span> {payload.blocks.length}</p>
                </div>
              </div>

              {payload.palette.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Courses to Import</h4>
                  <ScrollArea className="h-32 rounded-md border">
                    <div className="p-3 space-y-1">
                      {payload.palette.map((item, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-medium">{item.course_code}</span>
                          {item.section && <span className="text-muted-foreground"> ({item.section})</span>}
                          {' - '}{item.course_title}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!payload ? (
            <Button onClick={handleParse} disabled={!shareText.trim()}>
              <FileDown className="h-4 w-4 mr-2" />
              Parse Code
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? 'Importing...' : 'Add to Current Schedule'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
