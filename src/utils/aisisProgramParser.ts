export interface ParsedCourse {
  catalog_no: string;
  title: string;
  units: number;
  prerequisites: string[];
  category: string;
  is_placeholder: boolean;
  is_creditable: boolean;
  needs_review: boolean;
}

export interface ParsedTerm {
  label: string;
  total_units: number;
  courses: ParsedCourse[];
}

export interface ParseError {
  type: 'error' | 'warning';
  message: string;
  line?: number;
}

export interface ParseResult {
  program_name: string;
  program_code: string | null;
  track_code: string | null;
  version: string;
  school: string;
  terms: ParsedTerm[];
  errors: ParseError[];
}

export interface ParsedCodeAndTrack {
  baseCode: string;
  trackSuffix: string | null;
  fullCode: string;
}

export interface ParsedVersion {
  year: number | null;
  sem: number | null;
  label: string;
}

/**
 * Parse any year level from text (supports unlimited years)
 * Examples: "First Year" → 1, "Fifth Year" → 5, "4.5 Year" → 4.5
 */
function parseYearLevel(line: string): number | null {
  const ordinalMap: Record<string, number> = {
    'first': 1, 'second': 2, 'third': 3, 'fourth': 4,
    'fifth': 5, 'sixth': 6, 'seventh': 7, 'eighth': 8,
    'ninth': 9, 'tenth': 10
  };
  
  const lowerLine = line.toLowerCase().trim();
  
  // Try ordinal words
  for (const [word, num] of Object.entries(ordinalMap)) {
    if (lowerLine === word + ' year') return num;
  }
  
  // Try numeric patterns like "4.5 Year" or "5th Year"
  const numMatch = lowerLine.match(/^(\d+(?:\.\d+)?)\s*(?:st|nd|rd|th)?\s+year$/);
  if (numMatch) return parseFloat(numMatch[1]);
  
  return null;
}

const SEMESTER_MAP: Record<string, string> = {
  'first semester': '1st Sem',
  'second semester': '2nd Sem',
  'intersession': 'Intercession',
  'summer': 'Intercession',
};

const SCHOOL_MAP: Record<string, string> = {
  'art management': 'School of Humanities',
  'management engineering': 'John Gokongwei School of Management',
  'management': 'John Gokongwei School of Management',
  'engineering': 'School of Science and Engineering',
  'communication': 'School of Humanities',
  'psychology': 'School of Social Sciences',
  'diplomacy': 'School of Social Sciences',
  'international relations': 'School of Social Sciences',
  'political science': 'School of Social Sciences',
  'economics': 'School of Social Sciences',
  'sociology': 'School of Social Sciences',
  'history': 'School of Social Sciences',
  'development studies': 'School of Social Sciences',
  'chinese studies': 'School of Social Sciences',
  'european studies': 'School of Social Sciences',
};

const ELECTIVE_COUNTER: Record<string, number> = {};

function normalizeCourseCode(code: string): string {
  // Strip stray punctuation, normalize spacing
  let normalized = code.trim()
    .replace(/\s*[-–—]\s*/g, ' ') // Replace dashes with space
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .toUpperCase();
  
  // Keep dots in course numbers (e.g., MATH 31.1, ARTM 199.1)
  return normalized;
}

function inferSchool(programName: string): string {
  const lowerProgram = programName.toLowerCase();
  for (const [keyword, school] of Object.entries(SCHOOL_MAP)) {
    if (lowerProgram.includes(keyword)) {
      return school;
    }
  }
  return 'School of Humanities'; // Default
}

function isPlaceholderCourse(title: string, code: string): boolean {
  const titleLower = title.toLowerCase();
  const codeLower = code.toLowerCase();
  return titleLower.includes('elective') || 
         codeLower.includes('elec') ||
         titleLower.includes('placeholder');
}

