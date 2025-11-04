import { supabase } from '@/integrations/supabase/client';

export interface SchoolDetectionResult {
  schoolId: string | null;
  schoolCode: string | null;
  schoolName: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

// School keyword mappings for the five undergraduate schools
const SCHOOL_KEYWORDS: Record<string, string[]> = {
  'SOH': [
    'art management', 'communication', 'english', 'literature', 'philosophy', 
    'theology', 'history', 'interdisciplinary studies', 'fine arts', 'studio arts',
    'humanities', 'liberal arts', 'letters'
  ],
  'JGSOM': [
    'management engineering', 'management', 'entrepreneurship', 'accounting',
    'business', 'commerce', 'finance'
  ],
  'SOSE': [
    'biology', 'chemistry', 'physics', 'mathematics', 'computer science',
    'electronics engineering', 'computer engineering', 'environmental science',
    'materials science', 'data science', 'information technology', 'engineering',
    'science'
  ],
  'SOSS': [
    'psychology', 'economics', 'sociology', 'political science', 'diplomacy',
    'international relations', 'development studies', 'european studies',
    'chinese studies', 'social sciences', 'social science'
  ],
  'GBSEALD': [
    'education', 'learning', 'teacher', 'educ', 'teaching'
  ]
};

/**
 * Detect school from a course code (deprecated - use detectSchoolFromProgramName instead)
 * Course code patterns table has been removed in favor of curriculum architecture
 */
export async function detectSchoolFromCourseCode(courseCode: string): Promise<SchoolDetectionResult> {
  // This function is deprecated - the course_code_patterns table has been removed
  // Use detectSchoolFromProgramName instead
  return { schoolId: null, schoolCode: null, schoolName: null, confidence: 'none' };
}

/**
 * Detect school from program name using keyword matching
 * Queries the database to get actual school details
 */
export async function detectSchoolFromProgramName(programName: string): Promise<SchoolDetectionResult> {
  if (!programName) {
    return { schoolId: null, schoolCode: null, schoolName: null, confidence: 'none' };
  }

  const normalizedName = programName.toLowerCase();
  
  // Find matching school by keywords
  let matchedSchoolCode: string | null = null;
  
  for (const [schoolCode, keywords] of Object.entries(SCHOOL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedName.includes(keyword)) {
        matchedSchoolCode = schoolCode;
        console.log(`School detected: ${schoolCode} (keyword: "${keyword}")`);
        break;
      }
    }
    if (matchedSchoolCode) break;
  }

  // If no match found, return none
  if (!matchedSchoolCode) {
    console.log(`No school detected for program: ${programName}`);
    return { schoolId: null, schoolCode: null, schoolName: null, confidence: 'none' };
  }

  // Query database for school details
  try {
    const { data: school, error } = await supabase
      .from('schools')
      .select('id, code, name')
      .eq('code', matchedSchoolCode)
      .maybeSingle();

    if (error || !school) {
      console.warn(`School ${matchedSchoolCode} not found in database:`, error);
      return { schoolId: null, schoolCode: null, schoolName: null, confidence: 'none' };
    }

    return {
      schoolId: school.id,
      schoolCode: school.code,
      schoolName: school.name,
      confidence: 'high'
    };
  } catch (error) {
    console.error('Error querying schools:', error);
    return { schoolId: null, schoolCode: null, schoolName: null, confidence: 'none' };
  }
}
