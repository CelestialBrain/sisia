import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Trophy, Medal, Award } from "lucide-react";

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  cumulative_qpi: number;
  total_units: number;
  rank: number;
}

export default function Leaderboard() {
  const [search, setSearch] = useState("");

  const { data: entries = [], isLoading: loading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      // Query profiles that opted in
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("show_on_leaderboard", true);

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        return [];
      }

      // For each profile, calculate their QPI
      const leaderboardData: LeaderboardEntry[] = [];

      for (const profile of profiles) {
        const { data: courses, error: coursesError } = await supabase
          .from("user_courses")
          .select("units, qpi_value")
          .eq("user_id", profile.id)
          .not("qpi_value", "is", null);

        if (coursesError) continue;

        if (courses && courses.length > 0) {
          const totalUnits = courses.reduce((sum, c) => sum + c.units, 0);
          const totalQualityPoints = courses.reduce(
            (sum, c) => sum + c.units * (c.qpi_value || 0),
            0
          );
          const cumulativeQPI = totalUnits > 0 ? totalQualityPoints / totalUnits : 0;

          if (totalUnits >= 12) {
            // Only show users with at least 12 units
            leaderboardData.push({
              user_id: profile.id,
              display_name: profile.display_name,
              cumulative_qpi: cumulativeQPI,
              total_units: totalUnits,
              rank: 0,
            });
          }
        }
      }

      // Sort by QPI and assign ranks
      leaderboardData.sort((a, b) => b.cumulative_qpi - a.cumulative_qpi);
      leaderboardData.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return leaderboardData;
    },
  });

  const filteredEntries = entries.filter((entry) =>
    entry.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return null;
  };

  if (loading) {
    return (
    <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <Skeleton className="h-[44px] w-56 mb-2" />
          <Skeleton className="h-[24px] w-72" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />

          <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-12">
                      <Skeleton className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-[18px] w-48" />
                      <Skeleton className="h-[14px] w-32" />
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-[14px] w-12" />
                  </div>
                </div>
              </CardHeader>
            </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">QPI Leaderboard</h1>
        <p className="text-muted-foreground">
          See how you rank among your peers
        </p>
      </div>

      <div className="space-y-4">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

        {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No entries found. Be the first to appear on the leaderboard!
            </p>
          </CardContent>
        </Card>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <Card key={entry.user_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-12">
                        {getRankIcon(entry.rank)}
                        <span className="text-2xl font-bold">#{entry.rank}</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">{entry.display_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {entry.total_units} units completed
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold">
                        {entry.cumulative_qpi.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">QPI</p>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