function generatePlaceholderCode(title: string, category: string): string {
  const titleUpper = title.toUpperCase();
  
  // Skip invalid categories that would create bad course codes
  if (/TRACK|COURSE/i.test(category)) {
    return ''; // Return empty to signal skipping
  }
  
  // Sanitize category - remove spaces, limit length
  let sanitizedCategory = category
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/gi, '')
    .substring(0, 10)
    .toUpperCase();
  
  if (!sanitizedCategory || sanitizedCategory.length < 2) {
    sanitizedCategory = 'GEN';
  }
  
  // Try to extract a numeric suffix from the title (e.g., "ME ELECTIVE 1" → 1)
  const numMatch = title.match(/(\d+)/);
  const num = numMatch ? numMatch[1] : null;
  
  // If category is provided and we have a number, use category + number (e.g., "ME1")
  if (sanitizedCategory && sanitizedCategory !== 'M' && sanitizedCategory !== 'C' && num) {
    return `${sanitizedCategory}${num}`;
  }
  
  // Otherwise use category with auto-incremented counter
  if (sanitizedCategory && sanitizedCategory !== 'M' && sanitizedCategory !== 'C') {
    const key = sanitizedCategory;
    ELECTIVE_COUNTER[key] = (ELECTIVE_COUNTER[key] || 0) + 1;
    return `${sanitizedCategory}_ELEC${ELECTIVE_COUNTER[key]}`;
  }
  
  // Fallback: extract from title
  let key = '';
  if (titleUpper.includes('ARTS')) key = 'ARTS';
  else if (titleUpper.includes('FREE')) key = 'FREE';
  else if (titleUpper.includes('INTERDISCIPLINARY')) key = 'IE';
  else key = 'GEN';
  
  ELECTIVE_COUNTER[key] = (ELECTIVE_COUNTER[key] || 0) + 1;
  
  // If we have a number, use it
  if (num) {
    return `${key}${num}`;
  }
  
  return `${key}_ELEC${ELECTIVE_COUNTER[key]}`;
}

/**
 * Parse program code to extract base code and track suffix
 * Honors programs (with "HONORS PROGRAM" in name) keep -H as part of base code
 * Non-honors programs treat -H as a regular track suffix
 * 
 * Examples:
 *   "AB EC-H" + honors name → { baseCode: "AB EC-H", trackSuffix: null, fullCode: "AB EC-H" }
 *   "AB ChnS-H" + non-honors → { baseCode: "AB CHNS", trackSuffix: "H", fullCode: "AB ChnS-H" }
 *   "AB ChnS-AC" → { baseCode: "AB ChnS", trackSuffix: "AC", fullCode: "AB ChnS-AC" }
 */
export function parseCodeAndTrack(code: string | null, programName?: string): ParsedCodeAndTrack {
  if (!code) {
    return { baseCode: '', trackSuffix: null, fullCode: '' };
  }

  const trimmedCode = code.trim().toUpperCase();
  
  // Check if this is an honors program by looking at the program name
  // Honors programs contain "HONORS PROGRAM" or "HONOURS PROGRAM" in the name
  const isHonorsProgram = programName ? 
    /\(?\s*HONORS?\s+PROGRAM\s*\)?/i.test(programName) : 
    false;
  
  // If it ends with -H and is an honors program
  if (trimmedCode.match(/[-–—]H$/i) && isHonorsProgram) {
    // Check if there's an additional track after -H
    // Example: "AB EC-H-AC" → base: "AB EC-H", track: "AC"
    const honorsWithTrackMatch = trimmedCode.match(/^(.+?[-–—]H)[-–—]([A-Z]+)$/i);
    if (honorsWithTrackMatch) {
      return {
        baseCode: honorsWithTrackMatch[1].trim().toUpperCase(),
        trackSuffix: honorsWithTrackMatch[2].trim().toUpperCase(),
        fullCode: trimmedCode,
      };
    }
    
    // Honors program without additional track
    // Example: "AB EC-H" → base: "AB EC-H", track: null
    return {
      baseCode: trimmedCode,
      trackSuffix: null,
      fullCode: trimmedCode,
    };
  }
  
  // NOT an honors program - treat -H (or any suffix) as a regular track
  // Example: "AB ChnS-H" → base: "AB CHNS", track: "H" (Humanities)
  const trackMatch = trimmedCode.match(/^(.+?)[-–—]([A-Z]+)$/);
  
  if (trackMatch) {
    return {
      baseCode: trackMatch[1].trim().toUpperCase(),
      trackSuffix: trackMatch[2].trim().toUpperCase(),
      fullCode: trimmedCode,
    };
  }
  
  // No track suffix found
  return {
    baseCode: trimmedCode,
    trackSuffix: null,
    fullCode: trimmedCode,
  };
}

