export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      aisis_schedules: {
        Row: {
          course_title: string
          created_at: string | null
          days_of_week: number[] | null
          delivery_mode: string | null
          department: string
          deprecated: boolean | null
          end_time: string
          id: string
          import_source: string | null
          instructor: string | null
          language: string | null
          level: string | null
          max_capacity: number | null
          remarks: string | null
          room: string
          section: string
          start_time: string
          subject_code: string
          term_code: string
          time_pattern: string
          units: number
          updated_at: string | null
        }
        Insert: {
          course_title: string
          created_at?: string | null
          days_of_week?: number[] | null
          delivery_mode?: string | null
          department: string
          deprecated?: boolean | null
          end_time: string
          id?: string
          import_source?: string | null
          instructor?: string | null
          language?: string | null
          level?: string | null
          max_capacity?: number | null
          remarks?: string | null
          room: string
          section: string
          start_time: string
          subject_code: string
          term_code: string
          time_pattern: string
          units: number
          updated_at?: string | null
        }
        Update: {
          course_title?: string
          created_at?: string | null
          days_of_week?: number[] | null
          delivery_mode?: string | null
          department?: string
          deprecated?: boolean | null
          end_time?: string
          id?: string
          import_source?: string | null
          instructor?: string | null
          language?: string | null
          level?: string | null
          max_capacity?: number | null
          remarks?: string | null
          room?: string
          section?: string
          start_time?: string
          subject_code?: string
          term_code?: string
          time_pattern?: string
          units?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          cumulative_qpi: number | null
          display_name: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          message_content: string | null
          message_type: string
          program_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          cumulative_qpi?: number | null
          display_name: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          message_content?: string | null
          message_type: string
          program_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          cumulative_qpi?: number | null
          display_name?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          message_content?: string | null
          message_type?: string
          program_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chat_online_users: {
        Row: {
          display_name: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          display_name: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          display_name?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_read_receipts: {
        Row: {
          id: string
          message_id: string | null
          read_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          message_id?: string | null
          read_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          message_id?: string | null
          read_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_typing_indicators: {
        Row: {
          display_name: string
          started_typing_at: string
          user_id: string
        }
        Insert: {
          display_name: string
          started_typing_at?: string
          user_id: string
        }
        Update: {
          display_name?: string
          started_typing_at?: string
          user_id?: string
        }
        Relationships: []
      }
      course_equivalencies: {
        Row: {
          created_at: string | null
          equivalence_type: string
          from_course_id: string
          id: string
          notes: string | null
          to_course_id: string
          units_override: number | null
        }
        Insert: {
          created_at?: string | null
          equivalence_type?: string
          from_course_id: string
          id?: string
          notes?: string | null
          to_course_id: string
          units_override?: number | null
        }
        Update: {
          created_at?: string | null
          equivalence_type?: string
          from_course_id?: string
          id?: string
          notes?: string | null
          to_course_id?: string
          units_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "course_equivalencies_from_course_id_fkey"
            columns: ["from_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_equivalencies_to_course_id_fkey"
            columns: ["to_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_school_usage: {
        Row: {
          course_id: string
          created_at: string | null
          curriculum_count: number | null
          first_seen_at: string | null
          id: string
          school_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          curriculum_count?: number | null
          first_seen_at?: string | null
          id?: string
          school_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          curriculum_count?: number | null
          first_seen_at?: string | null
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_school_usage_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_school_usage_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          catalog_no: string | null
          category_tags: string[] | null
          course_code: string
          course_title: string
          created_at: string | null
          grade_mode: string | null
          id: string
          is_university_wide: boolean | null
          prereq_expr: string | null
          repeatable: boolean | null
          school_id: string | null
          units: number
          updated_at: string | null
        }
        Insert: {
          catalog_no?: string | null
          category_tags?: string[] | null
          course_code: string
          course_title: string
          created_at?: string | null
          grade_mode?: string | null
          id?: string
          is_university_wide?: boolean | null
          prereq_expr?: string | null
          repeatable?: boolean | null
          school_id?: string | null
          units: number
          updated_at?: string | null
        }
        Update: {
          catalog_no?: string | null
          category_tags?: string[] | null
          course_code?: string
          course_title?: string
          created_at?: string | null
          grade_mode?: string | null
          id?: string
          is_university_wide?: boolean | null
          prereq_expr?: string | null
          repeatable?: boolean | null
          school_id?: string | null
          units?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_versions: {
        Row: {
          created_at: string | null
          effective_end: string | null
          effective_start: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          program_id: string
          track_id: string | null
          updated_at: string | null
          version_label: string
          version_sem: number | null
          version_seq: number | null
          version_year: number | null
        }
        Insert: {
          created_at?: string | null
          effective_end?: string | null
          effective_start?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          program_id: string
          track_id?: string | null
          updated_at?: string | null
          version_label: string
          version_sem?: number | null
          version_seq?: number | null
          version_year?: number | null
        }
        Update: {
          created_at?: string | null
          effective_end?: string | null
          effective_start?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          program_id?: string
          track_id?: string | null
          updated_at?: string | null
          version_label?: string
          version_sem?: number | null
          version_seq?: number | null
          version_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_versions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_versions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "program_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_program_courses: {
        Row: {
          category: string
          course_code: string
          course_title: string
          created_at: string | null
          custom_program_id: string | null
          id: string
          units: number
        }
        Insert: {
          category: string
          course_code: string
          course_title: string
          created_at?: string | null
          custom_program_id?: string | null
          id?: string
          units: number
        }
        Update: {
          category?: string
          course_code?: string
          course_title?: string
          created_at?: string | null
          custom_program_id?: string | null
          id?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_program_courses_custom_program_id_fkey"
            columns: ["custom_program_id"]
            isOneToOne: false
            referencedRelation: "custom_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_programs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          total_units: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          total_units?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          total_units?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      freedom_wall_posts: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          featured_at: string
          id: string
          image_url: string | null
          post_url: string
          posted_at: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          featured_at?: string
          id?: string
          image_url?: string | null
          post_url: string
          posted_at: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          featured_at?: string
          id?: string
          image_url?: string | null
          post_url?: string
          posted_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      function_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_message: string
          event_type: string | null
          function_name: string
          id: string
          import_job_id: string | null
          level: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_message: string
          event_type?: string | null
          function_name: string
          id?: string
          import_job_id?: string | null
          level: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_message?: string
          event_type?: string | null
          function_name?: string
          id?: string
          import_job_id?: string | null
          level?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "function_logs_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          control_action: string | null
          courses_processed: number | null
          created_at: string | null
          created_program_id: string | null
          created_track_id: string | null
          created_version_id: string | null
          department: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          job_type: string
          last_scraped_page: string | null
          pages_scraped: number | null
          partial_data: Json | null
          paused_at: string | null
          program_code: string | null
          program_name: string | null
          progress: number | null
          progress_checkpoint: Json | null
          schedules_processed: number | null
          scrape_mode: string | null
          started_at: string | null
          status: string
          term_code: string | null
          total_courses: number | null
          total_pages: number | null
          total_schedules: number | null
          track_code: string | null
          updated_at: string | null
          user_id: string
          version_label: string | null
        }
        Insert: {
          completed_at?: string | null
          control_action?: string | null
          courses_processed?: number | null
          created_at?: string | null
          created_program_id?: string | null
          created_track_id?: string | null
          created_version_id?: string | null
          department?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          job_type?: string
          last_scraped_page?: string | null
          pages_scraped?: number | null
          partial_data?: Json | null
          paused_at?: string | null
          program_code?: string | null
          program_name?: string | null
          progress?: number | null
          progress_checkpoint?: Json | null
          schedules_processed?: number | null
          scrape_mode?: string | null
          started_at?: string | null
          status?: string
          term_code?: string | null
          total_courses?: number | null
          total_pages?: number | null
          total_schedules?: number | null
          track_code?: string | null
          updated_at?: string | null
          user_id: string
          version_label?: string | null
        }
        Update: {
          completed_at?: string | null
          control_action?: string | null
          courses_processed?: number | null
          created_at?: string | null
          created_program_id?: string | null
          created_track_id?: string | null
          created_version_id?: string | null
          department?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          job_type?: string
          last_scraped_page?: string | null
          pages_scraped?: number | null
          partial_data?: Json | null
          paused_at?: string | null
          program_code?: string | null
          program_name?: string | null
          progress?: number | null
          progress_checkpoint?: Json | null
          schedules_processed?: number | null
          scrape_mode?: string | null
          started_at?: string | null
          status?: string
          term_code?: string | null
          total_courses?: number | null
          total_pages?: number | null
          total_schedules?: number | null
          track_code?: string | null
          updated_at?: string | null
          user_id?: string
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_created_program_id_fkey"
            columns: ["created_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_created_track_id_fkey"
            columns: ["created_track_id"]
            isOneToOne: false
            referencedRelation: "program_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_created_version_id_fkey"
            columns: ["created_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cohort_year: string | null
          created_at: string | null
          display_name: string
          email: string
          entry_year: string | null
          id: string
          show_on_leaderboard: boolean | null
          student_number: string | null
          theme_color_hue: number | null
          theme_color_lightness: number | null
          theme_color_mode: string | null
          theme_color_saturation: number | null
          updated_at: string | null
        }
        Insert: {
          cohort_year?: string | null
          created_at?: string | null
          display_name: string
          email: string
          entry_year?: string | null
          id: string
          show_on_leaderboard?: boolean | null
          student_number?: string | null
          theme_color_hue?: number | null
          theme_color_lightness?: number | null
          theme_color_mode?: string | null
          theme_color_saturation?: number | null
          updated_at?: string | null
        }
        Update: {
          cohort_year?: string | null
          created_at?: string | null
          display_name?: string
          email?: string
          entry_year?: string | null
          id?: string
          show_on_leaderboard?: boolean | null
          student_number?: string | null
          theme_color_hue?: number | null
          theme_color_lightness?: number | null
          theme_color_mode?: string | null
          theme_color_saturation?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      program_courses: {
        Row: {
          category: string
          course_code: string
          course_title: string
          created_at: string | null
          id: string
          prerequisites: string[] | null
          program_id: string | null
          semester: string | null
          units: number
          year_level: number | null
        }
        Insert: {
          category: string
          course_code: string
          course_title: string
          created_at?: string | null
          id?: string
          prerequisites?: string[] | null
          program_id?: string | null
          semester?: string | null
          units: number
          year_level?: number | null
        }
        Update: {
          category?: string
          course_code?: string
          course_title?: string
          created_at?: string | null
          id?: string
          prerequisites?: string[] | null
          program_id?: string | null
          semester?: string | null
          units?: number
          year_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_courses_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_enrollments: {
        Row: {
          created_at: string | null
          curriculum_version_id: string
          end_term: string | null
          id: string
          notes: string | null
          program_id: string
          start_term: string
          status: string
          track_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          curriculum_version_id: string
          end_term?: string | null
          id?: string
          notes?: string | null
          program_id: string
          start_term: string
          status?: string
          track_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          curriculum_version_id?: string
          end_term?: string | null
          id?: string
          notes?: string | null
          program_id?: string
          start_term?: string
          status?: string
          track_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_enrollments_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "program_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      program_tracks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          program_id: string
          track_code: string
          track_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          program_id: string
          track_code: string
          track_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          program_id?: string
          track_code?: string
          track_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_tracks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          school_id: string
          total_units: number
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          school_id: string
          total_units: number
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          school_id?: string
          total_units?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_groups: {
        Row: {
          created_at: string | null
          curriculum_id: string
          description: string | null
          display_order: number | null
          double_counting_rule: string | null
          group_type: string
          id: string
          max_units: number | null
          min_courses: number | null
          min_units: number | null
          name: string
          priority: number | null
        }
        Insert: {
          created_at?: string | null
          curriculum_id: string
          description?: string | null
          display_order?: number | null
          double_counting_rule?: string | null
          group_type: string
          id?: string
          max_units?: number | null
          min_courses?: number | null
          min_units?: number | null
          name: string
          priority?: number | null
        }
        Update: {
          created_at?: string | null
          curriculum_id?: string
          description?: string | null
          display_order?: number | null
          double_counting_rule?: string | null
          group_type?: string
          id?: string
          max_units?: number | null
          min_courses?: number | null
          min_units?: number | null
          name?: string
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requirement_groups_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_rules: {
        Row: {
          choices_count: number | null
          code_prefix: string | null
          course_ids: string[] | null
          course_pattern: string | null
          created_at: string | null
          description: string | null
          id: string
          req_group_id: string
          rule_type: string
          tag_pattern: string | null
          units_override: number | null
        }
        Insert: {
          choices_count?: number | null
          code_prefix?: string | null
          course_ids?: string[] | null
          course_pattern?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          req_group_id: string
          rule_type: string
          tag_pattern?: string | null
          units_override?: number | null
        }
        Update: {
          choices_count?: number | null
          code_prefix?: string | null
          course_ids?: string[] | null
          course_pattern?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          req_group_id?: string
          rule_type?: string
          tag_pattern?: string | null
          units_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requirement_rules_req_group_id_fkey"
            columns: ["req_group_id"]
            isOneToOne: false
            referencedRelation: "requirement_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_blocks: {
        Row: {
          aisis_schedule_id: string | null
          color: string | null
          course_code: string
          course_title: string | null
          created_at: string | null
          day_of_week: number
          end_time: string
          font_color: string | null
          font_size: string | null
          id: string
          instructor: string | null
          is_auto_filled: boolean | null
          palette_item_id: string | null
          room: string
          schedule_id: string
          section: string | null
          start_time: string
          units: number | null
        }
        Insert: {
          aisis_schedule_id?: string | null
          color?: string | null
          course_code: string
          course_title?: string | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          font_color?: string | null
          font_size?: string | null
          id?: string
          instructor?: string | null
          is_auto_filled?: boolean | null
          palette_item_id?: string | null
          room: string
          schedule_id: string
          section?: string | null
          start_time: string
          units?: number | null
        }
        Update: {
          aisis_schedule_id?: string | null
          color?: string | null
          course_code?: string
          course_title?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          font_color?: string | null
          font_size?: string | null
          id?: string
          instructor?: string | null
          is_auto_filled?: boolean | null
          palette_item_id?: string | null
          room?: string
          schedule_id?: string
          section?: string | null
          start_time?: string
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_aisis_schedule_id_fkey"
            columns: ["aisis_schedule_id"]
            isOneToOne: false
            referencedRelation: "aisis_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_palette_item_id_fkey"
            columns: ["palette_item_id"]
            isOneToOne: false
            referencedRelation: "schedule_palette_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "user_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_palette_items: {
        Row: {
          color: string | null
          course_code: string
          course_title: string
          created_at: string | null
          id: string
          is_manual: boolean | null
          placed_count: number
          required_count: number
          schedule_id: string
          section: string | null
        }
        Insert: {
          color?: string | null
          course_code: string
          course_title: string
          created_at?: string | null
          id?: string
          is_manual?: boolean | null
          placed_count?: number
          required_count?: number
          schedule_id: string
          section?: string | null
        }
        Update: {
          color?: string | null
          course_code?: string
          course_title?: string
          created_at?: string | null
          id?: string
          is_manual?: boolean | null
          placed_count?: number
          required_count?: number
          schedule_id?: string
          section?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_palette_items_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "user_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_share_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string | null
          id: string
          schedule_data: Json
          schedule_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          schedule_data: Json
          schedule_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          schedule_data?: Json
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_share_codes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "user_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      scraped_account_info: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          import_job_id: string | null
          mobile: string | null
          program: string | null
          raw_html: string | null
          student_id: string | null
          user_id: string
          year_level: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          import_job_id?: string | null
          mobile?: string | null
          program?: string | null
          raw_html?: string | null
          student_id?: string | null
          user_id: string
          year_level?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          import_job_id?: string | null
          mobile?: string | null
          program?: string | null
          raw_html?: string | null
          student_id?: string | null
          user_id?: string
          year_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scraped_account_info_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_curriculum: {
        Row: {
          category: string
          course_code: string
          course_title: string
          created_at: string | null
          id: string
          import_job_id: string | null
          is_placeholder: boolean | null
          prerequisites: string[] | null
          program_code: string
          program_name: string
          raw_html: string | null
          scraped_at: string | null
          semester: string
          track_code: string | null
          units: number
          user_id: string
          version_label: string
          version_sem: number | null
          version_year: number | null
          year_level: number
        }
        Insert: {
          category: string
          course_code: string
          course_title: string
          created_at?: string | null
          id?: string
          import_job_id?: string | null
          is_placeholder?: boolean | null
          prerequisites?: string[] | null
          program_code: string
          program_name: string
          raw_html?: string | null
          scraped_at?: string | null
          semester: string
          track_code?: string | null
          units: number
          user_id: string
          version_label: string
          version_sem?: number | null
          version_year?: number | null
          year_level: number
        }
        Update: {
          category?: string
          course_code?: string
          course_title?: string
          created_at?: string | null
          id?: string
          import_job_id?: string | null
          is_placeholder?: boolean | null
          prerequisites?: string[] | null
          program_code?: string
          program_name?: string
          raw_html?: string | null
          scraped_at?: string | null
          semester?: string
          track_code?: string | null
          units?: number
          user_id?: string
          version_label?: string
          version_sem?: number | null
          version_year?: number | null
          year_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "scraped_curriculum_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_hold_orders: {
        Row: {
          action_required: string | null
          created_at: string | null
          date_imposed: string | null
          hold_type: string | null
          id: string
          import_job_id: string | null
          office: string | null
          raw_html: string | null
          reason: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          action_required?: string | null
          created_at?: string | null
          date_imposed?: string | null
          hold_type?: string | null
          id?: string
          import_job_id?: string | null
          office?: string | null
          raw_html?: string | null
          reason?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          action_required?: string | null
          created_at?: string | null
          date_imposed?: string | null
          hold_type?: string | null
          id?: string
          import_job_id?: string | null
          office?: string | null
          raw_html?: string | null
          reason?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraped_hold_orders_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_my_grades: {
        Row: {
          course_code: string | null
          course_title: string | null
          created_at: string | null
          grade: string | null
          grade_points: number | null
          id: string
          import_job_id: string | null
          instructor: string | null
          raw_html: string | null
          remarks: string | null
          term: string | null
          units: number | null
          user_id: string
        }
        Insert: {
          course_code?: string | null
          course_title?: string | null
          created_at?: string | null
          grade?: string | null
          grade_points?: number | null
          id?: string
          import_job_id?: string | null
          instructor?: string | null
          raw_html?: string | null
          remarks?: string | null
          term?: string | null
          units?: number | null
          user_id: string
        }
        Update: {
          course_code?: string | null
          course_title?: string | null
          created_at?: string | null
          grade?: string | null
          grade_points?: number | null
          id?: string
          import_job_id?: string | null
          instructor?: string | null
          raw_html?: string | null
          remarks?: string | null
          term?: string | null
          units?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraped_my_grades_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_my_program: {
        Row: {
          category: string | null
          course_code: string | null
          course_title: string | null
          created_at: string | null
          grade: string | null
          id: string
          import_job_id: string | null
          raw_html: string | null
          semester: string | null
          status: string | null
          term_taken: string | null
          units: number | null
          user_id: string
          year_level: number | null
        }
        Insert: {
          category?: string | null
          course_code?: string | null
          course_title?: string | null
          created_at?: string | null
          grade?: string | null
          id?: string
          import_job_id?: string | null
          raw_html?: string | null
          semester?: string | null
          status?: string | null
          term_taken?: string | null
          units?: number | null
          user_id: string
          year_level?: number | null
        }
        Update: {
          category?: string | null
          course_code?: string | null
          course_title?: string | null
          created_at?: string | null
          grade?: string | null
          id?: string
          import_job_id?: string | null
          raw_html?: string | null
          semester?: string | null
          status?: string | null
          term_taken?: string | null
          units?: number | null
          user_id?: string
          year_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scraped_my_program_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_my_schedule: {
        Row: {
          course_code: string | null
          course_title: string | null
          created_at: string | null
          enrollment_status: string | null
          id: string
          import_job_id: string | null
          instructor: string | null
          raw_html: string | null
          room: string | null
          schedule: string | null
          section: string | null
          term: string | null
          units: number | null
          user_id: string
        }
        Insert: {
          course_code?: string | null
          course_title?: string | null
          created_at?: string | null
          enrollment_status?: string | null
          id?: string
          import_job_id?: string | null
          instructor?: string | null
          raw_html?: string | null
          room?: string | null
          schedule?: string | null
          section?: string | null
          term?: string | null
          units?: number | null
          user_id: string
        }
        Update: {
          course_code?: string | null
          course_title?: string | null
          created_at?: string | null
          enrollment_status?: string | null
          id?: string
          import_job_id?: string | null
          instructor?: string | null
          raw_html?: string | null
          room?: string | null
          schedule?: string | null
          section?: string | null
          term?: string | null
          units?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraped_my_schedule_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_aisis_credentials: {
        Row: {
          created_at: string | null
          encrypted_password: string
          encrypted_username: string
          id: string
          last_used_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_password: string
          encrypted_username: string
          id?: string
          last_used_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_password?: string
          encrypted_username?: string
          id?: string
          last_used_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_courses: {
        Row: {
          counts_for_qpi: boolean | null
          course_code: string
          course_id: string | null
          course_title: string
          created_at: string | null
          grade: string
          grading_basis: string | null
          id: string
          qpi_value: number | null
          school_year: string
          semester: string
          term_code: string | null
          units: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          counts_for_qpi?: boolean | null
          course_code: string
          course_id?: string | null
          course_title: string
          created_at?: string | null
          grade: string
          grading_basis?: string | null
          id?: string
          qpi_value?: number | null
          school_year: string
          semester: string
          term_code?: string | null
          units: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          counts_for_qpi?: boolean | null
          course_code?: string
          course_id?: string | null
          course_title?: string
          created_at?: string | null
          grade?: string
          grading_basis?: string | null
          id?: string
          qpi_value?: number | null
          school_year?: string
          semester?: string
          term_code?: string | null
          units?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_courses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_grade_plan_courses: {
        Row: {
          course_code: string
          course_id: string | null
          course_title: string
          created_at: string
          grade: string | null
          id: string
          is_from_actual: boolean
          plan_id: string
          semester_label: string | null
          units: number
          updated_at: string
          year_level: number | null
        }
        Insert: {
          course_code: string
          course_id?: string | null
          course_title: string
          created_at?: string
          grade?: string | null
          id?: string
          is_from_actual?: boolean
          plan_id: string
          semester_label?: string | null
          units: number
          updated_at?: string
          year_level?: number | null
        }
        Update: {
          course_code?: string
          course_id?: string | null
          course_title?: string
          created_at?: string
          grade?: string | null
          id?: string
          is_from_actual?: boolean
          plan_id?: string
          semester_label?: string | null
          units?: number
          updated_at?: string
          year_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_grade_plan_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_grade_plan_courses_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "user_grade_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_grade_plans: {
        Row: {
          created_at: string
          curriculum_version_id: string
          id: string
          is_active: boolean
          plan_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          curriculum_version_id: string
          id?: string
          is_active?: boolean
          plan_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          curriculum_version_id?: string
          id?: string
          is_active?: boolean
          plan_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_grade_plans_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_programs: {
        Row: {
          created_at: string | null
          curriculum_version_id: string | null
          entry_year: string
          id: string
          is_primary: boolean | null
          program_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          curriculum_version_id?: string | null
          entry_year: string
          id?: string
          is_primary?: boolean | null
          program_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          curriculum_version_id?: string | null
          entry_year?: string
          id?: string
          is_primary?: boolean | null
          program_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_programs_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_schedules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          schedule_name: string
          term_code: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          schedule_name: string
          term_code: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          schedule_name?: string
          term_code?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      curriculum_downloads: {
        Row: {
          course_count: number | null
          courses: Json | null
          import_job_id: string | null
          program_code: string | null
          program_name: string | null
          scraped_at: string | null
          user_id: string | null
          version_sem: number | null
          version_year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scraped_curriculum_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cleanup_stale_import_jobs: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
