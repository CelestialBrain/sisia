export interface UserCourse {
  id: string;
  user_id: string;
  school_year: string;
  semester: number;
  course_code: string;
  course_title: string;
  units: number;
  grade: string;
  qpi_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface QPICalculation {
  semesterQPI: number;
  cumulativeQPI: number;
  totalUnits: number;
  totalQualityPoints: number;
  gradeDistribution: Record<string, number>;
}

export function getQPIValue(grade: string): number | null {
  const qpiMap: Record<string, number | null> = {
    'A': 4.0,
    'B+': 3.5,    // Fixed from 3.0 per 2025 handbook
    'B': 3.0,     // Fixed from 2.5 per 2025 handbook
    'C+': 2.5,    // Added missing grade
    'C': 2.0,
    'D': 1.0,
    'F': 0.0,     // Fixed from 0
    'W': 0.0,     // Counts in QPI per 2025 handbook
    'WP': null,   // Excluded from QPI per 2025 handbook
    'INC': null,
    'NE': null,
    'AUD': null,
    'S': null,
    'U': null,
  };
  return qpiMap[grade] ?? 0;
}

/**
 * Determines if a course counts toward QPI calculation
 * @param course User course record
 * @param cohortYear Entry cohort year (e.g., "2024-2025") for PE inclusion logic
 * @returns true if course should count in QPI
 */
export function countsInQPI(course: UserCourse, cohortYear?: string): boolean {
  // Check if it's a PE course
  const isPE = course.course_code?.toUpperCase().startsWith('PE') || 
               course.course_title?.toUpperCase().includes('PHYSICAL') ||
               course.course_title?.toUpperCase().includes('PATHFIT');
  
  // PE only counts for 2024+ cohorts per 2025 handbook
  if (isPE && cohortYear) {
    const year = parseInt(cohortYear.split('-')[0]);
    if (isNaN(year) || year < 2024) return false;
  }
  
  // Exclude NSTP, INTACT, bridging courses per 2025 handbook
  const excludedKeywords = ['NSTP', 'INTACT', 'BRIDGING', 'BASIC'];
  const titleUpper = course.course_title?.toUpperCase() || '';
  if (excludedKeywords.some(kw => titleUpper.includes(kw))) {
    return false;
  }
  
  // Exclude null QPI grades (WP, INC, NE, AUD, S, U)
  const qp = getQPIValue(course.grade);
  return typeof qp === 'number';
}

export function calculateQPI(courses: UserCourse[], cohortYear?: string): QPICalculation {
  let totalUnits = 0;
  let totalQualityPoints = 0;
  const gradeDistribution: Record<string, number> = {};

  for (const course of courses) {
    // Use new cohort-aware filtering
    if (!countsInQPI(course, cohortYear)) {
      continue;
    }

    const qpiValue = getQPIValue(course.grade);

    if (qpiValue !== null) {
      totalUnits += course.units;
      totalQualityPoints += course.units * qpiValue;
    }

    gradeDistribution[course.grade] = (gradeDistribution[course.grade] || 0) + 1;
  }

  const cumulativeQPI = totalUnits > 0 ? totalQualityPoints / totalUnits : 0;

  return {
    semesterQPI: cumulativeQPI,
    cumulativeQPI,
    totalUnits,
    totalQualityPoints,
    gradeDistribution,
  };
}

/**
 * Filters repeatable courses to keep only the best attempt
 * @param courses Array of user courses
 * @returns Filtered array with best attempts only
 */
export function filterBestAttempts(courses: UserCourse[]): UserCourse[] {
  const courseMap = new Map<string, UserCourse>();
  
  for (const course of courses) {
    const key = course.course_code;
    const existing = courseMap.get(key);
    
    if (!existing) {
      courseMap.set(key, course);
    } else {
      // Keep better grade (or most recent if same grade)
      const existingQPI = getQPIValue(existing.grade) || 0;
      const currentQPI = getQPIValue(course.grade) || 0;
      
      if (currentQPI > existingQPI) {
        courseMap.set(key, course);
      } else if (currentQPI === existingQPI && 
                 new Date(course.created_at) > new Date(existing.created_at)) {
        courseMap.set(key, course);
      }
    }
  }
  
  return Array.from(courseMap.values());
}

export function calculateSemesterQPI(courses: UserCourse[], schoolYear: string, semester: number): number {
  const semesterCourses = courses.filter(
    (c) => c.school_year === schoolYear && c.semester === semester
  );
  return calculateQPI(semesterCourses).cumulativeQPI;
}

export function qpiToGWA(qpi: number): number {
  return 5.0 - qpi;
}

export function gwaToQPI(gwa: number): number {
  return 5.0 - gwa;
}

export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    'A': 'text-success',
    'A-': 'text-success',
    'B+': 'text-chart-2',
    'B': 'text-chart-2',
    'C': 'text-warning',
    'D': 'text-destructive',
    'F': 'text-destructive',
    'W': 'text-muted-foreground',
    'I': 'text-muted-foreground',
    'WP': 'text-muted-foreground',
    'S': 'text-muted-foreground',
    'U': 'text-muted-foreground',
    'AUD': 'text-muted-foreground',
  };
  return colors[grade] || 'text-foreground';
}

export const GRADE_OPTIONS = ['A', 'B+', 'B', 'C+', 'C', 'D', 'F', 'W'];
export const SEMESTER_OPTIONS = ['1st Sem', '2nd Sem', 'Intercession'];
