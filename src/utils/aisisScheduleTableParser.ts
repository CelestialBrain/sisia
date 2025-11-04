/**
 * Parser for AISIS Schedule Table HTML
 * Extracts course schedule information from AISIS department schedule pages
 */

export interface ParsedAISISSchedule {
  term_code: string;
  subject_code: string;
  section: string;
  course_title: string;
  units: number;
  time_pattern: string;
  room: string;
  instructor: string | null;
  max_capacity: number | null;
  language: string | null;
  level: string | null;
  delivery_mode: string | null;
  remarks: string | null;
  days_of_week: number[];
  start_time: string;  // "HH:MM:SS"
  end_time: string;    // "HH:MM:SS"
  department: string;
}

export interface ParseError {
  type: 'error' | 'warning';
  message: string;
  line?: number;
}

export interface SkippedRow {
  lineNo: number;
  reason: string;
  data: string;
}

export interface ParseResult {
  schedules: ParsedAISISSchedule[];
  errors: ParseError[];
  metadata: {
    department: string;
    term: string;
    total_courses: number;
    detected_term: string | null;
    detected_department: string | null;
    mode: 'table' | 'plain-text';
    linesProcessed: number;
    rowsSkipped: number;
    skippedRows: SkippedRow[];
  };
}

interface TimeSegment {
  days: number[];
  startTime: string;
  endTime: string;
  deliveryMode: string | null;
}

/**
 * Parse time pattern into multiple segments (handles semicolon-separated sessions)
 * Examples: 
 * - "M-TH 0800-0930" -> single segment
 * - "SAT 0800-1200; W 0800-1200" -> two segments
 * - "TBA" -> empty array
 */
function parseTimeSegments(timePattern: string): TimeSegment[] {
  const segments: TimeSegment[] = [];
  
  // Extract delivery mode first (e.g., "(FULLY ONSITE)", "(~)")
  const deliveryModeMatch = timePattern.match(/\(([^)]+)\)/);
  const deliveryMode = deliveryModeMatch ? deliveryModeMatch[1] : null;
  
  // Remove delivery mode from pattern
  const cleanPattern = timePattern.replace(/\([^)]+\)/g, '').trim();
  
  // Handle TBA and TUTORIAL cases
  if (cleanPattern.includes('TBA') || cleanPattern.includes('TUTORIAL')) {
    return [];
  }
  
  // Split by semicolon for multiple sessions
  const sessionParts = cleanPattern.split(';').map(s => s.trim());
  
  for (const sessionPart of sessionParts) {
    // Split into days and time parts
    const parts = sessionPart.split(/\s+/);
    if (parts.length < 2) continue;
    
    const daysPart = parts[0];
    const timePart = parts[1];
    
    // Parse days (M, T, W, TH, F, SAT, SUN)
    const days: number[] = [];
    const dayString = daysPart.toUpperCase();
    
    // Day mapping: M=1, T=2, W=3, TH=4, F=5, SAT=6, SUN=7
    const dayMap: { [key: string]: number } = {
      'M': 1,
      'T': 2,
      'W': 3,
      'TH': 4,
      'F': 5,
      'SAT': 6,
      'SUN': 7
    };
    
    // Parse days like "M-TH" (enumerate, not range), "T-F", "W-SAT", single day, etc.
    // The hyphen is a SEPARATOR (M and TH), not a range operator (Mon through Thu)
    
    // Split by hyphens, slashes, commas, or spaces
    let dayTokens = dayString.split(/[-\/,\s]+/).filter(Boolean);

    // Handle compact notation like "MWF" (just in case)
    if (dayTokens.length === 1 && !dayMap[dayTokens[0]]) {
      const s = dayTokens[0];
      dayTokens = [];
      for (let i = 0; i < s.length; ) {
        // Multi-character day codes first
        if (s.slice(i, i + 3) === 'SUN') { dayTokens.push('SUN'); i += 3; continue; }
        if (s.slice(i, i + 3) === 'SAT') { dayTokens.push('SAT'); i += 3; continue; }
        if (s.slice(i, i + 2) === 'TH')  { dayTokens.push('TH');  i += 2; continue; }
        // Single-character day codes
        const ch = s[i];
        if ('MTWF'.includes(ch)) { dayTokens.push(ch); i += 1; continue; }
        i += 1; // Skip unknown characters
      }
    }

    // Map each token to day number
    for (const tok of dayTokens) {
      const d = dayMap[tok];
      if (d && !days.includes(d)) {
        days.push(d);
      }
    }
    
    // Parse time (e.g., "0800-0930")
    const timeMatch = timePart.match(/(\d{4})-(\d{4})/);
    if (!timeMatch || days.length === 0) continue;
    
    const startHour = parseInt(timeMatch[1].substring(0, 2));
    const startMin = parseInt(timeMatch[1].substring(2, 4));
    const endHour = parseInt(timeMatch[2].substring(0, 2));
    const endMin = parseInt(timeMatch[2].substring(2, 4));
    
    const startTime = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}:00`;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`;
    
    segments.push({
      days,
      startTime,
      endTime,
      deliveryMode
    });
  }
  
  return segments;
}

