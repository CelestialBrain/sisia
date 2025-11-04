import { cn } from '@/lib/utils';

interface Block {
  id: string;
  course_code: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  color: string;
  font_color?: string | null;
  font_size?: string | null;
}

interface CompactTimeGridProps {
  blocks: Block[];
}

// Convert time string to minutes from 7:00 AM
function minutesFromStart(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours - 7) * 60 + minutes;
}

// Round down to nearest 30-minute slot
function timeToRowFloor(time: string): number {
  return Math.floor(minutesFromStart(time) / 30);
}

// Round up to nearest 30-minute slot
function timeToRowCeil(time: string): number {
  return Math.ceil(minutesFromStart(time) / 30);
}

export function CompactTimeGrid({ blocks }: CompactTimeGridProps) {
  const days = ['M', 'T', 'W', 'Th', 'F', 'S', 'Su'];
  const hours = ['7', '8', '9', '10', '11', '12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  
  return (
    <div className="w-full overflow-x-auto">
      <div className="relative bg-card min-w-[600px]">
        {/* Header with days */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] gap-x-px bg-border border-b sticky top-0 z-20">
          <div className="bg-card h-8 border-r" />
          {days.map((day) => (
            <div key={day} className="bg-card h-8 flex items-center justify-center text-xs font-medium">
              {day}
            </div>
          ))}
        </div>

        {/* Time slots and grid */}
        <div className="relative grid grid-cols-[48px_repeat(7,1fr)] gap-x-px bg-border" style={{ gridAutoRows: '0.75rem' }}>
          {/* Time labels and grid cells */}
          {Array.from({ length: 30 }).map((_, idx) => {
            const isHourMark = idx % 2 === 0;
            const hourIndex = Math.floor(idx / 2);
            const hourLabel = isHourMark && hourIndex < hours.length ? hours[hourIndex] : '';
            
            return (
              <div key={`row-${idx}`} className="contents">
                {/* Time label */}
                <div className={cn(
                  "bg-card text-[5px] text-muted-foreground flex items-start justify-end pr-1 pt-0.5 border-t border-r",
                  !isHourMark && "text-[7px]"
                )}>
                  {isHourMark ? hourLabel : ''}
                </div>
                
                {/* Day columns */}
                {days.map((day, dayIdx) => (
                  <div
                    key={`cell-${idx}-${day}`}
                    className="bg-card border-t hover:bg-muted/30 transition-colors"
                  />
                ))}
              </div>
            );
          })}

          {/* Blocks positioned on grid */}
          <div
            className="absolute inset-0 pointer-events-none grid grid-cols-[48px_repeat(7,1fr)] gap-x-px"
            style={{ gridAutoRows: '0.75rem' }}
          >
            {blocks.map((block) => {
              const startRow = timeToRowFloor(block.start_time);
              const endRow = Math.min(30, timeToRowCeil(block.end_time));
              const col = block.day_of_week + 1;
              
              // Parse font size to get base size, default to 8 (from text-xs)
              const baseSizeMap: Record<string, number> = {
                'text-xs': 10,
                'text-sm': 11,
                'text-base': 12,
                'text-lg': 14,
                'text-xl': 16
              };
              const fontSize = baseSizeMap[block.font_size || 'text-xs'] || 10;
              const fontColor = block.font_color || '#000000';

              return (
                <div
                  key={block.id}
                  className="p-px"
                  style={{
                    gridColumn: `${col} / ${col + 1}`,
                    gridRow: `${startRow + 1} / ${endRow + 1}`,
                  }}
                >
                  <div
                    className="h-full w-full rounded border flex items-center justify-center font-semibold overflow-hidden"
                    style={{
                      backgroundColor: block.color,
                      borderColor: block.color,
                      color: fontColor,
                      fontSize: `${fontSize}px`,
                    }}
                    title={block.course_code}
                  >
                    <span className="truncate px-1">
                      {block.course_code}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
