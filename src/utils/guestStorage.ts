// Guest mode data storage using sessionStorage
// All data is cleared when the browser session ends

import { clientLogger } from './clientLogger';

export const guestStorage = {
  // User courses
  getCourses: () => {
    const data = sessionStorage.getItem('guest_courses');
    const courses = data ? JSON.parse(data) : [];
    clientLogger.debug('storage', 'Retrieved guest courses', { count: courses.length }, 'guest');
    return courses;
  },
  
  setCourses: (courses: any[]) => {
    sessionStorage.setItem('guest_courses', JSON.stringify(courses));
    clientLogger.debug('storage', 'Saved guest courses', { count: courses.length }, 'guest');
    // Notify listeners (e.g., GradePlanner) for real-time updates
    window.dispatchEvent(new CustomEvent('guest-courses-changed', { detail: { count: courses.length } }));
  },
  
  addCourse: (course: any) => {
    const courses = guestStorage.getCourses();
    courses.push(course);
    guestStorage.setCourses(courses);
  },
  
  updateCourse: (id: string, updates: any) => {
    const courses = guestStorage.getCourses();
    const index = courses.findIndex((c: any) => c.id === id);
    if (index !== -1) {
      courses[index] = { ...courses[index], ...updates };
      guestStorage.setCourses(courses);
    }
  },
  
  deleteCourse: (id: string) => {
    const courses = guestStorage.getCourses();
    guestStorage.setCourses(courses.filter((c: any) => c.id !== id));
  },
  
  // Program enrollments
  getEnrollment: () => {
    const data = sessionStorage.getItem('guest_enrollment');
    const enrollment = data ? JSON.parse(data) : null;
    clientLogger.debug('storage', 'Retrieved guest enrollment', { hasEnrollment: !!enrollment, programId: enrollment?.program_id }, 'guest');
    return enrollment;
  },
  
  setEnrollment: (enrollment: any) => {
    sessionStorage.setItem('guest_enrollment', JSON.stringify(enrollment));
    clientLogger.info('storage', 'Saved guest enrollment - invalidating curriculum cache', {
      programId: enrollment?.program_id,
      programName: enrollment?.programs?.name,
      curriculumVersionId: enrollment?.curriculum_version_id
    }, 'guest');
    
    // Log with enhanced context
    clientLogger.logEntityOperation(
      'enrollment',
      'UPDATE',
      'Guest program enrollment updated in sessionStorage',
      {
        programId: enrollment?.program_id,
        programName: enrollment?.programs?.name,
        curriculumVersionId: enrollment?.curriculum_version_id
      },
      {
        storageLayer: 'sessionStorage',
        interpretation: 'Guest user switched programs. Old curriculum data is being invalidated to prevent showing wrong course requirements. Fresh curriculum data will be fetched on next page load.'
      }
    );
  },
  
  // Schedules
  getSchedules: () => {
    const data = sessionStorage.getItem('guest_schedules');
    return data ? JSON.parse(data) : [];
  },
  
  setSchedules: (schedules: any[]) => {
    sessionStorage.setItem('guest_schedules', JSON.stringify(schedules));
    window.dispatchEvent(new CustomEvent('guestScheduleUpdate'));
  },
  
  // Grade plans
  getGradePlans: () => {
    const data = sessionStorage.getItem('guest_grade_plans');
    return data ? JSON.parse(data) : [];
  },
  
  setGradePlans: (plans: any[]) => {
    sessionStorage.setItem('guest_grade_plans', JSON.stringify(plans));
  },

  // Schedule blocks
  getScheduleBlocks: () => {
    const data = sessionStorage.getItem('guest_schedule_blocks');
    return data ? JSON.parse(data) : [];
  },

  setScheduleBlocks: (blocks: any[]) => {
    sessionStorage.setItem('guest_schedule_blocks', JSON.stringify(blocks));
    window.dispatchEvent(new CustomEvent('guestScheduleUpdate'));
  },

  addScheduleBlock: (block: any) => {
    const blocks = guestStorage.getScheduleBlocks();
    blocks.push(block);
    guestStorage.setScheduleBlocks(blocks);
  },

  updateScheduleBlock: (id: string, updates: any) => {
    const blocks = guestStorage.getScheduleBlocks();
    const index = blocks.findIndex((b: any) => b.id === id);
    if (index !== -1) {
      blocks[index] = { ...blocks[index], ...updates };
      guestStorage.setScheduleBlocks(blocks);
    }
  },

  deleteScheduleBlock: (id: string) => {
    const blocks = guestStorage.getScheduleBlocks();
    guestStorage.setScheduleBlocks(blocks.filter((b: any) => b.id !== id));
  },

  // Palette items
  getPaletteItems: () => {
    const data = sessionStorage.getItem('guest_palette_items');
    return data ? JSON.parse(data) : [];
  },

  setPaletteItems: (items: any[]) => {
    sessionStorage.setItem('guest_palette_items', JSON.stringify(items));
  },

  // Generate unique ID
  generateId: () => {
    return crypto.randomUUID();
  },

  // Check if guest has a program set up
  hasGuestProgram: () => {
    return !!sessionStorage.getItem('guest_enrollment');
  },
  
  // Clear all guest data
  clearAll: () => {
    clientLogger.info('storage', 'Clearing all guest data', {}, 'guest');
    // Clear all sessionStorage guest data
    sessionStorage.removeItem('guest_courses');
    sessionStorage.removeItem('guest_enrollment');
    sessionStorage.removeItem('guest_schedules');
    sessionStorage.removeItem('guest_grade_plans');
    sessionStorage.removeItem('guest_schedule_blocks');
    sessionStorage.removeItem('guest_palette_items');
    sessionStorage.removeItem('guest_mode');
    
    // Clear related localStorage items that might contain guest data
    localStorage.removeItem('app_program');
    localStorage.removeItem('schedule_search_presets');
    
    // Clear the entire sessionStorage to be safe
    sessionStorage.clear();
    clientLogger.info('storage', 'Guest data cleared successfully', {}, 'guest');
  }
};
