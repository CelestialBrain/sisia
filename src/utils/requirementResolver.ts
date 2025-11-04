import { supabase } from '@/integrations/supabase/client';

// Temporary types until migration is approved
interface RequirementGroup {
  id: string;
  curriculum_id: string;
  name: string;
  group_type: string;
  display_order: number;
  min_units: number | null;
  min_courses: number | null;
  max_units: number | null;
  double_counting_rule: string;
  description: string | null;
  created_at: string;
}

interface RequirementRule {
  id: string;
  req_group_id: string;
  rule_type: string;
  course_ids: string[] | null;
  tag_pattern: string | null;
  code_prefix: string | null;
  course_pattern: string | null;
  units_override: number | null;
  choices_count: number | null;
  description: string | null;
  created_at: string;
}

interface Course {
  id: string;
  course_code: string;
  course_title: string;
  units: number;
  school_id: string | null; // Allow null for university-wide courses
  category_tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface RequirementProgress {
  groupId: string;
  groupName: string;
  groupType: string;
  unitsEarned: number;
  unitsRequired: number;
  coursesEarned: number;
  coursesRequired: number;
  completedCourses: string[];
  remainingCourses: string[];
  isSatisfied: boolean;
  percentage: number;
  courses?: any[]; // Add courses array for displaying in UI
}

interface RequirementProgressInternal {
  groups: RequirementProgress[];
}

/**
 * Calculates requirement progress for a curriculum version
 * @param curriculumVersionId UUID of the curriculum version
 * @param userCourses Array of user's completed courses
 * @returns Object with groups array for each requirement group
 */
export async function calculateRequirementProgress(
  curriculumVersionId: string,
  userCourses: any[]
): Promise<RequirementProgressInternal> {
  // OPTIMIZED: Fetch all data upfront in 3 queries instead of N+1
  
  // 1. Fetch all requirement groups with their rules in one JOIN query
  const { data: groups } = await supabase
    .from('requirement_groups' as any)
    .select(`
      *,
      requirement_rules (*)
    `)
    .eq('curriculum_id', curriculumVersionId)
    .order('display_order');

  if (!groups) return { groups: [] };

  // 2. Fetch ALL courses once (we'll filter in memory)
  const { data: allCourses } = await supabase
    .from('courses')
    .select('*');

  const allCoursesTyped = (allCourses || []) as unknown as Course[];
  
  const groupsTyped = (groups as unknown) as RequirementGroup[];
  const progressList: RequirementProgress[] = [];

  for (const group of groupsTyped) {
    const rules = (group as any).requirement_rules || [];
    
    if (rules.length === 0) continue;

    const rulesTyped = rules as unknown as RequirementRule[];
    let applicableCourses: string[] = [];
    let applicableCoursesData: any[] = [];

    // Apply rules to find applicable courses (IN MEMORY - no DB queries!)
    for (const rule of rulesTyped) {
      if (rule.rule_type === 'by_course' && rule.course_ids) {
        // Exact course list - filter in memory
        const matchingCourses = allCoursesTyped.filter(c => 
          rule.course_ids?.includes(c.id)
        );
        applicableCoursesData.push(...matchingCourses);
        applicableCourses.push(...matchingCourses.map(c => c.course_code));
        
      } else if (rule.rule_type === 'by_tag' && rule.tag_pattern) {
        // Tag-based matching - filter in memory
        const pattern = rule.tag_pattern.replace('%', '.*').replace('*', '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        const matchingCourses = allCoursesTyped.filter(c => 
          c.category_tags?.some((tag: string) => regex.test(tag))
        );
        applicableCoursesData.push(...matchingCourses);
        applicableCourses.push(...matchingCourses.map(c => c.course_code));
        
      } else if (rule.rule_type === 'by_prefix' && rule.code_prefix) {
        // Prefix matching - filter in memory
        const matchingCourses = allCoursesTyped.filter(c => 
          c.course_code.toLowerCase().startsWith(rule.code_prefix.toLowerCase())
        );
        applicableCoursesData.push(...matchingCourses);
        applicableCourses.push(...matchingCourses.map(c => c.course_code));
      }
    }

    // Remove duplicates
    applicableCourses = [...new Set(applicableCourses)];

    // Match with user's completed courses (support both course_id and course_code)
    const completedInGroup = userCourses.filter(uc => {
      // Try matching by course_id first (stronger relationship)
      if (uc.course_id) {
        return applicableCoursesData.some(c => c.id === uc.course_id);
      }
      // Fall back to course_code matching for legacy data
      return applicableCourses.includes(uc.course_code);
    });

    const unitsEarned = completedInGroup.reduce((sum, c) => sum + (c.units || 0), 0);
    const coursesEarned = completedInGroup.length;

    const unitsRequired = group.min_units || 0;
    const coursesRequired = group.min_courses || 0;

    const isSatisfied = 
      (unitsRequired === 0 || unitsEarned >= unitsRequired) &&
      (coursesRequired === 0 || coursesEarned >= coursesRequired);

    const percentage = unitsRequired > 0 
      ? Math.min(100, (unitsEarned / unitsRequired) * 100)
      : coursesRequired > 0
        ? Math.min(100, (coursesEarned / coursesRequired) * 100)
        : 0;

    const remainingCourses = applicableCourses.filter(
      code => !completedInGroup.some(uc => uc.course_code === code)
    );

    progressList.push({
      groupId: group.id,
      groupName: group.name,
      groupType: group.group_type,
      unitsEarned,
      unitsRequired,
      coursesEarned,
      coursesRequired,
      completedCourses: completedInGroup.map(c => c.course_code),
      remainingCourses,
      isSatisfied,
      percentage,
      courses: applicableCoursesData, // Include full course data for UI
    });
  }

  return { groups: progressList };
}
