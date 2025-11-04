export interface ParsedScheduleBlock {
  courseCode: string;
  section: string;
  room: string;
  day: number; // 1 = Mon ... 6 = Sat
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

export interface DebugInfo {
  rawAnalysis: {
    totalLines: number;
    headerLine: number;
    headerContent: string;
    timeSlotGroups: number;
    usesTabSeparator: boolean;
    footerLinesIgnored?: number;
  };
  columnExtractions: Array<{
    timeSlot: string;
    rawLines: string[];
    collapsedColumns: string[];
    cellsWithContent: number[];
    laneEvents?: Array<{
      lineIndex: number;
      cellIndex: number;
      type: 'header' | 'detail' | 'gap' | 'detail_orphan';
      text: string;
      posAssigned?: number;
      note?: string;
    }>;
    lanesOverview?: Array<{
      ordinalPos: number;
      gap: boolean;
      header: string;
      details: string[];
      state: string;
      resolvedDay?: string;
    }>;
    endOfTableTripped?: boolean;
  }>;
  validationResults: Array<{
    dayName: string;
    timeRange: string;
    cellContent: string;
    result: 'accepted' | 'rejected' | 'empty';
    reason: string;
    courseCode?: string;
    lineNumber?: number;
  }>;
  commonIssues: Array<{
    type: 'alignment' | 'regex' | 'format' | 'footer';
    severity: 'error' | 'warning' | 'info';
    message: string;
    lineNumbers: number[];
  }>;
}

export interface ParseResult {
  blocks: ParsedScheduleBlock[];
  debug: DebugInfo;
}

// "700-730", "0800-0930"
const TIME_RX = /^\s*(\d{3,4})-(\d{3,4})/;

// Accepts "MATH 10", "SocSc 11", "MATH 31.1", "CS 101A"
const COURSE_CODE_RX = /^[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*\s+\d+(?:\.\d+)?[A-Za-z]?$/;

// Only applied AFTER course regex matches, to filter false positives
const REJECT_PATTERNS: RegExp[] = [
  /^[A-Z]?\d+$/,                // A3, J2, B5, 6, 307
  /^[A-Z]-\d+$/,                // F-113, A-210
  /^[A-Z]{2,3}-[A-Z]?\d+$/,     // SEC-A210, BEL-307, CTC-114
  /^COVERED\s+COURT/i,          // facilities
  /^\([^)]+\)$/,                // (FULLY ONSITE)
  /^[A-Z]$/,                    // M, N, F (single letters)
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thur", "Fri", "Sat"];

function toHhMm(s: string): string {
  const p = s.padStart(4, "0");
  return `${p.slice(0, 2)}:${p.slice(2)}`;
}

function timesEqual(a: string, b: string): boolean {
  return a === b;
}

function parseCourseInfo(text: string): { section: string; room: string } {
  const modeMatch = text.match(/\(([^)]+)\)\s*$/);
  const mode = modeMatch ? modeMatch[1] : "";
  const beforeParens = text.replace(/\([^)]+\)\s*$/, "").trim();

  // join wrapped things like "COVERED \n COURT 6"
  const flattened = beforeParens.replace(/\s+/g, " ");
  const parts = flattened.split(" ");
  if (parts.length === 0) return { section: "N/A", room: mode || "TBD" };

  const section = parts[0];
  const roomRaw = parts.slice(1).join(" ").trim();
  const room = roomRaw ? (mode ? `${roomRaw} (${mode})` : roomRaw) : (mode || "TBD");
  return { section, room };
}

function isValidCourseCode(line: string): boolean {
  if (!COURSE_CODE_RX.test(line)) return false;
  // apply rejects only if it first looked like a course
  return !REJECT_PATTERNS.some(rx => rx.test(line));
}

interface Lane {
  header?: string;
  details: string[];
  state: 'open' | 'done';
}

