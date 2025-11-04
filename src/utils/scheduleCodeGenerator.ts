import { z } from 'zod';

// Schema for share payload
const PaletteItemSchema = z.object({
  course_code: z.string(),
  course_title: z.string(),
  section: z.string().nullable(),
  required_count: z.number(),
  is_manual: z.boolean(),
  color: z.string(),
});

const BlockSchema = z.object({
  course_code: z.string(),
  course_title: z.string().nullable(),
  section: z.string(),
  room: z.string(),
  day_of_week: z.number().min(1).max(6),
  start_time: z.string(),
  end_time: z.string(),
  color: z.string(),
  font_color: z.string().optional().default('#000000'),
  font_size: z.string().optional().default('text-xs'),
  text_align: z.string().optional().default('left'),
});

const SharePayloadSchema = z.object({
  v: z.union([z.literal(1), z.literal(2)]),
  name: z.string(),
  term: z.string(),
  palette: z.array(PaletteItemSchema),
  blocks: z.array(BlockSchema),
});

export type SharePayload = z.infer<typeof SharePayloadSchema>;

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

export function encodeScheduleShare(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const encoded = base64urlEncode(json);
  return `SB2.${encoded}`;
}

export function decodeScheduleShare(shareString: string): SharePayload {
  // Validate length
  if (shareString.length > 100000) {
    throw new Error('Share code is too long');
  }

  // Check prefix - support both v1 (SB1.) and v2 (SB2.)
  if (!shareString.startsWith('SB1.') && !shareString.startsWith('SB2.')) {
    throw new Error('Invalid share code format. Code must start with "SB1." or "SB2."');
  }

  try {
    const encoded = shareString.slice(4);
    const json = base64urlDecode(encoded);
    const payload = JSON.parse(json);
    
    // Validate schema - will apply defaults for missing fields
    return SharePayloadSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Invalid share code data format');
    }
    throw new Error('Failed to decode share code. Please check the code and try again.');
  }
}

export function generateShareCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function formatShareCode(code: string): string {
  // Format as XXXX-XXXX for better readability
  return code.slice(0, 4) + '-' + code.slice(4, 8);
}

export function normalizeShareCode(code: string): string {
  // Remove dashes and convert to uppercase
  return code.replace(/-/g, '').toUpperCase();
}
