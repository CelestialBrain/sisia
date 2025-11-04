import { Loader2, FileText, Mic, Image as ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface UploadStatusProps {
  type: 'image' | 'file' | 'voice';
  fileName?: string;
  imageAspectRatio?: number; // width / height
}

export function UploadStatus({ type, fileName, imageAspectRatio }: UploadStatusProps) {
  if (type === 'image' && imageAspectRatio) {
    // Calculate dimensions for skeleton (max width 70% of container)
    const maxWidth = 320; // pixels
    const width = maxWidth;
    const height = maxWidth / imageAspectRatio;
    
    return (
      <div className="max-w-[70%] self-end mb-1">
        <Skeleton 
          className="rounded-lg relative overflow-hidden" 
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </Skeleton>
      </div>
    );
  }

  if (type === 'voice') {
    return (
      <div className="max-w-[70%] self-end mb-1">
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-3 min-w-[240px]">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <Mic className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">Sending voice message...</span>
        </div>
      </div>
    );
  }

  if (type === 'file') {
    return (
      <div className="max-w-[70%] self-end mb-1">
        <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <FileText className="h-4 w-4" />
          <span className="text-sm">{fileName || 'File'}</span>
        </div>
      </div>
    );
  }

  return null;
}
