// Application Context Documentation
// This module provides comprehensive documentation for log interpretation

export interface EntityDefinition {
  name: string;
  description: string;
  keyFields: { [key: string]: string };
  storageLocation: string;
  relatedEntities?: string[];
}

export interface ApplicationArchitecture {
  overview: string;
  frontend: string;
  backend: string;
  stateManagement: string;
  userModes: {
    guest: string;
    authenticated: string;
  };
}

export interface StorageLayer {
  name: string;
  description: string;
  persistence: string;
  useCase: string;
}

export interface CommonOperation {
  name: string;
  description: string;
  triggers: string[];
  sideEffects: string[];
  relatedLogs: string[];
}

export const APPLICATION_METADATA = {
  name: "Academic Planning System",
  description: "A comprehensive web application for university students to plan their academic journey, including course selection, schedule building, grade tracking, and program requirement management.",
  version: "1.0.0",
  
  architecture: {
    overview: "React-based SPA with dual storage modes (guest/authenticated) and real-time data synchronization",
    frontend: "React 18 + TypeScript + Vite + TanStack Query + Tailwind CSS",
    backend: "Supabase (PostgreSQL + Edge Functions) for authenticated users, sessionStorage for guests",
    stateManagement: "React Query for server state, React Context for auth/theme, sessionStorage for guest data",
    userModes: {
      guest: "Temporary session-based storage using browser sessionStorage. All data cleared on browser close. No authentication required.",
      authenticated: "Persistent backend storage using Supabase with Row Level Security (RLS). Data synced across devices."
    }
  } as ApplicationArchitecture,

  entities: {
    course: {
      name: "Course",
      description: "A university course offering (e.g., CS 11, MATH 20)",
      keyFields: {
        course_code: "Unique course identifier (e.g., 'CS 11', 'MATH 20')",
        course_title: "Full name of the course",
        units: "Credit hours/units for the course",
        school_id: "Which school/college offers this course"
      },
      storageLocation: "Supabase: 'courses' table (authenticated) | sessionStorage: 'guest_courses' (guest)",
      relatedEntities: ["programs", "schedules", "requirement_groups"]
    },
    
    program: {
      name: "Academic Program",
      description: "A degree program (e.g., BS Computer Science, BA Economics)",
      keyFields: {
        program_id: "Unique identifier for the program",
        code: "Short code (e.g., 'BS-CS', 'BA-ECON')",
        name: "Full program name",
        school_id: "School/college offering the program",
        total_units: "Total units required for graduation"
      },
      storageLocation: "Supabase: 'programs' table",
      relatedEntities: ["curriculum_versions", "tracks", "requirement_groups"]
    },

    enrollment: {
      name: "Program Enrollment",
      description: "A student's enrollment in a specific program with a specific curriculum version",
      keyFields: {
        program_id: "Which program the student is enrolled in",
        curriculum_version_id: "Which version of the curriculum they're following",
        track_id: "Optional specialization track within the program",
        status: "Enrollment status (active, completed, etc.)"
      },
      storageLocation: "Supabase: 'program_enrollments' table (authenticated) | sessionStorage: 'guest_enrollment' (guest)",
      relatedEntities: ["programs", "curriculum_versions", "tracks"]
    },

    curriculum_version: {
      name: "Curriculum Version",
      description: "A specific version of a program's curriculum (changes over years)",
      keyFields: {
        curriculum_version_id: "Unique identifier",
        version_label: "Human-readable label (e.g., '2023-2024')",
        program_id: "Parent program",
        effective_start: "When this version became active",
        effective_end: "When this version was superseded"
      },
      storageLocation: "Supabase: 'curriculum_versions' table",
      relatedEntities: ["programs", "requirement_groups"]
    },

    requirement_group: {
      name: "Requirement Group",
      description: "A category of courses required for program completion (e.g., Core, Electives, GE)",
      keyFields: {
        req_group_id: "Unique identifier",
        curriculum_id: "Which curriculum version this belongs to",
        name: "Group name (e.g., 'Core Courses', 'Free Electives')",
        group_type: "Type of requirement (core, elective, etc.)",
        min_units: "Minimum units required from this group"
      },
      storageLocation: "Supabase: 'requirement_groups' table",
      relatedEntities: ["curriculum_versions", "requirement_rules", "courses"]
    },

    schedule: {
      name: "Class Schedule",
      description: "A student's weekly class schedule for a specific term",
      keyFields: {
        schedule_id: "Unique identifier",
        schedule_name: "User-defined name (e.g., 'My Schedule 1')",
        term_code: "Academic term (e.g., '2025-2026-First Semester')",
        user_id: "Owner of the schedule"
      },
      storageLocation: "Supabase: 'user_schedules' table (authenticated) | sessionStorage: 'guest_schedules' (guest)",
      relatedEntities: ["schedule_blocks", "palette_items"]
    },

    schedule_block: {
      name: "Schedule Block",
      description: "A single time block in a schedule (e.g., CS 11 Mon 10:00-11:00)",
      keyFields: {
        schedule_id: "Parent schedule",
        course_code: "Course being scheduled",
        day_of_week: "0=Sunday, 1=Monday, etc.",
        start_time: "Start time (HH:MM)",
        end_time: "End time (HH:MM)",
        room: "Classroom location"
      },
      storageLocation: "Supabase: 'schedule_blocks' table (authenticated) | Part of schedule object in sessionStorage (guest)",
      relatedEntities: ["schedules", "courses", "palette_items"]
    },

    grade_plan: {
      name: "Grade Plan",
      description: "A projected academic plan with expected grades for courses",
      keyFields: {
        plan_id: "Unique identifier",
        plan_name: "User-defined name",
        curriculum_version_id: "Based on which curriculum",
        is_active: "Whether this is the active plan"
      },
      storageLocation: "Supabase: 'user_grade_plans' table (authenticated) | sessionStorage: 'guest_grade_plans' (guest)",
      relatedEntities: ["grade_plan_courses", "curriculum_versions"]
    }
  } as { [key: string]: EntityDefinition },

  storageLayers: {
    sessionStorage: {
      name: "sessionStorage (Guest Mode)",
      description: "Browser's sessionStorage API for temporary guest data",
      persistence: "Cleared when browser tab/window closes",
      useCase: "Guest users exploring the app without creating an account"
    },
    supabase: {
      name: "Supabase Backend (Authenticated Mode)",
      description: "PostgreSQL database with RLS policies and real-time sync",
      persistence: "Permanent, synced across devices",
      useCase: "Registered users with accounts"
    },
    reactQueryCache: {
      name: "React Query Cache",
      description: "In-memory cache of server data with automatic invalidation",
      persistence: "Session-based, cleared on refresh",
      useCase: "Performance optimization, reducing unnecessary API calls"
    }
  } as { [key: string]: StorageLayer },

  commonOperations: {
    programSwitch: {
      name: "Program Switch",
      description: "User changes their enrolled program (e.g., from CS to Economics)",
      triggers: [
        "User selects different program in Program Selection page",
        "User creates new program enrollment"
      ],
      sideEffects: [
        "Invalidates curriculum cache (requirement_groups, grouped_courses)",
        "Clears old curriculum data from display",
        "Fetches new curriculum data for selected program",
        "May clear incompatible grade plans or schedules"
      ],
      relatedLogs: ["PROGRAM-SELECTION", "QUERY", "STORAGE"]
    },

    cacheInvalidation: {
      name: "Cache Invalidation",
      description: "Clearing React Query cache to force fresh data fetch",
      triggers: [
        "Program change",
        "Data mutation (create/update/delete)",
        "Manual refresh",
        "Stale data detection"
      ],
      sideEffects: [
        "Next query will fetch from source (Supabase or sessionStorage)",
        "May cause brief loading state",
        "Ensures data consistency"
      ],
      relatedLogs: ["QUERY"]
    },

    guestToAuthSync: {
      name: "Guest to Authenticated Sync",
      description: "Transferring guest data to backend after user signs up/logs in",
      triggers: [
        "User signs up after using guest mode",
        "User logs in after exploring as guest"
      ],
      sideEffects: [
        "Copies sessionStorage data to Supabase",
        "Generates proper UUIDs for all entities",
        "Establishes user ownership via user_id",
        "Clears guest data from sessionStorage"
      ],
      relatedLogs: ["AUTH", "STORAGE", "API"]
    },

    scheduleCreation: {
      name: "Schedule Creation",
      description: "Creating a new class schedule for a term",
      triggers: [
        "User first visits Schedule Builder",
        "User clicks 'New Schedule' button"
      ],
      sideEffects: [
        "Creates schedule record in storage",
        "Initializes empty palette",
        "Sets as active schedule if first one",
        "Generates unique schedule_id"
      ],
      relatedLogs: ["SCHEDULE", "STORAGE"]
    }
  } as { [key: string]: CommonOperation },

  glossary: {
    curriculum_version_id: "Unique identifier for a specific version of an academic program's curriculum. Programs update their curricula over time, so students follow the version that was active when they enrolled.",
    program_id: "Unique identifier for an academic program/degree (e.g., BS Computer Science, BA Economics)",
    track_id: "Optional specialization within a program (e.g., 'Machine Learning' track within CS)",
    term_code: "Academic term identifier (format: 'YYYY-YYYY-Semester', e.g., '2025-2026-First Semester')",
    course_code: "University course code (e.g., 'CS 11', 'MATH 20', 'PHYS 71.1')",
    user_id: "Unique identifier for authenticated users (UUID from Supabase auth)",
    schedule_id: "Unique identifier for a class schedule",
    plan_id: "Unique identifier for a grade plan",
    req_group_id: "Unique identifier for a requirement group within a curriculum",
    palette_item_id: "Unique identifier for a course in the schedule palette (courses waiting to be placed on schedule)",
    aisis_schedule_id: "Reference to imported schedule data from AISIS (university system)",
    RLS: "Row Level Security - Supabase feature ensuring users can only access their own data",
    QPI: "Quality Point Index - GPA equivalent used by the university",
    GWA: "General Weighted Average - Overall academic performance metric",
    sessionStorage: "Browser API for storing data that persists only for the current tab session",
    React_Query_Cache: "In-memory cache managed by TanStack Query for optimizing data fetching"
  },

  logCategories: {
    api: "HTTP requests to backend (Supabase API calls)",
    storage: "Storage operations (sessionStorage, localStorage, indexedDB)",
    query: "React Query operations (fetch, cache, invalidate)",
    auth: "Authentication operations (login, signup, guest mode, logout)",
    component: "React component lifecycle and state changes",
    navigation: "Route changes and page transitions",
    schedule: "Schedule builder operations",
    "program-selection": "Program selection and enrollment operations",
    "grade-planner": "Grade planning and projection operations",
    ui: "User interface interactions and updates"
  }
};

export function getEntityDefinition(entityType: string): EntityDefinition | undefined {
  return APPLICATION_METADATA.entities[entityType];
}

export function getStorageLayerInfo(layer: string): StorageLayer | undefined {
  return APPLICATION_METADATA.storageLayers[layer];
}

export function getOperationInfo(operation: string): CommonOperation | undefined {
  return APPLICATION_METADATA.commonOperations[operation];
}

export function getGlossaryTerm(term: string): string | undefined {
  return APPLICATION_METADATA.glossary[term as keyof typeof APPLICATION_METADATA.glossary];
}
