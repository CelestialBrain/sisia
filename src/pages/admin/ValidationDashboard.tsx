import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

export function ValidationDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { data: validationIssues, isLoading, refetch } = useQuery({
    queryKey: ['validation-issues', refreshKey],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        const { data, error } = await supabase.functions.invoke('validate-data', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) {
          console.error('[Validation] Error:', error);
          toast.error('Validation failed: ' + error.message);
          throw error;
        }

        console.log('[Validation] Received validation results from backend');
        return data.issues as Array<{ type: string; severity: string; message: string }>;

      } catch (error: any) {
        console.error('[Validation] Failed:', error);
        toast.error('Validation failed');
        throw error;
      }
    },
    staleTime: 60000,
    refetchOnMount: 'always',
    gcTime: 5 * 60 * 1000,
  });
  
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading validation checks...</div>;
  }

  const errors = validationIssues?.filter(i => i.severity === 'error') || [];
  const warnings = validationIssues?.filter(i => i.severity === 'warning') || [];

  return (
    <>
      <div className="p-0 lg:p-6 lg:border lg:rounded-lg lg:bg-card">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Data Validation</h3>
            <p className="text-sm text-muted-foreground">Checks for data integrity issues in the new curriculum architecture</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <div>
          <div className="space-y-4">
            {validationIssues && validationIssues.length === 0 ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>All Clear!</AlertTitle>
                <AlertDescription>
                  No validation issues found. Your curriculum data is in good shape.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {errors.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-destructive">Errors ({errors.length})</h3>
                    {errors.map((issue, idx) => (
                      <Alert key={idx} variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{issue.type}</AlertTitle>
                        <AlertDescription>{issue.message}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-yellow-600">Warnings ({warnings.length})</h3>
                    {warnings.map((issue, idx) => (
                      <Alert key={idx}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{issue.type}</AlertTitle>
                        <AlertDescription>{issue.message}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
