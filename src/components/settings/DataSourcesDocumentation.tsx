import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Info, FileText, BookMarked, Code, Calendar, Table, Shield, Database, Download, FileCode } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const DATA_SOURCES = [
  { value: 'overview', label: 'Overview', icon: Info },
  { value: 'grades', label: 'Grades Parser', icon: FileText },
  { value: 'curriculum', label: 'Curriculum Parser', icon: BookMarked },
  { value: 'html-curriculum', label: 'HTML Parser', icon: Code },
  { value: 'schedule', label: 'Schedule Parser', icon: Calendar },
  { value: 'schedule-table', label: 'Schedule Table Parser', icon: Table },
];

export default function DataSourcesDocumentation() {
  const [activeSection, setActiveSection] = useState('overview');
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [selectedParserCode, setSelectedParserCode] = useState<{title: string, code: string}>({title: "", code: ""});

  const openCodeDialog = (title: string, code: string) => {
    setSelectedParserCode({title, code});
    setCodeDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Sources & Parsers
          </CardTitle>
          <CardDescription>
            Transparent documentation of all AISIS data scrapers and parsers used in this application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Data Collection Methods</h3>
            <div className="space-y-2">
              {DATA_SOURCES.slice(1).map((source) => {
                return (
                  <div key={source.value} className="flex gap-3">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs shrink-0 h-fit">
                      LOCAL
                    </Badge>
                    <div className="space-y-1 min-w-0">
                      <span className="text-sm font-mono block">{source.label}</span>
                      <p className="text-sm text-muted-foreground">
                        {source.value === 'grades' && 'Parses student grade data from AISIS grade reports'}
                        {source.value === 'curriculum' && 'Extracts curriculum structure from program pages'}
                        {source.value === 'html-curriculum' && 'HTML-based curriculum data extraction'}
                        {source.value === 'schedule' && 'Parses personal class schedules'}
                        {source.value === 'schedule-table' && 'Bulk schedule extraction for admin imports'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Privacy-First Approach</AlertTitle>
        <AlertDescription className="text-justify">
          All parsers process data locally in your browser. No AISIS credentials are stored. You manually paste data, and parsers extract only the structure.
        </AlertDescription>
      </Alert>

      <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4">
        <Select value={activeSection} onValueChange={setActiveSection}>
          <SelectTrigger className="w-[240px]">
            <SelectValue>
              {DATA_SOURCES.find(section => section.value === activeSection) && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = DATA_SOURCES.find(section => section.value === activeSection)!.icon;
                    return <Icon className="h-4 w-4" />;
                  })()}
                  <span>{DATA_SOURCES.find(section => section.value === activeSection)!.label}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DATA_SOURCES.map(({ value, label, icon: Icon }) => (
              <SelectItem key={value} value={value}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Transparency Overview</CardTitle>
              <CardDescription>How we collect and process data from AISIS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3 text-lg">Our Privacy-First Philosophy</h4>
                <div className="space-y-3 text-sm">
                  <p className="text-justify">
                    This application uses specialized parsers to extract structured data from AISIS (Ateneo Integrated Student Information System). 
                    We believe in complete transparency about how your data is collected and used.
                  </p>
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                      <div>
                        <p className="font-medium">No Automated Scraping</p>
                        <p className="text-muted-foreground">We never automatically access AISIS or store your credentials</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Database className="h-4 w-4 mt-0.5 text-blue-600" />
                      <div>
                        <p className="font-medium">Local Processing</p>
                        <p className="text-muted-foreground">All parsing happens in your browser or our secure backend</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Download className="h-4 w-4 mt-0.5 text-purple-600" />
                      <div>
                        <p className="font-medium">Manual Data Import</p>
                        <p className="text-muted-foreground">You manually paste data from AISIS - you control what's imported</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">How It Works</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">1</div>
                    <div>
                      <p className="font-medium">You visit an AISIS page</p>
                      <p className="text-muted-foreground">Log into AISIS normally (grades, schedule, curriculum, etc.)</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">2</div>
                    <div>
                      <p className="font-medium">You copy the data</p>
                      <p className="text-muted-foreground">Select and copy the text or HTML from the AISIS page</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">3</div>
                    <div>
                      <p className="font-medium">You paste it here</p>
                      <p className="text-muted-foreground">Paste into the appropriate import dialog in our app</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">4</div>
                    <div>
                      <p className="font-medium">Parser extracts structure</p>
                      <p className="text-muted-foreground">Our parser identifies and extracts only the relevant data fields</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">5</div>
                    <div>
                      <p className="font-medium">Data saved to your account</p>
                      <p className="text-muted-foreground">Structured data is saved to your personal database</p>
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-justify">
                  Select a specific parser from the dropdown above to see detailed technical documentation, including input formats, output structures, and example transformations.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">LOCAL</Badge>
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  AISIS Grades Parser
                </CardTitle>
              </div>
              <CardDescription>Extracts student grade data from AISIS grade reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => openCodeDialog("Grades Parser (aisisParser.ts)", GRADES_PARSER_CODE)}
                variant="outline"
                className="w-full"
              >
                <FileCode className="mr-2 h-4 w-4" />
                View Parser Source Code
              </Button>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">What It Does</h4>
                <p className="text-sm text-muted-foreground text-justify">
                  Parses tab-separated or formatted text from your AISIS "My Grades" page to extract course codes, 
                  titles, units, grades, and calculates QPI values.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Where to Find the Data</h4>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Log into AISIS</li>
                  <li>Navigate to "Student" → "My Grades"</li>
                  <li>Select the text from the grades table</li>
                  <li>Copy (Ctrl+C / Cmd+C)</li>
                  <li>Paste into the "Import from AISIS" dialog in the Grades page</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Data Extracted</h4>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">school_year</code>
                    <span className="text-muted-foreground">Academic year (e.g., "2024-2025")</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">semester</code>
                    <span className="text-muted-foreground">Semester number (1, 2, 3)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">course_code</code>
                    <span className="text-muted-foreground">Course code (e.g., "CS21")</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">course_title</code>
                    <span className="text-muted-foreground">Full course name</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">units</code>
                    <span className="text-muted-foreground">Credit units (numeric)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">grade</code>
                    <span className="text-muted-foreground">Letter grade (A, B+, etc.)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">qpi_value</code>
                    <span className="text-muted-foreground">Numeric QPI (calculated)</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Example Transformation</h4>
                <p className="text-sm text-muted-foreground mb-2">Input (pasted from AISIS):</p>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`2024-2025\t1\tCS21\tComputer Science 1\t3\tA`}
                </pre>
                <p className="text-sm text-muted-foreground mb-2 mt-3">Output (parsed object):</p>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "school_year": "2024-2025",
  "semester": 1,
  "course_code": "CS21",
  "course_title": "Computer Science 1",
  "units": 3,
  "grade": "A",
  "qpi_value": 4.0
}`}
                </pre>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Privacy Note</AlertTitle>
                <AlertDescription>
                  Grade data is stored in your personal account database and never shared with third parties. 
                  QPI calculations happen locally based on the standard Ateneo grading scale.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="curriculum" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">LOCAL</Badge>
                <CardTitle className="text-xl flex items-center gap-2">
                  <BookMarked className="h-5 w-5" />
                  AISIS Curriculum Parser
                </CardTitle>
              </div>
              <CardDescription>Extracts official curriculum structure from AISIS program pages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => openCodeDialog("Curriculum Parser (aisisProgramParser.ts)", CURRICULUM_PARSER_CODE)}
                variant="outline"
                className="w-full"
              >
                <FileCode className="mr-2 h-4 w-4" />
                View Parser Source Code
              </Button>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">What It Does</h4>
                <p className="text-sm text-muted-foreground">
                  Parses the text structure of official curriculum pages to extract program information, 
                  required courses organized by year and semester, course categories, prerequisites, and version information.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Where to Find the Data</h4>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Log into AISIS</li>
                  <li>Navigate to "View Official Curriculum"</li>
                  <li>Select your program from the dropdown</li>
                  <li>Select all text on the curriculum page</li>
                  <li>Copy and paste into the Program Tracker import dialog</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Data Extracted</h4>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">program_name</code>
                    <span className="text-muted-foreground">Full program name</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">program_code</code>
                    <span className="text-muted-foreground">Abbreviated code (e.g., "BS-CS")</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">version</code>
                    <span className="text-muted-foreground">Curriculum version/year</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">terms[]</code>
                    <span className="text-muted-foreground">Semesters with courses</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">courses[]</code>
                    <span className="text-muted-foreground">Course code, title, units, category</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">prerequisites</code>
                    <span className="text-muted-foreground">Prerequisite expressions</span>
                  </div>
                </div>
              </div>

              <Separator />

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Advanced Features</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>This parser handles complex curriculum structures including:</p>
                  <ul className="list-disc list-inside text-xs mt-2 space-y-1">
                    <li>Honors programs with -H suffix</li>
                    <li>Track variations (e.g., AB ChnS-AC)</li>
                    <li>Multi-year programs (4, 4.5, 5 years)</li>
                    <li>Elective placeholders with auto-generated codes</li>
                    <li>Version detection (year and semester)</li>
                    <li>Intersession and special term handling</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Privacy Note</AlertTitle>
                <AlertDescription>
                  Curriculum data is stored in your account for progress tracking. The parser never transmits data externally during parsing.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="html-curriculum" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">LOCAL</Badge>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  AISIS HTML Curriculum Parser
                </CardTitle>
              </div>
              <CardDescription>Alternative HTML-based curriculum parser</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => openCodeDialog("HTML Curriculum Parser (aisisHtmlParser.ts)", HTML_PARSER_CODE)}
                variant="outline"
                className="w-full"
              >
                <FileCode className="mr-2 h-4 w-4" />
                View Parser Source Code
              </Button>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">What It Does</h4>
                <p className="text-sm text-muted-foreground">
                  Alternative parser that processes the raw HTML structure of AISIS curriculum pages. 
                  Uses DOM parsing to extract program information and course data from HTML tables.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Where to Find the Data</h4>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Log into AISIS</li>
                  <li>Navigate to "View Official Curriculum"</li>
                  <li>Select your program</li>
                  <li>Right-click on the page and "View Page Source" or "Inspect"</li>
                  <li>Copy the HTML code</li>
                  <li>Paste into the HTML import dialog</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Key Features</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Code className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">DOM-Based Parsing</p>
                      <p className="text-muted-foreground text-xs">Uses browser DOM parser for accurate HTML structure extraction</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Table className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Table Recognition</p>
                      <p className="text-muted-foreground text-xs">Identifies year sections and semester tables automatically</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Content Filtering</p>
                      <p className="text-muted-foreground text-xs">Filters out navigation, header, and footer elements</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>When to Use This Parser</AlertTitle>
                <AlertDescription>
                  Use this parser when the plain-text parser fails or when you need more accurate extraction from complex HTML structures. 
                  It's particularly useful for programs with nested terms or special formatting.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">LOCAL</Badge>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  AISIS Schedule Parser
                </CardTitle>
              </div>
              <CardDescription>Extracts personal class schedule from AISIS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => openCodeDialog("Schedule Parser (aisisScheduleParser.ts)", SCHEDULE_PARSER_CODE)}
                variant="outline"
                className="w-full"
              >
                <FileCode className="mr-2 h-4 w-4" />
                View Parser Source Code
              </Button>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">What It Does</h4>
                <p className="text-sm text-muted-foreground">
                  Parses your personal AISIS "My Class Schedule" page to extract course codes, sections, rooms, 
                  day/time information, and creates schedule blocks for the visual calendar.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Where to Find the Data</h4>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Log into AISIS</li>
                  <li>Navigate to "Student" → "My Class Schedule"</li>
                  <li>Select the entire schedule table (including header with "Time Mon Tue Wed...")</li>
                  <li>Copy (Ctrl+C / Cmd+C)</li>
                  <li>Paste into the Schedule Builder import dialog</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Data Extracted</h4>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">courseCode</code>
                    <span className="text-muted-foreground">Course identifier (e.g., "CS 21")</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">section</code>
                    <span className="text-muted-foreground">Section code (e.g., "X")</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">room</code>
                    <span className="text-muted-foreground">Location (e.g., "SEC-A210")</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">day</code>
                    <span className="text-muted-foreground">Day number (1=Mon ... 6=Sat)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">startTime</code>
                    <span className="text-muted-foreground">Start time (HH:MM format)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">endTime</code>
                    <span className="text-muted-foreground">End time (HH:MM format)</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Advanced Features</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Time Block Merging</p>
                      <p className="text-muted-foreground text-xs">Automatically merges adjacent time slots for the same course</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Validation</p>
                      <p className="text-muted-foreground text-xs">Validates course codes and rejects false positives (room numbers, etc.)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Debug Information</p>
                      <p className="text-muted-foreground text-xs">Provides detailed debugging info for troubleshooting parse issues</p>
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Privacy Note</AlertTitle>
                <AlertDescription>
                  Your schedule is processed locally and stored only in your account. No schedule data is transmitted to external services.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule-table" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">LOCAL</Badge>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Table className="h-5 w-5" />
                  AISIS Schedule Table Parser
                </CardTitle>
              </div>
              <CardDescription>Bulk extraction of department schedules for admin imports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => openCodeDialog("Schedule Table Parser (aisisScheduleTableParser.ts)", SCHEDULE_TABLE_PARSER_CODE)}
                variant="outline"
                className="w-full"
              >
                <FileCode className="mr-2 h-4 w-4" />
                View Parser Source Code
              </Button>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">What It Does</h4>
                <p className="text-sm text-muted-foreground">
                  Parses entire department schedule tables from AISIS for bulk imports by administrators. 
                  Extracts detailed information for all sections including instructor, capacity, language, and delivery mode.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Where to Find the Data (Admin Only)</h4>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Log into AISIS with admin privileges</li>
                  <li>Navigate to department schedule view</li>
                  <li>Select term and department</li>
                  <li>Copy the entire schedule table or page HTML</li>
                  <li>Paste into the Admin Schedule Import tool</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Data Extracted</h4>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">subject_code</code>
                    <span className="text-muted-foreground">Course code with qualifiers (e.g., "NSTP 11(CWTS)")</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">section</code>
                    <span className="text-muted-foreground">Section identifier</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">course_title</code>
                    <span className="text-muted-foreground">Full course name</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">instructor</code>
                    <span className="text-muted-foreground">Faculty name</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">time_pattern</code>
                    <span className="text-muted-foreground">Schedule pattern (e.g., "M-TH 0800-0930")</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">max_capacity</code>
                    <span className="text-muted-foreground">Maximum students</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">language</code>
                    <span className="text-muted-foreground">Instruction language (ENG, FIL, or bilingual "E / F")</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">delivery_mode</code>
                    <span className="text-muted-foreground">Mode (ONSITE, HYBRID, etc.)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <code className="bg-muted px-2 py-1 rounded">department</code>
                    <span className="text-muted-foreground">Owning department</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Advanced Features</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Table className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Multi-Format Support</p>
                      <p className="text-muted-foreground text-xs">Handles both HTML table and plain-text formats</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Auto-Detection</p>
                      <p className="text-muted-foreground text-xs">Automatically detects term code and department from HTML</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Complex Time Patterns</p>
                      <p className="text-muted-foreground text-xs">Parses multiple sessions (e.g., "SAT 0800-1200; W 0800-1200")</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Code className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Subject Qualifiers</p>
                      <p className="text-muted-foreground text-xs">Preserves course qualifiers like (CWTS), (ROTC), (LTS) in subject codes</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <BookMarked className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Bilingual Language Support</p>
                      <p className="text-muted-foreground text-xs">Handles both standard codes (ENG, FIL) and bilingual formats (E / F)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Database className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">Detailed Metadata</p>
                      <p className="text-muted-foreground text-xs">Provides parse statistics and skipped row tracking</p>
                    </div>
                  </div>
                </div>
              </div>

              <Alert variant="destructive">
                <Shield className="h-4 w-4" />
                <AlertTitle>Admin Access Only</AlertTitle>
                <AlertDescription>
                  This parser is designed for bulk schedule imports by administrators. Regular students should use the personal schedule parser instead.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Code Viewer Dialog */}
      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent className="max-w-5xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedParserCode.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-full w-full rounded-md border">
            <pre className="p-4 text-xs font-mono">
              <code>{selectedParserCode.code}</code>
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Parser source code constants - actual source code from parser files
const GRADES_PARSER_CODE = `import { getQPIValue } from "./qpiCalculations";

export interface ParsedCourse {
  school_year: string;
  semester: string;
  course_code: string;
  course_title: string;
  units: number;
  grade: string;
  qpi_value: number | null;
}

export function parseAISISData(text: string): ParsedCourse[] {
  const lines = text.trim().split('\\n').filter(line => line.trim());
  const courses: ParsedCourse[] = [];
  
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
      if (line.includes('\\t')) {
        const columns = line.split('\\t').map(c => c.trim()).filter(Boolean);
        
        // Expected columns: [School Year, Sem, Course, Subject Code, Title, Units, Grade]
        if (columns.length >= 7) {
          const schoolYear = columns[0];
          const semesterRaw = columns[1];
          const courseCode = columns[3]; // "Subject Code" column
          const courseTitle = columns[4]; // "Course Title" column
          const unitsRaw = columns[5];
          const grade = columns[6]; // "Advisory Grade" column
          
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
      const schoolYearPattern = /(\\d{4}[-/]\\d{4}|\\d{4}[-/]\\d{2})/;
      const semesterPattern = /(1st\\s+Sem|2nd\\s+Sem|Intercession|Summer)/i;
      const courseCodePattern = /\\b([A-Z]{2,6})\\s*(\\d+(?:\\.\\d+)?)\\d{4}\\b/;
      const unitsPattern = /\\b(\\d+(?:\\.\\d+)?)\\b/g;
      const gradePattern = /\\b([A-F][+-]?|[IWSDAU]{1,3})\\b/;

      const schoolYearMatch = line.match(schoolYearPattern);
      const semesterMatch = line.match(semesterPattern);
      const courseCodeMatch = line.match(courseCodePattern);
      const gradeMatch = line.match(gradePattern);

      if (courseCodeMatch && gradeMatch) {
        const schoolYear = schoolYearMatch?.[0] || 'Unknown';
        const semester = semesterMatch?.[0] || 'Unknown';
        const courseCode = courseCodeMatch[0];
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

  return courses;
}

function extractTitle(line: string, courseCode: string): string {
  const parts = line.split(courseCode);
  if (parts.length > 1) {
    const afterCode = parts[1];
    // Remove tabs and extra whitespace, extract alphabetic title
    const cleaned = afterCode.replace(/\\t+/g, ' ').trim();
    const titleMatch = cleaned.match(/([A-Za-z\\s:&-]+)/);
    if (titleMatch) {
      return titleMatch[0].trim().replace(/\\s+/g, ' ');
    }
  }
  return 'Course Title';
}`;

const CURRICULUM_PARSER_CODE = `// Full source: src/utils/aisisProgramParser.ts (687 lines)
// This is a complex parser - showing key interfaces and main parsing function

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

export interface ParseResult {
  program_name: string;
  program_code: string | null;
  track_code: string | null;  // Extracted track suffix (e.g., "AC", "H")
  version: string;
  school: string;
  terms: ParsedTerm[];
  errors: ParseError[];
}

// Parses AISIS curriculum text to extract program structure
export function parseAISISProgramData(text: string): ParseResult {
  const lines = text.trim().split('\\n').filter(line => line.trim());
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
  let hasSeenRegularSemesterInYear = false;
  
  // Main parsing logic processes lines to extract:
  // - Program name and code from header (e.g., "(AB AM) BACHELOR OF ARTS...")
  // - Track code extraction (e.g., "AB ChnS-AC" → base: "AB ChnS", track: "AC")
  // - Honors program detection (keeps -H as part of base code)
  // - Version information (e.g., "(Ver Sem 1, Ver Year 2020)")
  // - Year level headers (supports unlimited years: First through Tenth Year, plus decimal years)
  // - Semester headers (First Semester, Second Semester, Intersession)
  // - Course rows with: catalog_no, title, units, prerequisites, category
  // - Duplicate course detection and deduplication
  // - Placeholder generation for electives (e.g., "ME ELECTIVE 1" → "ME1")
  // - Handles special cases: tracks, honors programs, multi-year curricula, mislabeled intersessions
  
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

// Key helper functions:
// - parseCodeAndTrack(): Extracts base code and track suffix with honors program logic
// - parseVersion(): Extracts year and semester from version label (supports 2-digit years)
// - parseYearLevel(): Supports unlimited year levels (First through Tenth, plus decimals)
// - inferTrackName(): Maps track codes to full names (AC, B, S, DA, CS, GD)
// - normalizeCourseCode(): Cleans and standardizes course codes, preserves dots (MATH 31.1)
// - isPlaceholderCourse(): Detects elective placeholders
// - generatePlaceholderCode(): Creates codes for elective slots with smart numbering
// - inferSchool(): Maps program keywords to school names`;

const HTML_PARSER_CODE = `import { ParsedCourse, ParsedTerm, ParseError, ParseResult } from "./aisisProgramParser";

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
    const codeMatch = optionText.match(/^\\(([^)]+)\\)/);
    if (codeMatch) {
      programCode = codeMatch[1].trim();
    }
    
    // Extract program name - between code and version
    let cleanedText = optionText.replace(/^\\([^)]+\\)\\s*/, ''); // Remove code at start
    cleanedText = cleanedText.replace(/\\(Ver[^)]+\\)\\s*$/, ''); // Remove version at end
    programName = cleanedText.trim();
    
    // Extract version from text like "(Ver Sem 1, Ver Year 2024)"
    const versionMatch = optionText.match(/\\(Ver[^)]+\\)/);
    if (versionMatch) {
      version = versionMatch[0];
    }
  }
  
  if (!programName) {
    errors.push({
      type: 'error',
      message: 'Could not find program name in HTML',
    });
  }
  
  // Find all year sections (.text06 elements)
  const yearHeaders = Array.from(doc.querySelectorAll('.text06'));
  
  yearHeaders.forEach(yearHeader => {
    const yearText = yearHeader.textContent?.trim() || '';
    const yearLevel = parseOrdinalYear(yearText);
    
    if (!yearLevel) return;
    
    // Get all sibling rows after the year header until we hit the next year
    let currentRow = yearHeader.closest('tr')?.nextElementSibling as HTMLElement | null;
    const semesterTables: HTMLTableElement[] = [];
    
    // Collect all tables in rows following this year header
    while (currentRow) {
      if (currentRow.querySelector('.text06')) break;
      
      const tables = currentRow.querySelectorAll('table[border="0"][cellpadding="2"]');
      tables.forEach(table => {
        if (!isNavigationOrFooterElement(table)) {
          const hasHeader = table.querySelector('.text04');
          if (hasHeader) {
            semesterTables.push(table as HTMLTableElement);
          }
        }
      });
      
      currentRow = currentRow.nextElementSibling as HTMLElement | null;
    }
    
    // Process each semester table (extracts courses from HTML table structure)
    // ...
  });
  
  return {
    program_name: programName,
    program_code: programCode,
    version: version,
    school: school,
    terms: terms,
    errors: errors,
  };
}`;

const SCHEDULE_PARSER_CODE = `// Full source: src/utils/aisisScheduleParser.ts (628 lines)
// Complex parser for personal AISIS schedules - showing key types and flow

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
    timeSlotGroups: number;
    usesTabSeparator: boolean;
  };
  columnExtractions: Array<{
    timeSlot: string;
    rawLines: string[];
    collapsedColumns: string[];
    cellsWithContent: number[];
  }>;
  validationResults: Array<{
    dayName: string;
    timeRange: string;
    cellContent: string;
    result: 'accepted' | 'rejected' | 'empty';
    reason: string;
  }>;
}

export function parseAISISSchedule(pastedText: string): ParsedScheduleBlock[] {
  const lines = pastedText.split(/\\r?\\n/);
  
  // 1. Find header row with "Time Mon Tue Wed Thur Fri Sat"
  const headerIdx = lines.findIndex(l => /Time/i.test(l) && /\\bMon\\b/i.test(l));
  
  // 2. Group rows into time-slot blocks (each starting with time like "0800-0930")
  const groups: string[][] = [];
  let current: string[] | null = null;
  
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    
    if (TIME_RX.test(line)) {
      // New time slot
      if (current && current.length) groups.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  
  // 3. Collapse each multi-line group into 7 columns (Time + 6 days)
  // Uses lane-based algorithm to handle courses spanning multiple lines
  
  // 4. Parse each day column to extract: course code, section, room
  // Validates course codes with regex patterns to filter out room names
  
  // 5. Merge adjacent time blocks for the same course
  const results: ParsedScheduleBlock[] = [];
  
  // ... (complex multi-line aggregation and validation logic)
  
  return mergeAdjacent(results);
}

// Key validation: Course codes must match pattern like "MATH 10", "CS 21"
// Rejects patterns like "SEC-A210" (room codes), "F-113" (building codes)
const COURSE_CODE_RX = /^[A-Z][A-Za-z]*(?:\\s+[A-Z][A-Za-z]*)*\\s+\\d+(?:\\.\\d+)?[A-Za-z]?$/;`;

const SCHEDULE_TABLE_PARSER_CODE = `// Full source: src/utils/aisisScheduleTableParser.ts (1168 lines)
// Bulk schedule parser for admin imports - showing key interfaces

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
  days_of_week: number[];  // [1,3,4] = Mon, Wed, Thu
  start_time: string;  // "HH:MM:SS"
  end_time: string;    // "HH:MM:SS"
  department: string;
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

/**
 * Parse AISIS schedule table HTML or plain text
 * Supports both HTML table format and multi-line plain-text format
 */
export function parseAISISScheduleTable(
  htmlText: string,
  termCode?: string,
  departmentOverride?: string
): ParseResult {
  const lines = htmlText.split('\\n');
  
  // Auto-detect term code (e.g., "2024-2025-First Semester")
  const detectedTerm = detectTermCode(lines);
  
  // Auto-detect department from HTML structure
  const detectedDept = detectDepartment(lines);
  
  // Use provided values, fallback to detected values
  const finalTermCode = termCode || detectedTerm;
  const finalDepartment = departmentOverride || detectedDept;
  
  // Multi-line reconstruction for plain text format
  // Handles course codes with parenthetical qualifiers (e.g., "NSTP 11(ROTC)")
  const rows = reconstructPlainTextRows(lines);
  
  const schedules: ParsedAISISSchedule[] = [];
  
  for (const row of rows) {
    // Parse time pattern (handles complex patterns)
    // Examples: "M-TH 0800-0930", "SAT 0800-1200; W 0800-1200", "TBA"
    const timeSegments = parseTimeSegments(row.time_pattern);
    
    if (timeSegments.length === 0) {
      // TBA or TUTORIAL - create a single entry without time info
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
        delivery_mode: null,
        remarks: row.remarks,
        days_of_week: [],
        start_time: "00:00:00",
        end_time: "00:00:00",
        department: shouldExtractFromSubjectCode(finalDepartment) 
          ? extractDepartment(row.subject_code) 
          : finalDepartment
      });
    } else {
      // Create one schedule entry per time segment (handles multi-session courses)
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
          delivery_mode: segment.deliveryMode,  // "(FULLY ONSITE)", "(~)", etc.
          remarks: row.remarks,
          days_of_week: segment.days,  // [1,4] = Mon, Thu
          start_time: segment.startTime,  // "08:00:00"
          end_time: segment.endTime,      // "09:30:00"
          department: shouldExtractFromSubjectCode(finalDepartment) 
            ? extractDepartment(row.subject_code) 
            : finalDepartment
        });
      }
    }
  }
  
  return { schedules, errors: [], metadata };
}

// Key helper functions:
// - detectTermCode(): Finds term in format "2024-2025-First Semester"
// - detectDepartment(): Extracts department from HTML structure or subject codes
// - reconstructPlainTextRows(): Handles multi-line plain text with continuation lines
// - parseTimeSegments(): Parses complex time patterns with semicolon-separated sessions
//   * Day mapping: M=1, T=2, W=3, TH=4, F=5, SAT=6, SUN=7
//   * IMPORTANT: "M-TH" means M AND TH (not Mon through Thu), hyphen is a separator
//   * Supports delivery modes like "(FULLY ONSITE)", "(~)"
// - extractDepartment(): Maps subject code prefixes to department names`;
