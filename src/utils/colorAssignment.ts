// Theme-aware color assignment using CSS variables
// These colors will automatically adapt to the user's chosen theme
const THEME_COLORS = [
  'hsl(var(--primary))',
  'hsl(142 70% 50%)',     // Green
  'hsl(0 70% 55%)',       // Red  
  'hsl(330 70% 60%)',     // Pink
  'hsl(270 70% 55%)',     // Purple
  'hsl(45 90% 55%)',      // Yellow
  'hsl(25 85% 55%)',      // Orange
  'hsl(174 70% 45%)',     // Teal
  'hsl(243 75% 58%)',     // Indigo
  'hsl(38 92% 50%)',      // Amber
];

export function assignColor(courseCode: string, existingBlocks: Array<{ course_code: string; color: string }>): string {
  // Check if course already has a color assigned
  const existing = existingBlocks.find(b => b.course_code === courseCode);
  if (existing) return existing.color;
  
  // Get all currently used colors
  const usedColors = new Set(existingBlocks.map(b => b.color));
  
  // Find first unused color
  const availableColor = THEME_COLORS.find(c => !usedColors.has(c));
  
  // If all colors are used, hash the course code to pick one
  if (!availableColor) {
    let hash = 0;
    for (let i = 0; i < courseCode.length; i++) {
      hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
    }
    return THEME_COLORS[Math.abs(hash) % THEME_COLORS.length];
  }
  
  return availableColor;
}
