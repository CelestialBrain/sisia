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
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      aisis_schedules: {
        Row: {
          course_title: string | null
          created_at: string | null
          days_of_week: string[] | null
          department: string | null
          deprecated: boolean | null
          end_time: string | null
          id: string
          instructor: string | null
          max_capacity: number | null
          room: string | null
          section: string
          start_time: string | null
          subject_code: string
          term_code: string
          time_pattern: string | null
          units: number | null
          updated_at: string | null
        }
        Insert: {
          course_title?: string | null
          created_at?: string | null
          days_of_week?: string[] | null
          department?: string | null
          deprecated?: boolean | null
          end_time?: string | null
          id?: string
          instructor?: string | null
          max_capacity?: number | null
          room?: string | null
          section: string
          start_time?: string | null
          subject_code: string
          term_code: string
          time_pattern?: string | null
          units?: number | null
          updated_at?: string | null
        }
        Update: {
          course_title?: string | null
          created_at?: string | null
          days_of_week?: string[] | null
          department?: string | null
          deprecated?: boolean | null
          end_time?: string | null
          id?: string
          instructor?: string | null
          max_capacity?: number | null
          room?: string | null
          section?: string
          start_time?: string | null
          subject_code?: string
          term_code?: string
          time_pattern?: string | null
          units?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string | null
          cumulative_qpi: number | null
          display_name: string
          file_name: string | null
          file_url: string | null
          id: string
          message_content: string
          message_type: string | null
          program_name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          cumulative_qpi?: number | null
          display_name: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_content: string
          message_type?: string | null
          program_name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          cumulative_qpi?: number | null
          display_name?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_content?: string
          message_type?: string | null
          program_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_online_users: {
        Row: {
          display_name: string
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          display_name: string
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          display_name?: string
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
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
          started_typing_at: string | null
          user_id: string
        }
        Insert: {
          display_name: string
          started_typing_at?: string | null
          user_id: string
        }
        Update: {
          display_name?: string
          started_typing_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      course_equivalencies: {
        Row: {
          created_at: string | null
          equivalence_type: string | null
          from_course_id: string
          id: string
          to_course_id: string
        }
        Insert: {
          created_at?: string | null
          equivalence_type?: string | null
          from_course_id: string
          id?: string
          to_course_id: string
        }
        Update: {
          created_at?: string | null
          equivalence_type?: string | null
          from_course_id?: string
          id?: string
          to_course_id?: string
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
      courses: {
        Row: {
          course_code: string
          course_title: string
          created_at: string | null
          description: string | null
          id: string
          prereq_expr: string | null
          school_id: string | null
          units: number
          updated_at: string | null
        }
        Insert: {
          course_code: string
          course_title: string
          created_at?: string | null
          description?: string | null
          id?: string
          prereq_expr?: string | null
          school_id?: string | null
          units: number
          updated_at?: string | null
        }
        Update: {
          course_code?: string
          course_title?: string
          created_at?: string | null
          description?: string | null
          id?: string
          prereq_expr?: string | null
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
      curriculum_downloads: {
        Row: {
          created_at: string | null
          download_data: Json | null
          id: string
          program_code: string
          user_id: string
          version_label: string | null
        }
        Insert: {
          created_at?: string | null
          download_data?: Json | null
          id?: string
          program_code: string
          user_id: string
          version_label?: string | null
        }
        Update: {
          created_at?: string | null
          download_data?: Json | null
          id?: string
          program_code?: string
          user_id?: string
          version_label?: string | null
        }
        Relationships: []
      }
      curriculum_versions: {
        Row: {
          created_at: string | null
          effective_start: string | null
          id: string
          is_active: boolean | null
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
          effective_start?: string | null
          id?: string
          is_active?: boolean | null
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
          effective_start?: string | null
          id?: string
          is_active?: boolean | null
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
          course_code: string
          course_title: string
          created_at: string | null
          custom_program_id: string
          id: string
          semester: number | null
          units: number
          year_level: number | null
        }
        Insert: {
          course_code: string
          course_title: string
          created_at?: string | null
          custom_program_id: string
          id?: string
          semester?: number | null
          units: number
          year_level?: number | null
        }
        Update: {
          course_code?: string
          course_title?: string
          created_at?: string | null
          custom_program_id?: string
          id?: string
          semester?: number | null
          units?: number
          year_level?: number | null
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
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          total_units?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          total_units?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      function_logs: {
        Row: {
          created_at: string | null
          details: string | null
          event_message: string | null
          event_type: string | null
          function_name: string
          id: string
          import_job_id: string | null
          level: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          event_message?: string | null
          event_type?: string | null
          function_name: string
          id?: string
          import_job_id?: string | null
          level: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          event_message?: string | null
          event_type?: string | null
          function_name?: string
          id?: string
          import_job_id?: string | null
          level?: string
          metadata?: Json | null
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
          department: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          job_type: string
          partial_data: Json | null
          program_code: string | null
          program_name: string | null
          progress: number | null
          schedules_processed: number | null
          started_at: string | null
          status: string
          term_code: string | null
          total_courses: number | null
          total_schedules: number | null
          updated_at: string | null
          user_id: string
          version_label: string | null
        }
        Insert: {
          completed_at?: string | null
          control_action?: string | null
          courses_processed?: number | null
          created_at?: string | null
          department?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          job_type: string
          partial_data?: Json | null
          program_code?: string | null
          program_name?: string | null
          progress?: number | null
          schedules_processed?: number | null
          started_at?: string | null
          status?: string
          term_code?: string | null
          total_courses?: number | null
          total_schedules?: number | null
          updated_at?: string | null
          user_id: string
          version_label?: string | null
        }
        Update: {
          completed_at?: string | null
          control_action?: string | null
          courses_processed?: number | null
          created_at?: string | null
          department?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          job_type?: string
          partial_data?: Json | null
          program_code?: string | null
          program_name?: string | null
          progress?: number | null
          schedules_processed?: number | null
          started_at?: string | null
          status?: string
          term_code?: string | null
          total_courses?: number | null
          total_schedules?: number | null
          updated_at?: string | null
          user_id?: string
          version_label?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          chat_timer_enabled: boolean | null
          chat_timer_minutes: number | null
          created_at: string | null
          display_name: string | null
          email: string | null
          entry_year: string | null
          id: string
          show_on_leaderboard: boolean | null
          student_number: string | null
          theme_color_accent: string | null
          theme_color_hue: number | null
          theme_color_lightness: number | null
          theme_color_mode: string | null
          theme_color_primary: string | null
          theme_color_saturation: number | null
          theme_color_secondary: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          chat_timer_enabled?: boolean | null
          chat_timer_minutes?: number | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          entry_year?: string | null
          id: string
          show_on_leaderboard?: boolean | null
          student_number?: string | null
          theme_color_accent?: string | null
          theme_color_hue?: number | null
          theme_color_lightness?: number | null
          theme_color_mode?: string | null
          theme_color_primary?: string | null
          theme_color_saturation?: number | null
          theme_color_secondary?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          chat_timer_enabled?: boolean | null
          chat_timer_minutes?: number | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          entry_year?: string | null
          id?: string
          show_on_leaderboard?: boolean | null
          student_number?: string | null
          theme_color_accent?: string | null
          theme_color_hue?: number | null
          theme_color_lightness?: number | null
          theme_color_mode?: string | null
          theme_color_primary?: string | null
          theme_color_saturation?: number | null
          theme_color_secondary?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      program_enrollments: {
        Row: {
          created_at: string | null
          curriculum_version_id: string | null
          end_term: string | null
          id: string
          is_active: boolean | null
          program_id: string
          status: string | null
          track_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          curriculum_version_id?: string | null
          end_term?: string | null
          id?: string
          is_active?: boolean | null
          program_id: string
          status?: string | null
          track_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          curriculum_version_id?: string | null
          end_term?: string | null
          id?: string
          is_active?: boolean | null
          program_id?: string
          status?: string | null
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
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          program_id: string
          track_code: string
          track_name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          program_id?: string
          track_code?: string
          track_name?: string
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
          school_id: string | null
          total_units: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          school_id?: string | null
          total_units?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          school_id?: string | null
          total_units?: number | null
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
          display_order: number | null
          group_name: string | null
          group_type: string
          id: string
          min_courses: number | null
          min_units: number | null
          name: string | null
        }
        Insert: {
          created_at?: string | null
          curriculum_id: string
          display_order?: number | null
          group_name?: string | null
          group_type: string
          id?: string
          min_courses?: number | null
          min_units?: number | null
          name?: string | null
        }
        Update: {
          created_at?: string | null
          curriculum_id?: string
          display_order?: number | null
          group_name?: string | null
          group_type?: string
          id?: string
          min_courses?: number | null
          min_units?: number | null
          name?: string | null
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
          course_ids: string[] | null
          course_pattern: string | null
          created_at: string | null
          id: string
          req_group_id: string
          rule_type: string
        }
        Insert: {
          course_ids?: string[] | null
          course_pattern?: string | null
          created_at?: string | null
          id?: string
          req_group_id: string
          rule_type: string
        }
        Update: {
          course_ids?: string[] | null
          course_pattern?: string | null
          created_at?: string | null
          id?: string
          req_group_id?: string
          rule_type?: string
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
          room: string | null
          schedule_id: string
          section: string | null
          start_time: string
          units: number | null
        }
        Insert: {
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
          room?: string | null
          schedule_id: string
          section?: string | null
          start_time: string
          units?: number | null
        }
        Update: {
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
          room?: string | null
          schedule_id?: string
          section?: string | null
          start_time?: string
          units?: number | null
        }
        Relationships: [
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
          course_title: string | null
          created_at: string | null
          id: string
          is_manual: boolean | null
          placed_count: number | null
          required_count: number | null
          schedule_id: string
          section: string | null
        }
        Insert: {
          color?: string | null
          course_code: string
          course_title?: string | null
          created_at?: string | null
          id?: string
          is_manual?: boolean | null
          placed_count?: number | null
          required_count?: number | null
          schedule_id: string
          section?: string | null
        }
        Update: {
          color?: string | null
          course_code?: string
          course_title?: string | null
          created_at?: string | null
          id?: string
          is_manual?: boolean | null
          placed_count?: number | null
          required_count?: number | null
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
          schedule_data: Json | null
          schedule_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          schedule_data?: Json | null
          schedule_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          schedule_data?: Json | null
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
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      scraped_account_info: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          program: string | null
          student_id: string | null
          user_id: string
          year_level: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          program?: string | null
          student_id?: string | null
          user_id: string
          year_level?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          program?: string | null
          student_id?: string | null
          user_id?: string
          year_level?: string | null
        }
        Relationships: []
      }
      scraped_curriculum: {
        Row: {
          category: string | null
          course_code: string | null
          course_title: string | null
          courses: Json | null
          created_at: string | null
          id: string
          prerequisites: string | null
          program_code: string
          program_name: string | null
          raw_html: string | null
          semester: number | null
          units: number | null
          user_id: string
          version_label: string | null
          version_sem: number | null
          version_year: number | null
          year_level: number | null
        }
        Insert: {
          category?: string | null
          course_code?: string | null
          course_title?: string | null
          courses?: Json | null
          created_at?: string | null
          id?: string
          prerequisites?: string | null
          program_code: string
          program_name?: string | null
          raw_html?: string | null
          semester?: number | null
          units?: number | null
          user_id: string
          version_label?: string | null
          version_sem?: number | null
          version_year?: number | null
          year_level?: number | null
        }
        Update: {
          category?: string | null
          course_code?: string | null
          course_title?: string | null
          courses?: Json | null
          created_at?: string | null
          id?: string
          prerequisites?: string | null
          program_code?: string
          program_name?: string | null
          raw_html?: string | null
          semester?: number | null
          units?: number | null
          user_id?: string
          version_label?: string | null
          version_sem?: number | null
          version_year?: number | null
          year_level?: number | null
        }
        Relationships: []
      }
      scraped_hold_orders: {
        Row: {
          created_at: string | null
          hold_type: string | null
          id: string
          office: string | null
          reason: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          hold_type?: string | null
          id?: string
          office?: string | null
          reason?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          hold_type?: string | null
          id?: string
          office?: string | null
          reason?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scraped_my_grades: {
        Row: {
          course_code: string
          course_title: string | null
          created_at: string | null
          grade: string | null
          id: string
          term: string | null
          units: number | null
          user_id: string
        }
        Insert: {
          course_code: string
          course_title?: string | null
          created_at?: string | null
          grade?: string | null
          id?: string
          term?: string | null
          units?: number | null
          user_id: string
        }
        Update: {
          course_code?: string
          course_title?: string | null
          created_at?: string | null
          grade?: string | null
          id?: string
          term?: string | null
          units?: number | null
          user_id?: string
        }
        Relationships: []
      }
      scraped_my_program: {
        Row: {
          category: string | null
          course_code: string
          course_title: string | null
          created_at: string | null
          id: string
          semester: number | null
          status: string | null
          units: number | null
          user_id: string
          year_level: number | null
        }
        Insert: {
          category?: string | null
          course_code: string
          course_title?: string | null
          created_at?: string | null
          id?: string
          semester?: number | null
          status?: string | null
          units?: number | null
          user_id: string
          year_level?: number | null
        }
        Update: {
          category?: string | null
          course_code?: string
          course_title?: string | null
          created_at?: string | null
          id?: string
          semester?: number | null
          status?: string | null
          units?: number | null
          user_id?: string
          year_level?: number | null
        }
        Relationships: []
      }
      scraped_my_schedule: {
        Row: {
          course_code: string
          created_at: string | null
          id: string
          schedule: string | null
          section: string | null
          term: string
          user_id: string
        }
        Insert: {
          course_code: string
          created_at?: string | null
          id?: string
          schedule?: string | null
          section?: string | null
          term: string
          user_id: string
        }
        Update: {
          course_code?: string
          created_at?: string | null
          id?: string
          schedule?: string | null
          section?: string | null
          term?: string
          user_id?: string
        }
        Relationships: []
      }
      user_aisis_credentials: {
        Row: {
          created_at: string | null
          encrypted_credentials: string
          id: string
          last_used_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_credentials: string
          id?: string
          last_used_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_credentials?: string
          id?: string
          last_used_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_courses: {
        Row: {
          course_code: string
          course_id: string | null
          course_title: string | null
          created_at: string | null
          grade: string | null
          id: string
          qpi_value: number | null
          school_year: string | null
          semester: number | null
          status: string | null
          term: string | null
          units: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          course_code: string
          course_id?: string | null
          course_title?: string | null
          created_at?: string | null
          grade?: string | null
          id?: string
          qpi_value?: number | null
          school_year?: string | null
          semester?: number | null
          status?: string | null
          term?: string | null
          units?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          course_code?: string
          course_id?: string | null
          course_title?: string | null
          created_at?: string | null
          grade?: string | null
          id?: string
          qpi_value?: number | null
          school_year?: string | null
          semester?: number | null
          status?: string | null
          term?: string | null
          units?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_grade_plan_courses: {
        Row: {
          course_code: string
          course_id: string | null
          course_title: string | null
          created_at: string | null
          expected_grade: string | null
          grade: string | null
          id: string
          is_from_actual: boolean | null
          plan_id: string
          semester_label: string | null
          term_semester: number
          term_year: number
          units: number | null
          updated_at: string | null
          year_level: number | null
        }
        Insert: {
          course_code: string
          course_id?: string | null
          course_title?: string | null
          created_at?: string | null
          expected_grade?: string | null
          grade?: string | null
          id?: string
          is_from_actual?: boolean | null
          plan_id: string
          semester_label?: string | null
          term_semester: number
          term_year: number
          units?: number | null
          updated_at?: string | null
          year_level?: number | null
        }
        Update: {
          course_code?: string
          course_id?: string | null
          course_title?: string | null
          created_at?: string | null
          expected_grade?: string | null
          grade?: string | null
          id?: string
          is_from_actual?: boolean | null
          plan_id?: string
          semester_label?: string | null
          term_semester?: number
          term_year?: number
          units?: number | null
          updated_at?: string | null
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
          created_at: string | null
          curriculum_version_id: string | null
          id: string
          is_active: boolean | null
          plan_name: string
          target_qpi: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          curriculum_version_id?: string | null
          id?: string
          is_active?: boolean | null
          plan_name?: string
          target_qpi?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          curriculum_version_id?: string | null
          id?: string
          is_active?: boolean | null
          plan_name?: string
          target_qpi?: number | null
          updated_at?: string | null
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
          id: string
          program_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          program_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          program_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
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
          name: string
          term_code: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          term_code?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          term_code?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
