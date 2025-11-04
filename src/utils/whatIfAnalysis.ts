import { supabase } from "@/integrations/supabase/client";
import { mapCoursesToRequirements } from "./requirementMapper";

interface WhatIfResult {
  remainingGroups: Array<{ 
    id: string;
    name: string; 
    remainingUnits: number;
    totalUnits: number;
    earnedUnits: number;
  }>;
  estimatedTermsToComplete: number;
  totalRemainingUnits: number;
  totalRequiredUnits: number;
  mappedCourses: Record<string, Array<{ course_code: string; units: number }>>;
}

export async function calculateWhatIf(
  userId: string,
  targetProgramId: string,
  targetCurriculumVersionId: string,
  effectiveTerm?: string
): Promise<WhatIfResult> {
  // 1. Fetch user's completed courses (filtered by term if specified)
  let query = supabase
    .from('user_courses')
    .select('course_id, course_code, units, grade, term_code')
    .eq('user_id', userId);

  if (effectiveTerm) {
    query = query.lte('term_code', effectiveTerm);
  }

  const { data: completedCourses, error: coursesError } = await query;

  if (coursesError || !completedCourses) {
    console.error('Error fetching courses:', coursesError);
    return {
      remainingGroups: [],
      estimatedTermsToComplete: 0,
      totalRemainingUnits: 0,
      totalRequiredUnits: 0,
      mappedCourses: {}
    };
  }

  // 2. Map to target program's requirements
  const { filled } = await mapCoursesToRequirements(
    targetCurriculumVersionId,
    completedCourses as any
  );

  // 3. Calculate remaining units per group
  const { data: groups, error: groupsError } = await supabase
    .from('requirement_groups')
    .select('id, name, min_units')
    .eq('curriculum_id', targetCurriculumVersionId);

  if (groupsError || !groups) {
    console.error('Error fetching groups:', groupsError);
    return {
      remainingGroups: [],
      estimatedTermsToComplete: 0,
      totalRemainingUnits: 0,
      totalRequiredUnits: 0,
      mappedCourses: filled
    };
  }

  const remainingGroups = groups.map(g => {
    const earnedUnits = filled[g.id]?.reduce((sum, c) => sum + c.units, 0) || 0;
    return {
      id: g.id,
      name: g.name,
      remainingUnits: Math.max(0, g.min_units - earnedUnits),
      totalUnits: g.min_units,
      earnedUnits
    };
  });

  const totalRemainingUnits = remainingGroups.reduce((sum, g) => sum + g.remainingUnits, 0);
  const totalRequiredUnits = remainingGroups.reduce((sum, g) => sum + g.totalUnits, 0);
  const estimatedTermsToComplete = Math.ceil(totalRemainingUnits / 18); // Assume 18 units/term

  return { 
    remainingGroups, 
    estimatedTermsToComplete, 
    totalRemainingUnits,
    totalRequiredUnits,
    mappedCourses: filled
  };
}
