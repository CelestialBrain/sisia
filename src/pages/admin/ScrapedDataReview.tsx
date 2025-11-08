import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function ScrapedDataReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch pending scraped curriculum
  const { data: scrapedCurriculums, isLoading } = useQuery({
    queryKey: ['scraped-curriculum-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraped_curriculum')
        .select('*')
        .eq('migration_status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch pending scraped schedules by user
  const { data: scrapedSchedules } = useQuery({
    queryKey: ['scraped-schedules-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraped_my_schedule')
        .select('*, profiles(display_name, email)')
        .eq('migration_status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Migrate curriculum mutation
  const migrateCurriculumMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke('migrate-scraped-curriculum', {
        body: { scraped_curriculum_ids: ids }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scraped-curriculum-pending'] });
      setSelectedIds([]);
      toast({
        title: 'Migration Complete',
        description: `Successfully migrated ${data.results.filter((r: any) => r.success).length} curriculum(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Migration Failed',
        description: error.message,
      });
    }
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleMigrateCurriculum = () => {
    if (selectedIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Selection',
        description: 'Please select at least one curriculum to migrate',
      });
      return;
    }
    migrateCurriculumMutation.mutate(selectedIds);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scraped Data Review</h1>
        <p className="text-muted-foreground">Review and approve scraped data before importing to main database</p>
      </div>

      <Tabs defaultValue="curriculum" className="space-y-4">
        <TabsList>
          <TabsTrigger value="curriculum">
            Curriculum ({scrapedCurriculums?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="schedules">
            Schedules ({scrapedSchedules?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="curriculum" className="space-y-4">
          {selectedIds.length > 0 && (
            <Card className="border-primary">
              <CardContent className="pt-6 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedIds.length} curriculum(s) selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedIds([])}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    onClick={handleMigrateCurriculum}
                    disabled={migrateCurriculumMutation.isPending}
                  >
                    {migrateCurriculumMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Migrating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve & Import
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {scrapedCurriculums && scrapedCurriculums.length > 0 ? (
            <div className="grid gap-4">
              {scrapedCurriculums.map((item: any) => (
                <Card 
                  key={item.id}
                  className={`cursor-pointer transition-colors ${
                    selectedIds.includes(item.id) ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => toggleSelect(item.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">
                          {item.program_name || item.program_code}
                        </CardTitle>
                        <CardDescription>
                          Version: {item.version_label || `${item.version_year}-${item.version_sem}`}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">
                        {item.courses?.length || 0} courses
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      Scraped: {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No pending curriculum data to review
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          {scrapedSchedules && scrapedSchedules.length > 0 ? (
            <div className="grid gap-4">
              {Object.entries(
                scrapedSchedules.reduce((acc: any, schedule: any) => {
                  const key = `${schedule.user_id}-${schedule.term}`;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(schedule);
                  return acc;
                }, {})
              ).map(([key, schedules]: [string, any]) => (
                <Card key={key}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>
                          {schedules[0].profiles?.display_name || 'Unknown User'}
                        </CardTitle>
                        <CardDescription>
                          Term: {schedules[0].term} • {schedules.length} course(s)
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {schedules.slice(0, 3).map((s: any, idx: number) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">{s.course_code}</span>
                          {s.section && ` - ${s.section}`}
                          {s.schedule && ` • ${s.schedule}`}
                        </div>
                      ))}
                      {schedules.length > 3 && (
                        <div className="text-sm text-muted-foreground">
                          +{schedules.length - 3} more courses
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No pending schedule data to review
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