interface LaneDebug {
  rawLines: string[];
  laneEvents?: Array<{
    lineIndex: number;
    cellIndex: number;
    type: 'header' | 'detail' | 'gap' | 'detail_orphan';
    text: string;
    posAssigned?: number;
    note?: string;
  }>;
  lanesOverview?: Array<{
    ordinalPos: number;
    gap: boolean;
    header: string;
    details: string[];
    state: string;
    resolvedDay?: string;
  }>;
  endOfTableTripped?: boolean;
}

function collapseRowGroup(lines: string[], debug?: LaneDebug): string[] {
  if (debug) {
    debug.rawLines = [...lines];
    debug.laneEvents = [];
    debug.lanesOverview = [];
  }

  if (lines.length === 0) return Array(7).fill('');

  const lanes: Lane[] = [];
  const gaps = new Set<number>();
  let completedCount = 0;

  const clean = (s: string) => s.replace(/\u00A0/g, ' ').replace(/\u200B/g, '').trim();
  
  const recordEvent = (e: LaneDebug['laneEvents'][0]) => {
    if (debug?.laneEvents) debug.laneEvents.push(e);
  };

  // Footer patterns to detect end of table
  const FOOTER_PATTERNS = [
    /Home\s*:/i,
    /Privacy Policy/i,
    /Terms & Conditions/i,
    /Ateneo Integrated Student Information System/i,
    /Contact Us/i,
    /Copyright.*Ateneo/i,
  ];

  const isFooterLine = (line: string) => 
    FOOTER_PATTERNS.some(p => p.test(line));

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    
    // Check for footer/end of table
    if (isFooterLine(raw)) {
      if (debug) debug.endOfTableTripped = true;
      break;
    }

    let cells = raw.split('\t').map(clean);
    const startsWithTime = TIME_RX.test(cells[0] || '');
    
    // If starts with time and not first line, unexpected new time slot
    if (startsWithTime && li > 0) {
      console.warn('Multiple time slots in same group:', raw);
      break;
    }

    // Remove time column if present
    if (startsWithTime) {
      cells = cells.slice(1);
    }

    const posBase = completedCount;

    for (let cj = 0; cj < cells.length; cj++) {
      const text = cells[cj];
      const pos = posBase + cj;

      // Empty cell - mark as explicit gap
      if (!text) {
        if (lanes[pos] === undefined) {
          gaps.add(pos);
        }
        recordEvent({ lineIndex: li, cellIndex: cj, type: 'gap', text: '', posAssigned: pos });
        continue;
      }

      const isHeader = COURSE_CODE_RX.test(text) && !REJECT_PATTERNS.some(rx => rx.test(text));

      if (isHeader) {
        // Find first free lane position >= pos
        let k = pos;
        while (lanes[k] !== undefined && k < 20) k++;
        lanes[k] = { header: text, details: [], state: 'open' };
        recordEvent({ lineIndex: li, cellIndex: cj, type: 'header', text, posAssigned: k });
      } else {
        // Attach detail to nearest open lane >= pos
        let k = pos;
        while (k < lanes.length && (!lanes[k] || lanes[k].state !== 'open')) k++;
        
        // If not found forward, search backward for last open lane
        if (k >= lanes.length || !lanes[k] || lanes[k].state !== 'open') {
          k = lanes.length - 1;
          while (k >= 0 && (!lanes[k] || lanes[k].state !== 'open')) k--;
        }

        if (k >= 0 && lanes[k] && lanes[k].state === 'open') {
          // Avoid duplicate details
          if (!lanes[k].details.includes(text)) {
            lanes[k].details.push(text);
          }
          lanes[k].state = 'done';
          completedCount++;
          recordEvent({ lineIndex: li, cellIndex: cj, type: 'detail', text, posAssigned: k });
        } else {
          recordEvent({ lineIndex: li, cellIndex: cj, type: 'detail_orphan', text, note: 'no open lane' });
        }
      }
    }
  }

  // Map lanes to 7 output columns (Time + 6 days)
  const out = Array(7).fill('');
  
  // Extract time from first line
  const timeMatch = (lines[0] || '').match(TIME_RX);
  out[0] = timeMatch ? timeMatch[0] : '';
  
  let dayIndex = 1; // Start at 1 for Mon (0 is Time)
  const maxPos = Math.max(lanes.length - 1, ...Array.from(gaps), -1);

  for (let pos = 0; pos <= Math.min(maxPos, 20) && dayIndex <= 6; pos++) {
    // If explicit gap at this position with no lane, skip a day
    if (gaps.has(pos) && !lanes[pos]) {
      if (debug?.lanesOverview) {
        debug.lanesOverview.push({
          ordinalPos: pos,
          gap: true,
          header: '',
          details: [],
          state: 'gap',
          resolvedDay: DAY_LABELS[dayIndex - 1] + ' (skipped)',
        });
      }
      dayIndex++;
      continue;
    }

    const lane = lanes[pos];
    if (!lane) {
      // No lane at this position, continue
      continue;
    }

    const text = [lane.header, ...lane.details].filter(Boolean).join('\n').trim();
    if (text) {
      out[dayIndex] = text;
    }

    if (debug?.lanesOverview) {
      debug.lanesOverview.push({
        ordinalPos: pos,
        gap: false,
        header: lane.header || '',
        details: lane.details,
        state: lane.state,
        resolvedDay: dayIndex <= 6 ? DAY_LABELS[dayIndex - 1] : 'overflow',
      });
    }

    dayIndex++;
  }

  // Check for alignment overflow
  if (dayIndex > 7 && debug) {
    recordEvent({ 
      lineIndex: -1, 
      cellIndex: -1, 
      type: 'detail_orphan', 
      text: '', 
      note: `Alignment overflow: ${dayIndex - 1} > 6 days` 
    });
  }

  // Clean up: remove excessive newlines
  return out.map(col => col.replace(/\n{2,}/g, '\n').trim());
}

