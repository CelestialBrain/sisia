import { z } from 'zod';

// Schema for share payload
const PlanCourseSchema = z.object({
  course_code: z.string(),
  course_title: z.string(),
  units: z.number(),
  grade: z.string().nullable(),
  year_level: z.number().nullable(),
  semester_label: z.string().nullable(),
  is_from_actual: z.boolean(),
  course_id: z.string().uuid().nullable(),
});

const SharePayloadSchema = z.object({
  v: z.literal(1),
  plan_name: z.string(),
  curriculum_version_id: z.string().uuid(),
  courses: z.array(PlanCourseSchema),
});

export type GradePlanSharePayload = z.infer<typeof SharePayloadSchema>;
export type PlanCourse = z.infer<typeof PlanCourseSchema>;

// Base64url encoding (URL-safe)
function base64urlEncode(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Base64url decoding
function base64urlDecode(str: string): string {
  // Restore padding
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

export function encodeGradePlanShare(payload: GradePlanSharePayload): string {
  const json = JSON.stringify(payload);
  const encoded = base64urlEncode(json);
  return `GP1.${encoded}`;
}

export function decodeGradePlanShare(shareString: string): GradePlanSharePayload {
  // Validate length
  if (shareString.length > 100000) {
    throw new Error('Share code is too long');
  }

  // Check prefix
  if (!shareString.startsWith('GP1.')) {
    throw new Error('Invalid share code format. Code must start with "GP1."');
  }

  try {
    const encoded = shareString.slice(4);
    const json = base64urlDecode(encoded);
    const payload = JSON.parse(json);
    
    // Validate schema
    return SharePayloadSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Invalid share code data format');
    }
    throw new Error('Failed to decode share code. Please check the code and try again.');
  }
}
