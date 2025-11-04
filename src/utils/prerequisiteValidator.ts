export interface PrerequisiteCheck {
  satisfied: boolean;
  missing: string[];
  message: string;
}

/**
 * Evaluates a prerequisite expression against completed courses
 * @param prereqExpr Logical expression like "PHILO-11", "PHILO-11 AND SOCSC-13", "(A AND B) OR C"
 * @param completedCourses Array of completed course codes
 * @returns PrerequisiteCheck object with satisfaction status
 */
export function evaluatePrerequisite(
  prereqExpr: string | null | undefined,
  completedCourses: string[]
): PrerequisiteCheck {
  if (!prereqExpr || prereqExpr.trim() === '') {
    return { satisfied: true, missing: [], message: 'No prerequisites' };
  }

  // Parse logical expression: "PHILO-11", "PHILO-11 AND SOCSC-13", "(A AND B) OR C"
  const tokens = prereqExpr.split(/\s+(AND|OR)\s+/i);
  const operators: string[] = [];
  const courses: string[] = [];
  
  tokens.forEach((token, idx) => {
    if (idx % 2 === 0) {
      // Course code (remove parens)
      courses.push(token.replace(/[()]/g, '').trim());
    } else {
      // Operator
      operators.push(token.toUpperCase());
    }
  });

  // Simple evaluation (AND = all required, OR = any required)
  const hasAnd = operators.includes('AND');
  const hasOr = operators.includes('OR');
  
  if (hasAnd && !hasOr) {
    // All required
    const missing = courses.filter(c => !completedCourses.includes(c));
    return {
      satisfied: missing.length === 0,
      missing,
      message: missing.length > 0 
        ? `Missing prerequisites: ${missing.join(', ')}`
        : 'Prerequisites satisfied'
    };
  } else if (hasOr && !hasAnd) {
    // Any required
    const hasSome = courses.some(c => completedCourses.includes(c));
    return {
      satisfied: hasSome,
      missing: hasSome ? [] : courses,
      message: hasSome 
        ? 'Prerequisites satisfied'
        : `Need at least one of: ${courses.join(', ')}`
    };
  } else if (courses.length === 1) {
    // Single course
    const satisfied = completedCourses.includes(courses[0]);
    return {
      satisfied,
      missing: satisfied ? [] : courses,
      message: satisfied ? 'Prerequisites satisfied' : `Missing: ${courses[0]}`
    };
  } else {
    // Mixed logic (complex) - simplified evaluation
    const satisfied = courses.some(c => completedCourses.includes(c));
    return {
      satisfied,
      missing: satisfied ? [] : courses,
      message: satisfied ? 'Prerequisites satisfied' : 'Prerequisites not met'
    };
  }
}

/**
 * Extracts completed course codes from user courses
 * @param userCourses Array of user course records
 * @returns Array of course codes that are completed
 */
export function getCompletedCourseCodes(userCourses: any[]): string[] {
  return userCourses
    .filter(c => c.grade && c.grade !== 'F' && c.grade !== 'W')
    .map(c => c.course_code);
}
