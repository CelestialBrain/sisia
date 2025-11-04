/**
 * Utility functions for term/semester normalization
 */

/**
 * Extracts and normalizes semester from a term/group name
 * Examples:
 *   "First Year - First Semester" → "First Semester"
 *   "Year 1 - 1st Sem" → "First Semester"
 *   "Second Year - Intercession" → "Intercession"
 */
export const normalizeSemester = (termName?: string | null): string => {
  if (!termName) return 'all';
  
  const lower = termName.toLowerCase();
  
  // Check for specific semester keywords
  if (lower.includes('1st sem') || lower.includes('first semester')) {
    return 'First Semester';
  }
  if (lower.includes('2nd sem') || lower.includes('second semester')) {
    return 'Second Semester';
  }
  if (lower.includes('intercession') || lower.includes('summer') || lower.includes('midyear')) {
    return 'Intercession';
  }
  
  return 'all';
};
