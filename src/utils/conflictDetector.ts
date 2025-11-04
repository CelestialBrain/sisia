export interface ScheduleBlock {
  id: string;
  course_code: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface Conflict {
  block1: ScheduleBlock;
  block2: ScheduleBlock;
  message: string;
}

export function detectConflicts(blocks: ScheduleBlock[]): Conflict[] {
  const conflicts: Conflict[] = [];
  
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (hasTimeConflict(blocks[i], blocks[j])) {
        const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        conflicts.push({
          block1: blocks[i],
          block2: blocks[j],
          message: `${blocks[i].course_code} and ${blocks[j].course_code} overlap on ${dayNames[blocks[i].day_of_week]}`
        });
      }
    }
  }
  
  return conflicts;
}

function hasTimeConflict(a: ScheduleBlock, b: ScheduleBlock): boolean {
  // Must be same day
  if (a.day_of_week !== b.day_of_week) return false;
  
  // Check time overlap
  const aStart = timeToMinutes(a.start_time);
  const aEnd = timeToMinutes(a.end_time);
  const bStart = timeToMinutes(b.start_time);
  const bEnd = timeToMinutes(b.end_time);
  
  return (aStart < bEnd && aEnd > bStart);
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
