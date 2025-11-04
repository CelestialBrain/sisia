import { ParsedCourse, ParsedTerm, ParseError, ParseResult, parseCodeAndTrack } from "./aisisProgramParser";

/**
 * Check if an element or its text content is part of navigation/header/footer
 */
function isNavigationOrFooterElement(element: Element): boolean {
  const text = element.textContent?.toLowerCase() || '';
  return (
    text.includes('home') && text.includes('sign out') ||
    text.includes('terms & conditions') ||
    text.includes('privacy policy') ||
    text.includes('copyright') ||
    text.includes('view advisory grades') ||
    text.includes('faculty attendance') ||
    text.includes('my individual program') ||
    text.includes('print tuition') ||
    text.includes('user identified as') ||
    text.includes('welcome to the') ||
    text.includes('ateneo integrated student information system') && text.length < 200
  );
}

/**
 * Parse any ordinal or numeric year pattern
 * Examples: "First Year" → 1, "Fifth Year" → 5, "4.5 Year" → 4.5
 */
function parseOrdinalYear(text: string): number | null {
  const ordinalMap: Record<string, number> = {
    'first': 1, 'second': 2, 'third': 3, 'fourth': 4,
    'fifth': 5, 'sixth': 6, 'seventh': 7, 'eighth': 8,
    'ninth': 9, 'tenth': 10
  };
  
  const lowerText = text.toLowerCase();
  
  // Try ordinal words first
  for (const [word, num] of Object.entries(ordinalMap)) {
    if (lowerText.includes(word + ' year')) return num;
  }
  
  // Try numeric patterns like "4.5 Year" or "5th Year"
  const numMatch = lowerText.match(/(\d+(?:\.\d+)?)\s*(?:st|nd|rd|th)?\s+year/);
  if (numMatch) return parseFloat(numMatch[1]);
  
  return null;
}

/**
 * Parse AISIS HTML curriculum page to extract program and course data
 */
