import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function ChatSettings() {
  const { user } = useAuth();
  const [showQPIBadge, setShowQPIBadge] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Load saved preference
    const loadPreference = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('show_on_leaderboard') // Reusing this field for QPI badge visibility
          .eq('id', user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error loading chat preferences:', error);
        }
        
        setShowQPIBadge(data?.show_on_leaderboard ?? false);
      } catch (err) {
        console.error('Failed to load chat settings:', err);
        setShowQPIBadge(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreference();
  }, [user]);

  const handleToggleQPI = async (checked: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ show_on_leaderboard: checked })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating chat preferences:', error);
        toast.error('Failed to update settings');
        return;
      }

      setShowQPIBadge(checked);
      toast.success('Chat settings updated');
    } catch (err) {
      console.error('Failed to update chat settings:', err);
      toast.error('Failed to update settings');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chat Preferences</CardTitle>
        <CardDescription>
          Manage how you appear in the community chat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="show-qpi">Show QPI Badge</Label>
            <p className="text-sm text-muted-foreground">
              Display your QPI next to your name in chat
            </p>
          </div>
          {isLoading ? (
            <div className="h-6 w-11 rounded-full bg-muted animate-pulse" />
          ) : (
            <Switch
              id="show-qpi"
              checked={showQPIBadge ?? false}
              onCheckedChange={handleToggleQPI}
            />
          )}
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Your program badge is always shown to maintain community transparency.
            The chat resets daily at 8 AM Philippine Time, and all messages are deleted.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
