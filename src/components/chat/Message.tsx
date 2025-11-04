import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { QPIBadge } from "./QPIBadge";
import { VoicePlayer } from "./VoicePlayer";
import { FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage } from "@/utils/messageGrouping";

// Extract simplified program code (e.g., "BACHELOR OF SCIENCE IN MANAGEMENT ENGINEERING" -> "BS ME")
function extractProgramCode(programName: string): string {
  const match = programName.match(/BACHELOR OF SCIENCE IN ([A-Z\s]+)/i);
  if (match) {
    const words = match[1].trim().split(' ');
    return `BS ${words.map(w => w[0]).join('')}`;
  }
  return programName;
}

interface MessageProps {
  message: ChatMessage;
  isOwn: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  readCount: number;
  showQPI: boolean;
}

export function Message({ message, isOwn, isFirstInGroup, isLastInGroup, readCount, showQPI }: MessageProps) {
  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn(
      "flex gap-3 py-0 hover:bg-muted/30 group",
      isFirstInGroup && "mt-1"
    )}>
      {/* Avatar - show only on first message in group */}
      <div className="flex-shrink-0 w-10">
        {isFirstInGroup ? (
          <Avatar className="h-10 w-10">
            <AvatarFallback className={cn(
              "text-xs font-semibold",
              isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              {getInitials(message.display_name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground/50 text-right w-full pt-0.5 inline-block">
            {format(new Date(message.created_at), 'h:mm')}
          </span>
        )}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {/* Header - show only on first message in group */}
        {isFirstInGroup && (
          <div className="flex items-center gap-2 mb-0">
            <span className={cn(
              "text-sm font-semibold",
              isOwn ? "text-primary" : "text-foreground"
            )}>
              {message.display_name}
            </span>
            {message.program_name && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {extractProgramCode(message.program_name)}
              </Badge>
            )}
            {showQPI && message.cumulative_qpi !== null && message.cumulative_qpi !== undefined && (
              <QPIBadge qpi={message.cumulative_qpi} />
            )}
            <span className="text-xs text-muted-foreground">
              {formatTime(message.created_at)}
            </span>
          </div>
        )}
        
        {/* Text message */}
        {message.message_type === 'text' && message.message_content && (
          <p className="text-sm text-foreground whitespace-pre-wrap break-words mt-0.5">
            {message.message_content}
          </p>
        )}
        
        {/* Image attachment */}
        {message.message_type === 'image' && message.file_url && (
          <div className="mt-1">
            <img 
              src={message.file_url} 
              alt={message.file_name || "Image"} 
              className="rounded-lg max-w-[40%] object-contain"
              loading="lazy"
            />
          </div>
        )}
        
        {/* Voice message */}
        {message.message_type === 'voice' && message.file_url && (
          <div className="mt-1">
            <VoicePlayer url={message.file_url} />
          </div>
        )}
        
        {/* File attachment */}
        {message.message_type === 'file' && message.file_url && (
          <div className="mt-1">
            <a 
              href={message.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:underline bg-card border rounded-md px-3 py-2"
            >
              <FileText className="h-4 w-4" />
              <span className="text-sm truncate max-w-[300px]">{message.file_name || 'File'}</span>
              <Download className="h-3 w-3 flex-shrink-0" />
            </a>
          </div>
        )}

        {/* Read receipts on last message in group */}
        {isOwn && readCount > 0 && isLastInGroup && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Seen by {readCount}
          </div>
        )}
      </div>
    </div>
  );
}
