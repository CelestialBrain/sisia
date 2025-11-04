import { supabase } from "@/integrations/supabase/client";

interface CompletedCourse {
  course_id: string | null;
  course_code: string;
  units: number;
  grade: string;
}

interface RequirementRule {
  id: string;
  rule_type: string;
  course_ids: string[] | null;
  units_override: number | null;
  tag_pattern: string | null;
  code_prefix: string | null;
}

interface RequirementGroup {
  id: string;
  name: string;
  priority: number;
  min_units: number;
  requirement_rules: RequirementRule[];
}

interface MappingResult {
  filled: Record<string, Array<{ course_code: string; units: number; course_id: string | null }>>;
  leftover: Array<{ course_code: string; units: number }>;
  totalMapped: number;
}

export async function mapCoursesToRequirements(
  curriculumVersionId: string,
  completedCourses: CompletedCourse[],
  includeEquivalencies = true
): Promise<MappingResult> {
  // 1. Fetch requirement groups + rules (sorted by priority)
  const { data: groups, error: groupsError } = await supabase
    .from('requirement_groups')
    .select(`
      id, 
      name, 
      priority, 
      min_units,
      requirement_rules (*)
    `)
    .eq('curriculum_id', curriculumVersionId)
    .order('priority', { ascending: true });

  if (groupsError || !groups) {
    console.error('Error fetching requirement groups:', groupsError);
    return { filled: {}, leftover: completedCourses.map(c => ({ course_code: c.course_code, units: c.units })), totalMapped: 0 };
  }

  // 2. Fetch equivalencies if needed
  const equivalenceMap = new Map<string, Array<{ to_course_id: string; units_override: number | null }>>();
  
  if (includeEquivalencies) {
    const { data: equivalencies } = await supabase
      .from('course_equivalencies')
      .select('from_course_id, to_course_id, units_override');
    
    equivalencies?.forEach(eq => {
      if (!equivalenceMap.has(eq.from_course_id)) {
        equivalenceMap.set(eq.from_course_id, []);
      }
      equivalenceMap.get(eq.from_course_id)!.push({
        to_course_id: eq.to_course_id,
        units_override: eq.units_override
      });
    });
  }

  // 3. Build remaining units pool (only count passing grades)
  const passingGrades = ['A', 'A-', 'B+', 'B', 'C', 'D', 'P', 'S'];
  const validCourses = completedCourses.filter(c => passingGrades.includes(c.grade));
  
  const remaining = new Map(
    validCourses.map(c => [c.course_code, { units: c.units, course_id: c.course_id }])
  );

  const filled: Record<string, any[]> = {};
  let totalMapped = 0;

  // 4. Iterate through groups by priority
  for (const group of groups as RequirementGroup[]) {
    filled[group.id] = [];
    let unitsInGroup = 0;

    for (const rule of (group.requirement_rules || []) as RequirementRule[]) {
      // Try exact match first
      if (rule.rule_type === 'by_course' && rule.course_ids) {
        for (const courseId of rule.course_ids) {
          const course = validCourses.find(c => c.course_id === courseId);
          if (course && remaining.has(course.course_code) && remaining.get(course.course_code)!.units > 0) {
            const unitsToUse = Math.min(
              remaining.get(course.course_code)!.units,
              rule.units_override || course.units
            );
            filled[group.id].push({ 
              course_code: course.course_code, 
              units: unitsToUse,
              course_id: course.course_id 
            });
            
            const current = remaining.get(course.course_code)!;
            remaining.set(course.course_code, { ...current, units: current.units - unitsToUse });
            unitsInGroup += unitsToUse;
            totalMapped += unitsToUse;
          }
        }
      }

      // Try pattern match by tag
      if (rule.rule_type === 'by_tag' && rule.tag_pattern) {
        // Would need to query courses table for matching tags
        // For now, skip this implementation
      }

      // Try pattern match by prefix
      if (rule.rule_type === 'by_prefix' && rule.code_prefix) {
        const prefix = rule.code_prefix.toUpperCase();
        for (const [courseCode, data] of remaining.entries()) {
          if (data.units > 0 && courseCode.toUpperCase().startsWith(prefix)) {
            const unitsToUse = Math.min(data.units, rule.units_override || data.units);
            filled[group.id].push({ 
              course_code: courseCode, 
              units: unitsToUse,
              course_id: data.course_id 
            });
            remaining.set(courseCode, { ...data, units: data.units - unitsToUse });
            unitsInGroup += unitsToUse;
            totalMapped += unitsToUse;
          }
        }
      }

      // Check if group is satisfied
      if (unitsInGroup >= group.min_units) break;
    }
  }

  // 5. Return filled + leftover
  const leftover = Array.from(remaining.entries())
    .filter(([_, data]) => data.units > 0)
    .map(([code, data]) => ({ course_code: code, units: data.units }));

  return { filled, leftover, totalMapped };
}
