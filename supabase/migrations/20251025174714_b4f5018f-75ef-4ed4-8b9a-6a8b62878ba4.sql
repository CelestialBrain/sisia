-- Add 5th School
INSERT INTO schools (code, name) 
VALUES ('GBSEALD', 'Gokongwei Brothers School of Education and Learning Design')
ON CONFLICT (code) DO NOTHING;

-- Get school IDs for program insertions
DO $$
DECLARE
  soh_id uuid;
  gbseald_id uuid;
  jgsom_id uuid;
  sose_id uuid;
  soss_id uuid;
BEGIN
  -- Get school IDs
  SELECT id INTO soh_id FROM schools WHERE code = 'SOH';
  SELECT id INTO gbseald_id FROM schools WHERE code = 'GBSEALD';
  SELECT id INTO jgsom_id FROM schools WHERE code = 'JGSOM';
  SELECT id INTO sose_id FROM schools WHERE code = 'SOSE';
  SELECT id INTO soss_id FROM schools WHERE code = 'SOSS';

  -- School of Humanities (8 programs)
  INSERT INTO programs (code, name, school_id, total_units, description) VALUES
    ('BFA AM', 'AB Art Management', soh_id, 0, NULL),
    ('BFA CW', 'BFA Major in Creative Writing', soh_id, 0, NULL),
    ('BFA ID', 'BFA Major in Information Design', soh_id, 0, NULL),
    ('BFA TA', 'BFA Major in Theater Arts', soh_id, 0, NULL),
    ('AB HUM', 'AB Humanities', soh_id, 0, NULL),
    ('AB IS', 'AB Interdisciplinary Studies', soh_id, 0, NULL),
    ('AB LIT ENG', 'AB Literature (English)', soh_id, 0, NULL),
    ('AB PH', 'AB Philosophy', soh_id, 0, NULL)
  ON CONFLICT (code) DO NOTHING;

  -- School of Education & Learning Design (1 program)
  INSERT INTO programs (code, name, school_id, total_units, description) VALUES
    ('BS LEARN', 'BS Learning Science and Design', gbseald_id, 0, NULL)
  ON CONFLICT (code) DO NOTHING;

  -- John Gokongwei School of Management (8 programs)
  INSERT INTO programs (code, name, school_id, total_units, description) VALUES
    ('BS CTM', 'BS Communications Technology Management', jgsom_id, 0, NULL),
    ('BS ITE', 'BS Information Technology Entrepreneurship', jgsom_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS LM', 'BS Legal Management', jgsom_id, 0, NULL),
    ('BS MGT', 'BS Management', jgsom_id, 0, NULL),
    ('BS MGT-H', 'BS Management (Honors)', jgsom_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS ME', 'BS Management Engineering', jgsom_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS MAC', 'BS Management of Applied Chemistry', jgsom_id, 0, NULL),
    ('BS REnt', 'BS Restaurant Entrepreneurship', jgsom_id, 0, NULL)
  ON CONFLICT (code) DO NOTHING;

  -- School of Science & Engineering (20 programs)
  INSERT INTO programs (code, name, school_id, total_units, description) VALUES
    ('BS AMDSc – M DSc', 'BS Applied Mathematics – Master in Data Science', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS/M AMF', 'BS/M Applied Mathematics (Specialization in Mathematical Finance)', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS AP-MSE', 'BS Applied Physics – BS Materials Science & Engineering', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS BIO', 'BS Biology', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS CHEM', 'BS Chemistry', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS MSE', 'BS Chemistry – BS Materials Science & Engineering', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS CpE', 'BS Computer Engineering', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS CS', 'BS Computer Science', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS CS-DGD', 'BS Computer Science – BS Digital Game Design & Development', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS ECE', 'BS Electronics Engineering', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS ES', 'BS Environmental Science', sose_id, 0, NULL),
    ('BS HS', 'BS Health Sciences', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS IDE', 'BS Innovation Design Engineering', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS LS', 'BS Life Sciences', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS MIS', 'BS Management Information Systems', sose_id, 0, NULL),
    ('BS MATH', 'BS Mathematics', sose_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('BS PHY', 'BS Physics', sose_id, 0, 'Honors Program (Top 15% of applicants)')
  ON CONFLICT (code) DO NOTHING;

  -- School of Social Sciences (15 programs)
  INSERT INTO programs (code, name, school_id, total_units, description) VALUES
    ('AB CHI', 'AB Chinese Studies', soss_id, 0, NULL),
    ('AB COM', 'AB Communication', soss_id, 0, NULL),
    ('AB DS', 'AB Development Studies', soss_id, 0, NULL),
    ('AB ECO', 'AB Economics', soss_id, 0, NULL),
    ('AB ECO-H', 'AB Economics (Honors)', soss_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('AB MEc', 'AB Management Economics', soss_id, 0, NULL),
    ('AB EU', 'AB European Studies', soss_id, 0, NULL),
    ('AB HIST', 'AB History', soss_id, 0, NULL),
    ('AB Dip IR', 'AB Diplomacy & International Relations (East & Southeast Asian Studies)', soss_id, 0, NULL),
    ('AB POS', 'AB Political Science', soss_id, 0, NULL),
    ('AB PSY', 'AB Psychology', soss_id, 0, NULL),
    ('BS PSY', 'BS Psychology', soss_id, 0, 'Honors Program (Top 15% of applicants)'),
    ('AB SOC', 'AB Sociology', soss_id, 0, NULL)
  ON CONFLICT (code) DO NOTHING;

  -- Expand course_code_patterns
  -- School of Humanities patterns
  INSERT INTO course_code_patterns (prefix, school_id, confidence) VALUES
    ('ARTAP', soh_id, 5),
    ('ARTS', soh_id, 5),
    ('ARTM', soh_id, 5),
    ('ENLIT', soh_id, 5),
    ('ENGL', soh_id, 5),
    ('FILI', soh_id, 5),
    ('HISTO', soh_id, 5),
    ('PHILO', soh_id, 5),
    ('THEO', soh_id, 5)
  ON CONFLICT (prefix) DO NOTHING;

  -- GBSEALD patterns
  INSERT INTO course_code_patterns (prefix, school_id, confidence) VALUES
    ('LEARN', gbseald_id, 5),
    ('EDUC', gbseald_id, 5)
  ON CONFLICT (prefix) DO NOTHING;

  -- JGSOM patterns (new ones)
  INSERT INTO course_code_patterns (prefix, school_id, confidence) VALUES
    ('CTM', jgsom_id, 5),
    ('ITE', jgsom_id, 5),
    ('LAS', jgsom_id, 5),
    ('LM', jgsom_id, 5),
    ('RENT', jgsom_id, 5),
    ('MAC', jgsom_id, 5)
  ON CONFLICT (prefix) DO NOTHING;

  -- SOSE patterns (new ones)
  INSERT INTO course_code_patterns (prefix, school_id, confidence) VALUES
    ('CS', sose_id, 5),
    ('CPE', sose_id, 5),
    ('ECE', sose_id, 5),
    ('AMATH', sose_id, 5),
    ('PHY', sose_id, 5),
    ('CHEM', sose_id, 5),
    ('BIO', sose_id, 5),
    ('MSE', sose_id, 5),
    ('ENGIN', sose_id, 5),
    ('IDE', sose_id, 5),
    ('HS', sose_id, 5),
    ('ES', sose_id, 5),
    ('MIS', sose_id, 5)
  ON CONFLICT (prefix) DO NOTHING;

  -- SOSS patterns (new ones)
  INSERT INTO course_code_patterns (prefix, school_id, confidence) VALUES
    ('CHI', soss_id, 5),
    ('COM', soss_id, 5),
    ('DS', soss_id, 5),
    ('ECON', soss_id, 5),
    ('ECO', soss_id, 5),
    ('EU', soss_id, 5),
    ('DIPIR', soss_id, 5),
    ('POLSC', soss_id, 5),
    ('POS', soss_id, 5),
    ('PSYCH', soss_id, 5),
    ('PSY', soss_id, 5),
    ('SOC', soss_id, 5)
  ON CONFLICT (prefix) DO NOTHING;

  -- Common/Core patterns (shared across schools)
  INSERT INTO course_code_patterns (prefix, school_id, confidence) VALUES
    ('NATSCI', sose_id, 3),
    ('PATHFIT', sose_id, 3),
    ('SOCSCI', soss_id, 3),
    ('INTACT', soh_id, 3),
    ('NSTP', sose_id, 3),
    ('FLC', soh_id, 3),
    ('IE', soh_id, 3),
    ('DLQ', soh_id, 3),
    ('STS', sose_id, 3),
    ('FREE', soh_id, 3)
  ON CONFLICT (prefix) DO NOTHING;

END $$;
