-- Grade Tracking System Complete Database Setup

-- 1. Create role enum
CREATE TYPE app_role AS ENUM ('admin', 'user');

-- 2. Create user_roles table (MUST be separate from profiles)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  student_number TEXT,
  bio TEXT,
  avatar_url TEXT,
  show_on_leaderboard BOOLEAN DEFAULT false,
  chat_timer_enabled BOOLEAN DEFAULT false,
  chat_timer_minutes INTEGER DEFAULT 30,
  theme_color_primary TEXT DEFAULT '221 83% 53%',
  theme_color_secondary TEXT DEFAULT '210 40% 96%',
  theme_color_accent TEXT DEFAULT '210 40% 96%',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Auto-create profile and assign 'user' role on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 7. Academic structure tables
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  total_units NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE program_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  track_code TEXT NOT NULL,
  track_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, track_code)
);

ALTER TABLE program_tracks ENABLE ROW LEVEL SECURITY;

CREATE TABLE curriculum_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  track_id UUID REFERENCES program_tracks(id) ON DELETE SET NULL,
  version_label TEXT NOT NULL,
  version_year INTEGER,
  version_sem INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE curriculum_versions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_curriculum_versions_updated_at
  BEFORE UPDATE ON curriculum_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code TEXT UNIQUE NOT NULL,
  course_title TEXT NOT NULL,
  units NUMERIC NOT NULL,
  description TEXT,
  prereq_expr TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE course_equivalencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  to_course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  equivalence_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_course_id, to_course_id)
);

ALTER TABLE course_equivalencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE requirement_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id UUID REFERENCES curriculum_versions(id) ON DELETE CASCADE NOT NULL,
  group_type TEXT NOT NULL,
  group_name TEXT,
  min_units NUMERIC,
  min_courses INTEGER,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE requirement_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE requirement_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  req_group_id UUID REFERENCES requirement_groups(id) ON DELETE CASCADE NOT NULL,
  rule_type TEXT NOT NULL,
  course_pattern TEXT,
  course_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE requirement_rules ENABLE ROW LEVEL SECURITY;

-- 8. User academic data tables
CREATE TABLE program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  curriculum_version_id UUID REFERENCES curriculum_versions(id) ON DELETE SET NULL,
  track_id UUID REFERENCES program_tracks(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE program_enrollments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_program_enrollments_updated_at
  BEFORE UPDATE ON program_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE user_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  course_title TEXT,
  grade TEXT,
  units NUMERIC,
  term TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_user_courses_updated_at
  BEFORE UPDATE ON user_courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE custom_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  total_units NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE custom_programs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_custom_programs_updated_at
  BEFORE UPDATE ON custom_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE custom_program_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_program_id UUID REFERENCES custom_programs(id) ON DELETE CASCADE NOT NULL,
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  units NUMERIC NOT NULL,
  year_level INTEGER,
  semester INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE custom_program_courses ENABLE ROW LEVEL SECURITY;

-- 9. Schedule tables
CREATE TABLE aisis_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_code TEXT NOT NULL,
  department TEXT,
  subject_code TEXT NOT NULL,
  section TEXT NOT NULL,
  course_title TEXT,
  instructor TEXT,
  room TEXT,
  start_time TIME,
  end_time TIME,
  days_of_week TEXT[],
  units NUMERIC,
  max_capacity INTEGER,
  deprecated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(term_code, subject_code, section)
);

ALTER TABLE aisis_schedules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_aisis_schedules_updated_at
  BEFORE UPDATE ON aisis_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE user_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  term_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_schedules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_user_schedules_updated_at
  BEFORE UPDATE ON user_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES user_schedules(id) ON DELETE CASCADE NOT NULL,
  course_code TEXT NOT NULL,
  section TEXT,
  room TEXT,
  instructor TEXT,
  day_of_week INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  color TEXT,
  units NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE TABLE schedule_palette_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES user_schedules(id) ON DELETE CASCADE NOT NULL,
  course_code TEXT NOT NULL,
  section TEXT,
  color TEXT,
  placed_count INTEGER DEFAULT 0,
  required_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schedule_palette_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE schedule_share_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES user_schedules(id) ON DELETE CASCADE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  schedule_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE schedule_share_codes ENABLE ROW LEVEL SECURITY;

