import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function LeaderboardSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("show_on_leaderboard")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setShowOnLeaderboard(data.show_on_leaderboard || false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ show_on_leaderboard: checked })
        .eq("id", user?.id);

      if (error) throw error;

      setShowOnLeaderboard(checked);
      toast({
        title: "Success",
        description: checked
          ? "You will now appear on the leaderboard"
          : "You have been removed from the leaderboard",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between space-x-3">
          <div className="space-y-1 flex-1">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between space-x-3">
        <div className="space-y-1">
          <Label htmlFor="leaderboard-toggle">Show on Leaderboard</Label>
          <p className="text-sm text-muted-foreground">
            Allow others to see your ranking and QPI on the public leaderboard
          </p>
        </div>
        <Switch
          id="leaderboard-toggle"
          checked={showOnLeaderboard}
          onCheckedChange={handleToggle}
          disabled={loading}
        />
      </div>
    </div>
  );
}
