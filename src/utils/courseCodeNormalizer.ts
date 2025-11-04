/**
 * Utility functions for normalizing and matching course codes between AISIS and curriculum
 */

/**
 * Normalizes AISIS course codes to match curriculum format
 * 
 * Examples:
 *   "ENLIT 1212018" → "ENLIT 12"
 *   "FILI 1112018" → "FILI 11"
 *   "MATH 31.112018" → "MATH 31.11"
 *   "PEPC 1012024" → "PEPC 10"
 *   "SocSc 1112018" → "SOCSC 11"
 */
export function normalizeAISISCourseCode(code: string): string {
  if (!code) return '';
  
  // Step 1: Uppercase and clean whitespace
  let normalized = code.toUpperCase().trim().replace(/\s+/g, ' ');
  
  // Step 2: Remove year suffix (trailing 4 digits after any number)
  // Pattern: Department + Space + Number(s) + 4-digit year
  // ENLIT 1212018 → ENLIT 121
  // MATH 31.112018 → MATH 31.11
  // Handle cases with or without space before year
  normalized = normalized.replace(/^([A-Z]+)\s+(\d+(?:\.\d+)?)\d{4}$/, '$1 $2');
  
  // Step 3: Handle trailing digit pattern from AISIS codes
  // After removing year, codes often have an extra trailing digit
  // ENLIT 121 → ENLIT 12, FILI 111 → FILI 11, MATH 101 → MATH 10
  // But NOT for decimal numbers like MATH 31.11
  if (!normalized.includes('.')) {
    const match = normalized.match(/^([A-Z]+)\s+(\d{2})(\d)$/);
    if (match) {
      normalized = `${match[1]} ${match[2]}`;
    }
  }
  
  return normalized;
}

/**
 * Normalizes curriculum course codes for consistent matching
 */
export function normalizeCurriculumCourseCode(code: string): string {
  if (!code) return '';
  return code.toUpperCase().trim().replace(/\s+/g, ' ');
}

/**
 * Course code equivalencies for renamed courses
 * Maps old course codes to new course codes
 */
export const COURSE_EQUIVALENCIES: Record<string, string> = {
  'PEPC 10': 'PATHFIT 1',
  'PEPC 20': 'PATHFIT 2',
  'PEPC 30': 'PATHFIT 3',
  'PEPC 40': 'PATHFIT 4',
  // Add more as discovered
};

/**
 * Attempts to match AISIS code to curriculum code, checking equivalencies
 */
export function matchCourseCode(aisisCode: string, curriculumCode: string): boolean {
  const normalizedAISIS = normalizeAISISCourseCode(aisisCode);
  const normalizedCurriculum = normalizeCurriculumCourseCode(curriculumCode);
  
  // Direct match
  if (normalizedAISIS === normalizedCurriculum) return true;
  
  // Check if AISIS code has an equivalent that matches curriculum
  const equivalentCode = COURSE_EQUIVALENCIES[normalizedAISIS];
  if (equivalentCode && normalizeCurriculumCourseCode(equivalentCode) === normalizedCurriculum) {
    return true;
  }
  
  // Check reverse: if curriculum code is an old code that's been renamed
  const reverseMatch = Object.entries(COURSE_EQUIVALENCIES).find(
    ([oldCode, newCode]) => 
      normalizeCurriculumCourseCode(newCode) === normalizedCurriculum &&
      normalizedAISIS === normalizeCurriculumCourseCode(oldCode)
  );
  
  return !!reverseMatch;
}

/**
 * Fuzzy matching that handles decimal precision differences and minor variations
 * Handles: MATH 31.1 vs MATH 31.11, spacing differences, and title similarity
 */
export function fuzzyMatchCourseCode(
  aisisCode: string, 
  curriculumCode: string,
  aisisTitle?: string,
  curriculumTitle?: string
): boolean {
  const normAISIS = normalizeAISISCourseCode(aisisCode);
  const normCurr = normalizeCurriculumCourseCode(curriculumCode);
  
  // Exact match
  if (normAISIS === normCurr) return true;
  
  // Check equivalencies
  const equiv = COURSE_EQUIVALENCIES[normAISIS];
  if (equiv && normalizeCurriculumCourseCode(equiv) === normCurr) return true;
  
  // Decimal precision match: MATH 31.1 vs MATH 31.11
  const aisisParts = normAISIS.match(/^([A-Z]+)\s+(\d+(?:\.\d+)?)$/);
  const currParts = normCurr.match(/^([A-Z]+)\s+(\d+(?:\.\d+)?)$/);
  
  if (aisisParts && currParts) {
    const [, aDept, aNum] = aisisParts;
    const [, cDept, cNum] = currParts;
    
    // Same department, check if numbers are close
    if (aDept === cDept) {
      const aFloat = parseFloat(aNum);
      const cFloat = parseFloat(cNum);
      
      // Allow decimal precision difference (31.1 === 31.10 === 31.11)
      if (Math.abs(aFloat - cFloat) < 0.02) return true;
    }
  }
  
  // Title similarity - if titles match exactly and departments are close, accept as match
  if (aisisTitle && curriculumTitle) {
    const normATitle = aisisTitle.toLowerCase().trim();
    const normCTitle = curriculumTitle.toLowerCase().trim();
    
    if (normATitle === normCTitle) {
      // Extract department codes
      const aDeptMatch = normAISIS.match(/^([A-Z]+)/);
      const cDeptMatch = normCurr.match(/^([A-Z]+)/);
      
      // If same department and exact title match, it's the same course
      if (aDeptMatch && cDeptMatch && aDeptMatch[1] === cDeptMatch[1]) {
        console.log(`✅ Matched by title: "${aisisCode}" → "${curriculumCode}"`);
        return true;
      }
    }
  }
  
  return false;
}