-- 10. Chat system tables
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  message_content TEXT NOT NULL,
  cumulative_qpi NUMERIC,
  program_name TEXT,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE chat_typing_indicators (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  started_typing_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE TABLE chat_online_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_online_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE chat_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

ALTER TABLE chat_read_receipts ENABLE ROW LEVEL SECURITY;

-- 11. AISIS scraper tables
CREATE TABLE scraped_curriculum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_code TEXT NOT NULL,
  version_label TEXT,
  courses JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scraped_curriculum ENABLE ROW LEVEL SECURITY;

CREATE TABLE scraped_my_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_code TEXT NOT NULL,
  course_title TEXT,
  grade TEXT,
  term TEXT,
  units NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scraped_my_grades ENABLE ROW LEVEL SECURITY;

CREATE TABLE scraped_my_program (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_code TEXT NOT NULL,
  course_title TEXT,
  category TEXT,
  year_level INTEGER,
  semester INTEGER,
  units NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scraped_my_program ENABLE ROW LEVEL SECURITY;

CREATE TABLE scraped_my_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  term TEXT NOT NULL,
  course_code TEXT NOT NULL,
  section TEXT,
  schedule TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scraped_my_schedule ENABLE ROW LEVEL SECURITY;

CREATE TABLE scraped_account_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_id TEXT,
  full_name TEXT,
  program TEXT,
  year_level TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scraped_account_info ENABLE ROW LEVEL SECURITY;

CREATE TABLE scraped_hold_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hold_type TEXT,
  office TEXT,
  status TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scraped_hold_orders ENABLE ROW LEVEL SECURITY;

-- 12. Import & admin tables
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  program_code TEXT,
  term_code TEXT,
  department TEXT,
  total_courses INTEGER,
  courses_processed INTEGER DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE function_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  level TEXT NOT NULL,
  event_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE function_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- 13. RLS Policies

-- user_roles: Only admins can manage roles
CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON user_roles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON user_roles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON user_roles FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- profiles: Users view own, everyone views leaderboard
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Leaderboard profiles are public"
  ON profiles FOR SELECT
  USING (show_on_leaderboard = true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- schools: Public read, admin write
CREATE POLICY "Anyone can view schools"
  ON schools FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert schools"
  ON schools FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update schools"
  ON schools FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete schools"
  ON schools FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- programs: Public read, admin write
CREATE POLICY "Anyone can view programs"
  ON programs FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert programs"
  ON programs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update programs"
  ON programs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete programs"
  ON programs FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- program_tracks: Public read, admin write
CREATE POLICY "Anyone can view tracks"
  ON program_tracks FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert tracks"
  ON program_tracks FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tracks"
  ON program_tracks FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tracks"
  ON program_tracks FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- curriculum_versions: Public read, admin write
CREATE POLICY "Anyone can view curriculum versions"
  ON curriculum_versions FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert curriculum versions"
  ON curriculum_versions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update curriculum versions"
  ON curriculum_versions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete curriculum versions"
  ON curriculum_versions FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- courses: Public read, admin write
CREATE POLICY "Anyone can view courses"
  ON courses FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert courses"
  ON courses FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update courses"
  ON courses FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete courses"
  ON courses FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- course_equivalencies: Public read, admin write
CREATE POLICY "Anyone can view course equivalencies"
  ON course_equivalencies FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage course equivalencies"
  ON course_equivalencies FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- requirement_groups: Public read, admin write
CREATE POLICY "Anyone can view requirement groups"
  ON requirement_groups FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage requirement groups"
  ON requirement_groups FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- requirement_rules: Public read, admin write
CREATE POLICY "Anyone can view requirement rules"
  ON requirement_rules FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage requirement rules"
  ON requirement_rules FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- program_enrollments: User-owned
CREATE POLICY "Users can view own enrollments"
  ON program_enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enrollments"
  ON program_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own enrollments"
  ON program_enrollments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own enrollments"
  ON program_enrollments FOR DELETE
  USING (auth.uid() = user_id);

-- user_courses: User-owned
CREATE POLICY "Users can view own courses"
  ON user_courses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own courses"
  ON user_courses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own courses"
  ON user_courses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own courses"
  ON user_courses FOR DELETE
  USING (auth.uid() = user_id);

-- custom_programs: User-owned
CREATE POLICY "Users can view own custom programs"
  ON custom_programs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom programs"
  ON custom_programs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom programs"
  ON custom_programs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom programs"
  ON custom_programs FOR DELETE
  USING (auth.uid() = user_id);

-- custom_program_courses: Via custom_programs ownership
CREATE POLICY "Users can view own custom program courses"
  ON custom_program_courses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM custom_programs
    WHERE custom_programs.id = custom_program_courses.custom_program_id
    AND custom_programs.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own custom program courses"
  ON custom_program_courses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM custom_programs
    WHERE custom_programs.id = custom_program_courses.custom_program_id
    AND custom_programs.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own custom program courses"
  ON custom_program_courses FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM custom_programs
    WHERE custom_programs.id = custom_program_courses.custom_program_id
    AND custom_programs.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own custom program courses"
  ON custom_program_courses FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM custom_programs
    WHERE custom_programs.id = custom_program_courses.custom_program_id
    AND custom_programs.user_id = auth.uid()
  ));

-- aisis_schedules: Public read, admin write
CREATE POLICY "Anyone can view schedules"
  ON aisis_schedules FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage schedules"
  ON aisis_schedules FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- user_schedules: User-owned
CREATE POLICY "Users can view own schedules"
  ON user_schedules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedules"
  ON user_schedules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules"
  ON user_schedules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedules"
  ON user_schedules FOR DELETE
  USING (auth.uid() = user_id);

-- schedule_blocks: Via user_schedules ownership
CREATE POLICY "Users can view own schedule blocks"
  ON schedule_blocks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_schedules
    WHERE user_schedules.id = schedule_blocks.schedule_id
    AND user_schedules.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own schedule blocks"
  ON schedule_blocks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_schedules
    WHERE user_schedules.id = schedule_blocks.schedule_id
    AND user_schedules.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own schedule blocks"
  ON schedule_blocks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_schedules
    WHERE user_schedules.id = schedule_blocks.schedule_id
    AND user_schedules.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own schedule blocks"
  ON schedule_blocks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_schedules
    WHERE user_schedules.id = schedule_blocks.schedule_id
    AND user_schedules.user_id = auth.uid()
  ));

