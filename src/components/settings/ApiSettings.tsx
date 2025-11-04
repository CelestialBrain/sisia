import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench } from 'lucide-react';

export default function ApiSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Advanced Settings
        </CardTitle>
        <CardDescription>
          Advanced configuration options and developer tools
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-sm text-muted-foreground">
          Additional advanced settings will be available here.
        </div>
      </CardContent>
    </Card>
  );
}
