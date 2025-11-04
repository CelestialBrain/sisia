import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DataPrivacy() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [deleteOptions, setDeleteOptions] = useState({
    grades: false,
    programEnrollments: false,
    customPrograms: false,
    profileData: false,
    schedules: false,
  });
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteSelected = async () => {
    if (!user || !Object.values(deleteOptions).some(v => v)) {
      toast({
        title: "No data selected",
        description: "Please select at least one data type to delete",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      if (deleteOptions.grades) {
        await supabase.from("user_courses").delete().eq("user_id", user.id);
      }

      if (deleteOptions.programEnrollments) {
        await supabase.from("program_enrollments").delete().eq("user_id", user.id);
        await supabase.from("user_programs").delete().eq("user_id", user.id);
      }

      if (deleteOptions.customPrograms) {
        await supabase.from("custom_programs").delete().eq("user_id", user.id);
      }

      if (deleteOptions.profileData) {
        await supabase.from("profiles").update({
          display_name: user.email?.split("@")[0] || "User",
          student_number: null,
          entry_year: null,
          show_on_leaderboard: false,
        }).eq("id", user.id);
        
        // Invalidate profile queries
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      }

      if (deleteOptions.schedules) {
        // First get user's schedule IDs
        const { data: userSchedules } = await supabase
          .from("user_schedules")
          .select("id")
          .eq("user_id", user.id);
        
        if (userSchedules && userSchedules.length > 0) {
          const scheduleIds = userSchedules.map(s => s.id);
          await supabase.from("schedule_blocks").delete().in("schedule_id", scheduleIds);
          await supabase.from("user_schedules").delete().eq("user_id", user.id);
        }
      }

      toast({
        title: "Data deleted successfully",
        description: "Your selected data has been permanently removed",
      });

      setDeleteOptions({
        grades: false,
        programEnrollments: false,
        customPrograms: false,
        profileData: false,
        schedules: false,
      });
      
      setShowConfirmDialog(false);
      
      // Redirect to dashboard to show onboarding if needed
      navigate("/");
      window.location.reload();
    } catch (error) {
      console.error("Error deleting data:", error);
      toast({
        title: "Error deleting data",
        description: "An error occurred while deleting your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteEverything = async () => {
    if (!user) return;

    setIsDeleting(true);
    try {
      // First get user's schedule IDs
      const { data: userSchedules } = await supabase
        .from("user_schedules")
        .select("id")
        .eq("user_id", user.id);
      
      // Delete all data
      await supabase.from("user_courses").delete().eq("user_id", user.id);
      await supabase.from("program_enrollments").delete().eq("user_id", user.id);
      await supabase.from("user_programs").delete().eq("user_id", user.id);
      await supabase.from("custom_programs").delete().eq("user_id", user.id);
      
      if (userSchedules && userSchedules.length > 0) {
        const scheduleIds = userSchedules.map(s => s.id);
        await supabase.from("schedule_blocks").delete().in("schedule_id", scheduleIds);
        await supabase.from("user_schedules").delete().eq("user_id", user.id);
      }
      
      await supabase.from("profiles").update({
        display_name: user.email?.split("@")[0] || "User",
        student_number: null,
        entry_year: null,
        show_on_leaderboard: false,
      }).eq("id", user.id);
      
      // Invalidate profile queries
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });

      toast({
        title: "All data deleted",
        description: "All your academic data has been permanently removed",
      });

      setShowDeleteAccountDialog(false);
      navigate("/");
      window.location.reload();
    } catch (error) {
      console.error("Error deleting all data:", error);
      toast({
        title: "Error deleting data",
        description: "An error occurred while deleting your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasSelectedOptions = Object.values(deleteOptions).some(v => v);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Selective Data Deletion</CardTitle>
          <CardDescription className="text-justify">
            Choose which data you want to permanently delete from your account
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="grades"
                checked={deleteOptions.grades}
                onCheckedChange={(checked) =>
                  setDeleteOptions(prev => ({ ...prev, grades: checked as boolean }))
                }
              />
              <div className="space-y-2">
                <Label htmlFor="grades" className="font-medium cursor-pointer">
                  Grades & Courses
                </Label>
                <p className="text-sm text-muted-foreground">
                  All your course grades and academic records
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="enrollments"
                checked={deleteOptions.programEnrollments}
                onCheckedChange={(checked) =>
                  setDeleteOptions(prev => ({ ...prev, programEnrollments: checked as boolean }))
                }
              />
              <div className="space-y-1">
                <Label htmlFor="enrollments" className="font-medium cursor-pointer">
                  Program Enrollments
                </Label>
                <p className="text-sm text-muted-foreground">
                  Your program selection and enrollment history
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="customPrograms"
                checked={deleteOptions.customPrograms}
                onCheckedChange={(checked) =>
                  setDeleteOptions(prev => ({ ...prev, customPrograms: checked as boolean }))
                }
              />
              <div className="space-y-1">
                <Label htmlFor="customPrograms" className="font-medium cursor-pointer">
                  Custom Programs
                </Label>
                <p className="text-sm text-muted-foreground">
                  Any custom programs you've created
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="profileData"
                checked={deleteOptions.profileData}
                onCheckedChange={(checked) =>
                  setDeleteOptions(prev => ({ ...prev, profileData: checked as boolean }))
                }
              />
              <div className="space-y-1">
                <Label htmlFor="profileData" className="font-medium cursor-pointer">
                  Profile Information
                </Label>
                <p className="text-sm text-muted-foreground">
                  Reset your profile (student number, entry year, display name)
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="schedules"
                checked={deleteOptions.schedules}
                onCheckedChange={(checked) =>
                  setDeleteOptions(prev => ({ ...prev, schedules: checked as boolean }))
                }
              />
              <div className="space-y-1">
                <Label htmlFor="schedules" className="font-medium cursor-pointer">
                  Schedules
                </Label>
                <p className="text-sm text-muted-foreground">
                  All your class schedules and schedule blocks
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={() => setShowConfirmDialog(true)}
            disabled={!hasSelectedOptions || isDeleting}
            className="w-full"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected Data
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-justify">
            Permanently delete all your academic data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteAccountDialog(true)}
            disabled={isDeleting}
            className="w-full"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All My Data
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected data from your account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Selected"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete All Data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL your academic data including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All grades and courses</li>
                <li>Program enrollments and history</li>
                <li>Custom programs</li>
                <li>Profile information</li>
                <li>All schedules and schedule blocks</li>
              </ul>
              <p className="mt-3 font-semibold">This action cannot be undone!</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEverything}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting Everything..." : "Delete All My Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