/**
 * Parse version label to extract year and semester
 * Examples:
 *   "(Ver Sem 1, Ver Year 2020)" → { year: 2020, sem: 1, label: "..." }
 *   "(Ver Sem 2, Ver Year 2019)" → { year: 2019, sem: 2, label: "..." }
 *   "(Ver Sem 1, Ver Year 18IR)" → { year: 2018, sem: 1, label: "..." }
 */
export function parseVersion(versionLabel: string): ParsedVersion {
  if (!versionLabel) {
    return { year: null, sem: null, label: versionLabel };
  }

  // Extract year - try multiple formats:
  // 1. Full 4-digit year: "Ver Year 2020" → 2020
  let yearMatch = versionLabel.match(/Ver\s+Year\s+(\d{4})/i);
  let year = yearMatch ? parseInt(yearMatch[1]) : null;
  
  // 2. 2-digit year with optional suffix: "Ver Year 18IR" → 2018, "Ver Year 18" → 2018
  if (!year) {
    const shortYearMatch = versionLabel.match(/Ver\s+Year\s+(\d{2})/i);
    if (shortYearMatch) {
      const shortYear = parseInt(shortYearMatch[1]);
      // Convert 2-digit year to 4-digit (assume 20xx for years 00-99)
      year = shortYear < 100 ? 2000 + shortYear : shortYear;
    }
  }

  // Extract semester: "Ver Sem 1" → 1
  const semMatch = versionLabel.match(/Ver\s+Sem\s+(\d+)/i);
  const sem = semMatch ? parseInt(semMatch[1]) : null;

  return {
    year,
    sem,
    label: versionLabel,
  };
}

/**
 * Infer track name from track code
 * Examples: "AC" → "Arts & Culture", "B" → "Business", "S" → "Science"
 */
export function inferTrackName(trackCode: string): string {
  const trackMap: Record<string, string> = {
    'AC': 'Arts & Culture Track',
    'B': 'Business Track',
    'S': 'Science Track',
    'DA': 'Data Analytics Track',
    'CS': 'Cyber Security Track',
    'GD': 'Game Development Track',
  };

  return trackMap[trackCode.toUpperCase()] || `${trackCode} Track`;
}