export function parseAISISHTML(htmlContent: string): ParseResult {
  const errors: ParseError[] = [];
  const terms: ParsedTerm[] = [];
  
  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  // Extract program name, version, and code
  let programName = '';
  let version = '';
  let programCode = '';
  let school = '';
  
  // Try to extract program code from selected option in dropdown
  const selectedOption = doc.querySelector('select[name="degCode"] option[selected]');
  if (selectedOption) {
    const optionText = selectedOption.textContent?.trim() || '';
    // Extract program code from format like "(AB AM) BACHELOR OF ARTS..."
    const codeMatch = optionText.match(/^\(([^)]+)\)/);
    if (codeMatch) {
      programCode = codeMatch[1].trim();
    }
    
    // Extract program name - between code and version
    let cleanedText = optionText.replace(/^\([^)]+\)\s*/, ''); // Remove code at start
    cleanedText = cleanedText.replace(/\(Ver[^)]+\)\s*$/, ''); // Remove version at end
    programName = cleanedText.trim();
    
    // Extract version from text like "(Ver Sem 1, Ver Year 2024)"
    const versionMatch = optionText.match(/\(Ver[^)]+\)/);
    if (versionMatch) {
      version = versionMatch[0];
    }
  }
  
  // Fallback: Find program title in .header06 element
  if (!programName) {
    const programTitle = doc.querySelector('.header06');
    if (programTitle) {
      // Get the HTML to properly split by <br>
      const innerHTML = programTitle.innerHTML;
      const parts = innerHTML.split(/<br\s*\/?>/i).map(p => {
        // Remove HTML tags and trim
        const temp = document.createElement('div');
        temp.innerHTML = p;
        return temp.textContent?.trim() || '';
      }).filter(p => p);
      
      if (parts.length >= 1) {
        programName = parts[0];
      }
      
      // Extract version from text like "(Ver Sem 1, Ver Year 2024)"
      if (!version && parts.length >= 2) {
        const versionMatch = parts[1].match(/(\(Ver Sem \d+, Ver Year \d+\))/);
        if (versionMatch) {
          version = versionMatch[1];
        }
      }
    }
  }
  
  if (!programName) {
    errors.push({
      type: 'error',
      message: 'Could not find program name in HTML',
    });
  }
  
  if (!version) {
    errors.push({
      type: 'warning',
      message: 'Could not determine curriculum version year',
    });
  }
  
  // Find all year sections
  const yearHeaders = Array.from(doc.querySelectorAll('.text06'));
  
  yearHeaders.forEach(yearHeader => {
    const yearText = yearHeader.textContent?.trim() || '';
    const yearLevel = parseOrdinalYear(yearText);
    
    if (!yearLevel) return;
    
    // Find the parent table row
    let yearRow = yearHeader.closest('tr');
    if (!yearRow) return;
    
    // Get all sibling rows after the year header until we hit the next year or end
    let currentRow = yearRow.nextElementSibling as HTMLElement | null;
    const semesterTables: HTMLTableElement[] = [];
    
    // Collect all tables in rows following this year header
    while (currentRow) {
      // Stop if we hit another year header
      if (currentRow.querySelector('.text06')) break;
      
      // Find all nested tables in this row
      const tables = currentRow.querySelectorAll('table[border="0"][cellpadding="2"]');
      tables.forEach(table => {
        // Skip navigation/footer tables
        if (isNavigationOrFooterElement(table)) {
          return;
        }
        
        // Check if this table has a semester header
        const hasHeader = table.querySelector('.text04');
        if (hasHeader) {
          semesterTables.push(table as HTMLTableElement);
        }
      });
      
      currentRow = currentRow.nextElementSibling as HTMLElement | null;
    }
    
    // Process each semester table
    semesterTables.forEach(table => {
      // Find semester header (e.g., "First Semester - 21.0 Units")
      const semesterHeader = table.querySelector('.text04');
      if (!semesterHeader) return;
      
      const semesterText = semesterHeader.textContent?.trim() || '';
      let semester = '';
      let totalUnits = 0;
      
      // Check if this is a nested year-as-term (e.g., "Fourth Year" under "Fifth Year")
      const nestedYearLevel = parseOrdinalYear(semesterText);
      if (nestedYearLevel && nestedYearLevel !== yearLevel) {
        // This is a special term labeled as a year level
        semester = 'Special Term';
      } else if (semesterText.includes('First Semester')) {
        semester = '1st Sem';
      } else if (semesterText.includes('Second Semester')) {
        semester = '2nd Sem';
      } else if (semesterText.includes('Intersession') || semesterText.includes('Summer')) {
        semester = 'Intercession';
      }
      
      // Parse total units
      const unitsMatch = semesterText.match(/(\d+(?:\.\d+)?)\s+Units/);
      if (unitsMatch) {
        totalUnits = parseFloat(unitsMatch[1]);
      }
      
      if (!semester) return;
      
      // Find all rows in this table
      const allRows = Array.from(table.querySelectorAll('tr'));
      
      // Find course rows - they have exactly 5 cells
      const courseRows = allRows.filter(row => {
        const allCells = row.querySelectorAll('td');
        
        // Must have exactly 5 cells
        if (allCells.length !== 5) return false;
        
        // Check if it's a header row (has .text04 class)
        const hasHeaderClass = row.querySelector('td.text04');
        if (hasHeaderClass) return false;
        
        // First cell must have content and not be "Cat No"
        const firstCellText = allCells[0]?.textContent?.trim() || '';
        if (!firstCellText || firstCellText === 'Cat No' || firstCellText.includes('Cat No')) {
          return false;
        }
        
        // Must have at least one cell with text02 class (course data)
        const text02Cells = row.querySelectorAll('td.text02');
        return text02Cells.length > 0;
      });
      
      const courses: ParsedCourse[] = [];
      
      courseRows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length !== 5) return;
        
        const catalogNo = cells[0].textContent?.trim() || '';
        const title = cells[1].textContent?.trim() || '';
        const unitsText = cells[2].textContent?.trim() || '0';
        const prereqText = cells[3].textContent?.trim() || '';
        const category = cells[4].textContent?.trim() || '';
        
        // Skip if this looks like a header row
        if (catalogNo === 'Cat No' || !catalogNo || !title) return;
        
        const units = parseFloat(unitsText) || 0;
        
        // Parse prerequisites more carefully
        // Split by comma, but be careful with course names that might have commas
        const prerequisites = prereqText
          ? prereqText
              .split(/,(?=\s*[A-Z])/) // Split on comma followed by optional space and capital letter
              .map(p => p.trim())
              .filter(p => p.length > 0 && p !== '-' && p !== 'None')
          : [];
        
        courses.push({
          catalog_no: catalogNo,
          title: title,
          units: units,
          prerequisites: prerequisites,
          category: category,
          is_placeholder: false,
          is_creditable: true,
          needs_review: prerequisites.length === 0 && prereqText.length > 0, // Flag if prereq parsing might have failed
        });
      });
      
      if (courses.length > 0) {
        terms.push({
          label: `Y${yearLevel} ${semester}`,
          total_units: totalUnits,
          courses: courses,
        });
      }
    });
  });
  
  // Parse program code and track using the same logic as text parser
  // Honors programs keep -H as part of base code, non-honors treat it as track
  const { baseCode, trackSuffix } = parseCodeAndTrack(programCode || null, programName);
  const finalProgramCode = baseCode;
  const trackCode = trackSuffix;
  
  return {
    program_name: programName,
    program_code: finalProgramCode, // Parsed base code
    track_code: trackCode, // Extracted track code
    version: version,
    school: school, // Will be detected by schoolDetector utility
    terms: terms,
    errors: errors,
  };
}