/**
 * Detect term code from AISIS HTML structure
 */
function detectTermCode(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for "School Year and Term" label
    if (line.includes('School Year and Term') || line.includes('School Year - Term')) {
      // The next non-empty line contains the term
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (nextLine && !nextLine.includes('\t') && nextLine.length > 5) {
          // Format: "2024-2025-First Semester" or "2025-2026-Second Semester"
          if (nextLine.match(/\d{4}-\d{4}-(First|Second|Intersession)/i)) {
            return nextLine;
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Detect department from AISIS HTML structure
 */
function detectDepartment(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for standalone "Department" label (not in table header)
    if (line === 'Department' || line === 'Department\t') {
      // The next non-empty line contains the department name
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (nextLine && 
            nextLine !== 'Cat. No.' && 
            nextLine !== 'ALL' &&
            nextLine.length > 0) {
          return nextLine.toUpperCase();
        }
      }
    }
  }
  
  return null;
}

/**
 * Check if we should extract department from subject codes
 */
function shouldExtractFromSubjectCode(detectedDept: string | null): boolean {
  if (!detectedDept) return true;
  
  // If department is generic, extract specific dept from each course's subject code
  const genericDepartments = [
    'ALL INTERDISCIPLINARY ELECTIVES',
    'ALL DEPARTMENTS',
    'INTERDISCIPLINARY',
  ];
  
  return genericDepartments.some(generic => 
    detectedDept.includes(generic)
  );
}

/**
 * Extract department from subject code (e.g., "BIO 10.01" -> "BIOLOGY")
 */
function extractDepartment(subjectCode: string): string {
  const match = subjectCode.match(/^([A-Z]+)/);
  if (!match) return 'UNKNOWN';
  
  const prefix = match[1];
  
  // Map common prefixes to full department names
  const deptMap: { [key: string]: string } = {
    'BIO': 'BIOLOGY',
    'MATH': 'MATHEMATICS',
    'CS': 'COMPUTER SCIENCE',
    'ENLIT': 'ENGLISH LITERATURE',
    'FILI': 'FILIPINO',
    'HISTO': 'HISTORY',
    'DECSC': 'DECISION SCIENCES',
    'INTACT': 'INTERDISCIPLINARY',
    'PEPC': 'PHYSICAL EDUCATION',
    'SOCSC': 'SOCIAL SCIENCE',
    'SCIED': 'SCIENCE EDUCATION',
    'PHYS': 'PHYSICS',
    'CHEM': 'CHEMISTRY',
    'ECON': 'ECONOMICS',
    'MGMT': 'MANAGEMENT',
    'ACCTG': 'ACCOUNTING',
    'LAWS': 'LAW',
    'PHILO': 'PHILOSOPHY',
    'THEO': 'THEOLOGY',
    'MATSE': 'MATERIALS SCIENCE AND ENGINEERING',
    'CHEMED': 'CHEMISTRY EDUCATION',
  };
  
  return deptMap[prefix] || prefix;
}

interface ReconstructedRow {
  subject_code: string;
  section: string;
  course_title: string;
  units: number;
  time_pattern: string;
  room: string;
  instructor: string | null;
  max_capacity: number | null;
  language: string | null;
  level: string | null;
  remarks: string | null;
  lineNo: number;
}

/**
 * Reconstruct rows from plain-text paste (multi-line format)
 */
function reconstructPlainTextRows(lines: string[]): ReconstructedRow[] {
  const rows: ReconstructedRow[] = [];
  
  // Find header line (optional - we can parse without it)
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Subject Code') && lines[i].includes('Section')) {
      headerIdx = i;
      break;
    }
  }
  
  // Parse data rows - start after header if present, otherwise from beginning
  // Updated regex to handle optional parenthetical qualifiers like "NSTP 11(ROTC)"
  const subjectCodePattern = /^([A-Z][A-Z0-9 ]{1,15})\s+(\d+(?:\.\d+)?[A-Za-z]?)(?:\s*\(([A-Z0-9\/&+\- ]{1,30})\))?\s+/i;
  const startAt = headerIdx === -1 ? 0 : headerIdx + 1;
  
  for (let i = startAt; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 10) continue;
    
    // Check if line starts with a subject code pattern
    const match = line.match(subjectCodePattern);
    if (!match) continue;
    
    try {
      // Extract subject code and section
      const subjectPrefix = match[1].replace(/\s+/g, ' ').trim();
      const courseNumber = match[2];
      const qualifier = match[3]; // Optional parenthetical part like "(ROTC)"
      const subject_code = `${subjectPrefix} ${courseNumber}${qualifier ? `(${qualifier})` : ''}`;
      
      // Parse rest of first line
      const afterSubject = line.substring(match[0].length);
      const tokens = afterSubject.split(/\s+/);
      
      // Find units (first integer token)
      let unitsIdx = -1;
      for (let j = 0; j < tokens.length; j++) {
        if (/^\d+$/.test(tokens[j])) {
          unitsIdx = j;
          break;
        }
      }
      
      if (unitsIdx === -1) continue;
      
      const section = tokens[0];
      const course_title = tokens.slice(1, unitsIdx).join(' ');
      const units = parseInt(tokens[unitsIdx]);
      const timeLinePart = tokens.slice(unitsIdx + 1).join(' ');
      
      // Look ahead for delivery mode line starting with "("
      let deliveryMode = '';
      let detailsLine = '';
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('(')) {
        detailsLine = lines[i + 1].trim();
        const dmMatch = detailsLine.match(/^\(([^)]+)\)/);
        if (dmMatch) {
          deliveryMode = dmMatch[1];
          detailsLine = detailsLine.substring(dmMatch[0].length).trim();
        }
        i++; // Consume continuation line
      }
      
      const time_pattern = timeLinePart + (deliveryMode ? ` (${deliveryMode})` : '');
      
      // Parse details line (room, instructor, capacity, language, level, remarks)
      let room = 'TBA';
      let instructor: string | null = null;
      let max_capacity: number | null = null;
      let language: string | null = null;
      let level: string | null = null;
      let remarks: string | null = null;
      
      if (detailsLine) {
        const detailTokens = detailsLine.split(/\s+/);
        
        // Room: allow one token ("SEC-B305A") or two tokens ("CTC 105")
        room = detailTokens[0] || 'TBA';
        if (
          detailTokens.length > 1 &&
          /^[A-Z-]+$/.test(room) && // Building tag (CTC, SEC-B, BEL, etc.)
          (/^\d/.test(detailTokens[1]) || /^[A-Z0-9-]+$/.test(detailTokens[1]))
        ) {
          room = `${room} ${detailTokens[1]}`;
          detailTokens.splice(0, 2);
        } else {
          detailTokens.splice(0, 1);
        }
        
        // Find language token (ENG, FIL, etc.) or bilingual pattern (E / F)
        let langIdx = detailTokens.findIndex(t => /^[A-Z]{3}$/.test(t) && t !== 'TBA');
        let langSpan = 1; // How many tokens the language takes up
        
        // If standard 3-letter code not found, try "X / Y" bilingual pattern
        if (langIdx === -1) {
          for (let j = 0; j < detailTokens.length - 2; j++) {
            if (
              /^[A-Z]{1,3}$/.test(detailTokens[j]) &&
              detailTokens[j + 1] === '/' &&
              /^[A-Z]{1,3}$/.test(detailTokens[j + 2])
            ) {
              langIdx = j;
              langSpan = 3; // Takes up 3 tokens: "E", "/", "F"
              language = `${detailTokens[j]} ${detailTokens[j + 1]} ${detailTokens[j + 2]}`;
              break;
            }
          }
        }
        
        if (langIdx !== -1) {
          // Only set language if we found standard 3-letter code (bilingual already set above)
          if (langSpan === 1) {
            language = detailTokens[langIdx];
          }
          
          // Capacity is before language
          if (langIdx > 0 && /^-?\d+$/.test(detailTokens[langIdx - 1])) {
            max_capacity = parseInt(detailTokens[langIdx - 1]);
          }
          
          // Level is after language (adjust for langSpan)
          if (langIdx + langSpan < detailTokens.length) {
            level = detailTokens[langIdx + langSpan];
          }
          
          // Instructor is between room and capacity
          const instrStart = 0;
          const instrEnd = langIdx - (max_capacity !== null ? 2 : 1);
          if (instrEnd >= instrStart) {
            instructor = detailTokens.slice(instrStart, instrEnd + 1).join(' ').replace(', -', '').trim() || null;
          }
          
          // Remarks: skip optional free-slots number and lone '-' tokens after level
          let rStart = langIdx + langSpan + 1; // After language + level (adjust for langSpan)
          if (rStart < detailTokens.length && /^-?\d+$/.test(detailTokens[rStart])) rStart++;
          while (rStart < detailTokens.length && detailTokens[rStart] === '-') rStart++;
          
          if (rStart < detailTokens.length) {
            const rem = detailTokens.slice(rStart);
            // Trim trailing "S P" or "N N"
            while (
              rem.length >= 2 &&
              (rem[rem.length - 2] === 'S' || rem[rem.length - 2] === 'N') &&
              (rem[rem.length - 1] === 'P' || rem[rem.length - 1] === 'N')
            ) {
              rem.pop(); rem.pop();
            }
            remarks = rem.join(' ').trim() || null;
          }
        }
      }
      
      rows.push({
        subject_code,
        section,
        course_title,
        units,
        time_pattern,
        room,
        instructor,
        max_capacity,
        language,
        level,
        remarks,
        lineNo: i + 1
      });
    } catch (err) {
      // Skip malformed rows
      continue;
    }
  }
  
  return rows;
}

