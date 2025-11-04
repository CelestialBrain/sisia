import { supabase } from "@/integrations/supabase/client";
import { normalizeSemester } from "./terms";

export interface CurriculumCourse {
  id: string;
  course_code: string;
  course_title: string;
  units: number;
  semester_label?: string;
  year_level?: number;
  category?: string;
}

export interface CurriculumStructure {
  courses: CurriculumCourse[];
  yearLevels: number[];
  semesters: Map<number, string[]>; // year -> semester labels
}

export async function fetchCurriculumCourses(
  curriculumVersionId: string
): Promise<CurriculumStructure> {
  try {
    // Fetch requirement groups for this curriculum
    const { data: groups, error: groupsError } = await supabase
      .from("requirement_groups")
      .select("id, name, display_order")
      .eq("curriculum_id", curriculumVersionId)
      .order("display_order");

    if (groupsError) throw groupsError;
    if (!groups || groups.length === 0) {
      return { courses: [], yearLevels: [], semesters: new Map() };
    }

    // Fetch all requirement rules for these groups
    const groupIds = groups.map((g) => g.id);
    const { data: rules, error: rulesError } = await supabase
      .from("requirement_rules")
      .select("id, req_group_id, rule_type, course_ids, code_prefix, tag_pattern")
      .in("req_group_id", groupIds);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return { courses: [], yearLevels: [], semesters: new Map() };
    }

    // Extract all course IDs from rules
    const courseIds: string[] = [];
    rules.forEach((rule) => {
      if (rule.course_ids && Array.isArray(rule.course_ids)) {
        courseIds.push(...rule.course_ids);
      }
    });

    // Fetch course details
    let allCourses: any[] = [];
    if (courseIds.length > 0) {
      const { data: courses, error: coursesError } = await supabase
        .from("courses")
        .select("id, course_code, course_title, units")
        .in("id", courseIds);

      if (coursesError) throw coursesError;
      allCourses = courses || [];
    }

    // Also fetch courses by prefix if any rules use that
    const prefixRules = rules.filter((r) => r.code_prefix);
    for (const rule of prefixRules) {
      const { data: prefixCourses, error } = await supabase
        .from("courses")
        .select("id, course_code, course_title, units")
        .ilike("course_code", `${rule.code_prefix}%`);

      if (!error && prefixCourses) {
        allCourses.push(...prefixCourses);
      }
    }

    // Remove duplicates
    const uniqueCourses = Array.from(
      new Map(allCourses.map((c) => [c.id, c])).values()
    );

    // Parse group names to extract year/semester info
    const coursesWithMetadata: CurriculumCourse[] = [];
    const yearLevelsSet = new Set<number>();
    const semestersMap = new Map<number, Set<string>>();

    groups.forEach((group) => {
      // Try to extract year level and semester from group name
      const yearMatch = group.name.match(/(\d+)(?:st|nd|rd|th)\s+Year/i);
      const semesterMatch = group.name.match(/(First|Second|Third|Intercession|Summer)\s+(?:Semester|Term)/i);

      const yearLevel = yearMatch ? parseInt(yearMatch[1]) : undefined;
      let semesterLabel = semesterMatch ? semesterMatch[0] : undefined;
      
      // Normalize "Summer" to "Intercession"
      if (semesterLabel) {
        const normalized = normalizeSemester(semesterLabel);
        // If the whole string contained "Term", preserve that format
        if (/term/i.test(semesterLabel) && normalized !== semesterLabel) {
          semesterLabel = normalized.replace(/Semester/i, 'Term');
        } else {
          semesterLabel = normalized.includes('Semester') ? normalized : `${normalized} Semester`;
        }
      }

      if (yearLevel) {
        yearLevelsSet.add(yearLevel);
        if (semesterLabel) {
          if (!semestersMap.has(yearLevel)) {
            semestersMap.set(yearLevel, new Set());
          }
          semestersMap.get(yearLevel)!.add(semesterLabel);
        }
      }

      // Find rules for this group
      const groupRules = rules.filter((r) => r.req_group_id === group.id);

      groupRules.forEach((rule) => {
        if (rule.course_ids && Array.isArray(rule.course_ids)) {
          rule.course_ids.forEach((courseId) => {
            const course = uniqueCourses.find((c) => c.id === courseId);
            if (course) {
              coursesWithMetadata.push({
                ...course,
                semester_label: semesterLabel,
                year_level: yearLevel,
                category: group.name,
              });
            }
          });
        }
      });
    });

    // Sort year levels
    const yearLevels = Array.from(yearLevelsSet).sort((a, b) => a - b);

    // Convert semester sets to arrays and sort
    const semesters = new Map<number, string[]>();
    const semesterOrder = ["First Semester", "Second Semester", "Third Semester", "Intercession"];
    semestersMap.forEach((semSet, year) => {
      const sorted = Array.from(semSet).sort((a, b) => {
        return semesterOrder.indexOf(a) - semesterOrder.indexOf(b);
      });
      semesters.set(year, sorted);
    });

    return {
      courses: coursesWithMetadata,
      yearLevels,
      semesters,
    };
  } catch (error) {
    console.error("Error fetching curriculum courses:", error);
    throw error;
  }
}