function parseCell(
  cell: string,
  dayName: string,
  timeRange: string
): { courseCode: string; section: string; room: string } | null {
  if (!cell) return null;
  const lines = cell.split("\n").map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const first = lines[0];
  if (!isValidCourseCode(first)) {
    return null;
  }
  const info = lines.length > 1 ? parseCourseInfo(lines.slice(1).join(" ")) : { section: "N/A", room: "TBD" };
  return { courseCode: first, section: info.section, room: info.room };
}

function mergeAdjacent(blocks: ParsedScheduleBlock[]): ParsedScheduleBlock[] {
  const sorted = blocks.slice().sort((a, b) =>
    a.day !== b.day ? a.day - b.day :
    a.startTime !== b.startTime ? a.startTime.localeCompare(b.startTime) :
    (a.courseCode + a.section + a.room).localeCompare(b.courseCode + b.section + b.room)
  );

  const out: ParsedScheduleBlock[] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (
      last &&
      last.day === b.day &&
      last.courseCode === b.courseCode &&
      last.section === b.section &&
      last.room === b.room &&
      timesEqual(last.endTime, b.startTime) // strict adjacency
    ) {
      last.endTime = b.endTime;
    } else {
      out.push({ ...b });
    }
  }
  return out;
}

export function parseAISISSchedule(pastedText: string): ParsedScheduleBlock[];
export function parseAISISSchedule(pastedText: string, withDebug: true): ParseResult;
export function parseAISISSchedule(pastedText: string, withDebug?: boolean): ParsedScheduleBlock[] | ParseResult {
  const debug: DebugInfo = {
    rawAnalysis: {
      totalLines: 0,
      headerLine: -1,
      headerContent: '',
      timeSlotGroups: 0,
      usesTabSeparator: false,
    },
    columnExtractions: [],
    validationResults: [],
    commonIssues: [],
  };
  const lines = pastedText.split(/\r?\n/);

  debug.rawAnalysis.totalLines = lines.length;
  debug.rawAnalysis.usesTabSeparator = lines.some(l => l.includes('\t'));

  // Find header row
  const headerIdx = lines.findIndex(l => /Time/i.test(l) && /\bMon\b/i.test(l));
  debug.rawAnalysis.headerLine = headerIdx;
  debug.rawAnalysis.headerContent = headerIdx >= 0 ? lines[headerIdx] : 'Not found';
  
  if (headerIdx === -1) {
    throw new Error(
      "Couldn't find schedule header. Please copy the entire AISIS page including the header row with 'Time Mon Tue Wed Thur Fri Sat'."
    );
  }

  // Group rows into time-slot blocks
  const groups: string[][] = [];
  let current: string[] | null = null;
  let footerLinesIgnored = 0;
  
  const FOOTER_PATTERNS = [
    /Home\s*:/i,
    /Privacy Policy/i,
    /Terms & Conditions/i,
    /Ateneo Integrated Student Information System/i,
    /Contact Us/i,
    /Copyright.*Ateneo/i,
  ];
  
  const isFooterLine = (line: string) => 
    FOOTER_PATTERNS.some(p => p.test(line));

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    
    // Check for footer content
    if (isFooterLine(line)) {
      footerLinesIgnored++;
      continue;
    }
    
    // Skip completely empty lines or lines with only whitespace/tabs
    if (!line.trim() || /^[\t\s]*$/.test(line)) {
      continue;
    }
    
    if (TIME_RX.test(line)) {
      // New time slot starts
      if (current && current.length) groups.push(current);
      current = [line];
    } else if (current) {
      // Continue current time slot
      current.push(line);
    }
  }
  if (current && current.length) groups.push(current);
  
  debug.rawAnalysis.footerLinesIgnored = footerLinesIgnored;

  debug.rawAnalysis.timeSlotGroups = groups.length;

  if (groups.length === 0) {
    throw new Error(
      "Found header but no time slots (e.g., '800-830'). Make sure you copied the full schedule table from AISIS."
    );
  }

  // Parse each time slot
  type Active = { courseCode: string; section: string; room: string; startTime: string; lastEnd: string };
  const active = new Map<number, Active>(); // dayIdx -> active block
  const results: ParsedScheduleBlock[] = [];

  for (const g of groups) {
    const debugEntry: LaneDebug = { rawLines: [], laneEvents: [], lanesOverview: [] };
    const cols = collapseRowGroup(g, debugEntry);
    
    const cellsWithContent: number[] = [];
    cols.forEach((col, idx) => {
      if (col.trim()) cellsWithContent.push(idx);
    });
    
    // Defensive fallback: extract time from raw group if collapseRowGroup didn't return it
    const fallbackTime = (g[0] || '').match(TIME_RX)?.[0] || '';
    const timeCell = cols[0] || fallbackTime;
    
    debug.columnExtractions.push({
      timeSlot: timeCell,
      rawLines: debugEntry.rawLines,
      collapsedColumns: cols,
      cellsWithContent,
      laneEvents: debugEntry.laneEvents,
      lanesOverview: debugEntry.lanesOverview,
      endOfTableTripped: debugEntry.endOfTableTripped,
    });
    
    const tm = timeCell.match(TIME_RX);
    if (!tm) continue;

    const start = toHhMm(tm[1]);
    const end = toHhMm(tm[2]);

    // Process each day column (Mon=0, Tue=1, ..., Sat=5)
    for (let d = 0; d < 6; d++) {
      const cell = cols[d + 1] ?? ""; // cols[0] is Time, cols[1-6] are days
      
      // Track validation in debug
      const cellLines = cell.split("\n").map(s => s.trim()).filter(Boolean);
      const dayName = DAY_LABELS[d];
      const timeRange = `${start}-${end}`;
      
      if (!cell || cellLines.length === 0) {
        debug.validationResults.push({
          dayName,
          timeRange,
          cellContent: '',
          result: 'empty',
          reason: 'No content in cell',
        });
      } else {
        const firstLine = cellLines[0];
        if (!isValidCourseCode(firstLine)) {
          let rejectReason = 'Does not match COURSE_CODE_RX pattern';
          if (COURSE_CODE_RX.test(firstLine)) {
            const matchedReject = REJECT_PATTERNS.find(rx => rx.test(firstLine));
            if (matchedReject) {
              rejectReason = `Matched reject pattern: ${matchedReject.toString()}`;
            }
          }
          debug.validationResults.push({
            dayName,
            timeRange,
            cellContent: firstLine,
            result: 'rejected',
            reason: rejectReason,
          });
        } else {
          debug.validationResults.push({
            dayName,
            timeRange,
            cellContent: firstLine,
            result: 'accepted',
            reason: 'Matched COURSE_CODE_RX and passed reject filters',
            courseCode: firstLine,
          });
        }
      }
      
      const parsed = parseCell(cell, dayName, timeRange);
      const a = active.get(d);

      if (parsed) {
        // Check if this continues the previous block
        if (a && a.courseCode === parsed.courseCode && a.section === parsed.section && timesEqual(a.lastEnd, start)) {
          // Continue existing block
          if (a.room === "TBD" && parsed.room !== "TBD") a.room = parsed.room;
          a.lastEnd = end;
        } else {
          // Close previous block if exists
          if (a) {
            results.push({
              courseCode: a.courseCode,
              section: a.section,
              room: a.room,
              day: d + 1, // 1-based for output
              startTime: a.startTime,
              endTime: a.lastEnd,
            });
          }
          // Start new block
          active.set(d, { 
            courseCode: parsed.courseCode, 
            section: parsed.section, 
            room: parsed.room, 
            startTime: start, 
            lastEnd: end 
          });
        }
      } else {
        // Empty cell - close any active block for this day
        if (a) {
          results.push({
            courseCode: a.courseCode,
            section: a.section,
            room: a.room,
            day: d + 1,
            startTime: a.startTime,
            endTime: a.lastEnd,
          });
          active.delete(d);
        }
      }
    }
  }

  // Close any remaining active blocks
  for (const [d, a] of active.entries()) {
    results.push({
      courseCode: a.courseCode,
      section: a.section,
      room: a.room,
      day: d + 1,
      startTime: a.startTime,
      endTime: a.lastEnd,
    });
  }

  // Detect common issues
  const rejectedAsCellNames = debug.validationResults.filter(v => 
    v.result === 'rejected' && /^[A-Z]{2,3}-[A-Z]?\d+$/.test(v.cellContent)
  );
  if (rejectedAsCellNames.length > 0) {
    debug.commonIssues.push({
      type: 'regex',
      severity: 'warning',
      message: `${rejectedAsCellNames.length} cells rejected as room codes (e.g., SEC-A210)`,
      lineNumbers: [],
    });
  }
  
  const alignmentIssues = debug.columnExtractions.filter(e => 
    e.collapsedColumns.length !== 7
  );
  if (alignmentIssues.length > 0) {
    debug.commonIssues.push({
      type: 'alignment',
      severity: 'error',
      message: `${alignmentIssues.length} time slots have incorrect column count (expected 7)`,
      lineNumbers: [],
    });
  }
  
  if (debug.rawAnalysis.footerLinesIgnored && debug.rawAnalysis.footerLinesIgnored > 0) {
    debug.commonIssues.push({
      type: 'footer',
      severity: 'info',
      message: `${debug.rawAnalysis.footerLinesIgnored} footer lines were ignored (e.g., "Home", "Privacy Policy")`,
      lineNumbers: [],
    });
  }
  
  const overflowLanes = debug.columnExtractions.filter(e => 
    e.laneEvents?.some(ev => ev.note?.includes('overflow'))
  );
  if (overflowLanes.length > 0) {
    debug.commonIssues.push({
      type: 'alignment',
      severity: 'warning',
      message: `${overflowLanes.length} time slots had more than 6 day columns (alignment overflow)`,
      lineNumbers: [],
    });
  }

  const blocks = mergeAdjacent(results);
  
  if (withDebug) {
    return { blocks, debug };
  }
  return blocks;
}
