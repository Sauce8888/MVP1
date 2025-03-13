-- Diagnostic script for calendar_events issues

-- 1. Verify table exists and its structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'calendar_events'
ORDER BY ordinal_position;

-- 2. Check if RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'calendar_events' 
AND relkind = 'r';

-- 3. Check policies with correctly quoted "check" column
SELECT tablename, policyname, permissive, cmd, qualifier, "check"
FROM pg_policies
WHERE tablename = 'calendar_events';

-- 4. Test the auth context
SELECT auth.uid() AS current_user_id;

-- 5. Check if current user has properties
SELECT COUNT(*) AS property_count
FROM properties
WHERE host_id = auth.uid();

-- 6. List properties available to current user
SELECT id, name, host_id
FROM properties
WHERE host_id = auth.uid();

-- 7. Verify if there are any events in the table
SELECT COUNT(*) AS event_count
FROM calendar_events;

-- 8. View your current events (if any)
SELECT 
    calendar_events.id,
    properties.name AS property_name,
    calendar_events.source,
    calendar_events.summary,
    calendar_events.start_date,
    calendar_events.end_date,
    calendar_events.created_at
FROM 
    calendar_events
    JOIN properties ON calendar_events.property_id = properties.id
WHERE 
    properties.host_id = auth.uid()
ORDER BY 
    calendar_events.created_at DESC
LIMIT 10;

-- 9. Check if there are any constraints that might be failing
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM
    pg_constraint
WHERE
    conrelid = 'calendar_events'::regclass;

-- 10. Explain the insert policy to see how it's evaluated
EXPLAIN (VERBOSE, FORMAT JSON)
SELECT 1
FROM properties
WHERE host_id = auth.uid() AND id = '[REPLACE_WITH_YOUR_PROPERTY_ID]'::uuid; 