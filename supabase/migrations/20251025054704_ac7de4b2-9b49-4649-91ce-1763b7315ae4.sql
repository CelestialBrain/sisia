-- Create app role enum
CREATE TYPE app_role AS ENUM ('admin', 'user');

-- User roles table
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

-- User profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  student_number text,
  entry_year text,
  show_on_leaderboard boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Programs (all Ateneo degree programs)
CREATE TABLE programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  school text NOT NULL,
  total_units integer NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Program courses (required courses for each program)
CREATE TABLE program_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES programs(id) ON DELETE CASCADE,
  course_code text NOT NULL,
  course_title text NOT NULL,
  units integer NOT NULL,
  category text NOT NULL,
  year_level integer,
  semester text,
  prerequisites text[],
  created_at timestamptz DEFAULT now()
);

-- Elective pools (groups of electives)
CREATE TABLE elective_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  required_units integer NOT NULL,
  course_codes text[],
  created_at timestamptz DEFAULT now()
);

-- User programs (what program(s) a user is enrolled in)
CREATE TABLE user_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  program_id uuid REFERENCES programs(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT true,
  entry_year text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, program_id)
);

-- User courses (grades entered by users)
CREATE TABLE user_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  school_year text NOT NULL,
  semester text NOT NULL,
  course_code text NOT NULL,
  course_title text NOT NULL,
  units integer NOT NULL,
  grade text NOT NULL,
  qpi_value numeric(3,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Custom programs (user-created programs)
CREATE TABLE custom_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  total_units integer,
  created_at timestamptz DEFAULT now()
);

-- Custom program courses
CREATE TABLE custom_program_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_program_id uuid REFERENCES custom_programs(id) ON DELETE CASCADE,
  course_code text NOT NULL,
  course_title text NOT NULL,
  units integer NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_courses_updated_at
  BEFORE UPDATE ON user_courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE elective_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_program_courses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Only admins can insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Leaderboard profiles are public"
  ON profiles FOR SELECT
  TO authenticated
  USING (show_on_leaderboard = true);

-- RLS Policies for programs (public read, admin write)
CREATE POLICY "Programs are viewable by everyone"
  ON programs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert programs"
  ON programs FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update programs"
  ON programs FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete programs"
  ON programs FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for program_courses
CREATE POLICY "Program courses are viewable by everyone"
  ON program_courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert program courses"
  ON program_courses FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update program courses"
  ON program_courses FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete program courses"
  ON program_courses FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for elective_pools
CREATE POLICY "Elective pools are viewable by everyone"
  ON elective_pools FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert elective pools"
  ON elective_pools FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update elective pools"
  ON elective_pools FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete elective pools"
  ON elective_pools FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for user_programs
CREATE POLICY "Users can view their own programs"
  ON user_programs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own programs"
  ON user_programs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own programs"
  ON user_programs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own programs"
  ON user_programs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_courses
CREATE POLICY "Users can view their own courses"
  ON user_courses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own courses"
  ON user_courses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own courses"
  ON user_courses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own courses"
  ON user_courses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for custom_programs
CREATE POLICY "Users can view their own custom programs"
  ON custom_programs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom programs"
  ON custom_programs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom programs"
  ON custom_programs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom programs"
  ON custom_programs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for custom_program_courses
CREATE POLICY "Users can view their own custom program courses"
  ON custom_program_courses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM custom_programs
      WHERE id = custom_program_courses.custom_program_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own custom program courses"
  ON custom_program_courses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM custom_programs
      WHERE id = custom_program_courses.custom_program_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own custom program courses"
  ON custom_program_courses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM custom_programs
      WHERE id = custom_program_courses.custom_program_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own custom program courses"
  ON custom_program_courses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM custom_programs
      WHERE id = custom_program_courses.custom_program_id
      AND user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_courses_user_id ON user_courses(user_id);
CREATE INDEX idx_user_courses_school_year ON user_courses(school_year);
CREATE INDEX idx_user_programs_user_id ON user_programs(user_id);
CREATE INDEX idx_program_courses_program_id ON program_courses(program_id);
CREATE INDEX idx_elective_pools_program_id ON elective_pools(program_id);
CREATE INDEX idx_profiles_leaderboard ON profiles(show_on_leaderboard) WHERE show_on_leaderboard = true;