/**
 * Parse AISIS schedule table HTML
 */
export function parseAISISScheduleTable(
  htmlText: string,
  termCode?: string,
  departmentOverride?: string
): ParseResult {
  const schedules: ParsedAISISSchedule[] = [];
  const errors: ParseError[] = [];
  
  // Extract table data
  const lines = htmlText.split('\n');
  
  // Auto-detect term and department
  const detectedTerm = detectTermCode(lines);
  const detectedDept = detectDepartment(lines);
  
  // Use provided values, fallback to detected values
  const finalTermCode = termCode || detectedTerm;
  const finalDepartment = departmentOverride || detectedDept;
  
  // Validation
  if (!finalTermCode) {
    errors.push({
      type: 'error',
      message: 'Could not detect term code. Please provide it manually.'
    });
    return { 
      schedules: [], 
      errors, 
      metadata: { 
        department: finalDepartment || 'UNKNOWN',
        term: '',
        total_courses: 0,
        detected_term: detectedTerm,
        detected_department: detectedDept,
        mode: 'table',
        linesProcessed: lines.length,
        rowsSkipped: 0,
        skippedRows: []
      } 
    };
  }
  
  // Determine if we should extract department from subject codes
  const extractDeptFromCourses = shouldExtractFromSubjectCode(finalDepartment);
  
  // Track skipped rows for debugging
  const skippedRows: SkippedRow[] = [];
  
  // Detect parsing mode - RELAXED: require 2+ data lines with 6+ tabs (not just header)
  const headerIdx = lines.findIndex(l => l.includes('Subject Code') && l.includes('Section'));
  let dataHasWideTabRows = false;
  if (headerIdx !== -1) {
    const sample = lines.slice(headerIdx + 1, Math.min(headerIdx + 81, lines.length));
    const wideCount = sample.filter(l => (l.match(/\t/g) || []).length >= 6).length; // RELAXED: 6+ tabs
    dataHasWideTabRows = wideCount >= 2; // RELAXED: 2+ lines
  }
  const looksLikeTable = htmlText.includes('<table') || dataHasWideTabRows;
  let parseMode: 'table' | 'plain-text' = looksLikeTable ? 'table' : 'plain-text';
  
  console.log(`[Parser] Mode detection: ${parseMode} (wideTabRows: ${dataHasWideTabRows})`);
  
  let reconstructedRows: ReconstructedRow[] = [];
  
  if (parseMode === 'plain-text') {
    // Plain text mode
    reconstructedRows = reconstructPlainTextRows(lines);
    
    for (const row of reconstructedRows) {
      // Parse time segments
      const timeSegments = parseTimeSegments(row.time_pattern);
      
      if (timeSegments.length === 0) {
        // Don't skip - create entry with TBA schedule
        errors.push({
          type: 'warning',
          message: `TBA/unparseable time for ${row.subject_code} ${row.section} - creating entry with placeholder schedule`,
          line: row.lineNo
        });
        
        const department = extractDeptFromCourses 
          ? extractDepartment(row.subject_code)
          : (finalDepartment || 'UNKNOWN');
        
        schedules.push({
          term_code: finalTermCode,
          subject_code: row.subject_code,
          section: row.section,
          course_title: row.course_title,
          units: row.units,
          time_pattern: row.time_pattern,
          room: row.room || 'TBA',
          instructor: row.instructor,
          max_capacity: row.max_capacity,
          language: row.language,
          level: row.level,
          delivery_mode: null,
          remarks: (row.remarks || '') + ' [TBA SCHEDULE]',
          days_of_week: [],
          start_time: '00:00:00',
          end_time: '00:00:00',
          department
        });
        continue;
      }
      
      // Determine department
      const department = extractDeptFromCourses 
        ? extractDepartment(row.subject_code)
        : (finalDepartment || 'UNKNOWN');
      
      // Create one schedule entry per time segment
      for (const segment of timeSegments) {
        schedules.push({
          term_code: finalTermCode,
          subject_code: row.subject_code,
          section: row.section,
          course_title: row.course_title,
          units: row.units,
          time_pattern: row.time_pattern,
          room: row.room,
          instructor: row.instructor,
          max_capacity: row.max_capacity,
          language: row.language,
          level: row.level,
          delivery_mode: segment.deliveryMode,
          remarks: row.remarks,
          days_of_week: segment.days,
          start_time: segment.startTime,
          end_time: segment.endTime,
          department
        });
      }
    }
  } else {
    // TABLE MODE: Multi-line row aggregation
    // Allow dots, slashes, ampersands, hyphens; multi-part numbers; optional trailing letters (case-insensitive)
    const SUBJECT_CELL_RX = /^[A-Z][A-Z0-9 .\/&-]{1,25}\s+\d+(?:\.\d+)*(?:[A-Z])?/i;

    // Merge continuation line cells into existing buckets
    function mergeLineIntoBuckets(buckets: string[], cells: string[]): string[] {
      // 1. SMART ALIGNMENT: Detect delivery mode marker and align to time column (index 4)
      const parenIdx = cells.findIndex(c => c && /^\([^)]{1,30}\)$/.test(c));
      if (parenIdx !== -1) {
        const offset = 4 - parenIdx; // Shift so marker lands at index 4
        const targetSize = Math.max(buckets.length, cells.length + Math.max(0, offset));
        if (buckets.length < targetSize) {
          buckets = buckets.concat(Array(targetSize - buckets.length).fill(""));
        }
        
        for (let k = 0; k < cells.length; k++) {
          const v = (cells[k] ?? "").trim();
          if (!v) continue;
          const target = k + offset;
          if (target < 0) continue;
          buckets[target] = buckets[target] ? `${buckets[target]} ${v}` : v;
        }
        return buckets;
      }
      
      // 2. LEGACY FALLBACK: Special case for short marker lines
      if (cells.length <= 2 && cells[0] && /^\([^)]{0,10}\)$/.test(cells[0]) && buckets.length >= 5) {
        // Append to time pattern bucket (index 4)
        buckets[4] = buckets[4] ? `${buckets[4]} ${cells[0]}` : cells[0];
        // If there's a second cell, merge normally
        if (cells[1]) {
          const len = Math.max(buckets.length, cells.length);
          if (buckets.length < len) {
            buckets = buckets.concat(Array(len - buckets.length).fill(""));
          }
          for (let i = 1; i < len; i++) {
            const v = (cells[i] ?? "").trim();
            if (v) {
              buckets[i] = buckets[i] ? `${buckets[i]} ${v}` : v;
            }
          }
        }
        return buckets;
      }
      
      // 3. NORMAL MERGE: Align by position
      const len = Math.max(buckets.length, cells.length);
      if (buckets.length < len) {
        buckets = buckets.concat(Array(len - buckets.length).fill(""));
      }
      for (let i = 0; i < len; i++) {
        const v = (cells[i] ?? "").trim();
        if (v) {
          buckets[i] = buckets[i] ? `${buckets[i]} ${v}` : v;
        }
      }
      return buckets;
    }

    // Process a complete aggregated row
    function processBuckets(
      buckets: string[],
      lineNumber: number
    ) {
      // Map columns: subject_code, section, title, units, time, room, instructor, max, lang, level, free, remarks...
      // Handle variable column count (remarks may contain tabs, or S/P columns after)
      const [
        subject_code_raw,
        section,
        course_title,
        unitsStr,
        timePattern,
        room,
        instructor,
        maxCapStr,
        language,
        level,
        freeSlotsStr,
        ...extraCells  // Capture any extra cells
      ] = buckets.map(s => (s ?? "").trim());
      
      // Clean any delivery mode that leaked into subject code (preserve qualifiers like CWTS, ROTC, LTS)
      const subject_code = subject_code_raw
        .replace(/\s*\((?:FULLY\s+ON[- ]?SITE|FULLY\s+ONLINE|ONLINE|ONSITE|HYBRID|BLENDED|SYNCHRONOUS|ASYNCHRONOUS)\)\s*$/i, '')
        .trim();
      
      // Join extra cells into remarks (handles tabs in remarks + S/P columns)
      const remarks = extraCells.join(' ').trim() || null;

      if (!subject_code || !section || !course_title) {
        skippedRows.push({ 
          lineNo: lineNumber, 
          reason: 'Missing essential field (subject/section/title)', 
          data: buckets.join('\t').slice(0, 60) 
        });
        return;
      }

      const finalTimePattern = timePattern || 'TBA';
      const finalRoom = room || 'TBA';

      const timeSegments = parseTimeSegments(finalTimePattern);

      const units = parseFloat(unitsStr) || 3;
      const max_capacity = maxCapStr ? parseInt(maxCapStr) : null;

      const department = extractDeptFromCourses
        ? extractDepartment(subject_code)
        : (finalDepartment || 'UNKNOWN');

      if (timeSegments.length === 0) {
        errors.push({
          type: 'warning',
          message: `TBA/unparseable time "${finalTimePattern}" for ${subject_code} - creating entry with placeholder schedule`,
          line: lineNumber
        });
        schedules.push({
          term_code: finalTermCode,
          subject_code,
          section,
          course_title,
          units,
          time_pattern: finalTimePattern,
          room: finalRoom,
          instructor: instructor && instructor !== 'TBA' ? instructor : null,
          max_capacity,
          language: language || null,
          level: level || null,
          delivery_mode: null,
          remarks: (remarks || '') + ' [TBA SCHEDULE]',
          days_of_week: [],
          start_time: '00:00:00',
          end_time: '00:00:00',
          department
        });
        return;
      }

      for (const seg of timeSegments) {
        schedules.push({
          term_code: finalTermCode,
          subject_code,
          section,
          course_title,
          units,
          time_pattern: finalTimePattern,
          room: finalRoom,
          instructor: instructor && instructor !== 'TBA' ? instructor : null,
          max_capacity,
          language: language || null,
          level: level || null,
          delivery_mode: seg.deliveryMode,
          remarks: remarks || null,
          days_of_week: seg.days,
          start_time: seg.startTime,
          end_time: seg.endTime,
          department
        });
      }
      
      // Mark that we've successfully found and processed courses
      if (schedules.length > 0) {
        hasFoundCourses = true;
      }
    }

    // Aggregator loop
    let lineNumber = 0;
    let inTableData = false;
    let hasFoundCourses = false; // Track if we've successfully parsed any courses
    let currentBuckets: string[] | null = null;
    let currentStartLine = 0;

    const flush = () => {
      if (currentBuckets) {
        processBuckets(currentBuckets, currentStartLine);
        currentBuckets = null;
      }
    };

    // Pre-process: merge lines that were split by <br> in HTML
    // This handles cases where "ArtAp 10\tA\tART APPRECIATION\t3\tM-TH 0800-0930"
    // is followed by "(FULLY ONSITE)\tINNOVATION 202\t..." on the next line
    const mergedLines: string[] = [];
    let skipNext = false;

    for (let i = 0; i < lines.length; i++) {
      if (skipNext) {
        skipNext = false;
        continue;
      }
      
      const line = lines[i];
      const cells = line.split('\t').map(c => c.replace(/\u00A0/g, ' ').replace(/\u200B/g, '').trim());
      const firstCell = (cells[0] ?? '').trim();
      
      // Check if this is a subject line followed by a delivery mode line
      if (SUBJECT_CELL_RX.test(firstCell) && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextCells = nextLine.split('\t').map(c => c.replace(/\u00A0/g, ' ').replace(/\u200B/g, '').trim());
        const nextFirst = (nextCells[0] ?? '').trim();
        
        // If next line starts with delivery mode in column 0, merge them
        if (/^\([^)]{1,30}\)$/.test(nextFirst)) {
          // Reconstruct as if it was never split
          const mergedCells = [...cells];
          
          // The delivery mode should be appended to the Time column (index 4)
          if (mergedCells.length >= 5) {
            mergedCells[4] = (mergedCells[4] || '') + '\n' + nextFirst;
          } else {
            // If we don't have enough columns yet, pad and add
            while (mergedCells.length < 4) mergedCells.push('');
            mergedCells.push(nextFirst);
          }
          
          // Append remaining cells from nextCells (starting from index 1)
          for (let j = 1; j < nextCells.length; j++) {
            const targetIdx = 4 + j; // Time is at 4, so Room is at 5, etc.
            if (targetIdx < mergedCells.length) {
              mergedCells[targetIdx] = nextCells[j];
            } else {
              mergedCells.push(nextCells[j]);
            }
          }
          
          mergedLines.push(mergedCells.join('\t'));
          skipNext = true;
          continue;
        }
      }
      
      mergedLines.push(line);
    }

    // Use mergedLines instead of lines in the main loop
    const linesToProcess = mergedLines;

    for (let i = 0; i < linesToProcess.length; i++) {
      const rawLine = linesToProcess[i];
      const line = rawLine.trim();
      lineNumber = i + 1;

      // Detect start of table data
      if (line.includes('Subject Code') && line.includes('Section')) {
        inTableData = true;
        continue;
      }
      if (!inTableData) continue;

      // Detect end of table data (footer markers)
      // Only stop on footer markers if we've already found courses
      // This prevents premature exit when footer text appears before the schedule table
      const footerMarkers = [
        /^Home\s*:/i,
        /^Terms\s*&\s*Conditions/i,
        /^Privacy\s*Policy/i,
        /^\(c\)\s*Copyright/i,
        /^version\s+\d{4}/i,
        /^Contact\s*Us/i
      ];
      
      if (hasFoundCourses && footerMarkers.some(marker => marker.test(line))) {
        flush(); // Flush any pending row
        break; // Stop processing, we've hit the footer
      }

      // Skip truly empty/short lines
      if (!line || line.length < 2) {
        continue;
      }

      // Build cells WITHOUT removing empties (preserve alignment)
      const rawCells = rawLine.split('\t');
      const cells = rawCells.map(c => c.replace(/\u00A0/g, ' ').replace(/\u200B/g, '').trim());
      const allEmpty = cells.every(c => !c);

      if (allEmpty) continue;

      const firstCell = (cells[0] ?? '').trim();

      // Helper: Structural fallback to detect rows by structure even if regex fails
      function isProbablySubjectRow(cells: string[]): boolean {
        const section = (cells[1] || '').trim();
        const units = (cells[3] || '').trim();
        const time = (cells[4] || '').trim();
        const sectionPat = /^[A-Za-z0-9-]{1,8}$/;
        const unitsPat = /^\d{1,2}$/;
        const timePat = /^(?:M|T|W|TH|F|SAT|SUN)(?:[-\/,\s]+(?:M|T|W|TH|F|SAT|SUN))*\s+\d{4}-\d{4}$|^TBA$|^TUTORIAL$/i;
        return cells.length >= 5 && sectionPat.test(section) && unitsPat.test(units) && timePat.test(time);
      }

      // New row starts when first cell looks like a subject code OR has valid row structure
      const isNewRow = SUBJECT_CELL_RX.test(firstCell) || isProbablySubjectRow(cells);

      if (isNewRow) {
        // LOOKAHEAD: Check next 1-2 lines for delivery mode, skip blank lines
        let shouldMergeNextLine = false;
        let nextLineCells: string[] = [];
        let advanceBy = 0;
        
        for (let ahead = 1; ahead <= 2 && i + ahead < linesToProcess.length; ahead++) {
          const candidateRaw = linesToProcess[i + ahead];
          const candidate = candidateRaw.trim();
          
          // Skip one blank/very short line
          if (!candidate || candidate.length < 2) continue;
          
          const candCells = candidateRaw.split('\t').map(c => c.replace(/\u00A0/g, ' ').replace(/\u200B/g, '').trim());
          
          // Check if any cell contains delivery mode pattern
          if (candCells.some(c => /^\([^)]{1,30}\)$/.test(c))) {
            shouldMergeNextLine = true;
            nextLineCells = candCells;
            advanceBy = ahead;
          }
          break; // Stop after first non-empty line
        }
        
        // Finish previous row
        flush();
        // Start new buckets from this line
        currentBuckets = mergeLineIntoBuckets([], cells);
        
        // If next line is a delivery mode, merge it now and skip it
        if (shouldMergeNextLine) {
          currentBuckets = mergeLineIntoBuckets(currentBuckets, nextLineCells);
          i += advanceBy; // Skip ahead by the number of lines we processed
        }
        
        currentStartLine = lineNumber;
      } else {
        // Continuation line: merge into current row if we have one
        if (currentBuckets) {
          currentBuckets = mergeLineIntoBuckets(currentBuckets, cells);
        } else {
          // Recovery: if this looks like a delivery mode and we have a recent line,
          // stitch them together retroactively
          const looksLikeDM = cells.some(c => /^\([^)]{1,30}\)$/.test(c));
          if (looksLikeDM && i > 0) {
            // Find the previous non-empty line
            let p = i - 1;
            while (p >= 0 && (!linesToProcess[p] || !linesToProcess[p].trim())) p--;
            
            if (p >= 0) {
              const prevRaw = linesToProcess[p];
              const prevCells = prevRaw.split('\t').map(c => c.replace(/\u00A0/g, ' ').replace(/\u200B/g, '').trim());
              const prevFirst = (prevCells[0] ?? '').trim();
              
              // Check if previous line is actually a subject code (that we missed)
              if (SUBJECT_CELL_RX.test(prevFirst)) {
                // Retroactively create the row by merging both lines
                currentBuckets = mergeLineIntoBuckets([], prevCells);
                currentBuckets = mergeLineIntoBuckets(currentBuckets, cells);
                currentStartLine = p + 1;
                continue; // Successfully handled; not an orphan
              }
            }
          }
          
          // If we get here, it's truly an orphan
          let diagnosticReason = 'Orphan continuation line';
          
          // Add diagnostic details
          if (looksLikeDM) {
            if (i === 0) {
              diagnosticReason = 'Orphan: Delivery mode at start of file (no previous line)';
            } else {
              let p = i - 1;
              while (p >= 0 && (!linesToProcess[p] || !linesToProcess[p].trim())) p--;
              
              if (p < 0) {
                diagnosticReason = 'Orphan: Delivery mode after blank lines (no valid previous line)';
              } else {
                const prevRaw = linesToProcess[p];
                const prevCells = prevRaw.split('\t').map(c => c.replace(/\u00A0/g, ' ').replace(/\u200B/g, '').trim());
                const prevFirst = (prevCells[0] ?? '').trim();
                
                if (!prevFirst) {
                  diagnosticReason = 'Orphan: Delivery mode after blank line';
                } else if (!SUBJECT_CELL_RX.test(prevFirst)) {
                  diagnosticReason = `Orphan: Delivery mode after non-subject line ("${prevFirst.slice(0, 20)}")`;
                } else {
                  diagnosticReason = 'Orphan: Delivery mode but recovery failed';
                }
              }
            }
          } else {
            // Not a delivery mode pattern
            const firstCell = (cells[0] ?? '').trim();
            if (firstCell.startsWith('(')) {
              diagnosticReason = `Orphan: Parenthetical but not standard delivery mode ("${firstCell.slice(0, 30)}")`;
            } else if (cells.length === 1) {
              diagnosticReason = `Orphan: Single-column continuation ("${firstCell.slice(0, 30)}")`;
            } else {
              diagnosticReason = `Orphan: Multi-column continuation, no open row (first: "${firstCell.slice(0, 20)}")`;
            }
          }
          
          skippedRows.push({ 
            lineNo: lineNumber, 
            reason: diagnosticReason, 
            data: line.slice(0, 100) 
          });
        }
      }
    }

    // Flush the last aggregated row
    flush();
    
    // Process any mixed plain-text rows found
    for (const row of reconstructedRows) {
      const timeSegments = parseTimeSegments(row.time_pattern);
      if (timeSegments.length === 0) continue;
      
      const department = extractDeptFromCourses 
        ? extractDepartment(row.subject_code)
        : (finalDepartment || 'UNKNOWN');
      
      for (const segment of timeSegments) {
        schedules.push({
          term_code: finalTermCode,
          subject_code: row.subject_code,
          section: row.section,
          course_title: row.course_title,
          units: row.units,
          time_pattern: row.time_pattern,
          room: row.room,
          instructor: row.instructor,
          max_capacity: row.max_capacity,
          language: row.language,
          level: row.level,
          delivery_mode: segment.deliveryMode,
          remarks: row.remarks,
          days_of_week: segment.days,
          start_time: segment.startTime,
          end_time: segment.endTime,
          department
        });
      }
    }
  }
  
  // FALLBACK: If table mode found nothing, retry in plain-text mode
  if (parseMode === 'table' && schedules.length === 0) {
    console.log('[Parser] Table mode found 0 schedules, retrying in plain-text mode...');
    parseMode = 'plain-text';
    reconstructedRows = reconstructPlainTextRows(lines);
    
    for (const row of reconstructedRows) {
      const timeSegments = parseTimeSegments(row.time_pattern);
      
      if (timeSegments.length === 0) {
        errors.push({
          type: 'warning',
          message: `TBA/unparseable time for ${row.subject_code} ${row.section} - creating entry with placeholder schedule`,
          line: row.lineNo
        });
        
        const department = extractDeptFromCourses 
          ? extractDepartment(row.subject_code)
          : (finalDepartment || 'UNKNOWN');
        
        schedules.push({
          term_code: finalTermCode,
          subject_code: row.subject_code,
          section: row.section,
          course_title: row.course_title,
          units: row.units,
          time_pattern: row.time_pattern,
          room: row.room || 'TBA',
          instructor: row.instructor,
          max_capacity: row.max_capacity,
          language: row.language,
          level: row.level,
          delivery_mode: null,
          remarks: (row.remarks || '') + ' [TBA SCHEDULE]',
          days_of_week: [],
          start_time: '00:00:00',
          end_time: '00:00:00',
          department
        });
        continue;
      }
      
      const department = extractDeptFromCourses 
        ? extractDepartment(row.subject_code)
        : (finalDepartment || 'UNKNOWN');
      
      for (const segment of timeSegments) {
        schedules.push({
          term_code: finalTermCode,
          subject_code: row.subject_code,
          section: row.section,
          course_title: row.course_title,
          units: row.units,
          time_pattern: row.time_pattern,
          room: row.room,
          instructor: row.instructor,
          max_capacity: row.max_capacity,
          language: row.language,
          level: row.level,
          delivery_mode: segment.deliveryMode,
          remarks: row.remarks,
          days_of_week: segment.days,
          start_time: segment.startTime,
          end_time: segment.endTime,
          department
        });
      }
    }
  }
  
  // Show warning if no courses parsed
  if (schedules.length === 0 && errors.length === 0) {
    errors.push({
      type: 'warning',
      message: `No courses parsed. Detected mode: ${parseMode}. Processed ${lines.length} lines, skipped ${skippedRows.length} rows. Please check your paste format.`
    });
  }
  
  // Deduplicate schedules in case any slipped through
  const uniqueSchedules: ParsedAISISSchedule[] = [];
  const seen = new Set<string>();

  for (const s of schedules) {
    const key = [
      s.subject_code,
      s.section,
      s.days_of_week.join(''),
      s.start_time,
      s.end_time,
      s.room,
      s.instructor ?? ''
    ].join('|');

    if (!seen.has(key)) {
      seen.add(key);
      uniqueSchedules.push(s);
    }
  }

  // Group skipped rows by reason
  const skipReasons: { [key: string]: number } = {};
  for (const skip of skippedRows) {
    skipReasons[skip.reason] = (skipReasons[skip.reason] || 0) + 1;
  }
  
  console.log(`[Parser] Complete: ${uniqueSchedules.length} schedules, ${errors.length} errors, ${skippedRows.length} skipped`);
  if (Object.keys(skipReasons).length > 0) {
    console.log('[Parser] Skip reasons:', skipReasons);
  }
  
  return {
    schedules: uniqueSchedules,
    errors,
    metadata: {
      department: finalDepartment || 'MULTIPLE',
      term: finalTermCode,
      total_courses: uniqueSchedules.length,
      detected_term: detectedTerm,
      detected_department: detectedDept,
      mode: parseMode,
      linesProcessed: lines.length,
      rowsSkipped: skippedRows.length,
      skippedRows
    }
  };
}
