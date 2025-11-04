import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ChatSettings } from "@/components/profile/ChatSettings";
import { AccountSettings } from "@/components/profile/AccountSettings";
import { DataPrivacy } from "@/components/profile/DataPrivacy";
import { User, MessageCircle, Settings, ShieldCheck, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, Link } from "react-router-dom";

const PROFILE_TABS = [
  { value: 'profile', label: 'Profile', icon: User },
  { value: 'chat', label: 'Chat Preferences', icon: MessageCircle },
  { value: 'account', label: 'Account', icon: Settings },
  { value: 'privacy', label: 'Privacy', icon: ShieldCheck },
];

export default function Profile() {
  const { user, isGuest } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loading, setLoading] = useState(true);

  useState(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="min-h-[50px]">
          <Skeleton className="h-[44px] w-64 max-w-full mb-2" />
          <Skeleton className="h-[24px] w-96 max-w-full" />
        </div>

      <div className="space-y-4">
        <div className="flex h-10 w-[240px] items-center justify-between rounded-md border border-input bg-background px-3 py-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-4 rounded" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-48 max-w-full" />
            <Skeleton className="h-5 w-80 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="min-h-[50px]">
        <h1 className="text-4xl font-bold mb-2">Profile Settings</h1>
        <p className="text-muted-foreground">
          {isGuest ? 'Guest mode settings' : 'Manage your personal information and preferences'}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger className="w-[240px]">
            <SelectValue>
              {PROFILE_TABS.find(tab => tab.value === activeTab) && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = PROFILE_TABS.find(tab => tab.value === activeTab)!.icon;
                    return <Icon className="h-4 w-4" />;
                  })()}
                  <span>{PROFILE_TABS.find(tab => tab.value === activeTab)!.label}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PROFILE_TABS.map(({ value, label, icon: Icon }) => (
              <SelectItem key={value} value={value}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your display name and academic information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProfileForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <ChatSettings />
          </TabsContent>

          <TabsContent value="account" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>
                  Manage your email and password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccountSettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="mt-4">
            <DataPrivacy />
          </TabsContent>
        </Tabs>
    </div>
  );
}
