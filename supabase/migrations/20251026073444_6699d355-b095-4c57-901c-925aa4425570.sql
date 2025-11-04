-- Add indexes for performance optimization on requirement tracking queries

-- Index for faster requirement_rules lookup by group
CREATE INDEX IF NOT EXISTS idx_requirement_rules_group_id 
ON requirement_rules(req_group_id);

-- Index for faster course lookup by category tags (GIN index for array matching)
CREATE INDEX IF NOT EXISTS idx_courses_category_tags 
ON courses USING GIN(category_tags);

-- Index for faster course code prefix matching (text pattern ops)
CREATE INDEX IF NOT EXISTS idx_courses_code_prefix 
ON courses(course_code text_pattern_ops);
