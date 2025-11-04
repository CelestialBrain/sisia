-- Update existing "Summer" semester records to "Intercession" in user_courses
UPDATE user_courses 
SET semester = 'Intercession' 
WHERE semester = 'Summer';

-- Update existing "Summer" semester records to "Intercession" in program_courses
UPDATE program_courses 
SET semester = 'Intercession' 
WHERE semester = 'Summer';
