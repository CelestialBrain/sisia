import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RenameScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onRename: (newName: string) => void;
  isRenaming: boolean;
}

export function RenameScheduleDialog({ 
  open, 
  onOpenChange, 
  currentName, 
  onRename,
  isRenaming 
}: RenameScheduleDialogProps) {
  const [newName, setNewName] = useState(currentName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newName !== currentName) {
      onRename(newName.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename Schedule</DialogTitle>
            <DialogDescription>
              Enter a new name for this schedule
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="scheduleName">Schedule Name</Label>
            <Input
              id="scheduleName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="My Schedule"
              className="mt-2"
              disabled={isRenaming}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isRenaming}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newName.trim() || newName === currentName || isRenaming}>
              {isRenaming ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
