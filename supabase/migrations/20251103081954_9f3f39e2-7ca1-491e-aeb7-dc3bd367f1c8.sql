-- Enable realtime for user_schedules table
ALTER TABLE public.user_schedules REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_schedules;

-- Enable realtime for schedule_blocks table
ALTER TABLE public.schedule_blocks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_blocks;
