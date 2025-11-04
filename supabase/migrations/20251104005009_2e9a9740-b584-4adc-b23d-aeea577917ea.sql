-- Create table for student's enrolled schedule
CREATE TABLE IF NOT EXISTS public.scraped_my_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  import_job_id uuid REFERENCES public.import_jobs(id),
  term varchar(50),
  course_code varchar(50),
  section varchar(50),
  course_title text,
  units numeric(3,1),
  schedule text,
  room varchar(100),
  instructor text,
  enrollment_status varchar(50),
  raw_html text,
  created_at timestamptz DEFAULT now()
);

-- Create table for student's program progress
CREATE TABLE IF NOT EXISTS public.scraped_my_program (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  import_job_id uuid REFERENCES public.import_jobs(id),
  course_code varchar(50),
  course_title text,
  units numeric(3,1),
  year_level int,
  semester varchar(20),
  category varchar(100),
  status varchar(50),
  grade varchar(10),
  term_taken varchar(50),
  raw_html text,
  created_at timestamptz DEFAULT now()
);

-- Create table for student's grades
CREATE TABLE IF NOT EXISTS public.scraped_my_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  import_job_id uuid REFERENCES public.import_jobs(id),
  term varchar(50),
  course_code varchar(50),
  course_title text,
  units numeric(3,1),
  grade varchar(10),
  grade_points numeric(4,2),
  remarks text,
  instructor text,
  raw_html text,
  created_at timestamptz DEFAULT now()
);

-- Create table for hold orders
CREATE TABLE IF NOT EXISTS public.scraped_hold_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  import_job_id uuid REFERENCES public.import_jobs(id),
  hold_type varchar(100),
  reason text,
  date_imposed date,
  office varchar(100),
  status varchar(50),
  action_required text,
  raw_html text,
  created_at timestamptz DEFAULT now()
);

-- Create table for account info
CREATE TABLE IF NOT EXISTS public.scraped_account_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  import_job_id uuid REFERENCES public.import_jobs(id),
  student_id varchar(50),
  full_name varchar(200),
  program varchar(200),
  year_level int,
  email varchar(200),
  mobile varchar(50),
  address text,
  raw_html text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scraped_my_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_my_program ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_my_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_hold_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_account_info ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own schedule data"
  ON public.scraped_my_schedule
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own program data"
  ON public.scraped_my_program
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own grades data"
  ON public.scraped_my_grades
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own hold orders"
  ON public.scraped_hold_orders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own account info"
  ON public.scraped_account_info
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
