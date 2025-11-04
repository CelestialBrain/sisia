export interface CourseInfo {
  courseCode: string;
  courseTitle: string;
  section: string;
  frequency: number; // how many times per week
}

export function extractCoursesFromAISIS(parsedBlocks: Array<{
  courseCode: string;
  courseTitle?: string;
  section: string;
  room: string;
  day: string | number;
  startTime: string;
  endTime: string;
}>): CourseInfo[] {
  const courseMap = new Map<string, CourseInfo>();

  for (const block of parsedBlocks) {
    const key = `${block.courseCode}-${block.section}`;
    
    if (courseMap.has(key)) {
      const existing = courseMap.get(key)!;
      existing.frequency += 1;
    } else {
      courseMap.set(key, {
        courseCode: block.courseCode,
        courseTitle: block.courseTitle || block.courseCode,
        section: block.section,
        frequency: 1,
      });
    }
  }

  return Array.from(courseMap.values());
}
