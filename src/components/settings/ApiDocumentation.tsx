import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Code, Database, Info, BookOpen, Calendar, GraduationCap, BookMarked, BarChart3, Copy } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
const API_SECTIONS = [{
  value: 'getting-started',
  label: 'Getting Started',
  icon: Info
}, {
  value: 'courses',
  label: 'Courses',
  icon: BookOpen
}, {
  value: 'schedules',
  label: 'Schedules',
  icon: Calendar
}, {
  value: 'programs',
  label: 'Programs',
  icon: GraduationCap
}, {
  value: 'curriculum',
  label: 'Curriculum',
  icon: BookMarked
}, {
  value: 'stats',
  label: 'Statistics',
  icon: BarChart3
}];
const API_ENDPOINTS = [{
  name: 'Courses',
  path: '/api-courses',
  description: 'Search and retrieve course information',
  icon: BookOpen
}, {
  name: 'Schedules',
  path: '/api-schedules',
  description: 'Query available class schedules',
  icon: Calendar
}, {
  name: 'Programs',
  path: '/api-programs',
  description: 'Browse academic programs',
  icon: GraduationCap
}, {
  name: 'Curriculum',
  path: '/api-curriculum',
  description: 'Get detailed curriculum requirements',
  icon: Database
}, {
  name: 'Statistics',
  path: '/api-stats',
  description: 'Get aggregate statistics',
  icon: BarChart3
}];
export default function ApiDocumentation() {
  const {
    toast
  } = useToast();
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const [activeSection, setActiveSection] = useState('getting-started');
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: 'Base URL copied successfully'
    });
  };
  return <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Public API Endpoints
          </CardTitle>
          <CardDescription>
            Read-only API access to course, schedule, and program data. No authentication required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Base URL Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL</label>
            <div className="flex gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono block overflow-x-auto whitespace-nowrap max-w-full">
                {baseUrl}
              </code>
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(baseUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Endpoints List */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Available Endpoints</h3>
            <div className="space-y-2">
              {API_ENDPOINTS.map(endpoint => <div key={endpoint.path} className="flex gap-3">
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 text-xs shrink-0 h-fit">
                    GET
                  </Badge>
                  <div className="space-y-1 min-w-0">
                    <code className="text-sm font-mono block">{endpoint.path}</code>
                    <p className="text-sm text-muted-foreground">
                      {endpoint.description}
                    </p>
                  </div>
                </div>)}
            </div>
          </div>
        </CardContent>
      </Card>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Public API</AlertTitle>
        <AlertDescription>
          All endpoints are publicly accessible and return JSON. No authentication required.
        </AlertDescription>
      </Alert>

      <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-4">
        <Select value={activeSection} onValueChange={setActiveSection}>
          <SelectTrigger className="w-[240px]">
            <SelectValue>
              {API_SECTIONS.find(section => section.value === activeSection) && <div className="flex items-center gap-2">
                  {(() => {
                const Icon = API_SECTIONS.find(section => section.value === activeSection)!.icon;
                return <Icon className="h-4 w-4" />;
              })()}
                  <span>{API_SECTIONS.find(section => section.value === activeSection)!.label}</span>
                </div>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {API_SECTIONS.map(({
            value,
            label,
            icon: Icon
          }) => <SelectItem key={value} value={value}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </div>
              </SelectItem>)}
          </SelectContent>
        </Select>

        <TabsContent value="getting-started" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Getting Started with the API</CardTitle>
              <CardDescription>Quick example for beginners - no setup required</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3 text-lg">Try Your First API Call</h4>
                <p className="text-sm text-muted-foreground mb-4 text-justify">
                  Copy this code and paste it into your browser's console (press F12, then click "Console" tab) to see live course data:
                </p>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {`fetch('${baseUrl}/api-courses?limit=5')
  .then(response => response.json())
  .then(data => {
    console.log('📚 Found', data.meta.total, 'courses!');
    console.log('First 5 courses:', data.data);
  });`}
                </pre>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Understanding the Response</h4>
                <div className="space-y-2 text-sm">
                  <p><code className="bg-muted px-2 py-1 rounded">data.success</code> - Whether the request was successful (true/false)</p>
                  <p><code className="bg-muted px-2 py-1 rounded">data.data</code> - Array of results (courses, schedules, etc.)</p>
                  <p><code className="bg-muted px-2 py-1 rounded">data.meta</code> - Pagination info (total count, page, limit)</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Common Use Cases</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">🔍 Search for CS courses</label>
                    <div className="flex gap-2">
                      <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono block overflow-x-auto whitespace-nowrap max-w-full">
                        {baseUrl}/api-courses?search=CS
                      </code>
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(`${baseUrl}/api-courses?search=CS`)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">📅 Get current term schedules</label>
                    <div className="flex gap-2">
                      <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono block overflow-x-auto whitespace-nowrap max-w-full">
                        {baseUrl}/api-schedules?term=20253
                      </code>
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(`${baseUrl}/api-schedules?term=20253`)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">🎓 Browse all programs</label>
                    <div className="flex gap-2">
                      <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono block overflow-x-auto whitespace-nowrap max-w-full">
                        {baseUrl}/api-programs
                      </code>
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(`${baseUrl}/api-programs`)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Select a specific endpoint from the dropdown above to see detailed documentation with all available parameters.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">GET</Badge>
                <CardTitle className="text-xl">/api-courses</CardTitle>
              </div>
              <CardDescription>Search and retrieve course information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <div className="space-y-2 text-sm">
                  <div><code className="bg-muted px-2 py-1 rounded">search</code> - Search by course code or title</div>
                  <div><code className="bg-muted px-2 py-1 rounded">school</code> - Filter by school code</div>
                  <div><code className="bg-muted px-2 py-1 rounded">units</code> - Filter by unit count</div>
                  <div><code className="bg-muted px-2 py-1 rounded">category</code> - Filter by category tag</div>
                  <div><code className="bg-muted px-2 py-1 rounded">limit</code> - Results per page (default: 50, max: 100)</div>
                  <div><code className="bg-muted px-2 py-1 rounded">offset</code> - Pagination offset (default: 0)</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Example Request
                </h4>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {`fetch('${baseUrl}/api-courses?search=CS&limit=20')
  .then(res => res.json())
  .then(data => console.log(data))`}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Example Response</h4>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {`{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "course_code": "CS21",
      "course_title": "Computer Science 1",
      "units": 3,
      "prereq_expr": null,
      "category_tags": ["core"],
      "schools": {
        "name": "School of Science",
        "code": "SOSE"
      }
    }
  ],
  "meta": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "page": 1
  }
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">GET</Badge>
                <CardTitle className="text-xl">/api-schedules</CardTitle>
              </div>
              <CardDescription>Query available class schedules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <div className="space-y-2 text-sm">
                  <div><code className="bg-muted px-2 py-1 rounded">term</code> - Term code (format: YYYYT, e.g., 20253)</div>
                  <div><code className="bg-muted px-2 py-1 rounded">department</code> - Filter by department</div>
                  <div><code className="bg-muted px-2 py-1 rounded">course</code> - Filter by course code prefix</div>
                  <div><code className="bg-muted px-2 py-1 rounded">instructor</code> - Filter by instructor name</div>
                  <div><code className="bg-muted px-2 py-1 rounded">room</code> - Filter by room</div>
                  <div><code className="bg-muted px-2 py-1 rounded">days</code> - Filter by days (0=Sun, 6=Sat, comma-separated)</div>
                  <div><code className="bg-muted px-2 py-1 rounded">limit</code> - Results per page (default: 50, max: 200)</div>
                  <div><code className="bg-muted px-2 py-1 rounded">offset</code> - Pagination offset</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Example Request
                </h4>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {`fetch('${baseUrl}/api-schedules?term=20253&department=CS')
  .then(res => res.json())
  .then(data => console.log(data))`}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Example Response</h4>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {`{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "subject_code": "CS21",
      "section": "A",
      "course_title": "Computer Science 1",
      "instructor": "Prof. Smith",
      "room": "V201",
      "days_of_week": [1, 3, 5],
      "start_time": "09:00:00",
      "end_time": "10:30:00",
      "units": 3,
      "term_code": "20253"
    }
  ],
  "meta": { "total": 45, "limit": 50, "offset": 0 }
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">GET</Badge>
                <CardTitle className="text-xl">/api-programs</CardTitle>
              </div>
              <CardDescription>Browse academic programs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <div className="space-y-2 text-sm">
                  <div><code className="bg-muted px-2 py-1 rounded">school</code> - Filter by school code</div>
                  <div><code className="bg-muted px-2 py-1 rounded">search</code> - Search by program name or code</div>
                  <div><code className="bg-muted px-2 py-1 rounded">limit</code> - Results per page (default: 50, max: 100)</div>
                  <div><code className="bg-muted px-2 py-1 rounded">offset</code> - Pagination offset</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Example Request
                </h4>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {`// List all programs
fetch('${baseUrl}/api-programs?school=SOSE')
  .then(res => res.json())
  .then(data => console.log(data))

// Get specific program by ID
fetch('${baseUrl}/api-programs/{program_id}')
  .then(res => res.json())
  .then(data => console.log(data))`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="curriculum" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">GET</Badge>
                <CardTitle className="text-xl">/api-curriculum/:version_id</CardTitle>
              </div>
              <CardDescription>Get detailed curriculum requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Path Parameters</h4>
                <div className="space-y-2 text-sm">
                  <div><code className="bg-muted px-2 py-1 rounded">version_id</code> - UUID of the curriculum version</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Example Request
                </h4>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {`fetch('${baseUrl}/api-curriculum/{version_id}')
  .then(res => res.json())
  .then(data => console.log(data))`}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Response Includes</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Curriculum version details</li>
                  <li>Program and school information</li>
                  <li>Requirement groups with rules</li>
                  <li>Course details for each requirement</li>
                  <li>Prerequisites and unit requirements</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">GET</Badge>
                <CardTitle className="text-xl">/api-stats/:type</CardTitle>
              </div>
              <CardDescription>Get aggregate statistics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Available Endpoints</h4>
                <div className="space-y-2 text-sm">
                  <div><code className="bg-muted px-2 py-1 rounded">/api-stats/overview</code> - Overall counts</div>
                  <div><code className="bg-muted px-2 py-1 rounded">/api-stats/instructors</code> - Top instructors by section count</div>
                  <div><code className="bg-muted px-2 py-1 rounded">/api-stats/departments</code> - Department offering counts</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <div className="space-y-2 text-sm">
                  <div><code className="bg-muted px-2 py-1 rounded">term</code> - Filter by term code (optional)</div>
                  <div><code className="bg-muted px-2 py-1 rounded">limit</code> - Results limit (default: 20, max: 100)</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Example Request
                </h4>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {`fetch('${baseUrl}/api-stats/overview')
  .then(res => res.json())
  .then(data => console.log(data))`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Error Handling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4">All errors return a consistent format:</p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
          {`{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "Descriptive error message",
    "details": {}
  }
}`}
          </pre>
          <div className="mt-4 space-y-2 text-sm">
            <p><strong>Common status codes:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>200 - Success</li>
              <li>400 - Bad Request (invalid parameters)</li>
              <li>404 - Not Found</li>
              <li>500 - Internal Server Error</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </>;
}
