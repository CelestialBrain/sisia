import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const profileSchema = z.object({
  display_name: z.string().min(1, "Display name is required").max(100),
  entry_year: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format must be YYYY-MM (e.g., 2021-08)").optional().or(z.literal("")),
  student_number: z.string().regex(/^2\d{5}$/, "Student ID must be 6 digits starting with 2 (e.g., 212345)").optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        reset({
          display_name: data.display_name || "",
          entry_year: data.entry_year || "",
          student_number: data.student_number || "",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: data.display_name,
          entry_year: data.entry_year || null,
          student_number: data.student_number || null,
        })
        .eq("id", user?.id);

      if (error) throw error;

      // Update auth user metadata for chat display name
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: data.display_name }
      });

      if (authError) throw authError;

      // Invalidate profile queries so Layout and other components refetch
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="space-y-3">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-2">
        <Label htmlFor="display_name">Display Name *</Label>
        <Input
          id="display_name"
          {...register("display_name")}
          placeholder="John Doe"
        />
        {errors.display_name && (
          <p className="text-sm text-destructive">{errors.display_name.message}</p>
        )}
      </div>

          <div className="space-y-2">
        <Label htmlFor="entry_year">Entry Year and Month</Label>
        <Input
          id="entry_year"
          {...register("entry_year")}
          placeholder="2021-08 (YYYY-MM)"
        />
        {errors.entry_year && (
          <p className="text-sm text-destructive">{errors.entry_year.message}</p>
        )}
      </div>

          <div className="space-y-2">
        <Label htmlFor="student_number">Student ID</Label>
        <Input
          id="student_number"
          {...register("student_number")}
          placeholder="212345 (6 digits starting with 2)"
        />
        {errors.student_number && (
          <p className="text-sm text-destructive">{errors.student_number.message}</p>
        )}
      </div>

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}
