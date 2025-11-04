import { ScheduleBlock } from './ScheduleBlock';
import { cn } from '@/lib/utils';
import { useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';

interface Block {
  id: string;
  course_code: string;
  course_title?: string | null;
  section: string;
  room: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  color: string;
}

interface TimeGridProps {
  blocks: Block[];
  conflicts: Set<string>;
  onBlockClick: (block: Block) => void;
  onBlockDelete: (blockId: string) => void;
  onBlockDuplicate: (block: Block) => void;
  onBlockDrop?: (paletteItemId: string, day: number, startTime: string) => void;
}

function timeToRow(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = (hours - 7) * 60 + minutes;
  return Math.round(totalMinutes / 30);
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 7; hour <= 21; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }
  return slots;
}

function generateHourlyTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 7; hour <= 21; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  return slots;
}

function TimeGridCell({ day, time }: { day: number; time: string }) {
  const cellId = `cell-${day}-${time}`;
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: {
      type: 'grid-cell',
      day,
      time,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-card h-10 relative border-t border-border",
        "hover:bg-primary/5 focus-visible:outline-1 focus-visible:outline-primary/20",
        "transition-colors",
        isOver && "bg-primary/20 ring-2 ring-primary border-2 border-primary border-dashed"
      )}
      data-time={time}
      data-day={day}
      tabIndex={0}
      aria-label={`${day === 1 ? 'Monday' : day === 2 ? 'Tuesday' : day === 3 ? 'Wednesday' : day === 4 ? 'Thursday' : day === 5 ? 'Friday' : day === 6 ? 'Saturday' : 'Sunday'} at ${time}`}
    />
  );
}

export function TimeGrid({ blocks, conflicts, onBlockClick, onBlockDelete, onBlockDuplicate, onBlockDrop }: TimeGridProps) {
  const timeSlots = generateTimeSlots();
  const hourlySlots = generateHourlyTimeSlots();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <div className="w-full">
      <div className="overflow-x-auto min-w-0">
        <div 
          ref={gridRef}
          className={cn(
            "relative bg-card overflow-y-visible min-w-[960px]"
          )}
        >
      <div className="grid grid-cols-[72px_repeat(7,1fr)] gap-x-px bg-border sticky top-0 z-20 border-b">
        <div className="bg-card sticky left-0 z-40 w-[72px] h-10 border-r"></div>
        {days.map((day) => (
          <div key={day} className="bg-card h-10 flex items-center justify-center font-semibold text-sm">{day}</div>
        ))}
      </div>

      <div className="relative grid grid-cols-[72px_repeat(7,1fr)] gap-x-px bg-border">
      {timeSlots.map((time, timeIdx) => {
          const isHourMark = time.endsWith(':00');
          const hour = parseInt(time.slice(0, 2));
          const period = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
          const hourTime = isHourMark ? `${displayHour} ${period}` : '';
          
          return (
            <div key={`time-${time}`} className="contents">
              <div className="bg-card pr-1 pt-0.5 text-[10px] text-muted-foreground flex items-start justify-end sticky left-0 z-10 w-[72px] h-10 border-t border-r border-border">
                {hourTime}
              </div>
              {days.map((day, dayIdx) => (
                <TimeGridCell key={`slot-${time}-${day}`} day={dayIdx + 1} time={time} />
              ))}
            </div>
          );
        })}

        {/* Blocks positioned using CSS Grid */}
        <div
          className="absolute inset-0 pointer-events-none grid grid-cols-[72px_repeat(7,1fr)] gap-x-px"
          style={{ gridAutoRows: '2.5rem' }}
        >
          {blocks.map((block) => {
            const startRow = timeToRow(block.start_time);
            const endRow = timeToRow(block.end_time);
            const col = block.day_of_week + 1; // +1 for time column

            return (
              <div
                key={block.id}
                className="pointer-events-auto z-30 p-px [transition:none]"
                style={{
                  gridColumn: `${col} / ${col + 1}`,
                  gridRow: `${startRow + 1} / ${endRow + 1}`,
                }}
              >
                <ScheduleBlock
                  block={block}
                  isConflict={conflicts.has(block.id)}
                  onClick={() => onBlockClick(block)}
                  onDelete={() => onBlockDelete(block.id)}
                  onDuplicate={() => onBlockDuplicate(block)}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            );
          })}
        </div>

      </div>
      </div>
    </div>
    </div>
  );
}
