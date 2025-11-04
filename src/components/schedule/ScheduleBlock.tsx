import { Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface ScheduleBlockProps {
  block: {
    id: string;
    course_code: string;
    course_title?: string | null;
    section: string;
    room: string;
    instructor?: string | null;
    start_time: string;
    end_time: string;
    color: string;
    day_of_week: number;
    font_color?: string | null;
    font_size?: string | null;
  };
  isConflict: boolean;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  style?: React.CSSProperties;
}

export function ScheduleBlock({ block, isConflict, onClick, onDelete, onDuplicate, style }: ScheduleBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    data: {
      type: 'schedule-block',
      block,
    },
  });

  const fontSizeClass = block.font_size || 'text-xs';
  const fontColor = block.font_color || '#000000';

  const draggableStyle = {
    ...style,
    transform: CSS.Translate.toString(transform),
    backgroundColor: isConflict ? undefined : block.color,
    borderColor: isConflict ? undefined : 'transparent',
    opacity: isDragging ? 0.5 : 1,
    cursor: 'move',
    color: fontColor,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "relative z-20 p-2 rounded-lg border-2 group overflow-hidden h-full flex flex-col select-none",
        fontSizeClass,
        !isDragging && "hover:opacity-90 active:opacity-70",
        isConflict && "border-destructive bg-destructive/10"
      )}
      style={{
        ...draggableStyle,
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onClick={(e) => {
        if (!isDragging) {
          onClick();
        }
      }}
    >
      {/* Top section - Course info */}
      <div className="flex-shrink-0">
        <div className="font-bold mb-1 truncate" title={block.course_code}>
          {block.course_code}
        </div>
        <div className="opacity-80 truncate" title={block.section}>
          {block.section}
        </div>
        <div className="opacity-70 truncate" title={block.room}>
          {block.room}
        </div>
      </div>
      
      {/* Spacer */}
      <div className="flex-grow min-h-[4px]" />
      
      {/* Bottom section - Instructor and time */}
      <div className="flex-shrink-0 mt-auto">
        {block.instructor && (
          <div className="opacity-60 truncate mb-0.5" title={block.instructor}>
            {block.instructor}
          </div>
        )}
        <div className="opacity-50">
          {block.start_time.slice(0, 5)} - {block.end_time.slice(0, 5)}
        </div>
      </div>
      
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-background/80 hover:bg-primary hover:text-primary-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
