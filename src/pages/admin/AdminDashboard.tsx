import { useState, useEffect } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { BookOpen, GraduationCap, BookMarked, BarChart3, CheckCircle2, Building2, Database, ArrowLeftRight, Calendar, FileText, FileSearch } from 'lucide-react';
import { ProgramsManager } from './ProgramsManager';
import { CoursesManager } from './CoursesManager';
import CurriculumManager from './CurriculumManager';
import { AdminStatistics } from './AdminStatistics';
import { ValidationDashboard } from './ValidationDashboard';
import { SchoolsManager } from './SchoolsManager';
import { DataManagement } from './DataManagement';
import { EquivalenciesManager } from './EquivalenciesManager';
import { SchedulesManager } from './SchedulesManager';
import { AdminLogs } from '@/components/admin/AdminLogs';
import ScrapedDataReview from './ScrapedDataReview';
import { useAuth } from '@/contexts/AuthContext';
const ADMIN_TABS = [{
  value: 'stats',
  label: 'Statistics',
  icon: BarChart3
}, {
  value: 'schools',
  label: 'Schools',
  icon: Building2
}, {
  value: 'programs',
  label: 'Programs',
  icon: GraduationCap
}, {
  value: 'courses',
  label: 'Courses',
  icon: BookOpen
}, {
  value: 'curriculum',
  label: 'Curriculum',
  icon: BookMarked
}, {
  value: 'schedules',
  label: 'Schedules',
  icon: Calendar
}, {
  value: 'equivalencies',
  label: 'Equivalencies',
  icon: ArrowLeftRight
}, {
  value: 'validation',
  label: 'Validation',
  icon: CheckCircle2
}, {
  value: 'scraped',
  label: 'Scraped Data',
  icon: FileSearch
}, {
  value: 'data',
  label: 'Data Management',
  icon: Database
}, {
  value: 'logs',
  label: 'Logs',
  icon: FileText
}];
export default function AdminDashboard() {
  const {
    user
  } = useAuth();
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => setLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [user]);
  if (loading) {
    return <div className="max-w-7xl mx-auto space-y-8">
        <div className="min-h-[50px]">
          <Skeleton className="h-[44px] w-56 max-w-full mb-2" />
          <Skeleton className="h-[24px] w-64 max-w-full" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-10 w-[240px]" />
          
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-full max-w-md" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>;
  }
  return <div className="max-w-7xl mx-auto space-y-8">
      <div className="min-h-[50px]">
        <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage academic data</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger className="w-[240px]">
            <SelectValue>
              {ADMIN_TABS.find(tab => tab.value === activeTab) && <div className="flex items-center gap-2">
                  {(() => {
                const Icon = ADMIN_TABS.find(tab => tab.value === activeTab)!.icon;
                return <Icon className="h-4 w-4" />;
              })()}
                  <span>{ADMIN_TABS.find(tab => tab.value === activeTab)!.label}</span>
                </div>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ADMIN_TABS.map(({
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

        <TabsContent value="stats" className="mt-3">
          <div className="space-y-3">
            <AdminStatistics />
          </div>
        </TabsContent>

        <TabsContent value="schools" className="mt-3">
          <div className="space-y-3">
            <SchoolsManager />
          </div>
        </TabsContent>

        <TabsContent value="programs" className="mt-3">
          <div className="space-y-3">
            <ProgramsManager />
          </div>
        </TabsContent>

        <TabsContent value="courses" className="mt-3">
          <div className="space-y-3">
            <CoursesManager />
          </div>
        </TabsContent>

        <TabsContent value="curriculum" className="mt-3">
          <div className="space-y-3">
            <CurriculumManager />
          </div>
        </TabsContent>

        <TabsContent value="validation" className="mt-3">
          <div className="space-y-3">
            <ValidationDashboard />
          </div>
        </TabsContent>

        <TabsContent value="scraped" className="mt-3">
          <div className="space-y-3">
            <ScrapedDataReview />
          </div>
        </TabsContent>

        <TabsContent value="data" className="mt-3">
          <div className="space-y-3">
            <DataManagement />
          </div>
        </TabsContent>

        <TabsContent value="equivalencies" className="mt-3">
          <div className="space-y-3">
            <EquivalenciesManager />
          </div>
        </TabsContent>

        <TabsContent value="schedules" className="mt-3">
          <div className="space-y-3">
            <SchedulesManager />
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-3 space-y-6">
          <AdminLogs />
        </TabsContent>
      </Tabs>
    </div>;
}
