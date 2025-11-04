import { getQPIValue } from "./qpiCalculations";
import { normalizeAISISCourseCode } from "./courseCodeNormalizer";

export interface ParsedCourse {
  school_year: string;
  semester: string;
  course_code: string;
  course_title: string;
  units: number;
  grade: string;
  qpi_value: number | null;
}

export interface AISISParseResult {
  courses: ParsedCourse[];
  detectedProgram?: string;
}

export function parseAISISData(text: string): AISISParseResult {
  const lines = text.trim().split('\n').filter(line => line.trim());
  const courses: ParsedCourse[] = [];
  let detectedProgram: string | undefined;
  
  // Skip header row if present
  let startIndex = 0;
  if (lines[0]?.includes('School Year') && lines[0]?.includes('Subject Code')) {
    startIndex = 1;
  }
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip navigation/footer lines
    if (
      line.includes('Home') ||
      line.includes('Copyright') ||
      line.includes('Terms & Conditions') ||
      line.includes('Welcome to') ||
      line.includes('Ateneo de Manila') ||
      line.includes('VIEW ADVISORY') ||
      line.includes('Click here for') ||
      line.includes('User Identified') ||
      line.trim().startsWith('*')
    ) {
      continue;
    }
    
    try {
      // PRIMARY METHOD: Tab-separated parsing (AISIS format)
      if (line.includes('\t')) {
        const columns = line.split('\t').map(c => c.trim()).filter(Boolean);
        
        // Expected columns: [School Year, Sem, Course, Subject Code, Title, Units, Grade]
        if (columns.length >= 7) {
          const schoolYear = columns[0];
          const semesterRaw = columns[1];
          const programCode = columns[2]; // "Course" column (BS ME, AB COM, etc.)
          const courseCodeRaw = columns[3]; // "Subject Code" column
          const courseCode = normalizeAISISCourseCode(courseCodeRaw); // Normalize for storage
          const courseTitle = columns[4]; // "Course Title" column
          const unitsRaw = columns[5];
          const grade = columns[6]; // "Advisory Grade" column
          
          // Extract program code if not already detected
          if (!detectedProgram && programCode && /^[A-Z]{2,4}\s*[A-Z]{2,4}$/.test(programCode)) {
            detectedProgram = programCode;
          }
          
          // Convert semester
          let semester = semesterRaw;
          if (semesterRaw === '1') semester = '1st Sem';
          else if (semesterRaw === '2') semester = '2nd Sem';
          else if (semesterRaw === '3') semester = 'Intercession';
          
          // Parse units
          const units = parseInt(unitsRaw);
          
          // Validate and add course
          if (courseCode && grade && !isNaN(units) && units > 0) {
            courses.push({
              school_year: schoolYear,
              semester: semester,
              course_code: courseCode,
              course_title: courseTitle,
              units: units,
              grade: grade,
              qpi_value: getQPIValue(grade),
            });
            continue; // Successfully parsed, skip regex fallback
          }
        }
      }
      
      // FALLBACK METHOD: Regex parsing (for non-TSV formats)
      const schoolYearPattern = /(\d{4}[-/]\d{4}|\d{4}[-/]\d{2})/;
      const semesterPattern = /(1st\s+Sem|2nd\s+Sem|Intercession|Summer)/i;
      // Make the 4-digit year suffix optional in regex
      const courseCodePattern = /\b([A-Z]{2,6})\s*(\d+(?:\.\d+)?)(\d{4})?\b/;
      const unitsPattern = /\b(\d+(?:\.\d+)?)\b/g;
      const gradePattern = /\b([A-F][+-]?|[IWSDAU]{1,3})\b/;

      const schoolYearMatch = line.match(schoolYearPattern);
      const semesterMatch = line.match(semesterPattern);
      const courseCodeMatch = line.match(courseCodePattern);
      const gradeMatch = line.match(gradePattern);

      if (courseCodeMatch && gradeMatch) {
        const schoolYear = schoolYearMatch?.[0] || 'Unknown';
        const semester = semesterMatch?.[0] || 'Unknown';
        const courseCodeRaw = courseCodeMatch[0];
        const courseCode = normalizeAISISCourseCode(courseCodeRaw); // Normalize for storage
        const grade = gradeMatch[0];

        // Extract units (must be single digit 1-12)
        const unitsMatches = [...line.matchAll(unitsPattern)];
        let units = 0;
        for (const match of unitsMatches) {
          const num = parseFloat(match[0]);
          if (num > 0 && num <= 12 && match[0].length <= 2) {
            units = num;
            break;
          }
        }

        if (units > 0) {
          const courseTitle = extractTitle(line, courseCode);
          courses.push({
            school_year: schoolYear,
            semester: semester,
            course_code: courseCode,
            course_title: courseTitle,
            units: units,
            grade: grade,
            qpi_value: getQPIValue(grade),
          });
        }
      }
    } catch (error) {
      console.error('Error parsing line:', line, error);
    }
  }

  return {
    courses,
    detectedProgram
  };
}

function extractTitle(line: string, courseCode: string): string {
  const parts = line.split(courseCode);
  if (parts.length > 1) {
    const afterCode = parts[1];
    // Remove tabs and extra whitespace, extract alphabetic title
    const cleaned = afterCode.replace(/\t+/g, ' ').trim();
    const titleMatch = cleaned.match(/([A-Za-z\s:&-]+)/);
    if (titleMatch) {
      return titleMatch[0].trim().replace(/\s+/g, ' ');
    }
  }
  return 'Course Title';
}
