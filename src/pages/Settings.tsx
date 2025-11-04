import { Wrench } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ThemeSettings from '@/components/settings/ThemeSettings';
import LogoSettings from '@/components/settings/LogoSettings';
import BackgroundSettings from '@/components/settings/BackgroundSettings';
import ApiSettings from '@/components/settings/ApiSettings';
import ApiDocumentation from '@/components/settings/ApiDocumentation';
import DataSourcesDocumentation from '@/components/settings/DataSourcesDocumentation';
import AISISScraperEnhanced from '@/components/settings/AISISScraperEnhanced';
import ScrapingHistory from '@/components/settings/ScrapingHistory';
import { useState, useEffect } from 'react';
export default function Settings() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  if (loading) {
    return <div className="max-w-7xl mx-auto space-y-8">
        <div className="min-h-[50px]">
          <Skeleton className="h-[44px] w-72 max-w-full mb-2" />
          <Skeleton className="h-[24px] w-96 max-w-full" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-3xl rounded-lg" />

          {/* Logo Settings skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 max-w-full mb-2" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
              <Skeleton className="h-32 w-full rounded-lg" />
            </CardContent>
          </Card>

          {/* Theme Settings Color Presets skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 max-w-full mb-2" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* RGB Mode skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 max-w-full mb-2" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full sm:w-48" />
            </CardContent>
          </Card>
        </div>
      </div>;
  }
  return <div className="max-w-7xl mx-auto space-y-8">
      <div className="min-h-[50px]">
        <h1 className="text-4xl font-bold mb-2">Website Settings</h1>
        <p className="text-muted-foreground">Customize your experience with visual preferences</p>
      </div>

      <Tabs defaultValue="appearance" className="space-y-4">
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="data-sources">Data Sources</TabsTrigger>
          <TabsTrigger value="scraping">Scraping</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="mt-4">
          <div className="space-y-4">
            <LogoSettings />
            <BackgroundSettings />
            <ThemeSettings />
          </div>
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <div className="space-y-4">
            <ApiDocumentation />
          </div>
        </TabsContent>

        <TabsContent value="data-sources" className="mt-4">
          <div className="space-y-4">
            <DataSourcesDocumentation />
          </div>
        </TabsContent>

        <TabsContent value="scraping" className="mt-4">
          <div className="space-y-4">
            <AISISScraperEnhanced />
            <ScrapingHistory />
          </div>
        </TabsContent>
      </Tabs>
    </div>;
}