export function parseAISISProgramData(text: string): ParseResult {
  const lines = text.trim().split('\n').filter(line => line.trim());
  const terms: ParsedTerm[] = [];
  const errors: ParseError[] = [];

  let program_name = '';
  let program_code: string | null = null;
  let track_code: string | null = null;
  let version = '';
  let school = '';
  let currentYear = 0;
  let currentSemester = '';
  let currentTermLabel = '';
  let currentTermUnits = 0;
  let currentTermCourses: ParsedCourse[] = [];
  
  // Year progression tracking for auto-correcting mislabeled intersessions
  let hasSeenRegularSemesterInYear = false; // Track if we've seen 1st/2nd sem in current year
  
  // Track seen courses by composite key: code|category|term
  const seenCourses = new Set<string>();
  const duplicatesSkipped: Array<{code: string, title: string, category: string, term: string}> = [];

  // Skip "Select a degree..." line if present
  let startLineIndex = 0;
  if (lines.length > 0 && lines[0].toLowerCase().includes('select a degree')) {
    startLineIndex = 1;
  }

  // Find the first year header to determine where curriculum actually starts
  let firstYearIndex = -1;
  for (let i = startLineIndex; i < lines.length; i++) {
    if (parseYearLevel(lines[i]) !== null) {
      firstYearIndex = i;
      break;
    }
  }

  // Extract program info from lines between start and first year header
  // PRIORITIZE lines with program codes in parentheses like "(BS ME)"
  let programLineIndex = startLineIndex;
  let programLineWithCode = -1;
  
  // If we found a year header, scan backwards to find the program line
  if (firstYearIndex > 0) {
    for (let i = firstYearIndex - 1; i >= startLineIndex; i--) {
      const line = lines[i].trim();
      
      // Check if this line has a program code in parentheses at the start
      if (line.match(/^\([A-Z]+(?:[\s\/\-][A-Z]+)*\)/i)) {
        programLineWithCode = i;
        break; // Prioritize this - it has the explicit code
      }
      
      // Otherwise, check if it's a program line
      if (line && (
        line.match(/^[A-Z][A-Z\s]+OF\s+[A-Z\s]+/i) || // "BACHELOR OF..."
        line.includes('BACHELOR') ||
        line.includes('MASTER')
      )) {
        programLineIndex = i; // Keep looking for one with a code
      }
    }
    
    // Use the line with code if found, otherwise use the last program line found
    if (programLineWithCode >= 0) {
      programLineIndex = programLineWithCode;
    }
  }

  // Extract program code, name, and version from the identified program line(s)
  if (lines.length > programLineIndex) {
    let programLine = lines[programLineIndex].trim();
    let nextLine = programLineIndex + 1 < lines.length ? lines[programLineIndex + 1].trim() : '';
    
    // Extract program code like "(AB AM)", "(AB EC-H)" - appears at the start
    // Updated regex to capture codes with -H honors suffix
    const codeMatch = programLine.match(/^\(([A-Z]+(?:[\s\/\-][A-Z]+)*(?:-H)?)\)/i);
    if (codeMatch) {
      program_code = codeMatch[1].trim().toUpperCase();
    } else {
      // Try to infer code from program name (e.g., "BS ME" from "BACHELOR OF SCIENCE IN MANAGEMENT ENGINEERING")
      const nameMatch = programLine.match(/BACHELOR OF (?:SCIENCE|ARTS) IN ([A-Z\s]+?)(?:\(|$)/i);
      if (nameMatch) {
        // Create code from first letters of major words
        const major = nameMatch[1].trim();
        const words = major.split(/\s+/).filter(w => w.length > 2); // Skip short words like "IN", "OF"
        if (words.length > 0) {
          program_code = words.map(w => w.charAt(0)).join('');
        }
      }
    }
    
    // Extract program name - between code and version
    let cleanedLine = programLine.replace(/^\([^)]+\)\s*/, ''); // Remove code
    cleanedLine = cleanedLine.replace(/\(Ver[^)]+\)\s*$/, ''); // Remove version
    program_name = cleanedLine.trim();
    
    // Extract version like "(Ver Sem 1, Ver Year 2020)"
    const versionMatch = programLine.match(/\(Ver[^)]+\)/);
    if (versionMatch) {
      version = versionMatch[0];
    } else if (nextLine.includes('Ver')) {
      // Version might be on the next line
      const nextVersionMatch = nextLine.match(/\(Ver[^)]+\)/);
      if (nextVersionMatch) {
        version = nextVersionMatch[0];
      }
    }
    
    school = inferSchool(program_name);
    
    // Parse program code and track
    // Honors programs (containing "HONORS PROGRAM" in name) keep -H as part of base code
    // Non-honors programs treat -H as a regular track suffix (e.g., "H" for Humanities)
    const { baseCode, trackSuffix } = parseCodeAndTrack(program_code, program_name);
    program_code = baseCode; // Update to parsed base code
    track_code = trackSuffix; // Extract track code
  } else {
    errors.push({ type: 'error', message: 'No program name found' });
    return { program_name, program_code, track_code: null, version, school, terms, errors };
  }


  const saveTerm = () => {
    if (currentTermLabel && currentTermCourses.length > 0) {
      terms.push({
        label: currentTermLabel,
        total_units: currentTermUnits,
        courses: currentTermCourses,
      });
      currentTermCourses = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Skip navigation/header/footer lines (comprehensive filtering)
    if (
      line === program_name || 
      line === version || 
      line.toLowerCase().includes('select a degree') ||
      line.includes('aisis online') ||
      line.includes('home') && line.includes('sign out') ||
      line.includes('Home') && line.includes('Terms & Conditions') ||
      line.includes('Privacy Policy') ||
      line.includes('Contact Us') ||
      line.includes('Copyright') ||
      line.includes('Ateneo Integrated Student Information System') ||
      line.includes('Ateneo de Manila University') ||
      line.includes('All Rights Reserved') ||
      line.includes('Welcome to the') ||
      line.includes('User Identified As:') ||
      line.includes('User Identified as:') ||
      line.includes('View Official Curriculum') ||
      line.includes('VIEW ADVISORY GRADES') ||
      line.includes('FACULTY ATTENDANCE') ||
      line.includes('MY INDIVIDUAL PROGRAM OF STUDY') ||
      line.includes('PRINT TUITION RECEIPT') ||
      line.includes('OFFICIAL CURRICULUM') ||
      line.includes('UPDATE STUDENT INFORMATION') ||
      line.includes('MY CURRENTLY ENROLLED CLASSES') ||
      line.includes('MY GRADES') ||
      line.includes('MY HOLD ORDERS') ||
      line.includes('PRINT SAA') ||
      line.includes('MY CLASS SCHEDULE') ||
      line.includes('CHANGE PASSWORD') ||
      line.includes('CLASS SCHEDULE') ||
      line.includes('Click here for printer friendly') ||
      line.trim().startsWith('*') ||
      /^\d+\w{2}\s+Semester,\s+SY\s+\d{4}-\d{4}$/.test(line)
    ) {
      continue;
    }

    // Check for year level headers
    const yearLevel = parseYearLevel(line);
    if (yearLevel !== null) {
      saveTerm(); // Save previous term
      
      // Validate year progression (allow skipping years, but warn)
      if (yearLevel > currentYear + 1 && currentYear > 0) {
        errors.push({
          type: 'warning',
          message: `Unexpected year jump from Year ${currentYear} to Year ${yearLevel} - possible AISIS labeling error`,
        });
      }
      
      currentYear = yearLevel;
      hasSeenRegularSemesterInYear = false; // Reset for new year
      continue;
    }

    // Check for semester headers with unit counts - unified pattern
    // Handles: "First Semester - X Units", "Intersession - X Units", or "[Year Level] - X Units" (mislabeled)
    const termPattern = /^(?:(First|Second)\s+Semester|Intersession|(First|Second|Third|Fourth|Fifth|Sixth)\s+Year)\s*-\s*([\d.]+)\s*Units?/i;
    const termMatch = line.match(termPattern);
    
    if (termMatch) {
      saveTerm(); // Save previous term
      
      const semesterType = termMatch[1]; // "First" or "Second" if it's a semester
      const yearType = termMatch[2]; // Year level word if mislabeled
      const units = parseFloat(termMatch[3]);
      
      // Check if this is "First Semester" or "Second Semester"
      if (semesterType) {
        const semKey = semesterType.toLowerCase() + ' semester';
        currentSemester = SEMESTER_MAP[semKey] || '';
        currentTermUnits = units;
        currentTermLabel = `Y${currentYear} ${currentSemester}`;
        hasSeenRegularSemesterInYear = true;
        continue;
      }
      
      // Check if this is explicitly "Intersession"
      if (line.toLowerCase().includes('intersession')) {
        currentSemester = 'Intersession';
        currentTermUnits = units;
        
        // Intersession belongs to the year it precedes (the current year context)
        const intersessionYear = currentYear;
        currentTermLabel = `Y${intersessionYear} Intersession`;
        continue;
      }
      
      // Otherwise, this is a "[Year Level] - X Units" line WITHOUT semester keyword
      // This is likely a mislabeled intersession - treat it as intersession
      if (yearType) {
        currentSemester = 'Intersession';
        currentTermUnits = units;
        
        // Treat mislabeled term as intersession for the current year
        const intersessionYear = currentYear;
        currentTermLabel = `Y${intersessionYear} Intersession`;
        
        errors.push({
          type: 'warning',
          message: `Detected mislabeled term "${line.substring(0, 40)}..." - treating as Year ${intersessionYear} Intersession`,
        });
        continue;
      }
    }

    // Skip table headers
    if (line.toLowerCase().includes('cat no') || 
        line.toLowerCase().includes('course title') ||
        line.toLowerCase().includes('subject code')) {
      continue;
    }

    // Skip summary rows
    if (line.toLowerCase().includes('category') && line.toLowerCase().includes('requirements')) continue;
    if (line.toLowerCase().includes('total units')) continue;
    if (line.toLowerCase().includes('summary of courses')) continue;

    // Try to parse as course row
    // Expected format: CATALOG_NO\tCOURSE_TITLE\tUNITS\tPREREQUISITES\tCATEGORY
    const parts = line.split('\t').map(p => p.trim());
    
    if (parts.length >= 3) {
      let rawCourseCode = parts[0];
      const courseTitle = parts[1];
      const unitsStr = parts[2];
      const prerequisitesStr = parts[3] || '';
      const category = parts[4] || '';

      // Normalize course code
      let catalog_no = normalizeCourseCode(rawCourseCode);

      // If course code seems invalid, try to generate one for placeholders
      let needs_review = false;
      if (!catalog_no || catalog_no.length < 2) {
        if (isPlaceholderCourse(courseTitle, rawCourseCode)) {
          catalog_no = generatePlaceholderCode(courseTitle, category);
          needs_review = true;
        } else {
          errors.push({
            type: 'warning',
            message: `Skipped invalid course code: "${rawCourseCode}" → "${courseTitle}"`,
            line: i + 1
          });
          continue;
        }
      }
      
      // Create composite key: code|category|term to allow same course in different contexts
      const compositeKey = `${catalog_no}|${category}|${currentTermLabel}`;
      
      // Skip duplicates only if same code + category + term
      if (seenCourses.has(compositeKey)) {
        duplicatesSkipped.push({
          code: catalog_no,
          title: courseTitle,
          category,
          term: currentTermLabel
        });
        continue;
      }

      // Parse units
      const units = parseFloat(unitsStr);
      if (isNaN(units) || units < 0 || units > 12) {
        errors.push({
          type: 'warning',
          message: `Invalid units value for ${catalog_no}: ${unitsStr}`,
          line: i + 1
        });
        continue;
      }

      // Parse prerequisites - normalize each one
      const prerequisites = prerequisitesStr
        .split(/[,;]/)
        .map(p => normalizeCourseCode(p))
        .filter(p => p && p.toLowerCase() !== 'none');

      // Validate term context
      if (!currentTermLabel) {
        errors.push({
          type: 'error',
          message: `Course ${catalog_no} has no year/semester context`,
          line: i + 1
        });
        continue;
      }

      if (!courseTitle) {
        errors.push({
          type: 'error',
          message: `Course ${catalog_no} missing title`,
          line: i + 1
        });
        continue;
      }

      const is_placeholder = isPlaceholderCourse(courseTitle, catalog_no);
      const is_creditable = units > 0;

      // Mark as seen (with composite key) and add to current term
      seenCourses.add(compositeKey);
      
      currentTermCourses.push({
        catalog_no,
        title: courseTitle,
        units,
        prerequisites,
        category,
        is_placeholder,
        is_creditable,
        needs_review,
      });
    }
  }

  saveTerm(); // Save final term

  if (terms.length === 0) {
    errors.push({ type: 'error', message: 'No valid courses found in the input' });
  }
  
  // Add detailed summary of duplicates skipped
  if (duplicatesSkipped.length > 0) {
    const summary = duplicatesSkipped
      .slice(0, 5)
      .map(d => `${d.code} (${d.category}) in ${d.term}`)
      .join(', ');
    
    errors.push({
      type: 'warning',
      message: `Skipped ${duplicatesSkipped.length} duplicate course(s) in same term: ${summary}${duplicatesSkipped.length > 5 ? '...' : ''}`
    });
  }

  return {
    program_name,
    program_code,
    track_code,
    version,
    school,
    terms,
    errors,
  };
}