-- schedule_palette_items: Via user_schedules ownership
CREATE POLICY "Users can view own palette items"
  ON schedule_palette_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_schedules
    WHERE user_schedules.id = schedule_palette_items.schedule_id
    AND user_schedules.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own palette items"
  ON schedule_palette_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_schedules
    WHERE user_schedules.id = schedule_palette_items.schedule_id
    AND user_schedules.user_id = auth.uid()
  ));

-- schedule_share_codes: Public read (anyone with code), owner write
CREATE POLICY "Anyone can view share codes"
  ON schedule_share_codes FOR SELECT
  USING (true);

CREATE POLICY "Users can create share codes for own schedules"
  ON schedule_share_codes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_schedules
    WHERE user_schedules.id = schedule_share_codes.schedule_id
    AND user_schedules.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own share codes"
  ON schedule_share_codes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_schedules
    WHERE user_schedules.id = schedule_share_codes.schedule_id
    AND user_schedules.user_id = auth.uid()
  ));

-- chat_messages: Public read, authenticated write
CREATE POLICY "Anyone can read messages"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert messages"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own messages"
  ON chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- chat_typing_indicators: Public read, authenticated write
CREATE POLICY "Anyone can read typing indicators"
  ON chat_typing_indicators FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own typing indicator"
  ON chat_typing_indicators FOR ALL
  USING (auth.uid() = user_id);

-- chat_online_users: Public read, authenticated write
CREATE POLICY "Anyone can read online users"
  ON chat_online_users FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own online status"
  ON chat_online_users FOR ALL
  USING (auth.uid() = user_id);

-- chat_read_receipts: User-owned
CREATE POLICY "Users can view own read receipts"
  ON chat_read_receipts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own read receipts"
  ON chat_read_receipts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- scraped_* tables: User-owned
CREATE POLICY "Users can view own scraped curriculum"
  ON scraped_curriculum FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scraped curriculum"
  ON scraped_curriculum FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scraped curriculum"
  ON scraped_curriculum FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own scraped grades"
  ON scraped_my_grades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scraped grades"
  ON scraped_my_grades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scraped grades"
  ON scraped_my_grades FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own scraped program"
  ON scraped_my_program FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scraped program"
  ON scraped_my_program FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scraped program"
  ON scraped_my_program FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own scraped schedule"
  ON scraped_my_schedule FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scraped schedule"
  ON scraped_my_schedule FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scraped schedule"
  ON scraped_my_schedule FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own scraped account info"
  ON scraped_account_info FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scraped account info"
  ON scraped_account_info FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scraped account info"
  ON scraped_account_info FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own scraped hold orders"
  ON scraped_hold_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scraped hold orders"
  ON scraped_hold_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scraped hold orders"
  ON scraped_hold_orders FOR DELETE
  USING (auth.uid() = user_id);

-- import_jobs: User can view own, admin can view all
CREATE POLICY "Users can view own import jobs"
  ON import_jobs FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own import jobs"
  ON import_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import jobs"
  ON import_jobs FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete import jobs"
  ON import_jobs FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- function_logs: Admin only
CREATE POLICY "Admins can view function logs"
  ON function_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert function logs"
  ON function_logs FOR INSERT
  WITH CHECK (true);

-- admin_audit_log: Admin only
CREATE POLICY "Admins can view audit log"
  ON admin_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert audit log"
  ON admin_audit_log FOR INSERT
  WITH CHECK (true);

-- 14. Create storage bucket for chat uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat uploads
CREATE POLICY "Anyone can view chat uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-uploads');

CREATE POLICY "Authenticated users can upload chat files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-uploads' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own chat uploads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 15. Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_online_users;