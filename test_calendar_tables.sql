-- Check if calendar_events table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'calendar_events'
);

-- Check if calendar_connections table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'calendar_connections'
);

-- Check RLS policies for calendar_events
SELECT tablename, policyname, permissive, cmd, qualifier, "check"
FROM pg_policies
WHERE tablename = 'calendar_events';

-- Check RLS policies for calendar_connections
SELECT tablename, policyname, permissive, cmd, qualifier, "check"
FROM pg_policies
WHERE tablename = 'calendar_connections';

-- Check if RLS is enabled for calendar_events
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'calendar_events' 
AND relkind = 'r';

-- Count events in calendar_events
SELECT COUNT(*) FROM calendar_events; 