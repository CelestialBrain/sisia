import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConflictConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: Array<{
    courseCode: string;
    time: string;
  }>;
  onConfirm: () => void;
}

export function ConflictConfirmDialog({ open, onOpenChange, conflicts, onConfirm }: ConflictConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Schedule Conflict
          </DialogTitle>
          <DialogDescription>
            This will create a scheduling conflict with existing classes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <p className="text-sm font-semibold">Conflicting with:</p>
          <ul className="space-y-1">
            {conflicts.map((conflict, idx) => (
              <li key={idx} className="text-sm text-muted-foreground pl-4">
                • {conflict.courseCode} ({conflict.time})
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}>
            Add Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
