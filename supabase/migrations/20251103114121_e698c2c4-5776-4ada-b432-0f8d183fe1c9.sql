-- Add font customization columns to schedule_blocks table
ALTER TABLE schedule_blocks 
ADD COLUMN IF NOT EXISTS font_color TEXT DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS font_size TEXT DEFAULT 'text-xs',
ADD COLUMN IF NOT EXISTS text_align TEXT DEFAULT 'left';
