-- Enable realtime for umbrellas table and ensure full row data on updates
ALTER TABLE public.umbrellas REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.umbrellas;
